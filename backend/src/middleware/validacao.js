import { HttpError } from './erros.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Exige texto (string) com tamanho entre min e max, já sem espaços nas pontas.
export function texto(valor, campo, { min = 1, max, obrigatorio = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (!obrigatorio) return '';
    throw new HttpError(400, `Informe ${campo}`);
  }
  if (typeof valor !== 'string') throw new HttpError(400, `${campo} inválido`);
  const v = valor.trim();
  if (v.length < min) throw new HttpError(400, obrigatorio ? `Informe ${campo}` : `${campo} muito curto`);
  if (max && v.length > max) throw new HttpError(400, `${campo} deve ter no máximo ${max} caracteres`);
  return v;
}

// E-mail em minúsculas e com formato válido.
export function email(valor, max = 160) {
  const v = texto(valor, 'o e-mail', { max }).toLowerCase();
  if (!EMAIL.test(v)) throw new HttpError(400, 'E-mail inválido');
  return v;
}

// Número finito vindo como number ou string numérica não vazia.
export function numero(valor, campo) {
  const ok = typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '');
  const n = ok ? Number(valor) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `${campo} inválido`);
  return n;
}
