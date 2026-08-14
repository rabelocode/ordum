Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 0a7be7730b213d4bc17f19c5eb2ccf84dfd074c1
Headline: Release Candidate 1 — protocolo humano homologado; Admin + Integridade preservados.

Database sync:
- `20260814175625_integrity_human_protocol` e `20260814175716_integrity_human_protocol_random_source_fix` constam no histórico remoto e agora no Git.
- A definição local final reproduz `public.submit_integrity_report_v2`; remoto confirmado como `SECURITY DEFINER`, `search_path=pg_catalog, public, extensions` e EXECUTE apenas para `service_role`.
- Nenhuma migration foi reaplicada no Supabase.

Protocol:
- Novos relatos: `INT-AAAA-000000`, ano `America/Sao_Paulo`, seis dígitos criptograficamente aleatórios, retry limitado e unique constraint como autoridade final.
- `ORD-*` preservado; acompanhamento continua exigindo protocolo + código secreto bcrypt.
- Protocolo idêntico em report/case, ciclo completo, busca e exportações.

E2E:
- Integridade RC no Preview: `integrity_e2e_1786732596294_2746f970`, protocolo `INT-2026-815606`.
- Browser mobile: envio, comprovante, tracking e complemento; desktop/mobile: caixa, busca integral/parcial e detalhe.
- Compliance: investigação até encerramento/reabertura; CSV individual, CSV de casos e PDF preservaram protocolo e filename seguro.
- Fixture legacy `ORD-*` acompanhada com protocolo + segredo.
- Admin aggregate-only e negativos RLS/cross-tenant preservados.
- Admin smoke: `ui-mstadow8`, login → dashboard → lead → empresa → implantação → Integridade.
- Cleanup: `residualTenants=0`, `residualAuth=0`.

Preview:
- READY — `dpl_7KtEXYrRT7yHiAf1Nes6YVgLGoPM`
- Imutável: https://ordum-6ok10c7t5-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- Logs HTTP 5xx no smoke: 0.

Checks:
- Secret scan PASS; 36 migrations locais válidas; lint/typecheck PASS; build PASS.
- 209 testes PASS, 0 FAIL, 1 live comercial SKIP explícito.
- 6 testes focados cobrem formato, fonte não sequencial, retry, sincronização report/case, segredo e grants.
- Security Advisor: nenhum alerta novo de protocolo; INFO/WARN legados mantidos sem limpeza fora de escopo.

Backend Requests:
- BR-001 pendente: SMTP transacional para remover o rate limit externo de convites.
- BR-002 pendente não bloqueante: runner sem `CRON_SECRET` e cron diário no plano atual.
- BR-003 RESOLVIDO e homologado.
- BR-004 novo, não bloqueante: `20260811231343_integrity_customer_operations` existe no Git, mas não no histórico/schema remoto; requer reconciliação oficial do backend.

Regressions:
- Nenhum 5xx, erro de console, duplicidade, divergência report/case, vazamento de segredo, quebra legacy ou acesso confidencial pelo Admin Global encontrado.
- `PlaceholderAdminPage.tsx` removido após confirmar ausência total de imports/uso.
