import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, seed } from '../src/db.js';
import { createApp } from '../src/app.js';

// Testes de regressão dos bugs encontrados na rodada de QA (agentes de IA e testadores)
let server, base;
test.before(async () => {
  const db = openDb(':memory:');
  seed(db);
  await new Promise((ok) => { server = createApp(db).listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, path, body, token) {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})), headers: r.headers };
}
const login = async (email) => (await call('POST', '/api/auth/login', { email, senha: '123456' })).data.token;

async function burger() {
  const rs = (await call('GET', '/api/restaurantes')).data.find((r) => r.nome === 'Burger House');
  const ps = (await call('GET', `/api/restaurantes/${rs.id}/produtos`)).data;
  return { rs, classico: ps.find((p) => p.nome === 'Clássico da Casa') };
}
const pedir = async (token, extra = {}) => {
  const { rs, classico } = await burger();
  return call('POST', '/api/pedidos', { restaurante_id: rs.id, endereco: 'Rua Teste, 100', itens: [{ produto_id: classico.id, quantidade: 1 }], ...extra }, token);
};

test('cadastro: e-mail inválido, duplicado por maiúsculas e campos longos', async () => {
  const dados = { nome: 'Teste Silva', senha: '123456', papel: 'cliente' };
  assert.equal((await call('POST', '/api/auth/register', { ...dados, email: 'abc' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { ...dados, email: 'Maria@Teste.com' })).status, 201);
  assert.equal((await call('POST', '/api/auth/register', { ...dados, email: 'maria@teste.COM' })).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { ...dados, email: 'long@teste.com', nome: 'N'.repeat(81) })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { ...dados, email: 'tipo@teste.com', nome: { a: 1 } })).status, 400);
});

test('login com tipos inesperados retorna 400 e não 500', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: { $ne: 1 }, senha: [1] })).status, 400);
});

test('troco menor que o total é recusado; maior ou igual é aceito', async () => {
  const cli = await login('cliente@demo.com');
  assert.equal((await pedir(cli, { pagamento: 'dinheiro', troco_para: 10 })).status, 400);
  assert.equal((await pedir(cli, { pagamento: 'dinheiro', troco_para: 100 })).status, 201);
  assert.equal((await pedir(cli, { pagamento: 'dinheiro' })).status, 201);
});

test('item nulo e tipos frouxos no pedido retornam 400 (nunca 500)', async () => {
  const cli = await login('cliente@demo.com');
  const { rs, classico } = await burger();
  const enviar = (itens) => call('POST', '/api/pedidos', { restaurante_id: rs.id, endereco: 'Rua Teste, 100', itens }, cli);
  assert.equal((await enviar([null])).status, 400);
  assert.equal((await enviar([{ produto_id: classico.id, quantidade: '2' }])).status, 400);
  assert.equal((await enviar([{ produto_id: classico.id, quantidade: 1, selecao: 'abc' }])).status, 400);
  assert.equal((await enviar([{ produto_id: classico.id, quantidade: 1, observacao: { a: 1 } }])).status, 400);
  const pao = classico.opcoes.find((o) => o.nome === 'Australiano');
  assert.equal((await enviar([{ produto_id: classico.id, quantidade: 1, selecao: { [pao.id]: 5 } }])).status, 400);
});

test('produto: nome vazio, só espaços, preço vazio, zero ou inválido são recusados', async () => {
  const rest = await login('pizzaria@demo.com');
  const invalidos = [{ nome: '   ', preco: 10 }, { nome: 'X', preco: '' }, { nome: 'X', preco: 0 }, { nome: 'X', preco: [30] }, { nome: 'X', preco: -1 }];
  for (const corpo of invalidos) {
    assert.equal((await call('POST', '/api/produtos', corpo, rest)).status, 400, JSON.stringify(corpo));
  }
});

test('remover produto duas vezes: a segunda retorna 404', async () => {
  const rest = await login('pizzaria@demo.com');
  const p = await call('POST', '/api/produtos', { nome: 'Produto Efêmero', preco: 12.5 }, rest);
  assert.equal((await call('DELETE', `/api/produtos/${p.data.id}`, undefined, rest)).status, 200);
  assert.equal((await call('DELETE', `/api/produtos/${p.data.id}`, undefined, rest)).status, 404);
});

test('disputa de entrega: o segundo entregador recebe 409; status vazio retorna 400', async () => {
  const cli = await login('cliente@demo.com');
  const rest = await login('burger@demo.com');
  const ent1 = await login('entregador@demo.com');
  const novo = await call('POST', '/api/auth/register', { nome: 'Outro Entregador', email: 'ent2@teste.com', senha: '123456', papel: 'entregador' });
  const ent2 = novo.data.token;
  const ped = (await pedir(cli)).data.id;
  const mudar = (t, status) => call('PATCH', `/api/pedidos/${ped}/status`, status === undefined ? {} : { status }, t);
  assert.equal((await mudar(rest)).status, 400);
  await mudar(rest, 'preparando');
  await mudar(rest, 'pronto');
  assert.equal((await mudar(ent1, 'a_caminho')).status, 200);
  const perdedor = await mudar(ent2, 'a_caminho');
  assert.equal(perdedor.status, 409);
  assert.match(perdedor.data.erro, /outro entregador/);
});

test('conta: editar nome e trocar senha exigindo a senha atual', async () => {
  const reg = await call('POST', '/api/auth/register', { nome: 'Conta Teste', email: 'conta@teste.com', senha: 'senha123', papel: 'cliente' });
  const t = reg.data.token;
  assert.equal((await call('GET', '/api/me', undefined, t)).data.email, 'conta@teste.com');
  assert.equal((await call('GET', '/api/me')).status, 401);

  const nome = await call('PATCH', '/api/me', { nome: 'Novo Nome' }, t);
  assert.equal(nome.status, 200);
  assert.equal(nome.data.usuario.nome, 'Novo Nome');
  assert.equal((await call('PATCH', '/api/me', {}, t)).status, 400);

  assert.equal((await call('PATCH', '/api/me', { senha_atual: 'errada', nova_senha: 'nova12345' }, t)).status, 403);
  assert.equal((await call('PATCH', '/api/me', { senha_atual: 'senha123', nova_senha: '123' }, t)).status, 400);
  assert.equal((await call('PATCH', '/api/me', { senha_atual: 'senha123', nova_senha: 'nova12345' }, t)).status, 200);
  assert.equal((await call('POST', '/api/auth/login', { email: 'conta@teste.com', senha: 'senha123' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: 'conta@teste.com', senha: 'nova12345' })).status, 200);
});

test('cabeçalhos de segurança presentes e sem x-powered-by', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('strict-transport-security'));
});

test('limite de tentativas: após 10 falhas de login o servidor responde 429', async () => {
  const db = openDb(':memory:');
  seed(db);
  const srv = await new Promise((ok) => { const s = createApp(db).listen(0, () => ok(s)); });
  const url = `http://localhost:${srv.address().port}/api/auth/login`;
  const tentar = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cliente@demo.com', senha: 'errada' }) });
  for (let i = 0; i < 10; i += 1) assert.equal((await tentar()).status, 401);
  assert.equal((await tentar()).status, 429);
  srv.close();
});
