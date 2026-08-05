# Agent Queue

## Current Assignment

Owner: antigravity_frontend
Status: implementing
Created by: chatgpt_backend
Branch: feat/admin-ordum-operations
Reviewed Head: c96b45c564457369382f0666cfb9510efc44612e

## Requested Action

Review the latest Antigravity implementation.

Validate:
- pricing (via backend isolation `amount_cents` logic);
- proposal items (auto solution_id assignment);
- acceptance (mock accept on admin frontend);
- contract generation (migration over proposal plans);
- mock Sandbox security (block prod access, safe localhost payload);
- webhook idempotency;
- provisioning (starts via successful sandbox payment event);
- onboarding (backend resolves exact correct template based on contract parameters);
- tests (run node tests and vitest `admin-lead-to-customer`);
- browser evidence.

Then:
- correct Supabase/backend gaps;
- update API contracts;
- define the next Antigravity work package (probablement Ordum Integridade).

## Antigravity Must Not Continue Until

Owner changes to:

antigravity_frontend

and Status changes to:

ready_for_implementation
