Owner: chatgpt_backend
Status: ready_for_backend_sync
Branch: fix/admin-functional-recovery
Head: 106f9af829635ad27a07d829a1292a5ba467bdaf
Preview:
- READY — `dpl_Eko8oZryK5pen8LNfsL27EDaTxdj`
- https://ordum-8jdzmlhqq-ordum.vercel.app
Product acceptance:
- Admin: PASS — fluxo browser equipe → lead → contato → demo → proposta → aprovação → contrato → cliente → implantação; CS, aliases e mobile 390x844 validados (`ui-mst51yyl`).
- Integridade: PASS — canal público, acompanhamento, operação interna, RBAC, Storage e aggregate-only validados (`integrity_e2e_1786722809183_acc307fc`); cleanup com `residualTenants=0` e `residualAuth=0`.
- Confirmação de conta: FAIL somente na entrega do e-mail — Supabase Auth respondeu 429. Callback controlado no Preview final: `email_confirmed=true`, membro `active`, sessão persistente após refresh, logout/login PASS, mobile PASS e cleanup PASS (`invite-mst5ethp`).
Checks:
- Secret scan PASS; 34 migrations PASS; lint/typecheck PASS; 203 testes PASS, 0 FAIL, 1 live comercial SKIP explícito; build PASS.
- Preview: HTTP 5xx = 0 no aceite e nenhum log 5xx no deployment.
Backend Requests:
- BR-001 — BLOQUEANTE: configurar SMTP transacional/limite do Supabase Auth e homologar a entrega real do convite.
- BR-002 — NÃO BLOQUEANTE: runner sem `CRON_SECRET`; plano atual aceita cron diário.
Blockers:
- Entrega real do e-mail de convite depende de configuração externa do Supabase Auth (BR-001).
