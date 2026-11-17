-- Projeto físico do banco de dados: Entrega Fácil
-- SGBD alvo: PostgreSQL 14+ (a aplicação roda hoje em SQLite com o mesmo modelo; ver 04-banco-de-dados.md)

CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,
  senha_hash  VARCHAR(100) NOT NULL,
  papel       VARCHAR(12)  NOT NULL CHECK (papel IN ('cliente', 'restaurante', 'entregador'))
);

CREATE TABLE restaurantes (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER       NOT NULL REFERENCES usuarios (id),
  nome           VARCHAR(120)  NOT NULL,
  categoria      VARCHAR(60)   NOT NULL DEFAULT 'Variada',
  descricao      VARCHAR(255)  NOT NULL DEFAULT '',
  imagem         VARCHAR(255),
  taxa_entrega   NUMERIC(8,2)  NOT NULL DEFAULT 6 CHECK (taxa_entrega >= 0),
  pedido_minimo  NUMERIC(8,2)  NOT NULL DEFAULT 0 CHECK (pedido_minimo >= 0),
  tempo_min      INTEGER       NOT NULL DEFAULT 30 CHECK (tempo_min > 0),
  tempo_max      INTEGER       NOT NULL DEFAULT 45 CHECK (tempo_max >= tempo_min)
);

CREATE TABLE produtos (
  id              SERIAL PRIMARY KEY,
  restaurante_id  INTEGER       NOT NULL REFERENCES restaurantes (id),
  categoria       VARCHAR(60)   NOT NULL DEFAULT 'Outros',
  nome            VARCHAR(120)  NOT NULL,
  descricao       VARCHAR(255)  NOT NULL DEFAULT '',
  preco           NUMERIC(8,2)  NOT NULL CHECK (preco >= 0),
  imagem          VARCHAR(255),
  destaque        SMALLINT      NOT NULL DEFAULT 0 CHECK (destaque IN (0, 1)),
  ativo           SMALLINT      NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

-- tipo: escolha (uma opção por grupo), extra (quantidade entre min e max), remover (ingrediente retirado)
CREATE TABLE opcoes (
  id          SERIAL PRIMARY KEY,
  produto_id  INTEGER       NOT NULL REFERENCES produtos (id),
  grupo       VARCHAR(60)   NOT NULL,
  tipo        VARCHAR(10)   NOT NULL CHECK (tipo IN ('escolha', 'extra', 'remover')),
  nome        VARCHAR(120)  NOT NULL,
  preco       NUMERIC(8,2)  NOT NULL DEFAULT 0 CHECK (preco >= 0),
  base        INTEGER       NOT NULL DEFAULT 0,
  min         INTEGER       NOT NULL DEFAULT 0,
  max         INTEGER       NOT NULL DEFAULT 1 CHECK (max >= min)
);

CREATE TABLE pedidos (
  id              SERIAL PRIMARY KEY,
  cliente_id      INTEGER       NOT NULL REFERENCES usuarios (id),
  restaurante_id  INTEGER       NOT NULL REFERENCES restaurantes (id),
  entregador_id   INTEGER       REFERENCES usuarios (id),
  endereco        VARCHAR(255)  NOT NULL,
  subtotal        NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  taxa            NUMERIC(8,2)  NOT NULL DEFAULT 0 CHECK (taxa >= 0),
  total           NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  pagamento       VARCHAR(10)   NOT NULL DEFAULT 'pix' CHECK (pagamento IN ('pix', 'cartao', 'dinheiro')),
  troco_para      NUMERIC(10,2),
  status          VARCHAR(12)   NOT NULL DEFAULT 'recebido'
                  CHECK (status IN ('recebido', 'preparando', 'pronto', 'a_caminho', 'entregue', 'cancelado')),
  criado_em       TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- nome e preco são copiados do produto no momento da compra (histórico imutável)
CREATE TABLE itens_pedido (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER       NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  produto_id  INTEGER       NOT NULL REFERENCES produtos (id),
  nome        VARCHAR(120)  NOT NULL,
  preco       NUMERIC(8,2)  NOT NULL CHECK (preco >= 0),
  quantidade  INTEGER       NOT NULL CHECK (quantidade > 0),
  detalhes    TEXT          NOT NULL DEFAULT '[]',
  observacao  VARCHAR(200)  NOT NULL DEFAULT ''
);

CREATE INDEX idx_produtos_restaurante ON produtos (restaurante_id);
CREATE INDEX idx_opcoes_produto       ON opcoes (produto_id);
CREATE INDEX idx_pedidos_cliente      ON pedidos (cliente_id);
CREATE INDEX idx_pedidos_restaurante  ON pedidos (restaurante_id, status);
CREATE INDEX idx_itens_pedido         ON itens_pedido (pedido_id);
