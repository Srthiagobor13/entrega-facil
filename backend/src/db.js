import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('cliente','restaurante','entregador'))
    );
    CREATE TABLE IF NOT EXISTS restaurantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Variada'
    );
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      preco REAL NOT NULL CHECK (preco >= 0),
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
      restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
      entregador_id INTEGER REFERENCES usuarios(id),
      endereco TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'recebido',
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      quantidade INTEGER NOT NULL CHECK (quantidade > 0)
    );
  `);
  return db;
}

export function seed(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
  if (n > 0) return;
  const hash = bcrypt.hashSync('123456', 8);
  const addUser = db.prepare('INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,?)');
  const addRest = db.prepare('INSERT INTO restaurantes (usuario_id,nome,categoria) VALUES (?,?,?)');
  const addProd = db.prepare('INSERT INTO produtos (restaurante_id,nome,descricao,preco) VALUES (?,?,?,?)');

  addUser.run('Cliente Demo', 'cliente@demo.com', hash, 'cliente');
  addUser.run('Entregador Demo', 'entregador@demo.com', hash, 'entregador');

  const u1 = Number(addUser.run('Dono Pizzaria', 'pizzaria@demo.com', hash, 'restaurante').lastInsertRowid);
  const r1 = Number(addRest.run(u1, 'Pizzaria Bella', 'Pizza').lastInsertRowid);
  addProd.run(r1, 'Pizza Margherita', 'Molho, mussarela e manjericão', 42.9);
  addProd.run(r1, 'Pizza Calabresa', 'Calabresa, cebola e mussarela', 45.0);
  addProd.run(r1, 'Refrigerante 2L', 'Cola, guaraná ou limão', 12.0);

  const u2 = Number(addUser.run('Dono Burger', 'burger@demo.com', hash, 'restaurante').lastInsertRowid);
  const r2 = Number(addRest.run(u2, 'Burger House', 'Hambúrguer').lastInsertRowid);
  addProd.run(r2, 'X-Burger', 'Pão, carne 150g, queijo e salada', 24.5);
  addProd.run(r2, 'X-Bacon', 'Pão, carne 150g, queijo e bacon', 29.9);
  addProd.run(r2, 'Batata Frita', 'Porção média', 16.0);
}
