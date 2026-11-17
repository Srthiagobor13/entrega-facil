import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, seed } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base;
const db = openDb(':memory:');
seed(db);

test.before(async () => {
  await new Promise((ok) => { server = createApp(db).listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, path, body, token) {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const login = async (email) => (await call('POST', '/api/auth/login', { email, senha: '123456' })).data.token;

test('login inválido retorna 401', async () => {
  const r = await call('POST', '/api/auth/login', { email: 'cliente@demo.com', senha: 'errada' });
  assert.equal(r.status, 401);
});

test('cadastro de cliente e e-mail duplicado', async () => {
  const dados = { nome: 'Ana', email: 'ana@teste.com', senha: '123456', papel: 'cliente' };
  assert.equal((await call('POST', '/api/auth/register', dados)).status, 201);
  assert.equal((await call('POST', '/api/auth/register', dados)).status, 409);
});

test('lista restaurantes e cardápio sem login', async () => {
  const rs = await call('GET', '/api/restaurantes');
  assert.ok(rs.data.length >= 2);
  const ps = await call('GET', `/api/restaurantes/${rs.data[0].id}/produtos`);
  assert.ok(ps.data.length >= 1);
});

test('fluxo completo: pedido -> preparo -> entrega', async () => {
  const cli = await login('cliente@demo.com');
  const rest = await login('burger@demo.com');
  const ent = await login('entregador@demo.com');

  const rs = (await call('GET', '/api/restaurantes')).data.find((r) => r.nome === 'Burger House');
  const prods = (await call('GET', `/api/restaurantes/${rs.id}/produtos`)).data;
  const p = await call('POST', '/api/pedidos', {
    restaurante_id: rs.id,
    endereco: 'Rua A, 10',
    itens: [{ produto_id: prods[0].id, quantidade: 2 }],
  }, cli);
  assert.equal(p.status, 201);
  assert.equal(p.data.total, Math.round(prods[0].preco * 2 * 100) / 100);

  // entregador não pode aceitar antes de ficar pronto
  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'a_caminho' }, ent)).status, 403);
  // cliente não pode pular etapa
  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'entregue' }, cli)).status, 400);

  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'preparando' }, rest)).status, 200);
  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'pronto' }, rest)).status, 200);

  const disp = await call('GET', '/api/pedidos', null, ent);
  assert.ok(disp.data.some((x) => x.id === p.data.id));

  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'a_caminho' }, ent)).status, 200);
  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'entregue' }, ent)).status, 200);

  const meus = await call('GET', '/api/pedidos', null, cli);
  assert.equal(meus.data.find((x) => x.id === p.data.id).status, 'entregue');
});

test('restaurante não altera pedido de outro restaurante', async () => {
  const cli = await login('cliente@demo.com');
  const pizza = await login('pizzaria@demo.com');
  const rs = (await call('GET', '/api/restaurantes')).data.find((r) => r.nome === 'Burger House');
  const prods = (await call('GET', `/api/restaurantes/${rs.id}/produtos`)).data;
  const p = await call('POST', '/api/pedidos', {
    restaurante_id: rs.id, endereco: 'Rua B, 5', itens: [{ produto_id: prods[0].id, quantidade: 1 }],
  }, cli);
  assert.equal((await call('PATCH', `/api/pedidos/${p.data.id}/status`, { status: 'preparando' }, pizza)).status, 403);
});

test('pedido exige login de cliente, endereço e carrinho', async () => {
  const cli = await login('cliente@demo.com');
  assert.equal((await call('POST', '/api/pedidos', { restaurante_id: 1, itens: [], endereco: 'x' })).status, 401);
  assert.equal((await call('POST', '/api/pedidos', { restaurante_id: 1, itens: [], endereco: 'x' }, cli)).status, 400);
  assert.equal((await call('POST', '/api/pedidos', { restaurante_id: 1, itens: [{ produto_id: 1, quantidade: 1 }], endereco: '' }, cli)).status, 400);
});

test('restaurante cria e remove produto', async () => {
  const rest = await login('pizzaria@demo.com');
  const novo = await call('POST', '/api/produtos', { nome: 'Pizza Teste', preco: 30 }, rest);
  assert.equal(novo.status, 201);
  assert.equal((await call('DELETE', `/api/produtos/${novo.data.id}`, null, rest)).status, 200);
  const cli = await login('cliente@demo.com');
  assert.equal((await call('POST', '/api/produtos', { nome: 'x', preco: 1 }, cli)).status, 403);
});
