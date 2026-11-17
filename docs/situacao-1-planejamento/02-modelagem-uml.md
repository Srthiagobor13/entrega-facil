# Modelagem UML

Diagramas em Mermaid (GitHub renderiza automaticamente).

## 1. Casos de uso
```mermaid
flowchart LR
  V([Visitante]) --> UC1(Ver restaurantes e cardápio)
  V --> UC2(Personalizar item e montar sacola)
  V --> UC3(Cadastrar e entrar)
  C([Cliente]) --> UC4(Finalizar pedido)
  C --> UC5(Acompanhar pedido)
  C --> UC6(Cancelar pedido recebido)
  R([Restaurante]) --> UC7(Gerenciar cardápio)
  R --> UC8(Aceitar ou recusar pedido)
  R --> UC9(Marcar pedido como pronto)
  E([Entregador]) --> UC10(Aceitar entrega)
  E --> UC11(Confirmar entrega)
  UC4 -. inclui .-> UC3
```
O Cliente é um Visitante autenticado. O Finalizar pedido inclui o login quando ele ainda não foi feito.

## 2. Diagrama de classes (persistência)
```mermaid
classDiagram
  class Usuario {
    +int id
    +string nome
    +string email
    +string senhaHash
    +Papel papel
  }
  class Restaurante {
    +int id
    +string nome
    +string categoria
    +decimal taxaEntrega
    +decimal pedidoMinimo
    +int tempoMin
    +int tempoMax
  }
  class Produto {
    +int id
    +string categoria
    +string nome
    +string descricao
    +decimal preco
    +bool destaque
    +bool ativo
  }
  class Opcao {
    +int id
    +string grupo
    +TipoOpcao tipo
    +string nome
    +decimal preco
    +int base
    +int min
    +int max
  }
  class Pedido {
    +int id
    +string endereco
    +decimal subtotal
    +decimal taxa
    +decimal total
    +Pagamento pagamento
    +Status status
    +datetime criadoEm
  }
  class ItemPedido {
    +int id
    +string nome
    +decimal preco
    +int quantidade
    +string[] detalhes
    +string observacao
  }
  class Papel { <<enumeration>> cliente restaurante entregador }
  class TipoOpcao { <<enumeration>> escolha extra remover }
  class Status { <<enumeration>> recebido preparando pronto a_caminho entregue cancelado }
  Usuario "1" --> "0..1" Restaurante : é dono de
  Restaurante "1" --> "0..*" Produto : oferece
  Produto "1" --> "0..*" Opcao : tem
  Usuario "1" --> "0..*" Pedido : faz (cliente)
  Usuario "0..1" --> "0..*" Pedido : entrega (entregador)
  Restaurante "1" --> "0..*" Pedido : recebe
  Pedido "1" *-- "1..*" ItemPedido : contém
  Produto "1" --> "0..*" ItemPedido : originou
```

## 3. Diagrama de sequência: finalizar pedido
```mermaid
sequenceDiagram
  actor C as Cliente
  participant V as View (PWA)
  participant R as Router
  participant PC as PedidoController
  participant PM as ProdutoModel
  participant S as Precificacao
  participant OM as PedidoModel
  C->>V: Confirmar pedido
  V->>R: POST /api/pedidos (JWT, itens, endereço, pagamento)
  R->>R: autenticar("cliente")
  R->>PC: criar(req, res)
  loop cada item
    PC->>PM: buscarAtivo(produto) e opcoesDe(produto)
    PC->>S: calcularItem(opcoes, preço, seleção)
    S-->>PC: preço unitário e detalhes (ou erro)
  end
  PC->>PC: valida pedido mínimo, soma taxa e total
  PC->>OM: criar(pedido, linhas) em transação
  OM-->>PC: id do pedido
  PC-->>V: 201 {id, subtotal, taxa, total}
  V-->>C: "Pedido enviado" e linha do tempo
```

## 4. Diagrama de sequência: preparo e entrega
```mermaid
sequenceDiagram
  actor R as Restaurante
  actor E as Entregador
  actor C as Cliente
  participant API as API (PedidoController)
  R->>API: PATCH /pedidos/:id/status {preparando}
  API-->>R: 200
  R->>API: PATCH /pedidos/:id/status {pronto}
  API-->>R: 200
  E->>API: GET /pedidos (prontos disponíveis)
  E->>API: PATCH /pedidos/:id/status {a_caminho}
  API-->>E: 200 (ou 409 se outro entregador aceitou antes)
  E->>API: PATCH /pedidos/:id/status {entregue}
  loop a cada 5 s
    C->>API: GET /pedidos
    API-->>C: status atualizado
  end
```

## 5. Diagrama de atividades: jornada do cliente
```mermaid
flowchart TD
  A([Abre o app]) --> B[Escolhe o restaurante]
  B --> C[Abre um item]
  C --> D[Personaliza e adiciona à sacola]
  D --> E{Quer mais itens?}
  E -- sim --> C
  E -- não --> F[Abre a sacola]
  F --> G{Subtotal maior ou igual ao mínimo?}
  G -- não --> C
  G -- sim --> H{Está logado?}
  H -- não --> I[Entra ou cria conta]
  I --> J
  H -- sim --> J[Informa endereço e pagamento]
  J --> K[Confirma o pedido]
  K --> L[Acompanha a linha do tempo]
  L --> M{Entregue?}
  M -- não --> L
  M -- sim --> N([Fim])
```
