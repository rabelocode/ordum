Owner: chatgpt_backend
Status: ready_for_review
Branch: fix/admin-functional-recovery
Head: 4a45cb8a0f951c85d462b51ba1a751f5aa3cd6ba
Implemented:
- Papel tenant-scoped `integrity_investigator` formalizado; leitura limitada a owner/comitê ativo e permissões independentes para investigar, nota interna, mensagem externa, evidência, recomendação, conclusão e reabertura.
- Identidade exige `integrity.identity.read`; Admin Global segue aggregate-only, sem case data plane.
- Comitês e roteamento ganharam edição, membros nomeados, lifecycle active/inactive/archived, fallback, prioridade, detecção de conflito, preview determinístico e proteção contra comitê com casos ativos órfãos.
- Configurações exibem checklist operacional e administram modo anônimo/identificado, textos, SLA, anexos e política de comunicação aplicada server-side.
- Case workflow separa notas/mensagens, recomendação/conclusão/reabertura e CTAs por permissão; query builder thenable corrigido após regressão encontrada no E2E.
- Modularização progressiva: `IntegrityConfigurationStatus` e `useIntegrityCasePermissions` extraídos por domínio.
Database:
- `20260809162824_integrity_rbac_and_configuration_lifecycle`: applied oficialmente.
- `20260809163845_private_integrity_case_scope_helper`: applied oficialmente; helper SECURITY DEFINER movido do schema exposto para `private`.
- RLS direto validado: assigned=1; unassigned=0; cross-tenant=0; identidade sem permissão=0.
- Security Advisor: 0 WARN de Integridade; 2 INFO fail-closed intencionais (`integrity_public_rate_limits`, `integrity_report_secrets`, sem policy/client access).
Tests:
- Secret scan PASS: 291 arquivos rastreados; migrations PASS: 24 ordenadas; lint/typecheck/build/live queries PASS.
- Suite PASS: 145 aprovados, 0 falhas, 1 live E2E comercial explicitamente ignorado.
- Live Integridade E2E PASS: run `integrity_e2e_1786293919913_121abbb3`; report HTTP 201; rate limit 429 na tentativa 21; cleanup PASS.
- Resíduos globais após runs: Auth=0; tenants=0; memberships=0; reports=0.
Preview:
- READY — dpl_7CLPk6vPDs9pjqAMhWEs5QpQErjX
- https://ordum-cjgp23yjb-ordum.vercel.app
- Alias público mobile: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Fluxo descartável validado: anônimo/identificado → roteamento/comitê → investigador/compliance → tarefa/evidência/mensagens → recomendação/decisão → encerramento/reabertura.
- Negativos PASS: sem permissão, investigador não atribuído, cross-tenant, identidade protegida, conflito, transição inválida, MIME inválido, comitê órfão e RPC legado.
- Desktop 1440x1000 e iPhone 14: Preview público renderizado, sem tela branca, erros de página ou console; deployment final com 0 logs HTTP 5xx no período de QA.
Blockers:
- Nenhum blocker externo da Fase 4D.
- Gap técnico restante: extrair os blocos grandes de detalhe/configurações ainda presentes em `IntegrityModuleView.tsx`; warnings de performance por policies permissivas sobrepostas ficam para consolidação medida, sem alterar autorização nesta fase.
Suggested next package:
- Fase 4E: concluir decomposição do workspace, consolidar policies com plano de query e executar QA visual autenticado persistente dos formulários de configuração.
