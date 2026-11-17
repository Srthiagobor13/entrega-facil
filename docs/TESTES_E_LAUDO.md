# Testes com colegas e Laudo de Qualidade

> Preencha com os dados reais dos testes. Cada colega deve usar o link da solução em funcionamento.

## Roteiro para o testador (10 min)
1. Criar conta de cliente e entrar.
2. Abrir um restaurante, adicionar itens, finalizar o pedido com endereço.
3. Em outra aba/janela, entrar como `pizzaria@demo.com` ou `burger@demo.com` (senha `123456`), aceitar e marcar o pedido como pronto.
4. Entrar como `entregador@demo.com`, aceitar e confirmar a entrega.
5. Voltar ao cliente e ver o status "Entregue".
6. Tentar: carrinho vazio, endereço vazio, cancelar pedido, instalar o PWA no celular.

## Registro dos 5 testes
| # | Nome | Data | Funcionou | Não funcionou / corrigir | Não testado / faltou |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Laudo de Qualidade
### Evidências automatizadas (já executadas)
Saída de `npm test` (`backend`): **7 testes, 7 aprovados, 0 falhas**.

### Erros encontrados e correções
Preencha após os testes dos colegas (anexe prints).

| # | Erro encontrado | Evidência (print) | Correção aplicada | Situação |
|---|---|---|---|---|
| 1 | | | | |

### Limitações conhecidas
- Pagamento simulado.
- Banco SQLite reinicia em novo deploy na hospedagem gratuita.
- Status por polling a cada 5 s.
