create index if not exists billing_plans_created_by_idx on public.billing_plans(created_by_user_id);
create index if not exists billing_plan_solutions_solution_idx on public.billing_plan_solutions(solution_id);

create index if not exists commercial_activities_created_by_idx on public.commercial_activities(created_by_user_id);
create index if not exists commercial_activities_owner_idx on public.commercial_activities(owner_platform_member_id);
create index if not exists commercial_activities_team_idx on public.commercial_activities(team_id);

create index if not exists commercial_demos_approved_by_idx on public.commercial_demos(approved_by_user_id);
create index if not exists commercial_demos_owner_idx on public.commercial_demos(owner_platform_member_id);
create index if not exists commercial_demos_team_idx on public.commercial_demos(team_id);

create index if not exists commercial_proposals_approved_by_idx on public.commercial_proposals(approved_by_user_id);
create index if not exists commercial_proposals_created_by_idx on public.commercial_proposals(created_by_user_id);
create index if not exists commercial_proposals_owner_idx on public.commercial_proposals(owner_platform_member_id);
create index if not exists commercial_proposals_plan_idx on public.commercial_proposals(plan_id);
create index if not exists commercial_proposals_team_idx on public.commercial_proposals(team_id);

create index if not exists commercial_contracts_approved_by_idx on public.commercial_contracts(approved_by_user_id);
create index if not exists commercial_contracts_created_by_idx on public.commercial_contracts(created_by_user_id);
create index if not exists commercial_contracts_lead_idx on public.commercial_contracts(lead_id);
create index if not exists commercial_contracts_owner_idx on public.commercial_contracts(owner_platform_member_id);
create index if not exists commercial_contracts_plan_idx on public.commercial_contracts(plan_id);
create index if not exists commercial_contracts_team_idx on public.commercial_contracts(team_id);
create index if not exists commercial_contract_items_solution_idx on public.commercial_contract_items(solution_id);

create index if not exists billing_customers_contract_idx on public.billing_customers(contract_id);
create index if not exists billing_customers_lead_idx on public.billing_customers(lead_id);
create index if not exists billing_customers_tenant_idx on public.billing_customers(tenant_id);
create index if not exists billing_subscriptions_customer_idx on public.billing_subscriptions(customer_id);
create index if not exists billing_subscriptions_tenant_idx on public.billing_subscriptions(tenant_id);
create index if not exists billing_payments_contract_idx on public.billing_payments(contract_id);
create index if not exists billing_payments_subscription_idx on public.billing_payments(subscription_id);
create index if not exists billing_payments_tenant_idx on public.billing_payments(tenant_id);

create index if not exists billing_status_history_actor_idx on public.billing_status_history(actor_user_id);
create index if not exists billing_status_history_contract_idx on public.billing_status_history(contract_id);
create index if not exists billing_status_history_payment_idx on public.billing_status_history(payment_id);
create index if not exists billing_status_history_webhook_idx on public.billing_status_history(webhook_event_id);
create index if not exists billing_reconciliation_triggered_by_idx on public.billing_reconciliation_runs(triggered_by_user_id);
create index if not exists tenant_billing_state_last_payment_idx on public.tenant_billing_state(last_payment_id);
