# ORDUM 02 — Arquitetura global

## Estado vigente

A Ordum é uma aplicação React/Vite publicada pela Vercel. A navegação é baseada em hash, incluindo `/#/login`, `/#/workspace` e `/#/admin`. O Supabase de produção (`plnciaxcujnvaermxmby`) é a fonte de verdade para Auth, PostgreSQL, RLS e os domínios dos tenants.

Não há banco local operacional nem mocks usados como fonte de verdade. `localStorage` guarda apenas a preferência do tenant ativo; usuários, vínculos, permissões, leads, clientes, contratos e cobrança são lidos do banco.

## Boundaries

```text
Browser React/Vite
  ├─ Supabase Auth + dados do workspace protegidos por RLS
  └─ /api/admin/* com Bearer JWT
         └─ Express serverless na Vercel
              ├─ valida sessão no Supabase Auth
              ├─ calcula papel + permissões + equipes + recurso
              └─ usa SUPABASE_SECRET_KEY somente no servidor

Asaas Sandbox
  ├─ API v3 chamada somente pelo BillingProvider server-side
  └─ POST /api/webhooks/asaas
         └─ token próprio → rate limit → persistência → HTTP 200
              └─ waitUntil → claim atômico → processamento idempotente
```

A boundary financeira principal é o Express já implantado na Vercel. Não existe uma segunda implementação concorrente em Edge Functions.

## Segurança

- O frontend aceita apenas publishable key.
- O backend falha se não houver `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`; chave pública não é fallback administrativo.
- A rota temporária que listava slugs e e-mails foi removida.
- Tabelas financeiras têm RLS habilitado, nenhum grant para `anon`/`authenticated` e grants explícitos apenas para `service_role`.
- Dados brutos de webhook e dados fiscais não são devolvidos ao browser.
- O papel interno da plataforma é separado dos papéis de cada tenant.
- Guards React são UX; a decisão autoritativa ocorre na API e no banco.

## Deploy

`main` no GitHub alimenta o projeto Vercel. `npm run build` gera o frontend em `dist/` e o handler serverless em `api/index.mjs`. `vercel.json` mantém o rewrite de `/api/*`, fallback SPA e um cron diário de conciliação às 06:17 UTC.

## Decisões

1. PostgreSQL/Supabase é a fonte de verdade.
2. Valores monetários são inteiros em centavos e moeda BRL.
3. A Ordum controla o estado de acesso; o provedor informa fatos financeiros.
4. Criar assinatura nunca ativa tenant.
5. Trial e pagamento têm fluxos distintos.
6. Produção Asaas permanece bloqueada em código até homologação e autorização explícita.
7. O cron diário retoma a fila e reconcilia assinaturas/cobranças paginadas; divergências críticas não alteram acesso automaticamente.

## Control plane administrativo

O admin ganhou uma boundary server-only para métricas, onboarding, Customer Success, suporte, privacidade, metas, operações e entitlements. As tabelas correspondentes não têm grant de browser; o Express intersecta filtros com equipe, owner e tenants permitidos antes de consultar RPCs. Detalhes em `ORDUM_09_ADMIN_CONTROL_PLANE.md`.
