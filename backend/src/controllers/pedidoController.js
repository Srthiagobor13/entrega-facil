import { PAGAMENTOS, TRANSICOES } from '../config.js';
import { HttpError } from '../middleware/erros.js';
import { calcularItem } from '../services/precificacao.js';

const arredonda = (v) => Math.round(v * 100) / 100;
const dinheiro = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// Controller: criação, listagem e andamento dos pedidos.
export const criarPedidoController = ({ pedidos, produtos, restaurantes }) => ({
  criar(req, res) {
    const { restaurante_id, itens, endereco, pagamento, troco_para } = req.body || {};
    if (!endereco || !String(endereco).trim()) throw new HttpError(400, 'Informe o endereço de entrega');
    if (!Array.isArray(itens) || !itens.length) throw new HttpError(400, 'Carrinho vazio');
    const pag = pagamento || 'pix';
    if (!PAGAMENTOS.includes(pag)) throw new HttpError(400, 'Forma de pagamento inválida');
    const rest = restaurantes.buscarPorId(Number(restaurante_id));
    if (!rest) throw new HttpError(404, 'Restaurante não encontrado');

    let subtotal = 0;
    const linhas = [];
    for (const it of itens) {
      const qtd = Number(it.quantidade);
      const prod = produtos.buscarAtivo(Number(it.produto_id), rest.id);
      if (!prod || !Number.isInteger(qtd) || qtd < 1 || qtd > 50) throw new HttpError(400, 'Item inválido no carrinho');
      let calc;
      try {
        calc = calcularItem(produtos.opcoesDe(prod.id), prod.preco, it.selecao);
      } catch (e) {
        throw new HttpError(400, e.message);
      }
      subtotal += calc.unit * qtd;
      linhas.push({ produtoId: prod.id, nome: prod.nome, unit: calc.unit, qtd, detalhes: calc.detalhes, obs: String(it.observacao || '').slice(0, 200) });
    }
    subtotal = arredonda(subtotal);
    if (subtotal < rest.pedido_minimo) throw new HttpError(400, `Pedido mínimo de ${dinheiro(rest.pedido_minimo)}`);
    const taxa = rest.taxa_entrega;
    const total = arredonda(subtotal + taxa);
    const troco = pag === 'dinheiro' && Number(troco_para) > total ? Number(troco_para) : null;

    const id = pedidos.criar({
      clienteId: req.user.id, restauranteId: rest.id, endereco: String(endereco).trim(), subtotal, taxa, total, pagamento: pag, troco, linhas,
    });
    res.status(201).json({ id, subtotal, taxa, total, status: 'recebido' });
  },

  listar(req, res) {
    const { papel, id } = req.user;
    res.json(pedidos.listarPara({ papel, usuarioId: id, restauranteId: papel === 'restaurante' ? restaurantes.idDoUsuario(id) : null }));
  },

  atualizarStatus(req, res) {
    const { status } = req.body || {};
    const { papel, id } = req.user;
    const p = pedidos.buscarPorId(Number(req.params.id));
    if (!p) throw new HttpError(404, 'Pedido não encontrado');

    if (papel === 'cliente' && p.cliente_id !== id) throw new HttpError(403, 'Sem permissão');
    if (papel === 'restaurante' && p.restaurante_id !== restaurantes.idDoUsuario(id)) throw new HttpError(403, 'Sem permissão');
    if (papel === 'entregador' && p.status !== 'pronto' && p.entregador_id !== id) throw new HttpError(403, 'Sem permissão');

    if (!(TRANSICOES[papel]?.[p.status] || []).includes(status)) throw new HttpError(400, `Transição inválida: ${p.status} -> ${status}`);

    if (papel === 'entregador' && status === 'a_caminho') {
      if (!pedidos.aceitarEntrega(p.id, id)) throw new HttpError(409, 'Pedido já foi aceito por outro entregador');
    } else {
      pedidos.atualizarStatus(p.id, status);
    }
    res.json({ id: p.id, status });
  },
});
