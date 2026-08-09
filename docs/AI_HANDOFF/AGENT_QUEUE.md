Owner: chatgpt_backend
Status: ready_for_review
Branch: fix/admin-functional-recovery
Head: 852809ddbfe26c4d11cfdd0756355a500ebc665d
Implemented:
- Cutover dos canais públicos para `/api/public/integrity`; RPCs legados de canal, submissão, acompanhamento e mensagem revogados de `anon`/`authenticated` e restritos a `service_role`.
- Contrato do catálogo corrigido para a chave canônica `integridade` no workspace e no resumo do Admin.
- Runner live descartável `test:integrity-e2e` com runId, fixtures isoladas, cleanup obrigatório e verificação de resíduos.
- E2E cobre anônimo/identificado, protocolo+segredo hash, roteamento/comitê, triagem, atribuição, conflito, tarefas, mensagens, Storage privado, signed URLs, SLA, decisão, reabertura, RBAC, cross-tenant, rate limit e control/data plane.
- Cliente HTTP/tipos do Integridade extraídos de `IntegrityModuleView.tsx` para `integrityApi.ts`, primeiro corte de modularização sem mudança funcional.
Database:
- `20260809154240_integrity_e2e_fixture_cleanup`: applied; cleanup permitido somente a `service_role`, runId estrito e tenants E2E marcados.
- `20260809160030_integrity_public_api_cutover`: applied oficialmente.
- RPC legado direto com publishable key: permission denied; fluxo novo server-side permanece funcional.
- Canais ativos após cleanup: 0; tenants/Auth E2E residuais: 0/0; Storage E2E residual: 0.
- Security advisor: nenhum aviso de RPC público do Integridade após cutover; `integrity_public_rate_limits` e `integrity_report_secrets` sem policy permanecem fail-closed/service-role-only intencionalmente. Avisos fora do pacote permanecem no backlog.
Tests:
- Secret scan PASS: 286 arquivos rastreados.
- Migration validation PASS: 22 migrations ordenadas.
- Lint/typecheck PASS; build cliente/servidor/Vercel PASS.
- Suite PASS: 136 aprovados, 0 falhas, 1 live E2E comercial explicitamente ignorado.
- Live E2E final PASS: run `integrity_e2e_1786291679050_c2715946`; report HTTP 201; rate limit HTTP 429 na tentativa 21; cleanup/resíduos 0.
Preview:
- READY — dpl_ET1Zi9xpwkksPPxj2JpRcnsgn7kW
- https://ordum-evbnenukz-ordum.vercel.app
QA:
- Fluxo funcional completo validado por API e banco no Preview final; signed URLs retornaram arquivo e enumeração anônima não revelou objetos.
- Admin integrity-summary retornou somente agregados com `confidentiality_boundary=aggregate_only`.
- Mobile 390x844: canal indisponível renderizou estado acionável, largura/scrollWidth 390/390, sem tela branca; login desktop renderizado sem overflow.
- Logs 5xx do deployment final no período de QA: 0.
Blockers:
- Nenhum blocker externo para o pacote 4C.
- Gaps para pacote seguinte: extrair detalhe/configurações do `IntegrityModuleView.tsx`; completar edição/arquivamento de comitês e regras; formalizar papel de investigador com leitura apenas de casos atribuídos no API/RLS.
Suggested next package:
- Fase 4D: RBAC atribuído, lifecycle das configurações e conclusão da modularização do workspace Integridade.
