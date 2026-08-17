Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 07c1919e8cc6ddc9535357a4c3e0b2b5264fd50f
Headline: Admin + Integridade FROZEN — gate final de produto aprovado.

Result:
- FROZEN WITH EXTERNAL BLOCKERS; nenhum blocker interno encontrado.

Browser run:
- Comercial completo: `ui-mswhe44h` PASS.
- Financeiro/CS: `rc21-mswhh98i-45d1ad` PASS.
- Navigation/RBAC: `admin-nav-mswhilku-a48c52` PASS.
- Acessos/custom roles: `admin-access-mswhkpfl-42801b` e `custom-role-mswhjiw2-0162a5` PASS.
- Integridade completo: `integrity_e2e_1786926372985_2e838e83` PASS.
- Convite/callback: `invite-mswifehh` PASS até o provider; entrega SMTP recebeu o 429 esperado de BR-001.

Fixes:
- Eliminada a corrida de resolução de destino que podia sobrescrever a navegação imediatamente após login/aceite do convite.
- Runner de aceite passou a acionar explicitamente o CTA real de envio.

Personas:
- Admin Global, Comercial, Financeiro, Customer Success, tenant_admin, compliance, investigador atribuído/não atribuído e denunciante anônimo/identificado validados.
- Deep-links proibidos negados; Admin Global permaneceu aggregate-only no Integridade.

Desktop/Mobile:
- 1440x1000 e 390x844 validados.
- Evidências finais: `tmp/final-freeze/01-dashboard.png` a `24-public-mobile.png`.

Preview:
- READY — `dpl_FkERuCnhy1QWTEreZ3xruTkRoT3V`.
- Imutável: https://ordum-mae070gl0-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- HTTP 5xx = 0; console inesperado = 0 (somente 429 externo do SMTP no teste de convite).

Checks:
- Migration validation, secret scan, lint, typecheck e build PASS.
- Suíte: 228 testes; 227 PASS, 1 live E2E explicitamente SKIP, 0 FAIL.

Cleanup:
- Auth QA = 0; platform_members QA = 0; roles QA = 0; tenants QA = 0; reports QA = 0.

Internal blockers:
- Nenhum.

External blockers:
- BR-001 SMTP transacional: pendente e bloqueante somente para entrega real do convite.
- BR-002 cron intradiário: pendente, não bloqueante.
- BR-005 Asaas Sandbox: pendente para operações financeiras externas; produto local permanece fail-closed.
