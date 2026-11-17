import bcrypt from 'bcryptjs';
import { PAPEIS, LIMITES } from '../config.js';
import { HttpError } from '../middleware/erros.js';
import { gerarToken } from '../middleware/auth.js';
import { texto, email as validaEmail } from '../middleware/validacao.js';

const senhaValida = (s, campo = 'A senha') => {
  if (typeof s !== 'string' || s.length < 6) throw new HttpError(400, `${campo} deve ter ao menos 6 caracteres`);
  if (s.length > LIMITES.senha) throw new HttpError(400, `${campo} deve ter no máximo ${LIMITES.senha} caracteres`);
  return s;
};

// Controller: cadastro, login e dados da própria conta.
export const criarAuthController = ({ usuarios, restaurantes }) => ({
  registrar(req, res) {
    const corpo = req.body || {};
    const nome = texto(corpo.nome, 'o nome', { min: 2, max: LIMITES.nome });
    const email = validaEmail(corpo.email, LIMITES.email);
    const senha = senhaValida(corpo.senha);
    if (!PAPEIS.includes(corpo.papel)) throw new HttpError(400, 'Tipo de conta inválido');
    const papel = corpo.papel;
    const nomeRest = papel === 'restaurante' ? texto(corpo.nome_restaurante, 'o nome do restaurante', { max: LIMITES.nome }) : null;
    const categoria = papel === 'restaurante' ? texto(corpo.categoria, 'a categoria', { max: LIMITES.categoria, obrigatorio: false }) : null;
    if (usuarios.buscarPorEmail(email)) throw new HttpError(409, 'E-mail já cadastrado');

    const usuario = usuarios.criar({ nome, email, senhaHash: bcrypt.hashSync(senha, 8), papel });
    const restauranteId = papel === 'restaurante' ? restaurantes.criar({ usuarioId: usuario.id, nome: nomeRest, categoria }) : null;
    res.status(201).json({ token: gerarToken(usuario, restauranteId), usuario: { ...usuario, restaurante_id: restauranteId } });
  },

  entrar(req, res) {
    const { email, senha } = req.body || {};
    if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) throw new HttpError(400, 'Informe e-mail e senha');
    const u = usuarios.buscarPorEmail(email.trim());
    if (!u || !bcrypt.compareSync(senha, u.senha_hash)) throw new HttpError(401, 'E-mail ou senha inválidos');
    const restauranteId = restaurantes.idDoUsuario(u.id);
    res.json({ token: gerarToken(u, restauranteId), usuario: { id: u.id, nome: u.nome, papel: u.papel, restaurante_id: restauranteId } });
  },

  // Dados da conta logada
  minhaConta(req, res) {
    const u = usuarios.buscarPorId(req.user.id);
    if (!u) throw new HttpError(404, 'Usuário não encontrado');
    res.json({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, restaurante_id: restaurantes.idDoUsuario(u.id) });
  },

  // Edita o nome e/ou troca a senha (exige a senha atual)
  atualizarConta(req, res) {
    const corpo = req.body || {};
    const u = usuarios.buscarPorId(req.user.id);
    if (!u) throw new HttpError(404, 'Usuário não encontrado');
    const querNome = corpo.nome !== undefined;
    const querSenha = corpo.nova_senha !== undefined;
    if (!querNome && !querSenha) throw new HttpError(400, 'Nada para atualizar');

    if (querNome) usuarios.atualizarNome(u.id, texto(corpo.nome, 'o nome', { min: 2, max: LIMITES.nome }));
    if (querSenha) {
      if (typeof corpo.senha_atual !== 'string' || !bcrypt.compareSync(corpo.senha_atual, u.senha_hash)) throw new HttpError(403, 'Senha atual incorreta');
      usuarios.atualizarSenha(u.id, bcrypt.hashSync(senhaValida(corpo.nova_senha, 'A nova senha'), 8));
    }
    const novo = usuarios.buscarPorId(u.id);
    const restauranteId = restaurantes.idDoUsuario(u.id);
    res.json({ token: gerarToken(novo, restauranteId), usuario: { id: novo.id, nome: novo.nome, papel: novo.papel, restaurante_id: restauranteId } });
  },
});
