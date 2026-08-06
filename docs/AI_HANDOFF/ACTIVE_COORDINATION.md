# Active Coordination Protocol

Agent Active Rules:
- No integrations out-of-scope.
- All code needs node unit tests for pure idempotency.

## Stabilization Phase 3 Delivery

1. **O que foi testado**: 
   - Rollback da proposta via DB (falha nos itens apaga pai).
   - Rollback de contrato via DB.
   - Teste de Idempotência do Mock (processStoredEvent).
   - Teste na lógica extratora de fallback de templates de onboarding.
   - Teste bloqueio Payload missing.
   - Regras de idempotência na Sandbox, com fallback update de status.
   
2. **Dívidas Técnicas (Tech Debt)**:
   - A atomicidade é baseada em callbacks de rede no Node env. A atomicidade REAL dependerá unicamente de migrar as chamadas para as seguintes RPC Postgres funcionarem transacionalmente: `create_commercial_proposal_with_items` e `create_commercial_contract_from_proposal`.
   - O processo de Onboarding precisa de garantia transacional futura, possivelmente adicionando `UNIQUE(tenant_id, template_id, status='active')` na tabela `onboarding_runs`.
   
3. **Restrições de Migrações**:
   - Nenhuma nova migration foi adicionada neste repositório. O contrato no banco remoto segue obedecendo à constraint pre-existente: `commercial_contracts_proposal_id_key UNIQUE (proposal_id)`.
