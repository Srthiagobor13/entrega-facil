import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const SCHEMA_VERSION = 2;

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = OFF');
  const { user_version: v } = db.prepare('PRAGMA user_version').get();
  if (v < SCHEMA_VERSION) {
    // Projeto em desenvolvimento: recria o esquema ao mudar de versão.
    for (const t of ['itens_pedido', 'pedidos', 'opcoes', 'produtos', 'restaurantes', 'usuarios']) db.exec(`DROP TABLE IF EXISTS ${t}`);
  }
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
      categoria TEXT NOT NULL DEFAULT 'Variada',
      descricao TEXT NOT NULL DEFAULT '',
      imagem TEXT,
      taxa_entrega REAL NOT NULL DEFAULT 6,
      pedido_minimo REAL NOT NULL DEFAULT 0,
      tempo_min INTEGER NOT NULL DEFAULT 30,
      tempo_max INTEGER NOT NULL DEFAULT 45
    );
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
      categoria TEXT NOT NULL DEFAULT 'Outros',
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      preco REAL NOT NULL CHECK (preco >= 0),
      imagem TEXT,
      destaque INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1
    );
    -- tipo: escolha (uma por grupo), extra (quantidade min..max), remover (ingrediente a retirar)
    CREATE TABLE IF NOT EXISTS opcoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      grupo TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('escolha','extra','remover')),
      nome TEXT NOT NULL,
      preco REAL NOT NULL DEFAULT 0,
      base INTEGER NOT NULL DEFAULT 0,
      min INTEGER NOT NULL DEFAULT 0,
      max INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
      restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
      entregador_id INTEGER REFERENCES usuarios(id),
      endereco TEXT NOT NULL,
      subtotal REAL NOT NULL,
      taxa REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      pagamento TEXT NOT NULL DEFAULT 'pix',
      troco_para REAL,
      status TEXT NOT NULL DEFAULT 'recebido',
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      produto_id INTEGER NOT NULL REFERENCES produtos(id),
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      quantidade INTEGER NOT NULL CHECK (quantidade > 0),
      detalhes TEXT NOT NULL DEFAULT '[]',
      observacao TEXT NOT NULL DEFAULT ''
    );
  `);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}

// ---------- Dados de demonstração ----------
const PONTO = ['escolha', 'Ponto da carne', [['Ao ponto', 0], ['Mal passada', 0], ['Bem passada', 0]]];
const PAO = ['escolha', 'Pão', [['Brioche', 0], ['Australiano', 2], ['Sem glúten', 4]]];

export function seed(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
  if (n > 0) return;
  const hash = bcrypt.hashSync('123456', 8);
  const addUser = db.prepare('INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,?)');
  const addRest = db.prepare(
    'INSERT INTO restaurantes (usuario_id,nome,categoria,descricao,imagem,taxa_entrega,pedido_minimo,tempo_min,tempo_max) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  const addProd = db.prepare('INSERT INTO produtos (restaurante_id,categoria,nome,descricao,preco,imagem,destaque) VALUES (?,?,?,?,?,?,?)');
  const addOp = db.prepare('INSERT INTO opcoes (produto_id,grupo,tipo,nome,preco,base,min,max) VALUES (?,?,?,?,?,?,?,?)');

  addUser.run('Cliente Demo', 'cliente@demo.com', hash, 'cliente');
  addUser.run('Entregador Demo', 'entregador@demo.com', hash, 'entregador');

  const prod = (rid, cat, nome, desc, preco, img, destaque = 0) =>
    Number(addProd.run(rid, cat, nome, desc, preco, img, destaque).lastInsertRowid);

  const escolha = (pid, [, grupo, itens]) => itens.forEach(([nome, preco]) => addOp.run(pid, grupo, 'escolha', nome, preco, 0, 0, 1));
  const extra = (pid, nome, preco, max, base = 0, min = 0) => addOp.run(pid, 'Adicionais', 'extra', nome, preco, base, min, max);
  const remover = (pid, ...nomes) => nomes.forEach((n2) => addOp.run(pid, 'Retirar ingredientes', 'remover', n2, 0, 0, 0, 1));
  const carne = (pid, base, max = 4) => addOp.run(pid, 'Carnes', 'extra', 'Carne artesanal 150 g', 9, base, 1, max);
  const adicionaisBurger = (pid) => {
    extra(pid, 'Queijo cheddar', 4, 3);
    extra(pid, 'Bacon crocante', 6, 3);
    extra(pid, 'Ovo', 3.5, 2);
    extra(pid, 'Cebola caramelizada', 3, 2);
    extra(pid, 'Molho da casa', 2.5, 3);
  };

  // ----- Burger House -----
  const u2 = Number(addUser.run('Dono Burger', 'burger@demo.com', hash, 'restaurante').lastInsertRowid);
  const r2 = Number(
    addRest.run(u2, 'Burger House', 'Hambúrguer artesanal', 'Blend da casa, pães de fermentação natural e molhos autorais.', 'img/hero.jpg', 6.9, 25, 30, 45)
      .lastInsertRowid,
  );

  const burger = (nome, desc, preco, img, baseCarne, remocoes, destaque = 0) => {
    const id = prod(r2, 'Hambúrgueres', nome, desc, preco, img, destaque);
    carne(id, baseCarne);
    escolha(id, PONTO);
    escolha(id, PAO);
    adicionaisBurger(id);
    remover(id, ...remocoes);
    return id;
  };
  burger('Clássico da Casa', 'Brioche, carne 150 g, queijo prato, alface, tomate e maionese da casa.', 28.9, 'img/b2.jpg', 1, ['Alface', 'Tomate', 'Cebola', 'Maionese'], 1);
  burger('Cheddar Duplo', 'Duas carnes 150 g, cheddar cremoso, cebola caramelizada e molho especial.', 36.9, 'img/b5.jpg', 2, ['Cebola caramelizada', 'Picles', 'Molho especial'], 1);
  burger('Bacon Smokehouse', 'Carne 180 g, bacon crocante, cheddar, alface, tomate e barbecue defumado.', 34.9, 'img/b7.jpg', 1, ['Alface', 'Tomate', 'Barbecue', 'Bacon'], 1);
  burger('Triplo Brutus', 'Três carnes 150 g, pastrami, queijo prato e molho de mostarda e mel.', 46.9, 'img/b4.jpg', 3, ['Pastrami', 'Molho de mostarda e mel']);
  burger('Fresh Burger', 'Carne 150 g, alface americana, tomate, picles e maionese verde.', 27.9, 'img/b3.jpg', 1, ['Alface', 'Tomate', 'Picles', 'Maionese verde']);

  const combo = (nome, desc, preco, img, baseCarne) => {
    const id = prod(r2, 'Combos', nome, desc, preco, img);
    carne(id, baseCarne, 3);
    escolha(id, PONTO);
    escolha(id, ['escolha', 'Bebida', [['Refrigerante cola', 0], ['Refrigerante guaraná', 0], ['Suco de laranja', 3]]]);
    escolha(id, ['escolha', 'Batata', [['Rústica', 0], ['Palito', 0], ['Cheddar e bacon', 5]]]);
    return id;
  };
  combo('Combo Clássico', 'Clássico da Casa, batata individual e bebida 350 ml.', 44.9, 'img/b8.jpg', 1);
  combo('Combo Cheddar Duplo', 'Cheddar Duplo, batata individual e bebida 350 ml.', 52.9, 'img/b6.jpg', 2);
  const casal = prod(r2, 'Combos', 'Combo Casal', 'Dois Clássicos, batata grande para dividir e duas bebidas.', 84.9, 'img/b1.jpg');
  escolha(casal, ['escolha', 'Bebidas', [['2 refrigerantes cola', 0], ['2 refrigerantes guaraná', 0], ['2 sucos de laranja', 6]]]);
  escolha(casal, PONTO);

  const bat = prod(r2, 'Acompanhamentos', 'Batata Rústica', 'Com casca, alho e alecrim. Acompanha molho da casa.', 19.9, 'img/fries.jpg');
  escolha(bat, ['escolha', 'Tamanho', [['Média', 0], ['Grande', 7]]]);
  extra(bat, 'Cheddar cremoso', 5, 2);
  extra(bat, 'Bacon crocante', 6, 2);
  const palito = prod(r2, 'Acompanhamentos', 'Batata Palito', 'Crocante, sequinha, porção individual.', 16.9, 'img/fries2.jpg');
  escolha(palito, ['escolha', 'Tamanho', [['Média', 0], ['Grande', 6]]]);
  extra(palito, 'Cheddar cremoso', 5, 2);

  const suco = prod(r2, 'Bebidas', 'Suco de Laranja 500 ml', 'Espremido na hora, sem açúcar.', 12.9, 'img/suco.jpg');
  escolha(suco, ['escolha', 'Gelo', [['Com gelo', 0], ['Sem gelo', 0]]]);
  const s1 = prod(r2, 'Bebidas', 'Milk-shake Chocolate', 'Sorvete artesanal, calda de chocolate e chantilly. 400 ml.', 22.9, 'img/shake1.jpg');
  extra(s1, 'Chantilly extra', 2, 2);
  prod(r2, 'Bebidas', 'Milk-shake Cookies', 'Sorvete de creme, pedaços de cookie e calda. 400 ml.', 24.9, 'img/shake2.jpg');
  const refri = prod(r2, 'Bebidas', 'Refrigerante lata 350 ml', 'Bem gelado.', 7, null);
  escolha(refri, ['escolha', 'Sabor', [['Cola', 0], ['Guaraná', 0], ['Limão', 0]]]);

  prod(r2, 'Sobremesas', 'Sundae Cookies', 'Taça de sorvete com cookies, calda de chocolate e chantilly.', 19.9, 'img/dessert1.jpg');
  prod(r2, 'Sobremesas', 'Donuts Confeitados', 'Trio de donuts com cobertura de chocolate e confeitos.', 17.9, 'img/dessert2.jpg');

  // ----- Pizzaria Bella -----
  const u1 = Number(addUser.run('Dono Pizzaria', 'pizzaria@demo.com', hash, 'restaurante').lastInsertRowid);
  const r1 = Number(
    addRest.run(u1, 'Pizzaria Bella', 'Pizza artesanal', 'Massa de longa fermentação e forno a lenha.', 'img/pizza2.jpg', 8.9, 35, 40, 60).lastInsertRowid,
  );
  const pizza = (nome, desc, preco, img) => {
    const id = prod(r1, 'Pizzas', nome, desc, preco, img, 1);
    escolha(id, ['escolha', 'Tamanho', [['Média (6 fatias)', 0], ['Grande (8 fatias)', 14]]]);
    extra(id, 'Borda recheada', 9, 1);
    extra(id, 'Queijo extra', 6, 2);
    remover(id, 'Cebola', 'Azeitona');
    return id;
  };
  pizza('Margherita', 'Molho de tomate, mussarela de búfala e manjericão fresco.', 48.9, 'img/pizza2.jpg');
  pizza('Frango com Catupiry', 'Frango desfiado, catupiry, milho e cebola roxa.', 54.9, 'img/pizza1.jpg');
  const ref2 = prod(r1, 'Bebidas', 'Refrigerante 2 L', 'Cola, guaraná ou limão.', 13, null);
  escolha(ref2, ['escolha', 'Sabor', [['Cola', 0], ['Guaraná', 0], ['Limão', 0]]]);
}
