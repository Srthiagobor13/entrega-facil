import jwt from 'jsonwebtoken';
import { SECRET } from '../config.js';
import { HttpError } from './erros.js';

export const gerarToken = (usuario, restauranteId = null) =>
  jwt.sign({ id: usuario.id, nome: usuario.nome, papel: usuario.papel, restaurante_id: restauranteId }, SECRET, { expiresIn: '12h' });

// Exige token válido. Se `papeis` for informado, restringe o acesso a esses papéis.
export const autenticar = (...papeis) => (req, _res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
  } catch {
    throw new HttpError(401, 'Não autenticado');
  }
  if (papeis.length && !papeis.includes(req.user.papel)) throw new HttpError(403, 'Sem permissão');
  next();
};
