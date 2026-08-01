# ORDUM 08 — Billing e Asaas

## Estado e regras

A integração usa a API v3 do Asaas exclusivamente no Sandbox. `BILLING_ENABLED=false` é o padrão e produção é recusada pelo código. A API usa `access_token`, `Content-Type: application/json` e `User-Agent`. O webhook valida `asaas-access-token` com comparação constante, persiste antes do negócio e usa o ID único do evento para idempotência.

Referências vigentes: [autenticação](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1), [assinaturas](https://docs.asaas.com/docs/assinaturas), [webhooks](https://docs.asaas.com/docs/sobre-os-webhooks), [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas) e [eventos de assinatura](https://docs.asaas.com/docs/eventos-para-assinaturas).

## Variáveis server-side

```dotenv
APP_URL=https://seu-dominio
BILLING_ENABLED=false
BILLING_PROVIDER=asaas
ASAAS_ENV=sandbox
ASAAS_API_KEY=
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=
ASAAS_USER_AGENT=Ordum
ASAAS_WEBHOOK_URL=https://seu-dominio/api/webhooks/asaas
CRON_SECRET=
```

Nenhuma variável secreta pode usar prefixo `VITE_`. Não cole chaves no chat, em issues ou no Git.

## Máquina de estados

```text
pending_payment
  └─ PAYMENT_CONFIRMED / PAYMENT_RECEIVED → active
active
  ├─ PAYMENT_OVERDUE → grace → prazo expirado → suspended
  ├─ PAYMENT_CHARGEBACK_* → review + suspensão
  └─ PAYMENT_REFUNDED → review + suspensão
grace / suspended
  └─ pagamento confirmado posterior → active
active
  └─ cancelamento da assinatura → sem nova renovação; período pago não é apagado
```

Reembolso parcial não suspende automaticamente. Eventos desconhecidos são persistidos e marcados `ignored`. Evento duplicado devolve 2xx sem renovar novamente. `PAYMENT_RECEIVED` posterior ao `PAYMENT_CONFIRMED` para a mesma cobrança reutiliza o mesmo período pago. Eventos pendentes fora de ordem não rebaixam pagamento já confirmado.

## Checklist exato de homologação

1. Criar uma conta no [Asaas Sandbox](https://sandbox.asaas.com/).
2. Com usuário administrador, gerar a API Key de Sandbox e guardá-la no momento da exibição.
3. Gerar um token aleatório forte, diferente da API Key, para autenticar o webhook.
4. Na Vercel, abrir **Project → Settings → Environment Variables** e cadastrar `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` somente no ambiente de homologação/produção usado pelo deploy. Não enviar pelo chat.
5. No mesmo painel, cadastrar `APP_URL`, `ASAAS_WEBHOOK_URL`, `ASAAS_ENV=sandbox`, `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`, `ASAAS_USER_AGENT=Ordum` e um `CRON_SECRET` forte.
6. Em **Project → Settings → Deployment Protection**, manter público o domínio de produção usado pelo webhook. A autenticação das rotas é feita pela aplicação e pelo `asaas-access-token`; proteção Vercel pode continuar nos previews.
7. Manter `BILLING_ENABLED=false`, redeployar e conferir `/#/admin/financeiro`.
8. No painel Asaas, criar webhook para `https://SEU_DOMINIO/api/webhooks/asaas`, usar o token do passo 3 e selecionar somente os eventos documentados abaixo.
9. Alterar `BILLING_ENABLED=true` apenas no ambiente Sandbox e redeployar.
10. No admin Ordum, criar plano, proposta, aprová-la, gerar e aprovar o contrato com CPF/CNPJ de teste.
11. Usar **Iniciar Sandbox** para criar cliente e assinatura.
12. Simular pagamento e confirmar o recebimento de `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`.
13. Reenviar o mesmo evento pelo Asaas e confirmar que aparece como duplicado sem estender o período novamente.
14. Validar renovação, atraso, carência, suspensão, pagamento atrasado, reativação, cancelamento, reembolso e chargeback.
15. Conferir a fila de webhooks, auditoria e a execução de conciliação.
16. Somente após aceite formal, criar conta e chave de produção separadas.
17. Cadastrar segredos de produção separados na Vercel; nunca reutilizar chave Sandbox.
18. A liberação de `ASAAS_ENV=production` exige mudança de código e autorização explícita. Não basta trocar uma variável.

## Eventos configurados

Pagamentos: `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL`, `PAYMENT_DUNNING_REQUESTED` e `PAYMENT_DUNNING_RECEIVED`.

Assinaturas: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED` e `SUBSCRIPTION_DELETED`.

## Limites atuais

- Não armazena cartão e não implementa split/subconta.
- O processamento ocorre no request depois da persistência; está correto para baixo volume e reprocessável. Uma fila dedicada é a evolução para alto volume.
- A conciliação consulta assinaturas e aplica suspensão por carência; recuperação histórica completa de cobranças deverá ser homologada com a chave Sandbox.
- Produção não foi chamada nem cobrada nesta entrega.
