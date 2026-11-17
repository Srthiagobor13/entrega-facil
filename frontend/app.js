'use strict';

// ====================================================================
// Estado
// ====================================================================
const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignora */ } };

// Carrinho guardado no navegador: se estiver corrompido ou em formato antigo, volta a vazio
function carrinhoSalvo() {
  const c = ler('cart_v2', null);
  const itemOk = (i) => i && typeof i.produto_id === 'number' && typeof i.unit === 'number' && Number.isInteger(i.qtd) && i.qtd > 0
    && i.selecao && typeof i.selecao === 'object' && Array.isArray(i.det);
  const ok = c && Array.isArray(c.itens) && c.itens.every(itemOk) && (c.rid === null || typeof c.rid === 'number');
  return ok ? c : { rid: null, itens: [] };
}

const S = {
  token: ler('token', null),
  user: ler('user', null),
  view: 'home',
  rests: [],
  rest: null,          // restaurante aberto
  produtos: [],
  cart: carrinhoSalvo(),
  ultimo: null,
  m: null,             // estado do modal de produto
  overlay: null,       // 'produto' | 'sacola' | 'checkout' | 'auth'
  authModo: 'entrar',
  depoisLogin: null,
  pag: 'pix',
};
let timer = null;
const STATUS = { recebido: 'Recebido', preparando: 'Em preparo', pronto: 'Pronto', a_caminho: 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado' };
const ETAPAS = ['recebido', 'preparando', 'pronto', 'a_caminho', 'entregue'];
const PAGAMENTOS = { pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' };

// ====================================================================
// Utilitários
// ====================================================================
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = (s) => !s ? '' : new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const foto = (src) => (src ? `style="background-image:url('${esc(src)}')"` : '');

const ICONES = {
  sacola: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icone = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n]}</svg>`;

function aviso(msg, erro = false) {
  const el = $('#aviso');
  el.textContent = msg;
  el.className = 'vis' + (erro ? ' erro' : '');
  el.setAttribute('role', erro ? 'alert' : 'status');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (el.className = ''), 3200);
}

async function api(caminho, metodo = 'GET', corpo) {
  // Limite de 70 s: o plano gratuito da hospedagem pode levar cerca de 1 minuto para acordar
  const ctl = new AbortController();
  const limite = setTimeout(() => ctl.abort(), 70000);
  let r;
  try {
    r = await fetch('/api' + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctl.signal,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'O servidor demorou para responder. Tente novamente em instantes.'
      : 'Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  } finally { clearTimeout(limite); }
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && !caminho.startsWith('/auth')) { sair(true); throw new Error('Sessão expirada. Entre novamente.'); }
  if (!r.ok) throw new Error(dados.erro || 'Não foi possível concluir a ação. Tente novamente.');
  return dados;
}

// ====================================================================
// Preço e personalização (espelha backend/src/pricing.js; o servidor é a fonte da verdade)
// ====================================================================
function agrupar(opcoes) {
  const m = new Map();
  for (const o of opcoes) {
    if (!m.has(o.grupo)) m.set(o.grupo, { grupo: o.grupo, tipo: o.tipo, itens: [] });
    m.get(o.grupo).itens.push(o);
  }
  return [...m.values()];
}

function selecaoInicial(p) {
  const sel = {};
  for (const g of agrupar(p.opcoes)) {
    if (g.tipo === 'escolha') sel[g.itens[0].id] = 1;
    if (g.tipo === 'extra') g.itens.forEach((o) => { sel[o.id] = o.base; });
  }
  return sel;
}

function calcular(p, sel) {
  let unit = p.preco;
  const det = [];
  for (const g of agrupar(p.opcoes)) {
    if (g.tipo === 'escolha') {
      const o = g.itens.find((x) => sel[x.id] > 0) || g.itens[0];
      unit += o.preco;
      det.push(`${g.grupo}: ${o.nome}`);
    } else {
      for (const o of g.itens) {
        if (o.tipo === 'extra') {
          const q = sel[o.id] ?? o.base;
          unit += o.preco * Math.max(0, q - o.base);
          if (q !== o.base) det.push(o.min > 0 ? `${o.nome}: ${q}` : `${q}x ${o.nome}`);
        } else if (sel[o.id] > 0) det.push(`Sem ${o.nome.toLowerCase()}`);
      }
    }
  }
  return { unit: Math.round(unit * 100) / 100, det };
}

// ====================================================================
// Carrinho
// ====================================================================
const salvaCart = () => gravar('cart_v2', S.cart);
const qtdCart = () => S.cart.itens.reduce((a, i) => a + i.qtd, 0);
const subtotal = () => S.cart.itens.reduce((a, i) => a + i.unit * i.qtd, 0);

function adicionarAoCarrinho() {
  const { p, sel, qtd, obs } = S.m;
  if (S.cart.rid !== S.rest.id) {
    if (S.cart.itens.length && !confirm('Sua sacola tem itens de outro restaurante. Deseja esvaziar e continuar?')) return;
    S.cart = { rid: S.rest.id, itens: [] };
  }
  const { unit, det } = calcular(p, sel);
  const chave = JSON.stringify([p.id, sel, obs.trim()]);
  const ex = S.cart.itens.find((i) => i.chave === chave);
  if (ex) ex.qtd += qtd;
  else S.cart.itens.push({ chave, produto_id: p.id, nome: p.nome, unit, qtd, selecao: { ...sel }, det, obs: obs.trim() });
  salvaCart();
  fecharOverlay();
  renderTopo();
  aviso(`${p.nome} adicionado à sacola`);
}

// ====================================================================
// Sessão
// ====================================================================
function entrar(dados) {
  S.token = dados.token; S.user = dados.usuario;
  gravar('token', S.token); gravar('user', S.user);
  const acao = S.depoisLogin; S.depoisLogin = null;
  fecharOverlay();
  S.view = S.user.papel === 'restaurante' ? 'painel' : S.user.papel === 'entregador' ? 'entregas' : acao === 'checkout' ? 'home' : 'home';
  renderTudo();
  aviso(`Bem-vindo, ${S.user.nome.split(' ')[0]}`);
  if (acao === 'checkout' && S.user.papel === 'cliente') abrirCheckout();
}

function sair(silencioso = false) {
  S.token = null; S.user = null; S.view = 'home';
  localStorage.removeItem('token'); localStorage.removeItem('user');
  fecharOverlay();
  renderTudo();
  if (!silencioso) aviso('Você saiu da conta');
}

// ====================================================================
// Topo
// ====================================================================
function renderTopo() {
  const u = S.user;
  const papel = u?.papel;
  const links = papel === 'restaurante' ? [['painel', 'Pedidos'], ['cardapio', 'Meu cardápio'], ['conta', 'Conta']]
    : papel === 'entregador' ? [['entregas', 'Entregas'], ['conta', 'Conta']]
    : [['home', 'Cardápio'], ...(papel === 'cliente' ? [['pedidos', 'Meus pedidos'], ['conta', 'Conta']] : [])];
  const mostraSacola = !papel || papel === 'cliente';
  $('#topo').innerHTML = `
    <button class="logo" data-a="ir" data-v="${papel === 'restaurante' ? 'painel' : papel === 'entregador' ? 'entregas' : 'home'}" aria-label="Entrega Fácil, início">ENTREGA <b>FÁCIL</b></button>
    <nav class="nav" aria-label="Principal">
      ${links.map(([v, n]) => `<button class="lnk ${S.view === v ? 'at' : ''}" data-a="ir" data-v="${v}">${n}</button>`).join('')}
      ${u ? `<span class="nome-user oculta-m">${esc(u.nome)}</span><button class="lnk" data-a="sair">Sair</button>`
          : `<button class="lnk" data-a="abrir-auth">Entrar</button>`}
      ${mostraSacola ? `<button class="btn-sacola" data-a="abrir-sacola" aria-label="Abrir sacola">${icone('sacola')}<span class="oculta-m">Sacola</span><span class="qt">${qtdCart()}</span></button>` : ''}
    </nav>`;
  atualizaSolido();
  medeTopo();
}

// Guarda a altura real do topo (no celular ele pode ocupar duas linhas) para o resto do layout
function medeTopo() {
  document.documentElement.style.setProperty('--topo-h', $('#topo').offsetHeight + 'px');
}
window.addEventListener('resize', medeTopo);

function atualizaSolido() {
  $('#topo').classList.toggle('solido', S.view !== 'home' || window.scrollY > 40);
}
window.addEventListener('scroll', atualizaSolido, { passive: true });

// ====================================================================
// Home: cartaz + cardápio
// ====================================================================
async function carregarRests() {
  if (!S.rests.length) S.rests = await api('/restaurantes');
  if (!S.rest) S.rest = S.rests.find((r) => r.id === S.cart.rid) || S.rests[0];
}

async function renderHome() {
  if (!document.querySelector('.hero')) {
    $('#app').innerHTML = '<div class="carregando" role="status"><div class="giro"></div><p>Carregando o cardápio...</p><small>Na primeira visita o servidor pode levar até 1 minuto para acordar.</small></div>';
  }
  try {
    await carregarRests();
    S.produtos = await api(`/restaurantes/${S.rest.id}/produtos`);
  } catch (e) { $('#app').innerHTML = `<div class="vazio"><h3>Não foi possível carregar</h3><p>${esc(e.message)}</p></div>`; return; }

  const r = S.rest;
  const cats = [...new Set(S.produtos.map((p) => p.categoria))];
  const dest = S.produtos.filter((p) => p.destaque);

  $('#app').innerHTML = `
    <section class="hero" style="--img:url('${esc(r.imagem || 'img/hero.jpg')}')">
      <div class="hero-in">
        <p class="eyebrow">${esc(r.nome)} &middot; ${esc(r.categoria)}</p>
        <h1 class="marca">Entrega<span>Fácil</span></h1>
        <p class="slogan">${esc(r.descricao)} Monte do seu jeito e receba em casa.</p>
        <ul class="info">
          <li><small>Entrega</small>${r.tempo_min}-${r.tempo_max} min</li>
          <li><small>Taxa</small>${brl(r.taxa_entrega)}</li>
          <li><small>Pedido mínimo</small>${brl(r.pedido_minimo)}</li>
        </ul>
        <div class="cta">
          <a class="btn pri" href="#cardapio" data-a="rolar" data-alvo="cardapio">Ver cardápio</a>
          ${S.user ? '' : '<button class="btn" data-a="abrir-auth">Entrar ou criar conta</button>'}
        </div>
      </div>
    </section>

    <div class="casas" role="tablist" aria-label="Estabelecimentos">
      ${S.rests.map((x) => `<button class="casa ${x.id === r.id ? 'at' : ''}" role="tab" aria-selected="${x.id === r.id}" data-a="casa" data-id="${x.id}">
        <div><strong>${esc(x.nome)}</strong><span>${esc(x.categoria)}</span></div><span class="tempo">${x.tempo_min}-${x.tempo_max} min</span></button>`).join('')}
    </div>

    <div class="cardapio" id="cardapio">
      <div class="cats" id="cats">
        ${dest.length ? '<button data-a="rolar" data-alvo="sec-destaques">Mais pedidos</button>' : ''}
        ${cats.map((c) => `<button data-a="rolar" data-alvo="sec-${esc(slug(c))}">${esc(c)}</button>`).join('')}
      </div>

      ${dest.length ? `<section class="secao" id="sec-destaques"><h2>Mais pedidos</h2>
        <div class="destaques">${dest.map((p) => `
          <button class="dest" data-a="prod" data-id="${p.id}">
            <div class="foto" ${foto(p.imagem)}><span class="selo">Favorito da casa</span></div>
            <div class="corpo"><h3>${esc(p.nome)}</h3><p>${esc(p.descricao)}</p><span class="preco">${brl(p.preco)}</span></div>
          </button>`).join('')}</div></section>` : ''}

      ${cats.map((c) => `<section class="secao" id="sec-${esc(slug(c))}"><h2>${esc(c)}</h2>
        <div class="lista">${S.produtos.filter((p) => p.categoria === c).map((p) => `
          <button class="item" data-a="prod" data-id="${p.id}">
            <div class="txt"><div><h3>${esc(p.nome)}</h3><p>${esc(p.descricao)}</p></div><span class="preco">${brl(p.preco)}</span></div>
            ${p.imagem ? `<div class="mini" ${foto(p.imagem)}></div>` : `<div class="mini mono">${esc(p.nome[0])}</div>`}
          </button>`).join('')}</div></section>`).join('')}
    </div>`;
  observarSecoes();
}

const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

let obs;
function observarSecoes() {
  obs?.disconnect();
  const secoes = [...document.querySelectorAll('.secao')];
  if (!('IntersectionObserver' in window) || !secoes.length) return;
  obs = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      document.querySelectorAll('#cats button').forEach((b) => b.classList.toggle('at', b.dataset.alvo === e.target.id));
      const at = $('#cats button.at');
      at?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, { rootMargin: '-130px 0px -65% 0px' });
  secoes.forEach((s) => obs.observe(s));
}

// ====================================================================
// Overlay (modal / gaveta)
// ====================================================================
function abrirOverlay(html, { lado = false, gaveta = false, rotulo = 'Janela' } = {}) {
  const ov = $('#overlay');
  S.focoAnterior = document.activeElement;
  ov.className = lado ? 'lado' : '';
  ov.hidden = false;
  ov.innerHTML = `<div class="fundo" data-a="fechar-ov"></div><div class="painel ${gaveta ? 'gaveta' : ''}" role="dialog" aria-modal="true" aria-label="${esc(rotulo)}" tabindex="-1">${html}</div>`;
  document.body.classList.add('trava');
  $('#overlay .painel').focus(); // leva o foco para dentro da janela
}
function trocarOverlay(html) {
  const p = $('#overlay .painel');
  const corpo = $('#overlay .p-corpo');
  const topo = corpo ? corpo.scrollTop : 0;
  p.innerHTML = html;
  const novo = $('#overlay .p-corpo');
  if (novo) novo.scrollTop = topo;
}
function fecharOverlay() {
  const ov = $('#overlay');
  ov.hidden = true; ov.innerHTML = '';
  document.body.classList.remove('trava');
  S.overlay = null; S.m = null;
  if (S.focoAnterior && document.contains(S.focoAnterior)) S.focoAnterior.focus(); // devolve o foco a quem abriu
  S.focoAnterior = null;
}
document.addEventListener('keydown', (e) => {
  if (!S.overlay) return;
  if (e.key === 'Escape') return fecharOverlay();
  if (e.key !== 'Tab') return;
  // mantém o Tab dentro da janela aberta
  const itens = [...document.querySelectorAll('#overlay .painel button:not([disabled]), #overlay .painel input, #overlay .painel textarea, #overlay .painel select, #overlay .painel a[href]')];
  if (!itens.length) return;
  const primeiro = itens[0]; const ultimo = itens[itens.length - 1];
  if (e.shiftKey && (document.activeElement === primeiro || document.activeElement.classList.contains('painel'))) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
});

const btnFechar = `<button class="fechar" data-a="fechar-ov" aria-label="Fechar">${icone('fechar')}</button>`;

// ---------- Modal de produto ----------
function abrirProduto(id) {
  const p = S.produtos.find((x) => x.id === Number(id));
  if (!p) return;
  S.m = { p, sel: selecaoInicial(p), qtd: 1, obs: '' };
  S.overlay = 'produto';
  abrirOverlay(htmlProduto(), { rotulo: 'Personalizar item' });
}

function htmlProduto() {
  const { p, sel, qtd, obs } = S.m;
  const { unit } = calcular(p, sel);
  const grupos = agrupar(p.opcoes).map((g) => {
    if (g.tipo === 'escolha') {
      return `<div class="grupo"><h4>${esc(g.grupo)}</h4><div class="dica">Escolha 1 opção</div>
        ${g.itens.map((o) => `<button class="sel-btn ${sel[o.id] > 0 ? 'on' : ''}" data-a="escolha" data-g="${esc(g.grupo)}" data-o="${o.id}" role="radio" aria-checked="${sel[o.id] > 0}">
          <span class="marca-op"></span><span>${esc(o.nome)}</span>${o.preco ? `<span class="extra-preco">+ ${brl(o.preco)}</span>` : ''}</button>`).join('')}</div>`;
    }
    if (g.tipo === 'extra') {
      return `<div class="grupo"><h4>${esc(g.grupo)}</h4>
        ${g.itens.map((o) => {
          const q = sel[o.id] ?? o.base;
          const sub = o.base > 0 ? `Incluso: ${o.base}${o.preco ? ` &middot; adicional ${brl(o.preco)} cada` : ''}` : o.preco ? `${brl(o.preco)} cada` : '';
          return `<div class="linha-op"><div><div class="nm">${esc(o.nome)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
            <div class="step"><button data-a="ex" data-o="${o.id}" data-d="-1" aria-label="Diminuir ${esc(o.nome)}" ${q <= o.min ? 'disabled' : ''}>&minus;</button><output>${q}</output><button data-a="ex" data-o="${o.id}" data-d="1" aria-label="Aumentar ${esc(o.nome)}" ${q >= o.max ? 'disabled' : ''}>+</button></div></div>`;
        }).join('')}</div>`;
    }
    return `<div class="grupo"><h4>${esc(g.grupo)}</h4><div class="dica">Marque o que deseja retirar</div>
      ${g.itens.map((o) => `<button class="sel-btn rem ${sel[o.id] > 0 ? 'on' : ''}" data-a="rem" data-o="${o.id}" role="checkbox" aria-checked="${sel[o.id] > 0}">
        <span class="marca-op"></span><span>Sem ${esc(o.nome.toLowerCase())}</span></button>`).join('')}</div>`;
  }).join('');

  return `${btnFechar}
    <div class="p-corpo">
      ${p.imagem ? `<div class="p-foto" ${foto(p.imagem)}></div>` : ''}
      <div class="p-cab ${p.imagem ? '' : 'sem-foto'}"><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p><p class="preco" style="margin-top:8px">${brl(p.preco)}</p></div>
      ${grupos}
      <div class="grupo"><h4>Observações</h4><textarea id="obs" rows="2" maxlength="200" placeholder="Alguma observação para a cozinha?">${esc(obs)}</textarea></div>
      <div style="height:18px"></div>
    </div>
    <div class="p-rodape"><div class="rod-linha">
      <div class="step"><button data-a="mq" data-d="-1" aria-label="Diminuir quantidade" ${qtd <= 1 ? 'disabled' : ''}>&minus;</button><output>${qtd}</output><button data-a="mq" data-d="1" aria-label="Aumentar quantidade" ${qtd >= 20 ? 'disabled' : ''}>+</button></div>
      <button class="btn pri" data-a="add">Adicionar &middot; ${brl(unit * qtd)}</button>
    </div></div>`;
}

const refazProduto = () => trocarOverlay(htmlProduto());

// ---------- Sacola ----------
function abrirSacola() {
  S.overlay = 'sacola';
  abrirOverlay(htmlSacola(), { lado: true, gaveta: true, rotulo: 'Sacola' });
}

function resumoValores() {
  const r = S.rests.find((x) => x.id === S.cart.rid);
  const sub = subtotal();
  const taxa = r ? r.taxa_entrega : 0;
  return { r, sub, taxa, total: sub + taxa, falta: r ? Math.max(0, r.pedido_minimo - sub) : 0 };
}

function htmlSacola() {
  if (!S.cart.itens.length) {
    return `${btnFechar}<div class="p-corpo"><div class="vazio"><h3>Sua sacola está vazia</h3><p>Escolha um item do cardápio para começar.</p></div></div>
      <div class="p-rodape"><button class="btn pri bloco" data-a="fechar-ov">Ver cardápio</button></div>`;
  }
  const { r, sub, taxa, total, falta } = resumoValores();
  return `${btnFechar}
    <div class="g-cab"><h2>Sua sacola</h2><p>${esc(r?.nome || '')}</p></div>
    <div class="p-corpo">
      ${S.cart.itens.map((i, idx) => `<div class="linha-sac">
        <div><h3>${i.qtd}x ${esc(i.nome)}</h3>
          ${i.det.length ? `<ul>${i.det.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
          ${i.obs ? `<div class="obs">Obs.: ${esc(i.obs)}</div>` : ''}</div>
        <div class="dir"><span class="preco">${brl(i.unit * i.qtd)}</span>
          <div class="step"><button data-a="cq" data-i="${idx}" data-d="-1" aria-label="Diminuir">&minus;</button><output>${i.qtd}</output><button data-a="cq" data-i="${idx}" data-d="1" aria-label="Aumentar">+</button></div>
          <button class="link-rm" data-a="rm" data-i="${idx}">Remover</button></div></div>`).join('')}
      <div class="resumo">
        <div class="l"><span>Subtotal</span><span>${brl(sub)}</span></div>
        <div class="l"><span>Taxa de entrega</span><span>${brl(taxa)}</span></div>
        <div class="l tot"><span>Total</span><span>${brl(total)}</span></div>
      </div>
      ${falta > 0 ? `<div class="alerta">Faltam ${brl(falta)} para o pedido mínimo de ${brl(r.pedido_minimo)}.</div>` : ''}
      <div style="height:16px"></div>
    </div>
    <div class="p-rodape"><div class="rod-linha">
      <button class="btn" data-a="limpar">Esvaziar</button>
      <button class="btn pri" data-a="finalizar" ${falta > 0 ? 'disabled' : ''}>Finalizar pedido</button>
    </div></div>`;
}

const refazSacola = () => { if (S.overlay === 'sacola') trocarOverlay(htmlSacola()); renderTopo(); };

// ---------- Checkout ----------
function abrirCheckout() {
  if (!S.user) { S.depoisLogin = 'checkout'; return abrirAuth('Entre ou crie uma conta para finalizar o pedido.'); }
  if (S.user.papel !== 'cliente') return aviso('Entre com uma conta de cliente para fazer pedidos', true);
  S.overlay = 'checkout';
  abrirOverlay(htmlCheckout(), { lado: true, gaveta: true, rotulo: 'Finalizar pedido' });
}

function htmlCheckout() {
  const { r, sub, taxa, total } = resumoValores();
  const end = ler('endereco', '');
  return `${btnFechar}
    <div class="g-cab"><h2>Finalizar pedido</h2><p>${esc(r?.nome || '')} &middot; ${r?.tempo_min}-${r?.tempo_max} min</p></div>
    <div class="p-corpo"><form class="form" id="f-ck">
      <label for="end">Endereço de entrega</label>
      <textarea id="end" rows="2" required placeholder="Rua, número, complemento, bairro">${esc(end)}</textarea>
      <label>Pagamento na entrega</label>
      <div class="pag" role="radiogroup">${Object.entries(PAGAMENTOS).map(([k, n]) => `<button type="button" class="${S.pag === k ? 'on' : ''}" data-a="pag" data-k="${k}" role="radio" aria-checked="${S.pag === k}">${n}</button>`).join('')}</div>
      ${S.pag === 'dinheiro' ? `<label for="troco">Troco para (opcional)</label><input id="troco" type="number" min="0" step="0.01" placeholder="Ex.: 100">` : ''}
      <div class="resumo" style="padding:20px 0 0">
        <div class="l"><span>Subtotal (${qtdCart()} ${qtdCart() === 1 ? 'item' : 'itens'})</span><span>${brl(sub)}</span></div>
        <div class="l"><span>Taxa de entrega</span><span>${brl(taxa)}</span></div>
        <div class="l tot"><span>Total</span><span>${brl(total)}</span></div>
      </div>
      <p class="mudo" style="color:var(--mudo);font-size:.78rem;margin-top:10px">Pagamento simulado. Nenhuma cobrança real é feita.</p>
    </form></div>
    <div class="p-rodape"><button class="btn pri bloco" data-a="confirmar">Confirmar pedido &middot; ${brl(total)}</button></div>`;
}

async function confirmarPedido() {
  const end = $('#end').value.trim();
  if (!end) { aviso('Informe o endereço de entrega', true); return; }
  const btn = $('[data-a=confirmar]'); btn.disabled = true;
  try {
    const troco = $('#troco')?.value;
    const r = await api('/pedidos', 'POST', {
      restaurante_id: S.cart.rid,
      endereco: end,
      pagamento: S.pag,
      troco_para: troco ? Number(troco) : undefined,
      itens: S.cart.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.qtd, selecao: i.selecao, observacao: i.obs })),
    });
    gravar('endereco', end);
    S.cart = { rid: null, itens: [] }; salvaCart();
    fecharOverlay();
    S.view = 'pedidos';
    renderTudo();
    aviso(`Pedido #${r.id} enviado ao restaurante`);
  } catch (e) { aviso(e.message, true); btn.disabled = false; }
}

// ---------- Login / cadastro ----------
function abrirAuth(msg = '') {
  S.overlay = 'auth';
  abrirOverlay(htmlAuth(msg), { rotulo: S.authModo === 'cadastro' ? 'Criar conta' : 'Entrar' });
}

function htmlAuth(msg = '') {
  const cad = S.authModo === 'cadastro';
  return `${btnFechar}
    <div class="p-corpo">
      <div class="p-cab sem-foto"><h2>${cad ? 'Criar conta' : 'Entrar'}</h2><p>${esc(msg) || (cad ? 'Leva menos de um minuto.' : 'Acesse sua conta para acompanhar seus pedidos.')}</p></div>
      <form class="form" id="f-auth" data-msg="${esc(msg)}">
        ${cad ? `<label for="nome">Nome</label><input id="nome" required autocomplete="name">
          <label for="papel">Tipo de conta</label>
          <select id="papel"><option value="cliente">Cliente</option><option value="restaurante">Restaurante parceiro</option><option value="entregador">Entregador</option></select>
          <div id="extra-rest" hidden><label for="nrest">Nome do restaurante</label><input id="nrest"><label for="cat">Categoria</label><input id="cat" placeholder="Ex.: Pizza artesanal"></div>` : ''}
        <label for="email">E-mail</label><input id="email" type="email" required autocomplete="username">
        <label for="senha">Senha</label><input id="senha" type="password" required minlength="6" autocomplete="${cad ? 'new-password' : 'current-password'}">
        <button class="btn pri bloco" style="margin-top:22px" type="submit">${cad ? 'Cadastrar' : 'Entrar'}</button>
        <p class="troca">${cad ? 'Já tem conta?' : 'Ainda não tem conta?'} <button type="button" data-a="troca-auth" data-msg="${esc(msg)}">${cad ? 'Entrar' : 'Criar conta'}</button></p>
        ${cad ? '' : `<div class="demo"><strong>Contas de demonstração</strong> (senha 123456)<br>cliente@demo.com &middot; burger@demo.com &middot; pizzaria@demo.com &middot; entregador@demo.com</div>`}
      </form>
    </div>`;
}

async function enviarAuth(e) {
  e.preventDefault();
  const cad = S.authModo === 'cadastro';
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    const corpo = { email: $('#email').value.trim(), senha: $('#senha').value };
    if (cad) Object.assign(corpo, { nome: $('#nome').value.trim(), papel: $('#papel').value, nome_restaurante: $('#nrest').value.trim(), categoria: $('#cat').value.trim() });
    entrar(await api(cad ? '/auth/register' : '/auth/login', 'POST', corpo));
  } catch (err) { aviso(err.message, true); btn.disabled = false; }
}

// ====================================================================
// Páginas internas (pedidos, painel, cardápio, entregas)
// ====================================================================
function linhaTempo(status) {
  if (status === 'cancelado') return '';
  const at = ETAPAS.indexOf(status);
  return `<ol class="linha-tempo" aria-label="Andamento do pedido">${ETAPAS.map((e, i) => `<li class="${i < at ? 'feito' : ''} ${i === at ? 'feito atual' : ''}">${STATUS[e]}</li>`).join('')}</ol>`;
}

function acoesPedido(p, papel) {
  const b = (st, txt, cls = '') => `<button class="btn peq ${cls}" data-a="status" data-id="${p.id}" data-st="${st}">${txt}</button>`;
  if (papel === 'restaurante') {
    if (p.status === 'recebido') return b('preparando', 'Aceitar e preparar', 'pri') + b('cancelado', 'Recusar', 'perigo');
    if (p.status === 'preparando') return b('pronto', 'Marcar como pronto', 'ok');
  }
  if (papel === 'entregador') {
    if (p.status === 'pronto') return b('a_caminho', 'Aceitar entrega', 'pri');
    if (p.status === 'a_caminho') return b('entregue', 'Confirmar entrega', 'ok');
  }
  if (papel === 'cliente' && p.status === 'recebido') return b('cancelado', 'Cancelar pedido', 'perigo');
  return '';
}

function cartaoPedido(p, papel) {
  const quem = papel === 'cliente' ? p.restaurante : p.cliente;
  return `<article class="cartao">
    <div class="topo"><div><h3>Pedido #${p.id} &middot; ${esc(quem)}</h3><div class="meta">${hora(p.criado_em)}${papel === 'entregador' ? ` &middot; Retirar em ${esc(p.restaurante)}` : ''}</div></div>
      <span class="etq ${p.status}">${STATUS[p.status]}</span></div>
    ${papel === 'cliente' ? linhaTempo(p.status) : ''}
    <ul class="itens-ped">${p.itens.map((i) => `<li><div>${i.quantidade}x ${esc(i.nome)}
      ${i.detalhes.length ? `<small>${i.detalhes.map(esc).join(' &middot; ')}</small>` : ''}${i.observacao ? `<small class="ob">Obs.: ${esc(i.observacao)}</small>` : ''}</div>
      <span>${brl(i.preco * i.quantidade)}</span></li>`).join('')}</ul>
    <div class="tot-ped"><span class="meta">Entregar em: ${esc(p.endereco)}<br>Pagamento: ${PAGAMENTOS[p.pagamento] || p.pagamento}${p.troco_para ? ` (troco para ${brl(p.troco_para)})` : ''}</span>
      <span class="meta" style="text-align:right">Taxa ${brl(p.taxa)}<br><strong class="preco" style="font-size:1.15rem">${brl(p.total)}</strong></span></div>
    <div class="acoes">${acoesPedido(p, papel)}</div>${notaCancelamento(p, papel)}</article>`;
}

// Explica ao cliente quando o cancelamento é possível
function notaCancelamento(p, papel) {
  if (papel !== 'cliente') return '';
  if (p.status === 'recebido') return '<p class="nota">Você pode cancelar enquanto o restaurante não aceitar o pedido.</p>';
  if (['preparando', 'pronto', 'a_caminho'].includes(p.status)) return '<p class="nota">O cancelamento só é possível enquanto o pedido está "Recebido". Como o restaurante já aceitou, fale com ele para qualquer alteração.</p>';
  return '';
}

async function renderPedidos() {
  const papel = S.user?.papel;
  if (!papel) { S.view = 'home'; return renderHome(); }
  const titulos = {
    pedidos: ['Meus pedidos', 'Acompanhe o andamento em tempo real.'],
    painel: ['Pedidos recebidos', 'Aceite, prepare e libere para entrega.'],
    entregas: ['Entregas', 'Pedidos prontos e suas entregas em andamento.'],
  };
  const [t, sub] = titulos[S.view];
  try {
    const lista = await api('/pedidos');
    if (!['pedidos', 'painel', 'entregas'].includes(S.view)) return;
    const assinatura = S.view + JSON.stringify(lista);
    if (assinatura === S.ultimo) return; // nada mudou: não refaz a tela (preserva o foco do teclado)
    S.ultimo = assinatura;
    $('#app').innerHTML = `<section class="pagina"><h1>${t}</h1><p class="sub">${sub}</p>
      ${lista.map((p) => cartaoPedido(p, papel)).join('') || `<div class="vazio"><h3>Nada por aqui ainda</h3><p>${papel === 'cliente' ? 'Faça seu primeiro pedido no cardápio.' : 'Novos pedidos aparecem automaticamente.'}</p>${papel === 'cliente' ? '<button class="btn pri" style="margin-top:16px" data-a="ir" data-v="home">Ver cardápio</button>' : ''}</div>`}
    </section>`;
  } catch (e) { aviso(e.message, true); }
}

async function renderCardapioGestao() {
  try {
    const lista = await api(`/restaurantes/${S.user.restaurante_id}/produtos`);
    $('#app').innerHTML = `<section class="pagina"><h1>Meu cardápio</h1><p class="sub">Cadastre e remova produtos do seu restaurante.</p>
      <form class="cartao" id="f-prod">
        <label for="pn" style="margin-top:0">Nome do produto</label><input id="pn" required>
        <label for="pc">Categoria</label><input id="pc" placeholder="Ex.: Hambúrgueres" value="Hambúrgueres">
        <label for="pd">Descrição</label><input id="pd">
        <label for="pp">Preço (R$)</label><input id="pp" type="number" step="0.01" min="0" required>
        <button class="btn pri bloco" style="margin-top:20px" type="submit">Adicionar produto</button></form>
      ${lista.map((p) => `<div class="cartao"><div class="topo"><div><h3>${esc(p.nome)}</h3><div class="meta">${esc(p.categoria)} &middot; ${esc(p.descricao)}</div><div class="preco" style="margin-top:6px">${brl(p.preco)}</div></div>
        <button class="btn peq perigo" data-a="rm-prod" data-id="${p.id}">Remover</button></div></div>`).join('')}</section>`;
    $('#f-prod').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/produtos', 'POST', { nome: $('#pn').value.trim(), categoria: $('#pc').value.trim(), descricao: $('#pd').value.trim(), preco: $('#pp').value });
        aviso('Produto adicionado'); renderCardapioGestao();
      } catch (err) { aviso(err.message, true); }
    };
  } catch (e) { aviso(e.message, true); }
}

function rolarPara(id) {
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
}

// ---------- Minha conta: editar nome e trocar senha ----------
async function renderConta() {
  try {
    const u = await api('/me');
    if (S.view !== 'conta') return;
    $('#app').innerHTML = `<section class="pagina"><h1>Minha conta</h1><p class="sub">Atualize seu nome ou troque a senha.</p>
      <form class="cartao" id="f-nome">
        <h3>Dados pessoais</h3>
        <label for="cn">Nome</label><input id="cn" required minlength="2" maxlength="80" value="${esc(u.nome)}" autocomplete="name">
        <label for="ce">E-mail</label><input id="ce" value="${esc(u.email)}" disabled>
        <button class="btn pri bloco" style="margin-top:20px" type="submit">Salvar nome</button>
      </form>
      <form class="cartao" id="f-senha">
        <h3>Trocar senha</h3>
        <label for="sa">Senha atual</label><input id="sa" type="password" required autocomplete="current-password">
        <label for="sn">Nova senha (mínimo 6 caracteres)</label><input id="sn" type="password" required minlength="6" maxlength="72" autocomplete="new-password">
        <label for="sc">Repita a nova senha</label><input id="sc" type="password" required minlength="6" maxlength="72" autocomplete="new-password">
        <button class="btn pri bloco" style="margin-top:20px" type="submit">Trocar senha</button>
      </form></section>`;
    const aplicar = (dados) => {
      S.token = dados.token; S.user = { ...S.user, ...dados.usuario };
      gravar('token', S.token); gravar('user', S.user); renderTopo();
    };
    $('#f-nome').onsubmit = async (e) => {
      e.preventDefault();
      try { aplicar(await api('/me', 'PATCH', { nome: $('#cn').value.trim() })); aviso('Nome atualizado'); } catch (err) { aviso(err.message, true); }
    };
    $('#f-senha').onsubmit = async (e) => {
      e.preventDefault();
      if ($('#sn').value !== $('#sc').value) return aviso('As senhas novas não são iguais', true);
      try {
        aplicar(await api('/me', 'PATCH', { senha_atual: $('#sa').value, nova_senha: $('#sn').value }));
        e.target.reset(); aviso('Senha alterada com sucesso');
      } catch (err) { aviso(err.message, true); }
    };
  } catch (e) { aviso(e.message, true); }
}

// ====================================================================
// Roteamento
// ====================================================================
function renderConteudo() {
  clearInterval(timer);
  S.ultimo = null;
  window.scrollTo(0, 0);
  if (S.view === 'home') return renderHome();
  if (S.view === 'cardapio') return renderCardapioGestao();
  if (S.view === 'conta') return renderConta();
  renderPedidos();
  timer = setInterval(() => { if (!S.overlay && document.visibilityState === 'visible') renderPedidos(); }, 5000);
}
function renderTudo() { renderTopo(); renderConteudo(); }

// ====================================================================
// Eventos
// ====================================================================
document.addEventListener('input', (e) => { if (e.target.id === 'obs' && S.m) S.m.obs = e.target.value; });
document.addEventListener('submit', (e) => { if (e.target.id === 'f-auth') enviarAuth(e); if (e.target.id === 'f-ck') e.preventDefault(); });
document.addEventListener('change', (e) => { if (e.target.id === 'papel') $('#extra-rest').hidden = e.target.value !== 'restaurante'; });

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const d = el.dataset;
  try {
    switch (d.a) {
      case 'ir': S.view = d.v; return renderTudo();
      case 'sair': return sair();
      case 'abrir-auth': S.authModo = 'entrar'; return abrirAuth();
      case 'troca-auth': S.authModo = S.authModo === 'entrar' ? 'cadastro' : 'entrar'; return trocarOverlay(htmlAuth(d.msg));
      case 'abrir-sacola': return abrirSacola();
      case 'fechar-ov': return fecharOverlay();
      case 'rolar': { e.preventDefault(); rolarPara(d.alvo); return; }
      case 'casa': { S.rest = S.rests.find((r) => r.id === Number(d.id)); await renderHome(); document.getElementById('cardapio')?.scrollIntoView({ block: 'start' }); return; }
      case 'prod': return abrirProduto(d.id);
      // modal de produto
      case 'escolha': { const g = agrupar(S.m.p.opcoes).find((x) => x.grupo === d.g); g.itens.forEach((o) => delete S.m.sel[o.id]); S.m.sel[d.o] = 1; return refazProduto(); }
      case 'rem': S.m.sel[d.o] = S.m.sel[d.o] ? 0 : 1; return refazProduto();
      case 'ex': { const o = S.m.p.opcoes.find((x) => x.id === Number(d.o)); const q = (S.m.sel[o.id] ?? o.base) + Number(d.d); S.m.sel[o.id] = Math.min(o.max, Math.max(o.min, q)); return refazProduto(); }
      case 'mq': S.m.qtd = Math.min(20, Math.max(1, S.m.qtd + Number(d.d))); return refazProduto();
      case 'add': return adicionarAoCarrinho();
      // sacola
      case 'cq': { const i = S.cart.itens[Number(d.i)]; i.qtd += Number(d.d); if (i.qtd < 1) S.cart.itens.splice(Number(d.i), 1); if (!S.cart.itens.length) S.cart.rid = null; salvaCart(); return refazSacola(); }
      case 'rm': S.cart.itens.splice(Number(d.i), 1); if (!S.cart.itens.length) S.cart.rid = null; salvaCart(); return refazSacola();
      case 'limpar': S.cart = { rid: null, itens: [] }; salvaCart(); return refazSacola();
      case 'finalizar': fecharOverlay(); return abrirCheckout();
      case 'pag': { S.pag = d.k; const end = $('#end')?.value; trocarOverlay(htmlCheckout()); if (end) $('#end').value = end; return; }
      case 'confirmar': return confirmarPedido();
      // pedidos / painel
      case 'status': { await api(`/pedidos/${d.id}/status`, 'PATCH', { status: d.st }); aviso('Status atualizado'); return renderPedidos(); }
      case 'rm-prod': { await api(`/produtos/${d.id}`, 'DELETE'); aviso('Produto removido'); return renderCardapioGestao(); }
    }
  } catch (err) { aviso(err.message, true); }
});

// ====================================================================
// PWA e início
// ====================================================================
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
// restaura a view correta do perfil logado
if (S.user?.papel === 'restaurante') S.view = 'painel';
else if (S.user?.papel === 'entregador') S.view = 'entregas';
else if (S.user?.papel === 'cliente' && new URLSearchParams(location.search).get('atalho') === 'pedidos') S.view = 'pedidos';
renderTudo();
