import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularItem } from '../src/services/precificacao.js';

// Opções de um hambúrguer fictício
const opcoes = [
  { id: 1, grupo: 'Carnes', tipo: 'extra', nome: 'Carne', preco: 9, base: 1, min: 1, max: 4 },
  { id: 2, grupo: 'Pão', tipo: 'escolha', nome: 'Brioche', preco: 0, base: 0, min: 0, max: 1 },
  { id: 3, grupo: 'Pão', tipo: 'escolha', nome: 'Australiano', preco: 2, base: 0, min: 0, max: 1 },
  { id: 4, grupo: 'Adicionais', tipo: 'extra', nome: 'Bacon', preco: 6, base: 0, min: 0, max: 3 },
  { id: 5, grupo: 'Retirar', tipo: 'remover', nome: 'Cebola', preco: 0, base: 0, min: 0, max: 1 },
];

test('sem seleção: preço base e escolha padrão', () => {
  const r = calcularItem(opcoes, 30);
  assert.equal(r.unit, 30);
  assert.deepEqual(r.detalhes, ['Pão: Brioche']);
});

test('carne extra cobra só o que passa da base', () => {
  assert.equal(calcularItem(opcoes, 30, { 1: 3 }).unit, 48);
  assert.equal(calcularItem(opcoes, 30, { 1: 1 }).unit, 30);
});

test('escolha paga, adicional e remoção compõem o preço e os detalhes', () => {
  const r = calcularItem(opcoes, 30, { 3: 1, 4: 2, 5: 1 });
  assert.equal(r.unit, 30 + 2 + 12);
  assert.deepEqual(r.detalhes, ['Pão: Australiano', '2x Bacon', 'Sem cebola']);
});

test('rejeita quantidade fora dos limites', () => {
  assert.throws(() => calcularItem(opcoes, 30, { 1: 0 }), /inválida/);
  assert.throws(() => calcularItem(opcoes, 30, { 4: 4 }), /inválida/);
  assert.throws(() => calcularItem(opcoes, 30, { 4: 1.5 }), /inválida/);
});

test('rejeita opção inexistente e duas escolhas no mesmo grupo', () => {
  assert.throws(() => calcularItem(opcoes, 30, { 99: 1 }), /inválida/);
  assert.throws(() => calcularItem(opcoes, 30, { 2: 1, 3: 1 }), /apenas uma/);
});

test('arredonda em centavos', () => {
  const ops = [{ id: 1, grupo: 'X', tipo: 'extra', nome: 'Y', preco: 0.1, base: 0, min: 0, max: 5 }];
  assert.equal(calcularItem(ops, 0.2, { 1: 1 }).unit, 0.3);
});
