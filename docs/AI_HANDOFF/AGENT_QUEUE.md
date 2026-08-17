Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 6c78c894badc1c7e9a10ee414b1936822307c43b
Headline: Release Readiness — produto congelado; integrações externas mapeadas e homologadas quando disponíveis.

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
- Validação local: 39 migrations ordenadas.
- Histórico remoto comparado sem DDL, `db push`, insert manual ou repair inseguro.
- BR-008: WAITING FOR SUPABASE CLI ACCESS para reconciliar divergências históricas pelo fluxo oficial; `SUPABASE_ACCESS_TOKEN` ausente.
- Checklist de ativação e rollback: `docs/AI_HANDOFF/RELEASE_READINESS.md`.

Checks:
- Secret scan, migration validation, lint, typecheck e build: PASS.
- Testes focados de release readiness: 5 PASS, 0 FAIL.
- QA final: fixtures removidas; Auth QA = 0, platform_members QA = 0, tenants QA = 0.

External blockers:
- BR-001: WAITING FOR SMTP CREDENTIALS.
- BR-002: WAITING FOR INFRASTRUCTURE.
- BR-005: WAITING FOR ASAAS SANDBOX CREDENTIALS.
- BR-008: WAITING FOR SUPABASE CLI ACCESS.
