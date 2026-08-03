# Ordum

Plataforma SaaS B2B modular com administração comercial, multi-tenancy e os módulos Ordum Integridade, Pessoas e Talentos.

## Ambiente local

Requisitos: Node.js 22 e npm.

1. Copie `.env.example` para `.env.local` e preencha somente no arquivo local.
2. Execute `npm ci`.
3. Execute `npm run dev` e acesse `http://localhost:3000`.

Validação completa antes de publicar:

```bash
npm run check:secrets
npm run test:migrations
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Consultas remotas autorizadas podem ser validadas separadamente com `npm run test:live-queries`. Esse comando exige credenciais locais e nunca integra o CI público.

## GitHub e Vercel

O repositório principal é `rabelocode/ordum`. A Vercel cria produção a partir de `main` e previews a partir das demais branches. Variáveis devem ser configuradas separadamente para Production e Preview; nenhuma credencial é embutida no repositório.

O build público é gerado em `dist/`. O servidor local é gerado em `build/`, fora do diretório publicado. A função da Vercel fica em `api/index.mjs`.

Variáveis mínimas:

- navegador: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`;
- servidor: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`;
- opcionais de observabilidade: `VITE_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`;
- opcionais de produto: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `POSTHOG_PROJECT_KEY`, `POSTHOG_HOST`;
- billing Sandbox: consultar `docs/ORDUM_08_BILLING_ASAAS.md`.

Nunca exponha chaves de servidor em variáveis `VITE_*`, logs, commits ou documentação.

## Documentação

- `docs/ORDUM_02_ARQUITETURA_GLOBAL.md` a `docs/ORDUM_09_ADMIN_CONTROL_PLANE.md`: arquitetura e operação existentes;
- `docs/ORDUM_10_PILOTO_OBSERVABILIDADE.md`: preparação do piloto, observabilidade, analytics, CI e pendências verificadas.
