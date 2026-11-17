import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, seed } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base;
test.before(async () => {
  const db = openDb(':memory:');
  seed(db);
  await new Promise((ok) => { server = createApp(db).listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, corpo, headers = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: corpo });

test('JSON malformado retorna 400 com mensagem (sem derrubar o servidor)', async () => {
  const r = await post('/api/auth/login', '{"email": ');
  assert.equal(r.status, 400);
  assert.equal((await r.json()).erro, 'JSON inválido');
  assert.equal((await fetch(base + '/api/saude')).status, 200);
});

test('corpo vazio no login retorna 401, não 500', async () => {
  const r = await post('/api/auth/login', '{}');
  assert.equal(r.status, 401);
});

test('rota inexistente da API retorna 404 em JSON', async () => {
  const r = await fetch(base + '/api/nao-existe');
  assert.equal(r.status, 404);
  assert.equal((await r.json()).erro, 'Rota não encontrada');
});

test('token inválido retorna 401', async () => {
  const r = await fetch(base + '/api/pedidos', { headers: { Authorization: 'Bearer lixo' } });
  assert.equal(r.status, 401);
});

test('cadastro valida campos obrigatórios, senha curta e papel inválido', async () => {
  assert.equal((await post('/api/auth/register', JSON.stringify({ nome: 'A' }))).status, 400);
  assert.equal((await post('/api/auth/register', JSON.stringify({ nome: 'A', email: 'a@a.com', senha: '123', papel: 'cliente' }))).status, 400);
  assert.equal((await post('/api/auth/register', JSON.stringify({ nome: 'A', email: 'a@a.com', senha: '123456', papel: 'admin' }))).status, 400);
  assert.equal((await post('/api/auth/register', JSON.stringify({ nome: 'R', email: 'r@r.com', senha: '123456', papel: 'restaurante' }))).status, 400);
});

test('produtos de restaurante inexistente retorna lista vazia', async () => {
  const r = await fetch(base + '/api/restaurantes/9999/produtos');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), []);
});

test('PWA: manifest, service worker, ícones PNG e página offline são servidos', async () => {
  const m = await fetch(base + '/manifest.webmanifest');
  assert.equal(m.status, 200);
  const man = await m.json();
  assert.equal(man.display, 'standalone');
  const tamanhos = man.icons.map((i) => i.sizes);
  assert.ok(tamanhos.includes('192x192') && tamanhos.includes('512x512'));
  assert.ok(man.icons.some((i) => i.purpose === 'maskable'));
  for (const i of man.icons) {
    const ic = await fetch(base + '/' + i.src);
    assert.equal(ic.status, 200);
    assert.equal(ic.headers.get('content-type'), 'image/png');
  }
  assert.equal((await fetch(base + '/sw.js')).status, 200);
  assert.equal((await fetch(base + '/offline.html')).status, 200);
  const home = await (await fetch(base + '/')).text();
  assert.match(home, /rel="manifest"/);
});
