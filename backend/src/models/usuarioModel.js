// Model: acesso à tabela `usuarios`.
export const criarUsuarioModel = (db) => ({
  buscarPorEmail: (email) => db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email),

  criar({ nome, email, senhaHash, papel }) {
    const r = db.prepare('INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,?)').run(nome, email, senhaHash, papel);
    return { id: Number(r.lastInsertRowid), nome, papel };
  },
});
