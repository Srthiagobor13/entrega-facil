import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularItem } from './pricing.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-trocar-em-producao';
const PAPEIS = ['cliente', 'restaurante', 'entregador'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Transições de status permitidas por papel: [statusAtual] -> [novoStatus]
const TRANSICOES = {
  restaurante: { recebido: ['preparando', 'cancelado'], preparando: ['pronto'] },
  entregador: { pronto: ['a_caminho'], a_caminho: ['entregue'] },
  cliente: { recebido: ['cancelado'] },
};

export function createApp(db) {
  const app = express();
  app.use(express.json());

  const erro = (res, code, msg) => res.status(code).json({ erro: msg });

  const auth = (...papeis) => (req, res, next) => {
    try {
      req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    } catch {
      return erro(res, 401, 'Não autenticado');
    }
    if (papeis.length && !papeis.includes(req.user.papel)) return erro(res, 403, 'Sem permissão');
    next();
  };

  const token = (u, restauranteId = null) =>
    jwt.sign({ id: u.id, nome: u.nome, papel: u.papel, restaurante_id: restauranteId }, SECRET, { expiresIn: '12h' });

  const restauranteDoUsuario = (uid) =>
    db.prepare('SELECT id FROM restaurantes WHERE usuario_id = ?').get(uid)?.id ?? null;

  // ---------- Autenticação ----------
  app.post('/api/auth/register', (req, res) => {
    const { nome, email, senha, papel, nome_restaurante, categoria } = req.body || {};
    if (!nome || !email || !senha || !PAPEIS.includes(papel)) return erro(res, 400, 'Dados inválidos');
    if (String(senha).length < 6) return erro(res, 400, 'Senha deve ter ao menos 6 caracteres');
    if (papel === 'restaurante' && !nome_restaurante) return erro(res, 400, 'Informe o nome do restaurante');
    if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) return erro(res, 409, 'E-mail já cadastrado');

    const r = db
      .prepare('INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,?)')
      .run(nome, email, bcrypt.hashSync(String(senha), 8), papel);
    const user = { id: Number(r.lastInsertRowid), nome, papel };
    let restId = null;
    if (papel === 'restaurante') {
      restId = Number(
        db
          .prepare('INSERT INTO restaurantes (usuario_id,nome,categoria) VALUES (?,?,?)')
          .run(user.id, nome_restaurante, categoria || 'Variada').lastInsertRowid,
      );
    }
    res.status(201).json({ token: token(user, restId), usuario: { ...user, restaurante_id: restId } });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body || {};
    const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email || '');
    if (!u || !bcrypt.compareSync(String(senha || ''), u.senha_hash)) return erro(res, 401, 'E-mail ou senha inválidos');
    const restId = restauranteDoUsuario(u.id);
    res.json({ token: token(u, restId), usuario: { id: u.id, nome: u.nome, papel: u.papel, restaurante_id: restId } });
  });

  // ---------- Restaurantes e cardápio ----------
  app.get('/api/restaurantes', (_req, res) => {
    res.json(
      db
        .prepare(
          `SELECT id, nome, categoria, descricao, imagem, taxa_entrega, pedido_minimo, tempo_min, tempo_max
           FROM restaurantes ORDER BY CASE WHEN nome = 'Burger House' THEN 0 ELSE 1 END, nome`,
        )
        .all(),
    );
  });

  app.get('/api/restaurantes/:id/produtos', (req, res) => {
    const produtos = db
      .prepare(
        `SELECT id, categoria, nome, descricao, preco, imagem, destaque FROM produtos
         WHERE restaurante_id = ? AND ativo = 1 ORDER BY id`,
      )
      .all(Number(req.params.id));
    const ops = db.prepare('SELECT id, grupo, tipo, nome, preco, base, min, max FROM opcoes WHERE produto_id = ? ORDER BY id');
    res.json(produtos.map((p) => ({ ...p, opcoes: ops.all(p.id) })));
  });

  app.post('/api/produtos', auth('restaurante'), (req, res) => {
    const { nome, descricao, preco, categoria } = req.body || {};
    const p = Number(preco);
    if (!nome || !Number.isFinite(p) || p < 0) return erro(res, 400, 'Nome e preço válidos são obrigatórios');
    const restId = restauranteDoUsuario(req.user.id);
    const cat = String(categoria || 'Outros').trim() || 'Outros';
    const r = db
      .prepare('INSERT INTO produtos (restaurante_id,categoria,nome,descricao,preco) VALUES (?,?,?,?,?)')
      .run(restId, cat, nome, descricao || '', p);
    res.status(201).json({ id: Number(r.lastInsertRowid), categoria: cat, nome, descricao: descricao || '', preco: p, opcoes: [] });
  });

  app.delete('/api/produtos/:id', auth('restaurante'), (req, res) => {
    const restId = restauranteDoUsuario(req.user.id);
    const r = db
      .prepare('UPDATE produtos SET ativo = 0 WHERE id = ? AND restaurante_id = ?')
      .run(Number(req.params.id), restId);
    if (!r.changes) return erro(res, 404, 'Produto não encontrado');
    res.json({ ok: true });
  });

  // ---------- Pedidos ----------
  app.post('/api/pedidos', auth('cliente'), (req, res) => {
    const { restaurante_id, itens, endereco, pagamento, troco_para } = req.body || {};
    if (!endereco || !String(endereco).trim()) return erro(res, 400, 'Informe o endereço de entrega');
    if (!Array.isArray(itens) || !itens.length) return erro(res, 400, 'Carrinho vazio');
    const pag = pagamento || 'pix';
    if (!['pix', 'cartao', 'dinheiro'].includes(pag)) return erro(res, 400, 'Forma de pagamento inválida');
    const rest = db.prepare('SELECT * FROM restaurantes WHERE id = ?').get(Number(restaurante_id));
    if (!rest) return erro(res, 404, 'Restaurante não encontrado');

    let subtotal = 0;
    const linhas = [];
    for (const it of itens) {
      const qtd = Number(it.quantidade);
      const prod = db
        .prepare('SELECT * FROM produtos WHERE id = ? AND restaurante_id = ? AND ativo = 1')
        .get(Number(it.produto_id), rest.id);
      if (!prod || !Number.isInteger(qtd) || qtd < 1 || qtd > 50) return erro(res, 400, 'Item inválido no carrinho');
      const ops = db.prepare('SELECT * FROM opcoes WHERE produto_id = ?').all(prod.id);
      let calc;
      try {
        calc = calcularItem(ops, prod.preco, it.selecao);
      } catch (e) {
        return erro(res, 400, e.message);
      }
      subtotal += calc.unit * qtd;
      linhas.push({ prod, qtd, calc, obs: String(it.observacao || '').slice(0, 200) });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    if (subtotal < rest.pedido_minimo) return erro(res, 400, `Pedido mínimo de R$ ${rest.pedido_minimo.toFixed(2).replace('.', ',')}`);
    const taxa = rest.taxa_entrega;
    const total = Math.round((subtotal + taxa) * 100) / 100;
    const troco = pag === 'dinheiro' && Number(troco_para) > total ? Number(troco_para) : null;

    db.exec('BEGIN');
    try {
      const pid = Number(
        db
          .prepare('INSERT INTO pedidos (cliente_id,restaurante_id,endereco,subtotal,taxa,total,pagamento,troco_para) VALUES (?,?,?,?,?,?,?,?)')
          .run(req.user.id, rest.id, String(endereco).trim(), subtotal, taxa, total, pag, troco).lastInsertRowid,
      );
      const ins = db.prepare('INSERT INTO itens_pedido (pedido_id,produto_id,nome,preco,quantidade,detalhes,observacao) VALUES (?,?,?,?,?,?,?)');
      for (const { prod, qtd, calc, obs } of linhas) ins.run(pid, prod.id, prod.nome, calc.unit, qtd, JSON.stringify(calc.detalhes), obs);
      db.exec('COMMIT');
      res.status(201).json({ id: pid, subtotal, taxa, total, status: 'recebido' });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  });

  app.get('/api/pedidos', auth(), (req, res) => {
    const { papel, id } = req.user;
    let where = '';
    let params = [];
    if (papel === 'cliente') { where = 'p.cliente_id = ?'; params = [id]; }
    else if (papel === 'restaurante') { where = 'p.restaurante_id = ?'; params = [restauranteDoUsuario(id)]; }
    else { where = "(p.status = 'pronto' OR p.entregador_id = ?)"; params = [id]; }

    const pedidos = db
      .prepare(
        `SELECT p.*, r.nome AS restaurante, c.nome AS cliente
         FROM pedidos p
         JOIN restaurantes r ON r.id = p.restaurante_id
         JOIN usuarios c ON c.id = p.cliente_id
         WHERE ${where} ORDER BY p.id DESC LIMIT 100`,
      )
      .all(...params);
    const itensStmt = db.prepare('SELECT nome, preco, quantidade, detalhes, observacao FROM itens_pedido WHERE pedido_id = ?');
    res.json(
      pedidos.map((p) => ({
        ...p,
        itens: itensStmt.all(p.id).map((i) => ({ ...i, detalhes: JSON.parse(i.detalhes) })),
      })),
    );
  });

  app.patch('/api/pedidos/:id/status', auth(), (req, res) => {
    const { status } = req.body || {};
    const { papel, id } = req.user;
    const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(Number(req.params.id));
    if (!p) return erro(res, 404, 'Pedido não encontrado');

    if (papel === 'cliente' && p.cliente_id !== id) return erro(res, 403, 'Sem permissão');
    if (papel === 'restaurante' && p.restaurante_id !== restauranteDoUsuario(id)) return erro(res, 403, 'Sem permissão');
    if (papel === 'entregador' && p.status !== 'pronto' && p.entregador_id !== id) return erro(res, 403, 'Sem permissão');

    if (!(TRANSICOES[papel]?.[p.status] || []).includes(status))
      return erro(res, 400, `Transição inválida: ${p.status} -> ${status}`);

    if (papel === 'entregador' && status === 'a_caminho') {
      // Evita dois entregadores aceitarem o mesmo pedido
      const r = db
        .prepare("UPDATE pedidos SET status = 'a_caminho', entregador_id = ? WHERE id = ? AND status = 'pronto'")
        .run(id, p.id);
      if (!r.changes) return erro(res, 409, 'Pedido já foi aceito por outro entregador');
    } else {
      db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, p.id);
    }
    res.json({ id: p.id, status });
  });

  app.get('/api/saude', (_req, res) => res.json({ ok: true }));

  // ---------- Front-end (PWA) ----------
  app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));
  app.use('/api', (_req, res) => erro(res, 404, 'Rota não encontrada'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    erro(res, 500, 'Erro interno');
  });

  return app;
}
