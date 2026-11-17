# Manual de uso e instalação

## 1. Instalar e rodar
Requisito: Node.js 22.13 ou superior.

```bash
git clone https://github.com/Srthiagobor13/entrega-facil.git
cd entrega-facil/backend
npm install
npm start
```
Abra http://localhost:3000. Para rodar os testes: `npm test`.

Variáveis de ambiente (opcionais): `PORT`, `JWT_SECRET` (troque em produção) e `DB_PATH` (arquivo do banco).

## 2. Contas de demonstração (senha `123456`)
| Perfil | E-mail |
|---|---|
| Cliente | cliente@demo.com |
| Restaurante (hamburgueria) | burger@demo.com |
| Restaurante (pizzaria) | pizzaria@demo.com |
| Entregador | entregador@demo.com |

## 3. Instalar no celular (PWA)
Precisa do endereço publicado em HTTPS.
- **Android (Chrome):** menu de três pontos, "Instalar app".
- **iPhone (Safari):** botão Compartilhar, "Adicionar à Tela de Início".

O ícone "EF" aparece na tela inicial e o app abre em tela cheia.

## 4. Como usar
### Cliente
1. Abra o app. O cardápio é público.
2. Escolha o restaurante e navegue pelas categorias.
3. Toque num item para personalizar:
   - **Carnes:** use − e + para tirar ou colocar carnes (o preço de cada carne extra aparece).
   - **Escolhas:** ponto da carne, tipo de pão.
   - **Adicionais:** bacon, cheddar, ovo e outros.
   - **Retirar ingredientes:** marque o que não quer.
   - **Observações:** recado para a cozinha.
4. Toque em "Adicionar". O botão mostra o total do item.
5. Abra a **Sacola**, confira e toque em "Finalizar pedido". Se ainda não entrou, o app pede login ou cadastro e continua de onde parou.
6. Informe o endereço, escolha o pagamento (Pix, cartão ou dinheiro com troco) e confirme.
7. Em **Meus pedidos**, acompanhe a linha do tempo. Enquanto estiver "Recebido", dá para cancelar.

### Restaurante
1. Entre com a conta do restaurante.
2. Em **Pedidos**, toque em "Aceitar e preparar" ou "Recusar". Depois do preparo, "Marcar como pronto".
3. Em **Meu cardápio**, adicione ou remova produtos.

### Entregador
1. Entre com a conta de entregador.
2. Em **Entregas**, toque em "Aceitar entrega" num pedido pronto. Ao entregar, "Confirmar entrega".

## 5. Problemas comuns
| Sintoma | O que fazer |
|---|---|
| "Faltam R$ X para o pedido mínimo" | Adicione mais itens |
| "Sessão expirada" | Entre novamente (o login vale 12 h) |
| "Sem conexão" | Verifique a internet e toque em "Tentar novamente" |
| Pedido sumiu após novo deploy | Na hospedagem gratuita o banco SQLite reinicia a cada deploy |
| Atualização do app não aparece no celular | Feche e abra o app, o cache é renovado a cada versão |
