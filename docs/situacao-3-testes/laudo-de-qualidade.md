# Laudo de qualidade

Sistema: Entrega Fácil (PWA) · https://entrega-facil-utpk.onrender.com · Data: 17/11/2026

## 1. Verificação (testes automatizados)
Rodar: `cd backend && npm test`.

Resultado da última execução: **33 testes, 33 aprovados, 0 falhas.**

| Arquivo | Testes | O que prova |
|---|---|---|
| `test/api.test.js` | 10 | Fluxo pedido, preparo e entrega. Permissões entre perfis. Personalização com preço. Pedido mínimo. Validação do pedido. Cadastro e login. CRUD de produto |
| `test/precificacao.test.js` | 6 | Cálculo do preço: base, carne extra, escolha paga, adicional, remoção, limites e arredondamento |
| `test/erros-e-pwa.test.js` | 7 | JSON inválido, 404, token inválido, login e cadastro com dados ruins, e arquivos do PWA |
| `test/correcoes.test.js` | 10 | Regressão dos erros achados no QA: e-mail, troco, tipos inesperados, produto inválido, disputa de entrega, troca de senha, cabeçalhos de segurança e limite de tentativas |

## 2. Validação manual feita pelo autor
Fluxo ponta a ponta no navegador, nos três perfis, e conferência do layout em tela de celular de 375 px (cliente, restaurante, entregador e visitante).

## 3. QA automatizado com agentes de IA
Cinco agentes de IA testaram o site publicado, cada um com um foco. Eles não são colegas de curso e não substituem testes com pessoas. O detalhe está em [`relatorio-qa-automatizado.md`](relatorio-qa-automatizado.md) e rendeu 17 itens.

## 4. Feedback dos testadores
Registro conforme informado pelo autor. A coluna "Verificação" mostra o que foi conferido no sistema.

| Testador | Relato | Verificação e resultado |
|---|---|---|
| Lívia Aparecida Nascimento | "Não tem a opção de cancelar pedido" | O botão existia, mas só aparecia em "Recebido" e sumia sem explicação. **Corrigido:** o app agora explica quando o cancelamento é possível |
| Matheus Xavier Santos | "Testei e funcionou tudo" | Sem ponto a corrigir |
| Eder Mocco Sales | "Não tem a opção de editar dados pessoais e trocar a senha" | Confirmado. **Corrigido:** criada a tela Conta (editar nome e trocar senha) e a rota `PATCH /api/me` |
| Marcos Pereira Silva | "Botão escondido no celular" | Confirmado (grave). **Corrigido:** o topo quebra em duas linhas no celular. Medido a 375 px nos quatro perfis, nenhum botão passa da borda (maior borda em 359 px) |
| Manoel Caroso Xavier | "Tudo certo" | Sem ponto a corrigir |

Localização ao vivo do entregador (citada por um testador) não foi implementada e está fora do escopo.

## 5. Erros encontrados e correções
| # | Origem | Erro encontrado | Correção aplicada | Situação |
|---|---|---|---|---|
| 1 | Marcos, QA 5 | Menu estourava em 375 px e escondia Sacola e Sair | Topo em duas linhas no celular, botões fora da tela eliminados, altura do topo medida para o resto do layout | Corrigido |
| 2 | Lívia | Cancelar sumia sem explicar | Aviso sobre quando o cancelamento é permitido | Corrigido |
| 3 | Eder | Sem editar dados nem trocar senha | Tela Conta e `PATCH /api/me` com senha atual obrigatória | Corrigido |
| 4 | QA 1 | Troco menor que o total aceito | Troco precisa cobrir o total | Corrigido |
| 5 | QA 1 | E-mail inválido e duplicado por maiúsculas | Validação de formato e e-mail em minúsculas | Corrigido |
| 6 | QA 3 | Sem limite de tentativas de login | Máximo de 10 falhas a cada 15 min por IP (resposta 429) | Corrigido |
| 7 | QA 3 | Sem limite de tamanho nos campos | Validação de tipo e tamanho em todos os campos de texto | Corrigido |
| 8 | QA 3 | Sem cabeçalhos de segurança | `helmet` com política de conteúdo (CSP) e sem `x-powered-by` | Corrigido |
| 9 | QA 5 | Erro em inglês e sem indicador de carregamento | Mensagens em português, tempo limite de 70 s e tela "Carregando o cardápio" | Corrigido |
| 10 | QA 5 | Carrinho salvo corrompido deixava a tela em branco | O carrinho salvo é validado e reiniciado se inválido | Corrigido |
| 11 | QA 5 | Foco do teclado perdido no modal e na atualização automática | Foco vai para a janela, fica preso nela e volta a quem abriu. A lista só se redesenha quando algo muda | Corrigido |
| 12 | QA 4 | Produto com nome só de espaços, preço vazio ou zero | Validação de nome e de preço maior que zero | Corrigido |
| 13 | QA 2, 3, 4 | Erro 500 com tipos inesperados | Validação de tipos. Devolve 400 | Corrigido |
| 14 | QA 4 | Disputa de entrega devolvia 403 e remover produto duas vezes devolvia 200 | 409 para quem perde a disputa e 404 na segunda remoção | Corrigido |
| 15 | QA 3 | Segredo padrão do JWT no código | Em produção o app não inicia sem `JWT_SECRET` | Corrigido |

Itens de gravidade baixa sem tratamento: carregamento sob demanda de imagens, tags de compartilhamento (og), aviso para navegador sem JavaScript e setas de teclado nos grupos de escolha.

## 6. Não implementado (fora do escopo desta versão)
- Localização ao vivo do entregador.
- Pagamento online real (é simulado).
- Edição das opções de personalização pelo restaurante.

## 7. Limitações conhecidas
- Em hospedagem gratuita o banco SQLite reinicia a cada deploy e quando o serviço dorme. Os dados de demonstração voltam.
- O status do pedido atualiza a cada 5 s (polling), não em tempo real por WebSocket.
- Não há testes automatizados do front-end (a validação dele foi manual e com os agentes).

## 8. Evidências a anexar
Coloque os prints em `evidencias/`: o menu em 375 px logado (antes e depois), a tela Conta, o aviso de cancelamento, a saída do `npm test` com 33 testes e o app publicado.
