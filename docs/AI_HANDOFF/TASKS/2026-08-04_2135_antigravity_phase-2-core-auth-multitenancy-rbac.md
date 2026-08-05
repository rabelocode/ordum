# Phase 2: Core, Auth, Multi-Tenancy e RBAC
Data: 2026-08-04  
Agente: Antigravity  

## 1. Tabela de Responsabilidade (Arquitetura Revisada)
| Responsabilidade | Provider antigo | AccessProvider | Duplicado | Ação Realizada/Decisão |
|---|---|---|---|---|
| session / auth | AuthProvider | AccessProvider via hooks | Parcial (listeners isolados) | Mantidos adaptadores passivos; consumers novos apontam p/ Access. |
| profile | TenantProvider | AccessProvider via hooks | Não (herdados) | Delegado. |
| memberships | TenantProvider | AccessProvider via hooks | Não (herdados) | Delegado. |
| active tenant | TenantProvider | AccessProvider via hooks | Não (herdados) | Delegado. |
| platform | PlatformAuthProvider | AccessProvider | Não (herdados) | Delegado. |

O `AccessProvider` foi eleito como agregador (Alternative Strategy) encapsulando chamadas mas não atritando com os caches dos três providers legados que ainda residem para evitar regressão visual durante a passagem massiva.

## 2. Integração Middlewares Backend

- **Rotas:** Os middlewares (`authenticateRequest`, `resolveTenantContext`, `requireTenantPermission`, `resolvePlatformContext`) agora operam sob a lógica base em `test/e2e/tenant-auth.test.ts`. Eles bloqueiam agressivamente requests cruzados onde o token do usuário não bate com a `membership` real no banco.

## 3. Integração Frontend (Guards e Provider Tree)

- **Guards:** Os componentes em `src/core/auth/Guards.tsx` (`RequireAuth`, `RequireTenant`, `RequirePlatformPermission`) aplicam verificação e forçam alteração silenciosa de hash `window.location.hash` quando interceptam falsificações.
- **Root Injection:** O `AccessProvider` unificado foi injetado sem redundâncias mortais de loop no `main.tsx`.

## 4. Testes (Mock E2E)

`test/e2e/tenant-auth.test.ts` foi inserido provando cenários de spoofing:
- **Acessando B a partir de A:** Devolve `403 Forbidden` ao identificar a fraude de header cruzado em simulação de request.
- **Acessando A de A:** Devolve 2xx (next()) validando a membership correspondente.

## 5. Comandos e Verificações CI
Executados sequencialmente sem operadores bitwise `&&` restritos via Powershell:
`npm run typecheck`, `npm run lint`.
*(Resultados assíncronos no log do disco. O build foi acionado em background).*

## 6. Schema e Migrations
Matriz averiguada no schema remoto:
- `memberships`, `roles`, `permissions`: Tabelas espelho aderentes sem desvio; RLS existente.
- **Não foi alocada migration nova** pois os middlewares interceptam o fluxo diretamente com `SUPABASE_SECRET_KEY` no server, isolando as políticas que o RLS já sustenta.

## Ponto de Continuação
1. Validar as rotas que consumirão o middleware real (`api/index.mjs` etc).
2. Substituir `WorkspaceApp.tsx` inteiramente com roteador estrito.
3. Testar a rota de Admin visualizando e ativando no Playwright (Ação manual ou Próximo turn).

STATUS: PARCIAL — NÃO FAZER MERGE
