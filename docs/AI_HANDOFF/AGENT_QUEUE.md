Owner: codex
Status: blocked_external
Branch: fix/admin-functional-recovery
Verified code SHA: 31e84285facaed405d0f471e5607ce1cbe372f36
Preview deployment: dpl_HnEGSnZgVFLSneVhCxj7ijrfnqVC
Preview URL: https://ordum-rm1hztbhp-ordum.vercel.app
Scope: Admin Commercial Recovery & Billing Asaas Sandbox

Checks verified on 2026-08-09:
- secret scan, migration validation, lint/typecheck, 104 tests and build: PASS;
- Preview deployment: READY; root HTTP 200; diagnostics without auth HTTP 401; 5xx logs: 0;
- E2E residue counts: Auth 0, platform_members 0, active platform_members 0;
- live E2E preflight: correctly aborted before fixtures because E2E operator credentials and ASAAS_API_KEY are absent;
- migration 20260806230000: still absent from official remote history; CLI repair blocked by missing Supabase CLI access token/link credentials.

External requirements:
- configure E2E_OPERATOR_EMAIL, E2E_OPERATOR_PASSWORD and ASAAS_API_KEY Sandbox in the controlled execution environment;
- provide Supabase CLI access/link credentials to run `migration repair 20260806230000 --status applied` officially.
