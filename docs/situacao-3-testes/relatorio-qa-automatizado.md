# Relatório de QA automatizado (agentes de IA)

**Data:** 17/11/2026 · **Alvo:** https://entrega-facil-utpk.onrender.com

> **Importante:** estes testes foram feitos por **agentes de IA (Claude)**, cada um com um foco, e não por colegas de curso. Eles complementam o laudo, mas **não substituem** os 5 testes com pessoas reais (ver [`registro-dos-5-testes.md`](registro-dos-5-testes.md)). Cada agente executou requisições reais contra o site publicado ou leu o código. Itens que o agente não conseguiu executar estão marcados como não testados.

## Agente QA 1: jornada do cliente (cerca de 55 requisições)
**O que testou e funcionou**
- Cadastro: campos faltando, senha curta e papel inválido são recusados (400). E-mail repetido retorna 409.
- Login certo e errado. A mensagem é igual para senha errada e e-mail inexistente.
- Cardápio e restaurantes visíveis sem login.
- Pedido válido: Clássico da Casa com total de R$ 35,80 (28,90 mais taxa de 6,90), conferido.
- Pedido sem login (401), sem endereço, com carrinho vazio, abaixo do mínimo, quantidade 0, negativa, 51, decimal ou texto, pagamento inválido: todos recusados.
- Cliente só vê os próprios pedidos. Cancelar em "recebido" funciona. Cancelar depois que o restaurante aceita é bloqueado (400). Cancelar pedido de outro cliente retorna 403.

**O que testou e não funcionou, e o que corrigir**
1. (Média) Pagamento em dinheiro com troco menor que o total é aceito.
2. (Média) E-mail sem formato válido, como "abc", é aceito no cadastro.
3. (Média) O mesmo e-mail em maiúsculas cria conta duplicada.
4. (Baixa) Restaurante inexistente retorna 200 com lista vazia, em vez de 404.
5. (Baixa) Dinheiro sem `troco_para` é aceito. Pode ser regra intencional.

**Não testado:** interface web, Pizzaria Bella, extras no pedido, fluxo do entregador, expiração do token.

## Agente QA 2: personalização e preço (cerca de 48 requisições)
**O que testou e funcionou**
- Cálculos conferidos à mão: Cheddar Duplo com carne extra, bacon e pão australiano deu R$ 53,90 (total R$ 60,80). Pedido com 3 itens e centavos fechou em R$ 391,20.
- Carne fora do mínimo ou do máximo, valores nulos, texto e objetos retornam 400.
- Duas escolhas no mesmo grupo, opção de outro produto, opção inexistente e as chaves `__proto__` e `constructor` retornam 400.
- Preço, total e taxa enviados pelo cliente são ignorados. O servidor sempre recalcula.
- As personalizações voltam corretas na listagem de pedidos.

**O que testou e não funcionou, e o que corrigir** (todos de gravidade baixa)
1. `itens: [null]` gera erro 500 em vez de 400.
2. Tipos aceitos demais: quantidade `"2"`, carne `"3"` e carne `[3]` passam. O preço continua correto.
3. Escolhas com valor estranho, como `{Australiano: 5}`, contam como marcadas.
4. `selecao` em texto ou `null` é ignorada sem erro.
5. Observação em objeto vira "[object Object]".
6. Observação com HTML é gravada sem tratamento (o front-end escapa ao exibir).

**Não testado:** troco e formas de pagamento, combos, pedido mínimo, carga.

## Agente QA 3: segurança e permissões (cerca de 70 requisições)
**O que testou e funcionou**
- Sem token, token inválido, assinatura adulterada, `alg none` e token forjado com o segredo padrão: todos 401.
- Cliente, restaurante e entregador não acessam rotas dos outros perfis (403). Restaurante não altera pedido nem produto de outra casa.
- Papel `admin` no cadastro é recusado. Campos extras são ignorados.
- Consultas ao banco são parametrizadas (conferido no código). O front-end escapa todo texto do usuário (conferido lendo o código, sem executar no navegador).
- JSON malformado retorna 400 e JSON de 150 KB retorna 413.

**O que testou e não funcionou, e o que corrigir**
1. (Média) Sem limite de tentativas de login: 12 erros seguidos, sem bloqueio.
2. (Média) Sem limite de tamanho nos campos: um nome de 90 KB foi aceito e inutilizou o token da conta.
3. (Média/baixa) Faltam cabeçalhos de segurança (`helmet`) e o `x-powered-by: Express` aparece.
4. (Baixa) Login com tipos inesperados no JSON gera erro 500 em vez de 400.
5. (Baixa) O segredo padrão continua no código como reserva. O app deveria recusar iniciar sem `JWT_SECRET`.
6. (Baixa) O cadastro revela se o e-mail já existe (409).

**Não testado:** XSS em navegador real, corrida entre entregadores, ataques em volume.

## Agente QA 4: restaurante e entregador (cerca de 70 requisições)
**O que testou e funcionou**
- Fluxo completo recebido, preparando, pronto, a caminho, entregue, com todas as respostas 200.
- Todas as transições inválidas retornam 400: pular etapa, voltar status, status inexistente, cancelar depois de preparando, entregar direto de "pronto".
- Restaurante recusa e cliente cancela em "recebido".
- Entregador não aceita pedido que não está pronto nem entrega pedido de outro (403).
- Dois entregadores aceitando o mesmo pedido ao mesmo tempo: só um conseguiu, sem aceite duplo.
- A lista do entregador mostra só pedidos prontos e os seus. A lista do restaurante mostra só os da própria casa. Pizzaria e Burger House ficam isoladas, e uma casa não vende produto da outra.
- Produto com preço negativo, nome vazio, preço em texto ou `1e999` é recusado. Produto removido some do cardápio e os pedidos antigos continuam intactos.

**O que testou e não funcionou, e o que corrigir**
1. (Média) Produto com nome só de espaços é criado com nome vazio.
2. (Média/baixa) Produto com preço vazio ou `[30]` é criado, e preço 0 é aceito.
3. (Baixa) Na disputa entre dois entregadores, quem perde recebe 403 "Sem permissão" em vez de 409 "já foi aceito por outro entregador". Não há erro de dados, só mensagem enganosa.
4. (Baixa) Remover o mesmo produto duas vezes retorna 200 de novo, em vez de 404.
5. (Cosmético) Status vazio retorna "Transição inválida: recebido -> undefined".

**Observação do agente:** o banco é compartilhado entre os agentes, então ele alterou por engano os pedidos 3 e 4, que eram de outro agente. Isso pode ter afetado os testes dos outros.

**Não testado:** erro 409 real (pelo item 3 não é alcançável), seleção de opções, troco e pagamento, pedido abaixo do mínimo.

## Agente QA 5: front-end, PWA e interface (análise do código, sem navegador)
**O que testou e funcionou**
- Manifest válido. Ícones 192, 512 e maskable são PNG reais, com o tamanho declarado.
- Service worker: a API fica fora do cache, a atualização funciona após deploy e existe página offline.
- Contraste de cores aprovado no nível AA (mínimo de 5,78 para 1).
- Esc fecha o modal, o duplo clique em "Confirmar pedido" é bloqueado, existe `prefers-reduced-motion`.
- Fontes externas indisponíveis não quebram a página.

**O que testou e não funcionou, e o que corrigir**
1. (Média) Carrinho salvo com formato inválido deixa a tela em branco.
2. (Média) Sem internet ou com o servidor acordando, o erro aparece em inglês e não há indicador de carregamento.
3. (Média) O modal não move o foco, não prende o Tab e não devolve o foco ao fechar.
4. (Média) A atualização a cada 5 s refaz a tela e tira o foco do teclado.
5. (Média) Em telas de 375 px o menu do topo provavelmente estoura a largura.
6. (Média) A rolagem suave ignora a preferência de reduzir movimento.
7. (Baixa) Alvos de toque de 32 px, ARIA incompleto, cache guardando respostas de erro, `robots.txt` ausente, imagens sem carregamento sob demanda.

**Não testado:** navegador real, Lighthouse, instalação do PWA, tela em 375 px.

---

## Quadro de erros e correções (para o laudo)
Todos os 17 itens abaixo foram corrigidos e cobertos por testes de regressão (`backend/test/correcoes.test.js`) ou verificados no navegador. Ficaram sem tratamento, por serem de gravidade baixa ou decisão de projeto: carregamento sob demanda das imagens, tags de compartilhamento (og), aviso para navegador sem JavaScript, setas de teclado nos grupos de escolha, o HTML da observação ser gravado como texto no banco (o front-end escapa ao exibir), o cadastro informar que o e-mail já existe, e o pagamento em dinheiro sem troco ser aceito (regra intencional).

| # | Origem | Erro | Gravidade | Situação |
|---|---|---|---|---|
| 1 | QA 1 | Troco menor que o total aceito | Média | Corrigido |
| 2 | QA 1 | E-mail inválido aceito | Média | Corrigido |
| 3 | QA 1 | E-mail duplicado por maiúsculas | Média | Corrigido |
| 4 | QA 3 | Sem limite de tentativas de login | Média | Corrigido |
| 5 | QA 3 | Sem limite de tamanho nos campos | Média | Corrigido |
| 6 | QA 3 | Sem cabeçalhos de segurança | Média/baixa | Corrigido |
| 7 | QA 5 | Menu do topo estoura em 375 px | Média | Corrigido |
| 8 | QA 5 | Erro em inglês e sem indicador de carregamento | Média | Corrigido |
| 9 | QA 5 | Carrinho corrompido deixa tela em branco | Média | Corrigido |
| 10 | QA 5 | Foco do teclado e do modal | Média | Corrigido |
| 11 | QA 2, 3 | Erro 500 com tipos inesperados (item nulo, login) | Baixa | Corrigido |
| 12 | QA 2 | Tipos aceitos demais na seleção | Baixa | Corrigido |
| 13 | QA 3 | Segredo padrão no código | Baixa | Corrigido |
| 14 | QA 4 | Produto com nome só de espaços ou preço vazio ou 0 é criado | Média | Corrigido |
| 15 | QA 4 | Aceite duplo de entrega devolve 403 em vez de 409 | Baixa | Corrigido |
| 16 | QA 4 | Remover produto duas vezes retorna 200 | Baixa | Corrigido |
| 17 | QA 4 | Status vazio retorna mensagem confusa | Cosmético | Corrigido |
