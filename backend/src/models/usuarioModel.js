// Model: acesso à tabela `usuarios`.
export const criarUsuarioModel = (db) => ({
  buscarPorEmail: (email) => db.prepare('SELECT * FROM usuarios WHERE lower(email) = lower(?)').get(email),

  buscarPorId: (id) => db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id),

  criar({ nome, email, senhaHash, papel }) {
    const r = db.prepare('INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,?)').run(nome, email, senhaHash, papel);
    return { id: Number(r.lastInsertRowid), nome, papel };
  },

  atualizarNome: (id, nome) => db.prepare('UPDATE usuarios SET nome = ? WHERE id = ?').run(nome, id),

  atualizarSenha: (id, senhaHash) => db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(senhaHash, id),
});
