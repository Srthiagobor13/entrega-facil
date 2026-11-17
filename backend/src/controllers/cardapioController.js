import { HttpError } from '../middleware/erros.js';
import { LIMITES } from '../config.js';
import { texto, numero } from '../middleware/validacao.js';

// Controller: restaurantes, cardápio e gestão de produtos.
export const criarCardapioController = ({ restaurantes, produtos }) => ({
  listarRestaurantes: (_req, res) => res.json(restaurantes.listar()),

  listarProdutos(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !restaurantes.buscarPorId(id)) throw new HttpError(404, 'Restaurante não encontrado');
    res.json(produtos.listarPorRestaurante(id));
  },

  criarProduto(req, res) {
    const corpo = req.body || {};
    const nome = texto(corpo.nome, 'o nome do produto', { max: LIMITES.nome });
    const preco = numero(corpo.preco, 'Preço');
    if (preco <= 0 || preco > 9999) throw new HttpError(400, 'O preço deve ser maior que zero e até R$ 9.999,00');
    const categoria = texto(corpo.categoria, 'a categoria', { max: LIMITES.categoria, obrigatorio: false }) || 'Outros';
    const descricao = texto(corpo.descricao, 'a descrição', { max: LIMITES.descricao, obrigatorio: false });
    const restauranteId = restaurantes.idDoUsuario(req.user.id);
    res.status(201).json(produtos.criar({ restauranteId, categoria, nome, descricao, preco: Math.round(preco * 100) / 100 }));
  },

  removerProduto(req, res) {
    const restauranteId = restaurantes.idDoUsuario(req.user.id);
    if (!produtos.desativar(Number(req.params.id), restauranteId)) throw new HttpError(404, 'Produto não encontrado');
    res.json({ ok: true });
  },
});
