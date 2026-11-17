# Laudo de qualidade

## 1. Verificação (testes automatizados)
Rodar: `cd backend && npm test`.

Resultado da última execução: **23 testes, 23 aprovados, 0 falhas.**

| Arquivo | Testes | O que prova |
|---|---|---|
| `test/api.test.js` | 10 | Fluxo pedido, preparo e entrega. Permissões entre perfis. Personalização com preço. Pedido mínimo. Validação do pedido. Cadastro e login. CRUD de produto |
| `test/precificacao.test.js` | 6 | Cálculo do preço: base, carne extra, escolha paga, adicional, remoção, limites e arredondamento |
| `test/erros-e-pwa.test.js` | 7 | JSON inválido, 404, token inválido, login e cadastro com dados ruins, e arquivos do PWA (manifest, ícones, service worker) |

## 2. Validação manual feita pelo autor
Fluxo ponta a ponta no navegador, nos três perfis:
- Cliente: cardápio sem login, personalização, sacola, login no checkout, pedido com pagamento em dinheiro e troco.
- Restaurante: aceitar, preparar e marcar como pronto.
- Entregador: aceitar a entrega e confirmar.
- PWA: service worker ativo, manifest válido e cache do app preenchido.

## 3. Validação com usuários
Veja [`registro-dos-5-testes.md`](registro-dos-5-testes.md) e o formulário em [`formulario-de-teste.md`](formulario-de-teste.md).

## 4. Erros encontrados e correções
Preencher depois dos testes com os colegas. Anexe prints em `evidencias/`.

| # | Origem | Erro encontrado | Evidência | Correção aplicada | Situação |
|---|---|---|---|---|---|
| 1 | | | | | |

## 5. Limitações conhecidas
- Pagamento é simulado. Nenhuma cobrança real é feita.
- Em hospedagem gratuita o banco SQLite reinicia a cada deploy. Os dados de demonstração voltam.
- O status do pedido atualiza a cada 5 s (polling), não em tempo real por WebSocket.
- O restaurante cadastra produtos, mas ainda não edita as opções de personalização.
- Não há testes automatizados do front-end (a validação dele foi manual).
