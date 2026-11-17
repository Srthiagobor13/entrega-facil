import { HttpError } from '../middleware/erros.js';

// Controller: restaurantes, cardápio e gestão de produtos.
export const criarCardapioController = ({ restaurantes, produtos }) => ({
  listarRestaurantes: (_req, res) => res.json(restaurantes.listar()),

  listarProdutos: (req, res) => res.json(produtos.listarPorRestaurante(Number(req.params.id))),

  criarProduto(req, res) {
    const { nome, descricao, preco, categoria } = req.body || {};
    const valor = Number(preco);
    if (!nome || !Number.isFinite(valor) || valor < 0) throw new HttpError(400, 'Nome e preço válidos são obrigatórios');
    const restauranteId = restaurantes.idDoUsuario(req.user.id);
    const criado = produtos.criar({
      restauranteId,
      categoria: String(categoria || 'Outros').trim() || 'Outros',
      nome: String(nome).trim(),
      descricao: String(descricao || '').trim(),
      preco: valor,
    });
    res.status(201).json(criado);
  },

  removerProduto(req, res) {
    const restauranteId = restaurantes.idDoUsuario(req.user.id);
    if (!produtos.desativar(Number(req.params.id), restauranteId)) throw new HttpError(404, 'Produto não encontrado');
    res.json({ ok: true });
  },
});
