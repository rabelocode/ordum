# SUPABASE ACCESS MATRIX

## Tabelas Mapeadas (Diag OpenAPI)
- **Core (Browser + Server)**: `profiles`, `tenants`, `memberships`. Acesso restrito a RLS, interceptado em testes multi-tenant pelo Middleware `tenantAuth.ts`.
- **Autorização (Server-Scoped Recomendado)**: `roles`, `permissions`.
- **Platform (Admin-scoped)**: `platform_members`, `platform_roles`, `platform_permissions`. Mapeamento presente no schema via diag (98 tabelas totais no projeto referenciadas).
- **Integridade**: `integrity_channels`, `integrity_reports`. Acessíveis via RPCs (`submit_integrity_report`, `read_integrity_report`, `post_integrity_reporter_message`).
- **Geral**: RLS presumido (NÃO CONFIRMADO como autossuficiente para browser, dependemos fortemente dos middlewares já instalados na base express).

Status Diagnóstico de Acesso:
- SERVICE ROLE: COMPROVADO (Consulta de tables list ok).
- ANON: PROVÁVEL (RPcs definidos, restrições limitadas a RLS não exposto na API definition).
- AUTHENTICATED: NÃO EXECUTADO — EXIGE CRIAÇÃO AUTORIZADA DE FIXTURE.
