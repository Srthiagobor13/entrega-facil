import bcrypt from 'bcryptjs';
import { PAPEIS } from '../config.js';
import { HttpError } from '../middleware/erros.js';
import { gerarToken } from '../middleware/auth.js';

// Controller: cadastro e login.
export const criarAuthController = ({ usuarios, restaurantes }) => ({
  registrar(req, res) {
    const { nome, email, senha, papel, nome_restaurante, categoria } = req.body || {};
    if (!nome || !email || !senha || !PAPEIS.includes(papel)) throw new HttpError(400, 'Dados inválidos');
    if (String(senha).length < 6) throw new HttpError(400, 'Senha deve ter ao menos 6 caracteres');
    if (papel === 'restaurante' && !nome_restaurante) throw new HttpError(400, 'Informe o nome do restaurante');
    if (usuarios.buscarPorEmail(email)) throw new HttpError(409, 'E-mail já cadastrado');

    const usuario = usuarios.criar({ nome, email, senhaHash: bcrypt.hashSync(String(senha), 8), papel });
    const restauranteId = papel === 'restaurante' ? restaurantes.criar({ usuarioId: usuario.id, nome: nome_restaurante, categoria }) : null;
    res.status(201).json({ token: gerarToken(usuario, restauranteId), usuario: { ...usuario, restaurante_id: restauranteId } });
  },

  entrar(req, res) {
    const { email, senha } = req.body || {};
    const u = usuarios.buscarPorEmail(email || '');
    if (!u || !bcrypt.compareSync(String(senha || ''), u.senha_hash)) throw new HttpError(401, 'E-mail ou senha inválidos');
    const restauranteId = restaurantes.idDoUsuario(u.id);
    res.json({ token: gerarToken(u, restauranteId), usuario: { id: u.id, nome: u.nome, papel: u.papel, restaurante_id: restauranteId } });
  },
});
