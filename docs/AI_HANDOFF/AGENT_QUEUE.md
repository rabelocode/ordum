Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 5f375bdf75d54cf28a04db1379dc533553d87c55
Headline: Release Readiness — BR-008 resolvido; histórico Git e Supabase oficialmente sincronizado.

Core product:
- Admin: FROZEN.
- Integridade: FROZEN.
- Nenhum blocker interno novo.

Preview:
- READY — `dpl_5uikHvPSrdDW3BTuapLEzLS1oJT8`.
- Imutável: https://ordum-le8o7xovz-ordum.vercel.app
- Alias da branch: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- Browser QA `release-mswj92q1`: 3 integrações pendentes exibidas, console errors = 0, HTTP 5xx = 0.
- Screenshot: `tmp/release-readiness-health-final.png`.

SMTP / Auth redirects:
- BR-001: WAITING FOR SMTP CREDENTIALS.
- Contrato documentado: host, port, username, password, sender address e sender name; nenhum valor real no Git/frontend/logs.
- Templates Ordum e redirects exatos de Preview/produção preparados em `docs/AI_HANDOFF/RELEASE_READINESS.md`.
- Callback/login permanecem homologados; entrega real depende do SMTP externo.

Cron:
- BR-002: WAITING FOR INFRASTRUCTURE.
- `CRON_SECRET` existe no ambiente seguro; ausência e credencial incorreta retornaram 401.
- Frequência atual: diária (`06:17 UTC` e `06:47 UTC`); última execução registrada em 11/08/2026, portanto não foi declarada operacional.
- Validação com credencial correta permanece bloqueada porque o valor Sensitive não é recuperável nesta sessão; plano atual não entrega alertas intradiários.

Asaas Sandbox:
- BR-005: WAITING FOR ASAAS SANDBOX CREDENTIALS.
- `ASAAS_API_KEY` ausente; nenhuma homologação externa foi simulada.
- Preview corrigido para `BILLING_ENABLED=false`; produção não foi alterada.
- Setup valida chave Sandbox e usa a lista canônica de eventos; produção continua bloqueada/fail-closed.

Health / environment / security:
- Saúde do sistema mostra E-mail transacional, Integração financeira e Automação de alertas em linguagem humana e sem secrets.
- Variáveis classificadas server-side em core, integração externa opcional e produção.
- Secret scan: 376 arquivos rastreados, 0 ocorrência.
- Logs do Preview: HTTP 5xx = 0; nenhum segredo exposto.

Database / release checklist:
- BR-008: RESOLVIDO em 17/08/2026.
- Acesso oficial validado no projeto `ordum-production`; `supabase migration list --linked` final possui 40 versões com `local = remote`.
- Aliases históricos reconciliados somente por `supabase migration repair`; migration remota `20260805230011` materializada no Git com hash canônico igual.
- `20260806230000_backfill_commercial_items` marcado como aplicado após prova agregada de zero propostas e zero contratos pendentes.
- Zero DDL, `db push`, alteração manual em `schema_migrations` ou leitura de conteúdo comercial.
- Checklist de ativação e rollback: `docs/AI_HANDOFF/RELEASE_READINESS.md`.

Checks:
- Secret scan: 378 arquivos, PASS; migration validation: 40 migrations ordenadas, PASS.
- Lint, typecheck e build permanecem PASS do pacote de Release Readiness; nenhum código de produto foi alterado no BR-008.
- Testes focados de release readiness: 5 PASS, 0 FAIL.
- QA final: fixtures removidas; Auth QA = 0, platform_members QA = 0, tenants QA = 0.

External blockers:
- BR-001: WAITING FOR SMTP CREDENTIALS.
- BR-002: WAITING FOR INFRASTRUCTURE.
- BR-005: WAITING FOR ASAAS SANDBOX CREDENTIALS.
