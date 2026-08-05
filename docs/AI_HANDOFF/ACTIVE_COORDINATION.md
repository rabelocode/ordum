# Active Coordination

## Project
Ordum

## Branch
feat/admin-ordum-operations

## Current Head
f1b00478fa0d6ee2799589f69cf44a38df70256f

## Current Phase
Admin commercial vertical flow

## Current Owner
chatgpt_backend

## Antigravity Last Delivery
Implementação visual, UI, middleware backend e lógica negocial das etapas comerciais (Lote C e D). Ajustes server-side para cálculo e registro correto de price/solutions em requisições de Proposta e Contrato. Mock financeiro criado no server. Gatilhos de Onboarding implementados.

## Files Changed
- api/index.mjs
- server.ts
- src/pages/admin/BillingPage.tsx
- src/pages/admin/CompanyDetailPage.tsx
- src/pages/admin/ContractsPage.tsx
- src/pages/admin/DemosPage.tsx
- src/pages/admin/LeadsPage.tsx
- src/pages/admin/PlansPage.tsx
- src/pages/admin/ProposalsPage.tsx
- src/server/adminClientsRouter.ts
- src/server/adminControlPlaneRouter.ts
- src/server/adminLeadsRouter.ts
- src/server/billing/router.ts
- test/integration/admin-lead-to-customer.test.ts

## Supabase Dependencies
- comercial_demos
- commercial_proposals (com amount_cents modificado server-side)
- commercial_proposal_items (gravados server-side na emissão da proposta)
- commercial_contracts (usa proposal items para gerar contract_items)
- admin_start_onboarding (acionado com rules via template)
- provision_paid_contract (gera as pre-condições de Onboarding)

## Backend Contracts Used
- `POST /api/admin/leads/:id/demos`
- `POST /api/admin/commercial/proposals`
- `POST /api/admin/commercial/proposals/:id/accept`
- `POST /api/admin/commercial/proposals/:id/create-contract`
- `POST /api/admin/commercial/contracts/:id/mock-sandbox-payment`
- `POST /api/admin/commercial/contracts/:id/start-billing`

## Verified
- Propostas rejeitam "amount_cents" oriundos do input da plataforma. Selecionam via `billing_plan_prices`.
- Itens das Propostas (`commercial_proposal_items`) são injetados automaticamente a partir do `solution_ids`.
- `mock-sandbox-payment` não ocorre em `production` devido à validações de `NODE_ENV`.
- Onboarding auto-detecta e injeta template ativo no webhook success/mock.
- Teste Híbrido (`admin-lead-to-customer.test.ts`) simula o core actions.

## Not Verified
- Conexão Assas Sandbox via proxy webhook externa (túnel).
- Comportamento de envio de boleto na confirmação real de subscription.

## Critical Gaps
- Nenhum gap crítico técnico frontend detectado.

## Next Decision Required
ChatGPT must review the remote branch and define the next work package (possivelmente Ordum Integridade).

## Do Not Start
- Integrity implementation
- Merge
- Production deployment
- Production billing
