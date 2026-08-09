Owner: chatgpt_backend
Status: ready_for_review
Branch: fix/admin-functional-recovery
Head: afb4ce51f316a8d0688ec66d04541ed6beb05209
Implemented:
- `IntegrityModuleView.tsx` reduzido a orquestração; CaseDetail, CasesList, Tasks, Messages, Evidence, Decision, Timeline, Settings, Committees/Routing e Notifications extraídos por domínio sem alterar os contratos homologados.
- Investigação profissional: responsável principal, investigadores adicionais case-scoped, comitê, conflitos, tarefas/subtarefas editáveis e reatribuíveis, notas internas, mensagens externas, recomendação, decisão, encerramento e reabertura auditados.
- Cadeia de custódia: SHA-256 calculado no servidor para uploads internos e públicos, metadata de uploader/data/MIME/tamanho, Storage privado, signed URL curta e eventos auditáveis de upload/download/delete.
- Dossiê PDF A4 sanitizado e auditado com dados institucionais, SLA, tarefas, evidências/checksums, decisão e timeline. Identidade omitida por padrão e incluída somente com `integrity.identity.read` + opt-in explícito; Platform Admin não possui endpoint individual.
- Retenção tenant-scoped com lifecycle explícito `active -> closed -> retention_due -> archived/anonymized`; avaliação nunca executa purge físico automático.
- Templates editáveis para tarefa, mensagem, pedido de informação, recomendação e decisão; governança de acesso por papel/permissão/comitê/casos/conflitos, sem inventar last access.
- Notification center persistente e sanitizado para novo caso, atribuição, SLA/tarefa vencidos, mensagem externa, conflito, recomendação, decisão e reabertura.
Database:
- `20260809184617_integrity_phase4f_investigation_governance` aplicada oficialmente: permissões, colaboradores, templates, notificações, retenção, subtarefas, checksum e triggers auditáveis.
- `20260809184836_integrity_phase4f_policy_and_index_hardening` aplicada oficialmente: índices justificados e policies das novas tabelas separadas por operação, sem ampliar autorização.
- `20260809191057_integrity_decision_event_utf8` aplicada oficialmente: evento de decisão corrigido para UTF-8; função mantém `search_path` fixo e `PUBLIC EXECUTE=false`.
- RLS ativa nas tabelas novas; colaborador só amplia acesso ao caso explicitamente vinculado. Bucket `ordum-integrity` confirmado privado, limite 10 MiB e enumeração pública bloqueada.
Tests:
- Suite completa: 164 testes, 163 PASS, 0 FAIL, 1 live comercial SKIP explícito; Fase 4F 8/8 PASS e PDF 2/2 PASS.
- Secret scan PASS (310 arquivos); migration validation PASS (28); lint/typecheck/build/live queries PASS.
- Live E2E final PASS: run `integrity_e2e_1786302762175_fc9bacbb`; report HTTP 201; rate limit 429 na tentativa 21; browser QA PASS; cleanup PASS.
- Negativos PASS: não atribuído, cross-tenant, identidade sem permissão, Platform Admin/dossiê, RPC legado, MIME, bucket e Storage cross-tenant.
- Resíduos finais: tenants=0 e Auth=0.
Preview:
- READY — `dpl_3Ej1MRdwp1k2jV5eXt5Sqp5SKr76`
- https://ordum-34zstztd1-ordum.vercel.app
- Alias público/mobile: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Fluxo descartável real PASS: denúncia anônima/identificada -> roteamento/comitê -> colaboradores -> conflito -> tarefa/subtarefa -> notas/mensagens -> evidência pública/privada -> signed download -> recomendação -> decisão -> retenção -> reabertura -> notificações -> dossiê.
- Browser autenticado PASS em tenant_admin/compliance desktop e investigador atribuído/não atribuído mobile/desktop; console/rede sem erro funcional ou 5xx.
- PDF operacional renderizado com Poppler e inspecionado nas 2 páginas A4; tarefa, checksum, conclusão, timeline e acentuação validados. PDF identificado também validado com identidade omitida/permitida.
- Vercel: 0 HTTP 5xx, 0 runtime errors e build READY; somente warning conhecido de chunk principal >500 kB.
Performance:
- EXPLAIN confirmou índices de timeline, tarefas e evidências; inbox manteve seq scan somente pelo custo mínimo da tabela vazia/pequena, sem índice especulativo.
- Security Advisor: Integridade sem WARN novo; 2 INFO fail-closed intencionais (`integrity_public_rate_limits`, `integrity_report_secrets`).
- Performance Advisor: warnings das novas FKs/policies corrigidos; permanecem policies permissivas sobrepostas legadas, não consolidadas sem prova de equivalência. Índices recém-criados ainda aparecem como unused antes de tráfego representativo.
Blockers:
- Billing/Asaas permanece dependência externa controlada já registrada; não alterado nesta fase.
- Purge físico e anonimização irreversível exigem política jurídica/operacional explícita e continuam deliberadamente fora do fluxo automático.
Suggested next package:
- Fase 4G: homologação piloto com usuários reais controlados, política jurídica de retenção/anonimização, scheduler de alertas SLA e redução mensurada dos warnings legados de RLS/performance.
