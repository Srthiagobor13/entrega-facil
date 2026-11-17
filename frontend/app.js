'use strict';

// ---------- Estado ----------
const S = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  aba: null,
  modoCadastro: false,
  restaurante: null,   // restaurante aberto pelo cliente
  produtos: [],
  carrinho: JSON.parse(localStorage.getItem('carrinho') || 'null') || { restaurante_id: null, nome: '', itens: {} },
};
let timer = null;

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS = { recebido: 'Recebido', preparando: 'Preparando', pronto: 'Pronto p/ entrega', a_caminho: 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado' };

function aviso(msg, erro = false) {
  const el = $('#aviso');
  el.textContent = msg;
  el.className = 'vis' + (erro ? ' erro' : '');
  setTimeout(() => (el.className = ''), 2800);
}

async function api(caminho, metodo = 'GET', corpo) {
  const r = await fetch('/api' + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { sair(); throw new Error('Sessão expirada'); }
  if (!r.ok) throw new Error(dados.erro || 'Erro na requisição');
  return dados;
}

const salvaCarrinho = () => localStorage.setItem('carrinho', JSON.stringify(S.carrinho));

function entrar(dados) {
  S.token = dados.token; S.user = dados.usuario;
  localStorage.setItem('token', S.token);
  localStorage.setItem('user', JSON.stringify(S.user));
  S.aba = null;
  iniciar();
}
function sair() {
  clearInterval(timer);
  S.token = null; S.user = null; S.aba = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  iniciar();
}

// ---------- Abas por papel ----------
const ABAS = {
  cliente: [['restaurantes', 'Restaurantes'], ['carrinho', 'Carrinho'], ['pedidos', 'Meus pedidos']],
  restaurante: [['pedidos', 'Pedidos'], ['cardapio', 'Cardápio']],
  entregador: [['entregas', 'Entregas']],
};

function iniciar() {
  clearInterval(timer);
  $('#usuario').innerHTML = S.user ? `<span>${esc(S.user.nome)}</span><button class="btn sec peq" data-a="sair">Sair</button>` : '';
  if (!S.user) { $('#abas').innerHTML = ''; return telaLogin(); }
  const abas = ABAS[S.user.papel];
  S.aba = S.aba || abas[0][0];
  $('#abas').innerHTML = abas.map(([k, n]) => {
    const extra = k === 'carrinho' ? ` (${Object.values(S.carrinho.itens).reduce((a, i) => a + i.qtd, 0)})` : '';
    return `<button data-a="aba" data-k="${k}" class="${k === S.aba ? 'ativa' : ''}">${n}${extra}</button>`;
  }).join('');
  desenhar();
  // Atualização periódica do status dos pedidos (tempo real simplificado)
  if (['pedidos', 'entregas'].includes(S.aba)) timer = setInterval(desenhar, 5000);
}

function desenhar() {
  ({ restaurantes: telaRestaurantes, carrinho: telaCarrinho, pedidos: telaPedidos, cardapio: telaCardapio, entregas: telaPedidos })[S.aba]();
}

// ---------- Telas ----------
function telaLogin() {
  const cad = S.modoCadastro;
  $('#app').innerHTML = `
    <div class="card">
      <h2>${cad ? 'Criar conta' : 'Entrar'}</h2>
      <form id="f-auth">
        ${cad ? `<label for="nome">Nome</label><input id="nome" required>
        <label for="papel">Tipo de conta</label>
        <select id="papel"><option value="cliente">Cliente</option><option value="restaurante">Restaurante</option><option value="entregador">Entregador</option></select>
        <div id="extra-rest" hidden><label for="nrest">Nome do restaurante</label><input id="nrest">
        <label for="cat">Categoria</label><input id="cat" placeholder="Ex.: Pizza"></div>` : ''}
        <label for="email">E-mail</label><input id="email" type="email" required autocomplete="username">
        <label for="senha">Senha</label><input id="senha" type="password" required minlength="6" autocomplete="${cad ? 'new-password' : 'current-password'}">
        <button class="btn largo" type="submit">${cad ? 'Cadastrar' : 'Entrar'}</button>
      </form>
      <p class="mudo" style="text-align:center"><a href="#" data-a="trocar">${cad ? 'Já tenho conta' : 'Criar uma conta'}</a></p>
      ${cad ? '' : '<p class="mudo">Contas de demonstração (senha 123456): cliente@demo.com, pizzaria@demo.com, burger@demo.com, entregador@demo.com</p>'}
    </div>`;
  if (cad) $('#papel').onchange = (e) => ($('#extra-rest').hidden = e.target.value !== 'restaurante');
  $('#f-auth').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const corpo = { email: $('#email').value.trim(), senha: $('#senha').value };
      if (cad) Object.assign(corpo, { nome: $('#nome').value.trim(), papel: $('#papel').value, nome_restaurante: $('#nrest').value.trim(), categoria: $('#cat').value.trim() });
      entrar(await api(cad ? '/auth/register' : '/auth/login', 'POST', corpo));
    } catch (err) { aviso(err.message, true); }
  };
}

async function telaRestaurantes() {
  try {
    if (S.restaurante) {
      S.produtos = await api(`/restaurantes/${S.restaurante.id}/produtos`);
      $('#app').innerHTML = `
        <button class="btn sec peq" data-a="voltar">← Restaurantes</button>
        <h2 style="margin-top:12px">${esc(S.restaurante.nome)}</h2>
        ${S.produtos.map((p) => {
          const q = S.carrinho.restaurante_id === S.restaurante.id ? (S.carrinho.itens[p.id]?.qtd || 0) : 0;
          return `<div class="card linha"><div><strong>${esc(p.nome)}</strong><div class="mudo">${esc(p.descricao)}</div><div class="preco">${brl(p.preco)}</div></div>
          <div class="qtd"><button data-a="menos" data-id="${p.id}" aria-label="Remover um">−</button><span>${q}</span><button data-a="mais" data-id="${p.id}" aria-label="Adicionar um">+</button></div></div>`;
        }).join('') || '<div class="vazio">Sem produtos.</div>'}`;
    } else {
      const lista = await api('/restaurantes');
      $('#app').innerHTML = `<h2>Restaurantes</h2>` + (lista.map((r) =>
        `<div class="card linha"><div><strong>${esc(r.nome)}</strong><div class="mudo">${esc(r.categoria)}</div></div>
        <button class="btn peq" data-a="abrir" data-id="${r.id}" data-nome="${esc(r.nome)}">Ver cardápio</button></div>`).join('') || '<div class="vazio">Nenhum restaurante.</div>');
    }
  } catch (e) { aviso(e.message, true); }
}

function telaCarrinho() {
  const itens = Object.entries(S.carrinho.itens);
  if (!itens.length) { $('#app').innerHTML = '<div class="vazio">Seu carrinho está vazio.</div>'; return; }
  const total = itens.reduce((a, [, i]) => a + i.preco * i.qtd, 0);
  $('#app').innerHTML = `
    <h2>Carrinho — ${esc(S.carrinho.nome)}</h2>
    ${itens.map(([id, i]) => `<div class="card linha"><div><strong>${esc(i.nome)}</strong><div class="mudo">${brl(i.preco)} cada</div></div>
      <div class="qtd"><button data-a="menos" data-id="${id}" aria-label="Remover um">−</button><span>${i.qtd}</span><button data-a="mais-c" data-id="${id}" aria-label="Adicionar um">+</button></div></div>`).join('')}
    <div class="card">
      <div class="linha"><strong>Total</strong><span class="preco">${brl(total)}</span></div>
      <label for="end">Endereço de entrega</label><textarea id="end" rows="2" placeholder="Rua, número, bairro"></textarea>
      <label for="pag">Pagamento (simulado)</label><select id="pag"><option>Pix</option><option>Cartão</option><option>Dinheiro</option></select>
      <button class="btn largo" data-a="finalizar">Finalizar pedido</button>
      <button class="btn perigo largo" data-a="limpar">Esvaziar carrinho</button>
    </div>`;
}

async function telaPedidos() {
  try {
    const lista = await api('/pedidos');
    const papel = S.user.papel;
    const titulo = papel === 'cliente' ? 'Meus pedidos' : papel === 'restaurante' ? 'Pedidos recebidos' : 'Entregas';
    $('#app').innerHTML = `<h2>${titulo}</h2>` + (lista.map((p) => `
      <div class="card">
        <div class="linha"><strong>#${p.id} · ${esc(papel === 'cliente' ? p.restaurante : p.cliente)}</strong><span class="badge ${p.status}">${STATUS[p.status]}</span></div>
        <ul class="itens">${p.itens.map((i) => `<li>${i.quantidade}× ${esc(i.nome)}</li>`).join('')}</ul>
        <div class="mudo">📍 ${esc(p.endereco)}${papel === 'entregador' ? ` · ${esc(p.restaurante)}` : ''}</div>
        <div class="linha" style="margin-top:6px"><span class="mudo">${esc(p.criado_em)}</span><span class="preco">${brl(p.total)}</span></div>
        <div class="acoes">${acoes(p, papel)}</div>
      </div>`).join('') || '<div class="vazio">Nada por aqui ainda.</div>');
  } catch (e) { aviso(e.message, true); }
}

function acoes(p, papel) {
  const b = (st, txt, cls = '') => `<button class="btn peq ${cls}" data-a="status" data-id="${p.id}" data-st="${st}">${txt}</button>`;
  if (papel === 'restaurante') {
    if (p.status === 'recebido') return b('preparando', 'Aceitar e preparar') + b('cancelado', 'Recusar', 'perigo');
    if (p.status === 'preparando') return b('pronto', 'Marcar como pronto', 'ok');
  }
  if (papel === 'entregador') {
    if (p.status === 'pronto') return b('a_caminho', 'Aceitar entrega');
    if (p.status === 'a_caminho') return b('entregue', 'Confirmar entrega', 'ok');
  }
  if (papel === 'cliente' && p.status === 'recebido') return b('cancelado', 'Cancelar pedido', 'perigo');
  return '';
}

async function telaCardapio() {
  try {
    const lista = await api(`/restaurantes/${S.user.restaurante_id}/produtos`);
    $('#app').innerHTML = `
      <h2>Meu cardápio</h2>
      <div class="card"><form id="f-prod">
        <label for="pn">Nome do produto</label><input id="pn" required>
        <label for="pd">Descrição</label><input id="pd">
        <label for="pp">Preço (R$)</label><input id="pp" type="number" step="0.01" min="0" required>
        <button class="btn largo" type="submit">Adicionar produto</button></form></div>` +
      lista.map((p) => `<div class="card linha"><div><strong>${esc(p.nome)}</strong><div class="mudo">${esc(p.descricao)}</div><div class="preco">${brl(p.preco)}</div></div>
        <button class="btn perigo peq" data-a="rm-prod" data-id="${p.id}">Remover</button></div>`).join('');
    $('#f-prod').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/produtos', 'POST', { nome: $('#pn').value.trim(), descricao: $('#pd').value.trim(), preco: $('#pp').value });
        aviso('Produto adicionado'); telaCardapio();
      } catch (err) { aviso(err.message, true); }
    };
  } catch (e) { aviso(e.message, true); }
}

// ---------- Ações (delegação de eventos) ----------
function mudaQtd(prodId, delta, produto) {
  const c = S.carrinho;
  if (produto) {
    if (c.restaurante_id !== S.restaurante.id) {
      if (Object.keys(c.itens).length && !confirm('O carrinho tem itens de outro restaurante. Esvaziar e continuar?')) return;
      S.carrinho = { restaurante_id: S.restaurante.id, nome: S.restaurante.nome, itens: {} };
    }
  }
  const cur = S.carrinho.itens[prodId];
  const qtd = (cur?.qtd || 0) + delta;
  if (qtd <= 0) delete S.carrinho.itens[prodId];
  else S.carrinho.itens[prodId] = { nome: cur?.nome ?? produto.nome, preco: cur?.preco ?? produto.preco, qtd };
  if (!Object.keys(S.carrinho.itens).length) S.carrinho = { restaurante_id: null, nome: '', itens: {} };
  salvaCarrinho(); iniciar();
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const { a, id, k, st, nome } = el.dataset;
  try {
    if (a === 'sair') return sair();
    if (a === 'trocar') { e.preventDefault(); S.modoCadastro = !S.modoCadastro; return telaLogin(); }
    if (a === 'aba') { S.aba = k; if (k === 'restaurantes') S.restaurante = null; return iniciar(); }
    if (a === 'abrir') { S.restaurante = { id: Number(id), nome }; return desenhar(); }
    if (a === 'voltar') { S.restaurante = null; return desenhar(); }
    if (a === 'mais') return mudaQtd(id, 1, S.produtos.find((p) => p.id == id));
    if (a === 'mais-c') return mudaQtd(id, 1);
    if (a === 'menos') return mudaQtd(id, -1);
    if (a === 'limpar') { S.carrinho = { restaurante_id: null, nome: '', itens: {} }; salvaCarrinho(); return iniciar(); }
    if (a === 'finalizar') {
      const endereco = $('#end').value.trim();
      if (!endereco) return aviso('Informe o endereço de entrega', true);
      const itens = Object.entries(S.carrinho.itens).map(([produto_id, i]) => ({ produto_id: Number(produto_id), quantidade: i.qtd }));
      const r = await api('/pedidos', 'POST', { restaurante_id: S.carrinho.restaurante_id, itens, endereco });
      S.carrinho = { restaurante_id: null, nome: '', itens: {} }; salvaCarrinho();
      aviso(`Pedido #${r.id} realizado! Total ${brl(r.total)}`);
      S.aba = 'pedidos'; return iniciar();
    }
    if (a === 'status') { await api(`/pedidos/${id}/status`, 'PATCH', { status: st }); aviso('Status atualizado'); return desenhar(); }
    if (a === 'rm-prod') { await api(`/produtos/${id}`, 'DELETE'); aviso('Produto removido'); return telaCardapio(); }
  } catch (err) { aviso(err.message, true); }
});

// ---------- PWA ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

iniciar();
