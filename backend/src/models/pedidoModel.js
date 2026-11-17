// Model: acesso às tabelas `pedidos` e `itens_pedido`.
export const criarPedidoModel = (db) => ({
  // Cria o pedido e seus itens numa transação.
  criar({ clienteId, restauranteId, endereco, subtotal, taxa, total, pagamento, troco, linhas }) {
    db.exec('BEGIN');
    try {
      const pid = Number(
        db
          .prepare(
            'INSERT INTO pedidos (cliente_id,restaurante_id,endereco,subtotal,taxa,total,pagamento,troco_para) VALUES (?,?,?,?,?,?,?,?)',
          )
          .run(clienteId, restauranteId, endereco, subtotal, taxa, total, pagamento, troco).lastInsertRowid,
      );
      const ins = db.prepare('INSERT INTO itens_pedido (pedido_id,produto_id,nome,preco,quantidade,detalhes,observacao) VALUES (?,?,?,?,?,?,?)');
      for (const l of linhas) ins.run(pid, l.produtoId, l.nome, l.unit, l.qtd, JSON.stringify(l.detalhes), l.obs);
      db.exec('COMMIT');
      return pid;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },

  buscarPorId: (id) => db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id),

  // Cliente vê os seus; restaurante vê os da sua casa; entregador vê prontos e os que aceitou.
  listarPara({ papel, usuarioId, restauranteId }) {
    let filtro;
    let params;
    if (papel === 'cliente') { filtro = 'p.cliente_id = ?'; params = [usuarioId]; }
    else if (papel === 'restaurante') { filtro = 'p.restaurante_id = ?'; params = [restauranteId]; }
    else { filtro = "(p.status = 'pronto' OR p.entregador_id = ?)"; params = [usuarioId]; }

    const pedidos = db
      .prepare(
        `SELECT p.*, r.nome AS restaurante, c.nome AS cliente
         FROM pedidos p
         JOIN restaurantes r ON r.id = p.restaurante_id
         JOIN usuarios c ON c.id = p.cliente_id
         WHERE ${filtro} ORDER BY p.id DESC LIMIT 100`,
      )
      .all(...params);
    const itens = db.prepare('SELECT nome, preco, quantidade, detalhes, observacao FROM itens_pedido WHERE pedido_id = ?');
    return pedidos.map((p) => ({ ...p, itens: itens.all(p.id).map((i) => ({ ...i, detalhes: JSON.parse(i.detalhes) })) }));
  },

  atualizarStatus: (id, status) => db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, id),

  // Atômico: só um entregador consegue aceitar um pedido ainda "pronto".
  aceitarEntrega: (id, entregadorId) =>
    db.prepare("UPDATE pedidos SET status = 'a_caminho', entregador_id = ? WHERE id = ? AND status = 'pronto'").run(entregadorId, id).changes > 0,
});
