# ORDUM 04 — Modelo de dados

## Núcleo existente e validado

- Identidade/tenant: `profiles`, `tenants`, `memberships`, `roles`, `permissions`, `membership_roles`, `role_permissions`.
- Catálogo: `solutions`, `tenant_solutions`.
- Plataforma: `platform_members`, `platform_roles`, `platform_permissions`, `platform_role_permissions`, `platform_teams`, `platform_team_members`, atribuições e `platform_audit_logs`.
- Comercial inicial: `marketing_leads` e `marketing_lead_events`.
- Produtos: tabelas `integrity_*`, `people_*` e `talent_*`.

Todas as 59 tabelas públicas encontradas antes desta entrega estavam com RLS habilitado. O histórico remoto de migrations, porém, estava vazio e o repositório não possuía `supabase/`; esta divergência foi corrigida para as mudanças novas, sem fingir que o esquema legado está versionado.

## Comercial adicionado

- `commercial_activities`: notas, ligações, tarefas, reuniões e demos.
- `commercial_demos`: trial, aprovação, expiração, revogação e vínculo com tenant.
- `commercial_proposals`: condição preparada e aprovação.
- `commercial_contracts`: contrato, plano, responsável, ciclo, valor, owner e estado.
- `commercial_contract_items`: soluções e limites contratados.

## Billing adicionado

- `billing_plans`, `billing_plan_prices`, `billing_plan_solutions`;
- `billing_customers`, `billing_subscriptions`, `billing_payments`;
- `billing_webhook_events`, `billing_status_history`;
- `billing_reconciliation_runs`, `tenant_billing_state`.

IDs externos do Asaas têm constraints únicas. `external_reference` usa UUID interno. Valores usam `integer` em centavos. Payload bruto fica em `billing_webhook_events`, sem grants ao browser. Apenas os quatro últimos dígitos do documento fiscal podem ser mantidos no mapeamento do cliente; o contrato fica no boundary administrativo server-side.

## Provisionamento

`provision_paid_contract` é uma RPC `SECURITY DEFINER` com `search_path` explícito, execução revogada de `PUBLIC`, `anon` e `authenticated`, grant apenas para `service_role` e verificação do claim `service_role`. A transação:

1. bloqueia o contrato e o pagamento;
2. exige pagamento local `confirmed`/`received` e contrato elegível;
3. cria tenant somente uma vez;
4. ativa só os itens contratados;
5. mantém owner/membership e RBAC do tenant;
6. transfere a atribuição comercial;
7. atualiza acesso e histórico;
8. registra auditoria.

## Migrations versionadas desta entrega

- `admin_commercial_billing_foundation`
- `billing_provisioning_transaction`
- `demo_idempotency`
- `demo_tenant_link`
- `fix_service_role_rpc_guard`
- `billing_foreign_key_indexes`
