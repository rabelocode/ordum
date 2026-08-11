Owner: chatgpt_backend
Status: ready_for_review
Branch: fix/admin-functional-recovery
Head: f3790ee926ad9ee0c2c04c475bf237f9b5d53eab
Implemented:
- Wizard único de implantação do Integridade, sincronizado ao onboarding comercial, com 16 etapas, teste obrigatório e estados `not_started`, `incomplete`, `ready_for_test`, `ready_for_publish` e `published`.
- Estrutura organizacional tenant-scoped com matriz/filiais, departamentos, responsáveis e nomes legíveis em filtros, roteamento e indicadores.
- Motor de roteamento determinístico e explicável por categoria, severidade, unidade, departamento, tipo de relato, identificação e conflito; atribui comitê/responsável/colaboradores, prioridade, SLA e escalonamento.
- Scheduler server-side idempotente para SLA próximo/vencido, tarefa vencida, caso sem responsável/parado, decisão pendente, conflito e retenção; outbox sanitizada e Vercel Cron a cada 30 minutos.
- Central de pendências operacional com CTAs; acompanhamento público com status sanitizado, ação necessária, mensagens, complementos e evidências sem dados internos.
- Formulário público configurável com campos tipados/validados, textos de privacidade/confirmação e política de anonimato; QA mobile explícito em 390x844.
- Dashboard executivo tenant-scoped, filtros e relatório agregado PDF/CSV auditado; Admin Ordum enriquecido exclusivamente com control plane/aggregate-only e CTA sem impersonation.
Database:
- `20260809204033_integrity_phase4g_deployment_automation` aplicada oficialmente: permissões, hierarquia, custom fields, routing avançado, outbox, scheduler, retenção, RLS e índices operacionais.
- `20260809205518_integrity_phase4g_routing_scope_hardening` aplicada oficialmente: colaboradores de roteamento validados contra regra e membership do mesmo tenant.
- RLS `USING`/`WITH CHECK` confirmada nas estruturas tenant-scoped; filas de outbox/scheduler são service-only e não possuem policy de navegador.
Tests:
- Secret scan PASS (320 arquivos); migration validation PASS (30); lint/typecheck/build PASS.
- Suite completa: 173 testes, 172 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Live E2E final PASS: run `integrity_e2e_1786453854068_d0361191`; health 200; report 201; rate limit na tentativa 21; scheduler idempotente; routing determinístico; relatório executivo e QA browser/mobile PASS.
- Negativos PASS: RPC público legado, não atribuído, cross-tenant, identidade, Storage, Platform Admin/dossiê e Admin aggregate-only.
- Cleanup PASS; resíduos finais tenants=0 e Auth=0.
Preview:
- READY — `dpl_6wqAW93BYT4PL7Py7hNCTxCd21RA`
- https://ordum-nnlivykh4-ordum.vercel.app
- Alias público/mobile: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Fluxo descartável real PASS: onboarding/wizard -> hierarquia -> canal/teste/publicação -> denúncia anônima/identificada -> routing/comitê -> tarefa/evidência/mensagem -> scheduler/pendências -> decisão/encerramento/reabertura -> relatório/retenção.
- Browser autenticado e público PASS em desktop/mobile; acompanhamento público sanitizado e sem overflow horizontal.
- Vercel: deployment READY e 0 logs HTTP 5xx no período do E2E.
Security:
- Security Advisor: 58 achados, 0 ERROR, 13 WARN preexistentes e 45 INFO; nenhuma nova exposição 4G. Bucket privado e Admin aggregate-only preservados.
- Segredo temporário local do Cron removido após o E2E; `CRON_SECRET` permanece somente no ambiente Preview da Vercel.
Performance:
- Performance Advisor: 227 achados, 0 ERROR, 31 WARN e 196 INFO. Índices compostos 4G cobrem hierarquia, custom fields, routing, outbox, pendências e retenção.
- Três sobreposições permissivas 4G permanecem sem consolidação: não houve prova suficiente de equivalência/autorização sob tráfego representativo; segurança foi priorizada.
Blockers:
- Billing/Asaas permanece dependência externa controlada e não foi alterado.
- E-mail externo não foi simulado; somente in-app/outbox está habilitado até existir provider confiável.
- Purge físico e anonimização irreversível permanecem fora do automático até política jurídica/operacional explícita.
Suggested next package:
- Homologar um piloto controlado com responsáveis reais e política de publicação.
- Definir política jurídica de retenção/anonimização antes de qualquer purge.
- Medir queries/policies 4G com tráfego piloto e consolidar apenas com equivalência comprovada.
- Conectar provider externo de comunicação somente após configuração segura e consentimento.
- Fechar configuração externa do Billing/Asaas Sandbox no pacote comercial dedicado.
