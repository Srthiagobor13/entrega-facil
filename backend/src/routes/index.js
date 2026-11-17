import { Router } from 'express';
import { autenticar } from '../middleware/auth.js';
import { criarUsuarioModel } from '../models/usuarioModel.js';
import { criarRestauranteModel } from '../models/restauranteModel.js';
import { criarProdutoModel } from '../models/produtoModel.js';
import { criarPedidoModel } from '../models/pedidoModel.js';
import { criarAuthController } from '../controllers/authController.js';
import { criarCardapioController } from '../controllers/cardapioController.js';
import { criarPedidoController } from '../controllers/pedidoController.js';

// Router: liga cada rota HTTP ao controller responsável (monta as dependências Model -> Controller).
export function criarRotas(db) {
  const models = {
    usuarios: criarUsuarioModel(db),
    restaurantes: criarRestauranteModel(db),
    produtos: criarProdutoModel(db),
    pedidos: criarPedidoModel(db),
  };
  const auth = criarAuthController(models);
  const cardapio = criarCardapioController(models);
  const pedido = criarPedidoController(models);

  const r = Router();
  r.get('/saude', (_req, res) => res.json({ ok: true }));

  r.post('/auth/register', auth.registrar);
  r.post('/auth/login', auth.entrar);

  r.get('/restaurantes', cardapio.listarRestaurantes);
  r.get('/restaurantes/:id/produtos', cardapio.listarProdutos);
  r.post('/produtos', autenticar('restaurante'), cardapio.criarProduto);
  r.delete('/produtos/:id', autenticar('restaurante'), cardapio.removerProduto);

  r.post('/pedidos', autenticar('cliente'), pedido.criar);
  r.get('/pedidos', autenticar(), pedido.listar);
  r.patch('/pedidos/:id/status', autenticar(), pedido.atualizarStatus);
  return r;
}
