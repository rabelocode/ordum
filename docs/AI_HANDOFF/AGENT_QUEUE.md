Owner: chatgpt_backend
Status: ready_for_review
Branch: fix/admin-functional-recovery
Head: 5644ddeb27fd890f9a0e93d082e5a41a0c4b044e
Implemented:
- Cockpit do Integridade extraído para `IntegrityDashboard.tsx`, com período, status, severidade, categoria, unidade, comitê e responsável; métricas de SLA, conflitos, tarefas, não atribuídos, reabertura, médias, distribuições e evolução temporal sem zeros fictícios.
- Caixa de casos com filtros combináveis persistidos na URL, busca por protocolo/assunto, ordenação, paginação server-side, clear filters, nomes legíveis de responsável/comitê e CSV limitado/auditado.
- Exportação de relatório individual auditada; conteúdo e identidade respeitam permissões independentes, CSV injection é neutralizado e segredos/hashes/anexos em massa são excluídos.
- Timeline enriquecida com ator, estado anterior/posterior e motivo; mutações de settings, canal, categorias, unidades, comitês e roteamento entram na auditoria.
- Configuração ganhou teste persistido de prontidão e checklist operacional de 14 capacidades; CTA/API compatibilizados (`slug` + `public_slug`).
- Provisionamento comercial pago com Integridade garante template idempotente e onboarding específico antes da seleção; ativação de `tenant_solutions` inicializa settings sem edição manual.
- Modularização progressiva: dashboard isolado e dois blocos legados duplicados removidos; navegação mobile recebeu nome acessível.
- Admin Ordum validado em fronteira `aggregate_only`: contrato/solution/configuração/onboarding/saúde/volume/SLA/storage/último uso, sem conteúdo, identidade, mensagens, evidências ou decisão.
Database:
- `20260809173050_integrity_phase4e_governance` aplicada e registrada oficialmente.
- Novas permissões: `integrity.audit.read`, `integrity.exports.execute`, `integrity.case_report.export`; grants tenant-scoped para tenant_admin/compliance.
- `integrity_settings.channel_tested_at` e `channel_published_at`; índice único de template por solução/versão; RPC service-only com `search_path=''`; trigger idempotente de settings.
- Template `Onboarding Ordum Integridade` ativo: ID `622a8954-dfbd-4863-bb37-c192a43de801`, 14 etapas, posições 0–13.
- Security Advisor: nenhum WARN novo do Integridade; 2 INFO fail-closed intencionais (rate limits e secrets sem policy cliente). Performance Advisor mantém warnings preexistentes de policies permissivas sobrepostas; nenhuma policy foi consolidada sem plano/prova de equivalência.
Tests:
- Suite completa: 153 PASS, 0 FAIL, 1 live comercial SKIP explícito; suíte Integridade: 57/57 PASS.
- Secret scan PASS (294 arquivos rastreados); migration validation PASS (25 migrations); lint/typecheck/build PASS.
- Live E2E final PASS: run `integrity_e2e_1786297932548_27d2af64`, report HTTP 201, rate limit 429 na tentativa 21, cleanup PASS.
- Negativos PASS: RLS assigned=1, unassigned=0, cross-tenant=0, identidade sem permissão=0; conflito, transição inválida, MIME, bucket, RPC legado, Admin aggregate-only.
- Resíduos após o run: tenants=0, Auth=0, memberships=0, reports=0.
Preview:
- READY — `dpl_9w6DnuvYRF4UprbntBLYGiweZMVa`
- https://ordum-hel3mc0ly-ordum.vercel.app
- Alias público/mobile: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- Runtime logs do deployment: 0 HTTP 5xx no período do QA. `/api/index.mjs.map` retorna 404; `/build/server.cjs.map` retorna somente fallback HTML, não source map.
QA:
- Browser autenticado real PASS: tenant_admin desktop 1440x1000, compliance desktop, investigador atribuído mobile 390x844 e investigador não atribuído desktop.
- CTAs validados: navegação, filtros, limpar, exportar CSV, configurações e prontidão do canal; console sem erro e rede sem 5xx.
- Fluxo real PASS: denúncia anônima/identificada → roteamento/comitê → tarefa → mensagens interna/externa → Storage privado/signed URL → recomendação → decisão → encerramento → acompanhamento → reabertura → auditoria/exportação.
Blockers:
- Billing/Asaas continua pendência externa controlada já registrada; não alterado nesta fase.
- Decomposição restante: extrair CaseDetail/Tasks/Messages/Evidence/Decision e Settings/Committees/Routing do container principal sem alterar contratos já homologados.
- PDF completo permanece próximo pacote; CSV funcional está entregue.
Suggested next package:
- Fase 4F: concluir extrações do workspace, medir/consolidar policies permissivas equivalentes e adicionar relatório PDF individual sanitizado.
