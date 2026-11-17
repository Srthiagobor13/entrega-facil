import { PAGAMENTOS, TRANSICOES, LIMITES } from '../config.js';
import { HttpError } from '../middleware/erros.js';
import { texto } from '../middleware/validacao.js';
import { calcularItem } from '../services/precificacao.js';

const arredonda = (v) => Math.round(v * 100) / 100;
const dinheiro = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const objetoSimples = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Controller: criação, listagem e andamento dos pedidos.
export const criarPedidoController = ({ pedidos, produtos, restaurantes }) => ({
  criar(req, res) {
    const corpo = req.body || {};
    const endereco = texto(corpo.endereco, 'o endereço de entrega', { min: 5, max: LIMITES.endereco });
    if (!Array.isArray(corpo.itens) || !corpo.itens.length) throw new HttpError(400, 'Carrinho vazio');
    if (corpo.itens.length > 40) throw new HttpError(400, 'Itens demais no pedido');
    const pag = corpo.pagamento === undefined ? 'pix' : corpo.pagamento;
    if (!PAGAMENTOS.includes(pag)) throw new HttpError(400, 'Forma de pagamento inválida');
    const rest = restaurantes.buscarPorId(Number(corpo.restaurante_id));
    if (!rest) throw new HttpError(404, 'Restaurante não encontrado');

    let subtotal = 0;
    const linhas = [];
    for (const it of corpo.itens) {
      if (!objetoSimples(it)) throw new HttpError(400, 'Item inválido no carrinho');
      const qtd = it.quantidade;
      if (typeof qtd !== 'number' || !Number.isInteger(qtd) || qtd < 1 || qtd > 50) throw new HttpError(400, 'Quantidade inválida no carrinho');
      if (it.selecao !== undefined && it.selecao !== null && !objetoSimples(it.selecao)) throw new HttpError(400, 'Personalização inválida');
      if (it.observacao !== undefined && it.observacao !== null && typeof it.observacao !== 'string') throw new HttpError(400, 'Observação inválida');
      const prod = produtos.buscarAtivo(Number(it.produto_id), rest.id);
      if (!prod) throw new HttpError(400, 'Item inválido no carrinho');
      let calc;
      try {
        calc = calcularItem(produtos.opcoesDe(prod.id), prod.preco, it.selecao || {});
      } catch (e) {
        throw new HttpError(400, e.message);
      }
      subtotal += calc.unit * qtd;
      linhas.push({ produtoId: prod.id, nome: prod.nome, unit: calc.unit, qtd, detalhes: calc.detalhes, obs: (it.observacao || '').slice(0, LIMITES.observacao) });
    }
    subtotal = arredonda(subtotal);
    if (subtotal < rest.pedido_minimo) throw new HttpError(400, `Pedido mínimo de ${dinheiro(rest.pedido_minimo)}`);
    const taxa = rest.taxa_entrega;
    const total = arredonda(subtotal + taxa);

    // Troco: se informado, precisa cobrir o total. Igual ao total significa "sem troco".
    let troco = null;
    if (pag === 'dinheiro' && corpo.troco_para !== undefined && corpo.troco_para !== null && corpo.troco_para !== '') {
      const t = Number(corpo.troco_para);
      if (typeof corpo.troco_para === 'boolean' || !Number.isFinite(t)) throw new HttpError(400, 'Valor do troco inválido');
      if (t < total) throw new HttpError(400, `O valor para troco deve ser maior ou igual ao total (${dinheiro(total)})`);
      troco = t > total ? arredonda(t) : null;
    }

    const id = pedidos.criar({ clienteId: req.user.id, restauranteId: rest.id, endereco, subtotal, taxa, total, pagamento: pag, troco, linhas });
    res.status(201).json({ id, subtotal, taxa, total, status: 'recebido' });
  },

  listar(req, res) {
    const { papel, id } = req.user;
    res.json(pedidos.listarPara({ papel, usuarioId: id, restauranteId: papel === 'restaurante' ? restaurantes.idDoUsuario(id) : null }));
  },

  atualizarStatus(req, res) {
    const { status } = req.body || {};
    if (typeof status !== 'string' || !status) throw new HttpError(400, 'Informe o status');
    const { papel, id } = req.user;
    const p = pedidos.buscarPorId(Number(req.params.id));
    if (!p) throw new HttpError(404, 'Pedido não encontrado');

    if (papel === 'cliente' && p.cliente_id !== id) throw new HttpError(403, 'Sem permissão');
    if (papel === 'restaurante' && p.restaurante_id !== restaurantes.idDoUsuario(id)) throw new HttpError(403, 'Sem permissão');
    if (papel === 'entregador') {
      // Quem chega depois que outro entregador já aceitou recebe 409 (conflito), não 403
      if (status === 'a_caminho' && p.entregador_id && p.entregador_id !== id) throw new HttpError(409, 'Pedido já foi aceito por outro entregador');
      if (p.status !== 'pronto' && p.entregador_id !== id) throw new HttpError(403, 'Sem permissão');
    }

    if (!(TRANSICOES[papel]?.[p.status] || []).includes(status)) throw new HttpError(400, `Transição inválida: ${p.status} -> ${status}`);

    if (papel === 'entregador' && status === 'a_caminho') {
      if (!pedidos.aceitarEntrega(p.id, id)) throw new HttpError(409, 'Pedido já foi aceito por outro entregador');
    } else {
      pedidos.atualizarStatus(p.id, status);
    }
    res.json({ id: p.id, status });
  },
});
