Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 2ace7c6ed2c82a0d2e16fec1f487743e68a0f7db
Headline: Admin Access Management homologado — papéis personalizados e RBAC completos.

Implemented:
- Catálogo, criação, edição atômica, atribuição e preview do menu foram homologados de ponta a ponta.
- Papéis personalizados aparecem com zero pessoas; Administrador, Gerente e Vendas permanecem protegidos e sem CTA de edição.
- Correções de homologação: contagem de impacto considera pessoas atuais, dialogs possuem nome acessível e papel `sales` usa o rótulo Vendas.

Database:
- Migration remota já aplicada `20260816170658_grant_service_role_app_private_usage` materializada no Git sem reaplicação.
- Grants confirmados: `service_role` possui USAGE em `app_private` e EXECUTE nas wrappers; PUBLIC/anon/authenticated não possuem esses acessos.
- BR-006 e BR-007 RESOLVIDOS.

Tests:
- Browser QA final `custom-role-msw4atdk-152e74`: PASS; catálogo HTTP 200; dois papéis criados; papel sem membro visível; sistema protegido; deep-link negado; auditoria humana.
- Negativos: usuário sem `platform.staff.manage` recebeu 403 em POST e PATCH; menu real atualizado após novo login.
- Migration validation, secret scan, lint, typecheck e build PASS; testes focados 7/7; suíte 228 testes, 227 PASS, 1 live E2E explicitamente SKIP, 0 FAIL.

Preview:
- READY — `dpl_34Ks8XV6WzVKdb21UGPCfxZW33TM`
- Imutável: https://ordum-dxuue9a52-ordum.vercel.app
- Alias da branch: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app

QA:
- Desktop e mobile 390x844 validados; 9 screenshots em `tmp/custom-roles/`; overflow mobile = false.
- Criação → papel com zero pessoas → atribuição → login real → edição com impacto → refresh de permissões → auditoria concluídos.
- Console errors = 0; HTTP 5xx = 0 no runner e nos logs do deployment.
- Cleanup: Auth QA = 0; platform_members QA = 0; papéis QA = 0; team memberships QA = 0.

Blockers:
- BR-001 SMTP, BR-002 cron não bloqueante e BR-005 Asaas Sandbox permanecem pendentes e inalterados.

Suggested next package:
- Product review da Gestão de Acessos homologada; não há blocker interno de papéis personalizados.
