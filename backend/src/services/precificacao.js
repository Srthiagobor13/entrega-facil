// Calcula o preço unitário de um item personalizado, sempre no servidor.
// selecao: { [opcaoId]: quantidade }. Retorna { unit, detalhes } ou lança Error com mensagem para o usuário.
const ehInteiro = (v) => typeof v === 'number' && Number.isInteger(v);

export function calcularItem(opcoes, precoBase, selecao = {}) {
  const sel = selecao && typeof selecao === 'object' && !Array.isArray(selecao) ? selecao : {};
  const ids = new Set(opcoes.map((o) => String(o.id)));
  for (const k of Object.keys(sel)) if (!ids.has(k)) throw new Error('Opção inválida');

  // escolha e remover aceitam só 0 ou 1; extra aceita inteiro dentro dos limites
  for (const o of opcoes) {
    const v = sel[o.id];
    if (v === undefined) continue;
    if (o.tipo === 'extra') continue;
    if (v !== 0 && v !== 1) throw new Error('Opção inválida');
  }

  let unit = precoBase;
  const detalhes = [];

  // escolhas: exatamente uma por grupo (a primeira é o padrão)
  const grupos = new Map();
  for (const o of opcoes.filter((x) => x.tipo === 'escolha')) {
    if (!grupos.has(o.grupo)) grupos.set(o.grupo, []);
    grupos.get(o.grupo).push(o);
  }
  for (const [grupo, lista] of grupos) {
    const marcadas = lista.filter((o) => sel[o.id] === 1);
    if (marcadas.length > 1) throw new Error(`Escolha apenas uma opção em "${grupo}"`);
    const escolhida = marcadas[0] || lista[0];
    unit += escolhida.preco;
    detalhes.push(`${grupo}: ${escolhida.nome}`);
  }

  for (const o of opcoes) {
    if (o.tipo === 'extra') {
      const qtd = sel[o.id] === undefined ? o.base : sel[o.id];
      if (!ehInteiro(qtd) || qtd < o.min || qtd > o.max) throw new Error(`Quantidade inválida para ${o.nome}`);
      unit += o.preco * Math.max(0, qtd - o.base);
      if (qtd !== o.base) detalhes.push(o.min > 0 ? `${o.nome}: ${qtd}` : `${qtd}x ${o.nome}`);
    } else if (o.tipo === 'remover' && sel[o.id] === 1) {
      detalhes.push(`Sem ${o.nome.toLowerCase()}`);
    }
  }
  return { unit: Math.round(unit * 100) / 100, detalhes };
}
