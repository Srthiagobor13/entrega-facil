// Model: acesso às tabelas `produtos` e `opcoes`.
export const criarProdutoModel = (db) => {
  const opcoesDe = (produtoId) =>
    db.prepare('SELECT id, grupo, tipo, nome, preco, base, min, max FROM opcoes WHERE produto_id = ? ORDER BY id').all(produtoId);

  return {
    opcoesDe,

    listarPorRestaurante(restauranteId) {
      const produtos = db
        .prepare(
          `SELECT id, categoria, nome, descricao, preco, imagem, destaque FROM produtos
           WHERE restaurante_id = ? AND ativo = 1 ORDER BY id`,
        )
        .all(restauranteId);
      return produtos.map((p) => ({ ...p, opcoes: opcoesDe(p.id) }));
    },

    buscarAtivo: (id, restauranteId) =>
      db.prepare('SELECT * FROM produtos WHERE id = ? AND restaurante_id = ? AND ativo = 1').get(id, restauranteId),

    criar({ restauranteId, categoria, nome, descricao, preco }) {
      const r = db
        .prepare('INSERT INTO produtos (restaurante_id,categoria,nome,descricao,preco) VALUES (?,?,?,?,?)')
        .run(restauranteId, categoria, nome, descricao, preco);
      return { id: Number(r.lastInsertRowid), categoria, nome, descricao, preco, opcoes: [] };
    },

    desativar: (id, restauranteId) =>
      db.prepare('UPDATE produtos SET ativo = 0 WHERE id = ? AND restaurante_id = ?').run(id, restauranteId).changes > 0,
  };
};
