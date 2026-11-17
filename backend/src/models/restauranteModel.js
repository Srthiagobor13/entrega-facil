// Model: acesso à tabela `restaurantes`.
export const criarRestauranteModel = (db) => ({
  listar: () =>
    db
      .prepare(
        `SELECT id, nome, categoria, descricao, imagem, taxa_entrega, pedido_minimo, tempo_min, tempo_max
         FROM restaurantes ORDER BY CASE WHEN nome = 'Burger House' THEN 0 ELSE 1 END, nome`,
      )
      .all(),

  buscarPorId: (id) => db.prepare('SELECT * FROM restaurantes WHERE id = ?').get(id),

  idDoUsuario: (usuarioId) => db.prepare('SELECT id FROM restaurantes WHERE usuario_id = ?').get(usuarioId)?.id ?? null,

  criar({ usuarioId, nome, categoria }) {
    return Number(
      db.prepare('INSERT INTO restaurantes (usuario_id,nome,categoria) VALUES (?,?,?)').run(usuarioId, nome, categoria || 'Variada')
        .lastInsertRowid,
    );
  },
});
