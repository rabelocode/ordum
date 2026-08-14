Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 4e56e9171de9aab781d6ae031186b92bf9290e96
Headline: RC2.1 — Admin e Integridade homologados visualmente no browser.

Preview:
- READY — `dpl_sDZjRvaQ73VoaMTKEoyKEUR6qzsC`
- Imutável: https://ordum-mt7l4xc5j-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- Smoke autenticado/anônimo sem console error; runtime HTTP 5xx: 0.

Visual acceptance:
- Admin Global/Vendedor: Dashboard, Lead, Proposta e Customer 360 aprovados em 1440x1000.
- Financeiro: visão geral, assinaturas ativa/trial/em atraso e cobrança vencida aprovadas em 1440x1000 e 390x844.
- Customer Success: carteira e próxima ação aprovadas com dados persistidos.
- Integridade: Home, caixa, caso, investigação, canal público e tracking aprovados em desktop/mobile.
- 22 screenshots em `tmp/rc2-visual/` (`01-admin-dashboard.png` a `22-public-tracking-mobile.png`).

Bugs encontrados/corrigidos:
- Status de trial e atraso agora usa o estado financeiro efetivo, sem rótulo genérico.
- Upload de evidência no tracking público não expõe mais seletor nativo em inglês; controle acessível em português.
- Roteiros descartáveis estabilizados para navegação SPA, escopo de CS e capturas após skeleton.

Evidence:
- Admin browser QA: `rc21-mste6uvp-641b3f`; personas Admin Global, Financeiro, Customer Success e Vendedor; cleanup concluído.
- Integridade live E2E: `integrity_e2e_1786739456585_4d6dce2d`; browser/RBAC/Storage/tracking/Admin aggregate-only PASS.
- Cleanup Integridade: `residualTenants=0`, `residualAuth=0`.
- Secret scan: 361 arquivos; lint/typecheck/build PASS; 214 testes, 213 PASS, 1 live comercial SKIP explícito.

Backend Requests:
- BR-001 pendente: SMTP transacional externo.
- BR-002 pendente não bloqueante: cron intradiário/runner.
- BR-005 pendente: credenciais Asaas Sandbox; produção permanece desabilitada.
