# Contratos de API do Módulo Comercial

## Agendar Demo
Method: POST
Route: `/api/admin/leads/:id/demos`
Permission: `platform.commercial.manage`
Input: `{ scheduled_at: ISODate, duration_minutes: number, notes: string }`
Output: `{ id, status, scheduled_at, ... }`
Errors: 400 Validation, 403 Forbidden, 404 Not Found, 409 Conflict
Database: `commercial_demos`
RPC: N/A
Idempotency: Not strictly idempotent (creates distinct demos).
Environment restrictions: None.
Audit action: `commercial.demo.scheduled`
Implemented in: `src/server/adminLeadsRouter.ts`
Tested in: `test/integration/admin-lead-to-customer.test.ts`


## Criar Proposta
Method: POST
Route: `/api/admin/commercial/proposals`
Permission: `platform.commercial.manage`
Input: `{ lead_id, plan_id, cycle, billing_type, discount_cents, solution_ids, valid_until, notes }`
Output: `{ id, status, amount_cents, ... }`
Errors: 400 Bad Request, 403 Forbidden (Escopo ou Desconto Alto)
Database: `commercial_proposals` e `commercial_proposal_items`
RPC: N/A
Idempotency: Not strictly idempotent (gera nova proposta versionada).
Environment restrictions: None.
Audit action: `commercial.proposal.created`
Implemented in: `src/server/billing/router.ts`
Tested in: `test/integration/admin-lead-to-customer.test.ts`


## Aceitar Proposta
Method: POST
Route: `/api/admin/commercial/proposals/:id/accept`
Permission: `platform.commercial.manage`
Input: Empty Body (Header IP e User-Agent coletados)
Output: `{ success: true, status: 'accepted' }`
Errors: 404 Not Found, 409 Conflict (Não Aprovada antes)
Database: `commercial_proposals`
RPC: N/A
Idempotency: Idempotente para propostas já aceitas.
Environment restrictions: None.
Audit action: `commercial.proposal.accepted`
Implemented in: `src/server/billing/router.ts`
Tested in: N/A (Mocks diretos no DB)


## Gerar Contrato
Method: POST
Route: `/api/admin/commercial/proposals/:id/create-contract`
Permission: `platform.commercial.manage`
Input: `{ customer_tax_id }`
Output: `{ id, status, amount_cents, ... }`
Errors: 409 (Proposta não aprovada/já associada), 404 Not Found
Database: `commercial_contracts`, `commercial_contract_items`, atualiza `commercial_proposals`
RPC: N/A
Idempotency: Impede a duplicação se o Contrato já possuir a vinculação Unique da Proposta (23505).
Environment restrictions: None.
Audit action: `commercial.contract.created_from_proposal`
Implemented in: `src/server/billing/router.ts`
Tested in: `test/integration/admin-lead-to-customer.test.ts`


## Mock Sandbox
Method: POST
Route: `/api/admin/commercial/contracts/:id/mock-sandbox-payment`
Permission: `platform.billing.webhooks.manage`
Input: Empty Body
Output: `{ success: true, message: '...' }`
Errors: 403 Forbidden (Produção), 400 Bad Request
Database: `billing_subscriptions`, `billing_payments`, insere e processa `processStoredEvent`
RPC: `provision_paid_contract`, `admin_start_onboarding` internal via Event processor.
Idempotency: Simula evento isolado. Repetições podem atualizar/re-provisionar caso status divirja.
Environment restrictions: Somente acesso em `NODE_ENV!==production` e `ASAAS_ENV===sandbox`.
Audit action: N/A (Gera Audit logs filhos de `payment_confirmed` e provisões).
Implemented in: `src/server/billing/router.ts`
Tested in: Em ambiente Sandbox (Browser)


## Iniciar Onboarding
Method: POST
Route: `/api/admin/control-plane/onboarding/start`
Permission: `platform.onboarding.manage`
Input: `{ tenantId, templateId, ownerId }`
Output: `{ id: RUN_ID }`
Errors: 403 Forbidden, 409 Conflict
Database: `onboarding_runs`
RPC: `admin_start_onboarding`
Idempotency: Tratada na lógica RPC (não duplica Run não finalizado).
Environment restrictions: None.
Audit action: Embutido no RPC
Implemented in: `src/server/adminControlPlaneRouter.ts`
Tested in: Sim (`test/integration/admin-lead-to-customer.test.ts`)
