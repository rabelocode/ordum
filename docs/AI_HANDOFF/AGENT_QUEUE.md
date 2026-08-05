# Agent Queue

## Current Assignment

Owner: chatgpt_backend
Status: ready_for_review
Created by: chatgpt_backend
Branch: feat/admin-ordum-operations
Head: 51abd2654c609650db94ff8a3ebcde59adcdced0

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
