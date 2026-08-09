Owner: codex
Status: phase_4_partial
Branch: fix/admin-functional-recovery
Verified code SHA: d356bf1
Preview deployment: pending for this SHA
Preview URL: pending for this SHA
Scope: Fase 4 — Ordum Integridade Core

Checks verified on 2026-08-09:
- migrations remotas `20260809132523` e `20260809133226`: applied;
- fluxo transacional público no Supabase, com rollback: PASS;
- secret scan, migration validation, lint, typecheck, 119 tests (118 pass, 1 live E2E skip) e build: PASS;
- live queries existentes e bloqueios públicos de Storage/control-plane: PASS;
- Supabase Security Advisor: nenhuma ocorrência referente às novas tabelas de Integridade.

Entregue neste pacote:
- Report e Case separados, timeline imutável, tarefas, conflitos, identidade protegida, unidades e configurações tenant-scoped;
- protocolo + segredo bcrypt, projeção pública sem notas internas e canal público sem login;
- cockpit, paginação/filtros, detalhe, comunicação interna/externa, atribuição e máquina de estados transacional;
- control plane agregado no Admin sem conteúdo confidencial.

Próximos pacotes internos:
- Storage privado de evidências e anexos públicos controlados;
- rate limiting persistente para submissão e acompanhamento;
- tarefas, decisão/conclusão completas e configuração avançada de comitê/roteamento;
- testes E2E autenticados e visual QA com tenant de homologação autorizado.

Checks verified on 2026-08-09:
- secret scan, migration validation, lint/typecheck, 104 tests and build: PASS;
- Preview deployment: READY; root HTTP 200; diagnostics without auth HTTP 401; 5xx logs: 0;
- E2E residue counts: Auth 0, platform_members 0, active platform_members 0;
- live E2E preflight: correctly aborted before fixtures because E2E operator credentials and ASAAS_API_KEY are absent;
- migration 20260806230000: still absent from official remote history; CLI repair blocked by missing Supabase CLI access token/link credentials.

External requirements:
- configure E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD and ASAAS_API_KEY Sandbox in the controlled execution environment;
- provide Supabase CLI access/link credentials to run `migration repair 20260806230000 --status applied` officially.
