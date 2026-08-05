# SECURITY FINDINGS

## Auditoria e Diagnóstico de Database

**Método de Teste:** Leitura isolada via REST OpenAPI utilizando token `SUPABASE_SECRET_KEY` restrito, rodado em 2026-08-04T22:00 (Ordum env).

### Descobertas e Status

- **Falsificação de Tenant via API Frontend:**
  - Status: COMPROVADO (mitigado nos endpoints cobertos pelos testes de Mock). Múltiplos testes unitários garantem rejeição de interceptações quando um client adulterar o header `x-tenant-id` para requisitar tenancy alheia.
  - Ação Necessária: PROVÁVEL expansão de cobertura no `server.ts` e `index.mjs` ao vincular todos os paths protegidos.

- **Supabase RLS Bypass Auth (Nativo Supabase):**
  - Risco de usuários forjarem headers na UI acessando tabelas públicas (e.g. `marketing_leads`).
  - Eficiência do RLS: NÃO CONFIRMADO em teste ponta a ponta real. As queries OpenAPI acusam apenas presença de visibilidade e RPCs genéricos; policies não são lidas cruamente sem shell `psql` direto.

- **Acesso Direto Service Role RPCs:**
  - Status: COMPORTAMENTO INTENCIONAL. `provision_tenant` etc., mapeados como RPCs presentes no banco (Total de 35 identificados).

## Plano de Teste Mandatório (Próximo Ciclo Segurado)
1. Criar fixture `User A (Tenant A)` e `User B (Tenant B)`.
2. Efetuar requisições client-side certificando segregação estrita sem intervenção humana.
