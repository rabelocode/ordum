Owner: chatgpt_backend
Status: ready_for_backend_sync
Branch: fix/admin-functional-recovery
Head: 90f96c85bcf6560b5bec33c387df078ea58da3c3
Headline: Admin Access Management completo no produto; homologação de papéis personalizados bloqueada por grant remoto incompleto.

Implemented:
- API Express autenticada para catálogo, criação e edição atômica de papéis; ator sempre derivado da sessão e erros humanizados.
- Papéis lista funções com zero pessoas, diferencia sistema/personalizado e não oferece exclusão ou edição de papéis protegidos.
- Editor responsivo agrupa permissões por domínio, omite keys técnicas, mostra o menu resultante e confirma impacto nas pessoas vinculadas.
- Seletor de acesso recebe imediatamente papéis personalizados; auditoria apresenta criação/edição em linguagem humana.

Database:
- Git sincronizado com as migrations remotas já aplicadas `20260816162954_platform_custom_roles_management` e `20260816163157_platform_custom_roles_api_wrappers`; nenhuma migration foi reaplicada.
- Estado remoto confirmado: `system_managed=true` para admin/manager/sales; wrappers invoker com EXECUTE apenas para postgres/service_role.
- BR-007: `service_role` não possui USAGE em `app_private`, por isso as wrappers invoker falham antes da função interna.

Tests:
- Secret scan, migration validation, lint, typecheck e build PASS; suite completa 228 testes, 227 PASS, 1 live E2E explicitamente SKIP, 0 FAIL.
- 7 testes focados de apresentação, contrato API, proteção e migrations PASS.
- Browser reproduziu GET `/api/admin/access/roles` = 500; RPC via SDK confirmou `permission denied for schema app_private`.

Preview:
- READY — `dpl_EJzGEkXKNpoH6M11M2oEdjVympL6`
- Imutável: https://ordum-rakwoyr7c-ordum.vercel.app
- Alias da branch: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app

QA:
- Fixtures Auth/membros descartáveis criadas e removidas em todas as tentativas; zero papel ou pessoa QA residual.
- UI desktop abriu Papéis e Novo papel; o editor e preview visual foram validados até a dependência do catálogo.
- Runner completo `scripts/run-custom-roles-qa.ts` preparado para criação, papel sem pessoa, atribuição, login, menu real, deep-link, edição/impacto, auditoria, mobile e cleanup.
- Screenshots parciais e descartáveis: `tmp/custom-roles/01-roles.png` e `02-new-role.png`; não há alegação de E2E PASS.

Blockers:
- BR-007 bloqueia a homologação remota e a resolução do BR-006.
- BR-001 SMTP, BR-002 cron não bloqueante e BR-005 Asaas Sandbox permanecem pendentes e inalterados.

Suggested next package:
- Aplicar e versionar o grant mínimo do BR-007; então executar o runner custom roles sem outras mudanças de produto e marcar BR-006 resolvido com evidência completa.
