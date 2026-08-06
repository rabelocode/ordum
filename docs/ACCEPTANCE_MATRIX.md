# Acceptance Matrix

| Item | Status | Detalhes |
| :--- | :---: | :--- |
| **Propostas: status != approved não gera contrato** | PASS | Bloqueado na API com retorno idempotente via testes de lógica Node. |
| **Aceite explícito não é alterado pelo contrato** | PASS | Removido `update({ status: 'accepted' })` do gerador de contrato. |
| **Contrato: Rollback manual com audit `critical`** | PASS | Em caso de items falahrem, o pai é deletado; se o delete falha, gera log crítico. |
| **Onboarding: Idempotência garantida** | PASS | Realiza `select` na `onboarding_runs` por `tenant_id` e `template_id` antes e injeta _ignored_. |
| **API Webhook: Idempotency keys (`provider_event_id`)** | PASS | Assinado com `mock:payment:<contract_id>` garantindo execução única do processStoredEvent. |
| **Auditoria Sandbox Completa** | PASS | Gravando logs `billing.sandbox_payment.processed`, `.failed`, `.reused`. | 
| **Dívida Técnica Transacional (RPCs)** | NOT_IMPLEMENTED | Adiado para a Próxima Fase, detalhado no API_CONTRACTS.md. Sem migrações temporárias. |
