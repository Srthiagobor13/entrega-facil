# EntregaFácil — app de entrega de comida (PWA)

Projeto PIT: app com 3 perfis (cliente, restaurante, entregador), desenvolvido com Scrum.

## Stack
| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS e JavaScript puro, PWA (manifest + service worker) |
| Back-end | Node.js + Express (API REST, JWT, bcrypt) |
| Banco | SQLite (`node:sqlite`, nativo do Node) |
| Testes | `node:test` |
| Hospedagem | Render (`render.yaml`) |

## Rodar localmente
Requer Node 22.5 ou superior.
```bash
cd backend
npm install
npm start      # http://localhost:3000
npm test       # 10 testes automatizados da API
```

## Contas de demonstração (senha `123456`)
`cliente@demo.com`, `pizzaria@demo.com`, `burger@demo.com`, `entregador@demo.com`

## Fluxo
Cliente navega no cardápio sem login, personaliza os itens (carne, adicionais, retiradas, ponto), monta a sacola e só entra na conta ao finalizar (`recebido`). O restaurante aceita (`preparando`) e marca `pronto`. O entregador aceita (`a_caminho`) e confirma (`entregue`). A tela se atualiza a cada 5 s.

## Documentação
Veja `docs/DOCUMENTACAO.md`.

## Limitações conhecidas
- Pagamento é simulado.
- Em hospedagem gratuita o disco é efêmero: o banco SQLite reinicia a cada novo deploy.
- Status atualizado por polling, não WebSocket.

## PWA
Instalável no celular: `manifest.webmanifest` (ícones 192, 512 e maskable em PNG), service worker com cache do app (`sw.js`) e página offline (`offline.html`). A API nunca é cacheada. No Android (Chrome): menu, "Instalar app". No iPhone (Safari): Compartilhar, "Adicionar à Tela de Início".
