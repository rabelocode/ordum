-- Ordum commercial and billing foundation.
-- All financial data is server-only: RLS is enabled and browser roles receive no grants.

create schema if not exists ordum_private;
revoke all on schema ordum_private from public, anon, authenticated;

create or replace function ordum_private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function ordum_private.set_updated_at() from public, anon, authenticated;

create table if not exists public.commercial_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.marketing_leads(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  team_id uuid references public.platform_teams(id) on delete set null,
  owner_platform_member_id uuid references public.platform_members(id) on delete set null,
  activity_type text not null check (activity_type in ('note','call','email','task','meeting','demo')),
  subject text not null,
  description text,
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or tenant_id is not null)
);

create table if not exists public.commercial_demos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.marketing_leads(id) on delete cascade,
  team_id uuid references public.platform_teams(id) on delete set null,
  owner_platform_member_id uuid references public.platform_members(id) on delete set null,
  status text not null default 'requested' check (status in ('requested','scheduled','approved','active','expired','revoked','cancelled')),
  starts_at timestamptz,
  expires_at timestamptz,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null default 1 check (version > 0),
  name text not null,
  description text,
  currency text not null default 'BRL' check (currency = 'BRL'),
  trial_days integer not null default 0 check (trial_days >= 0),
  grace_days integer not null default 5 check (grace_days >= 0),
  limits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (code, version)
);

create unique index if not exists billing_plans_one_active_version_idx
  on public.billing_plans(code) where active and archived_at is null;

create table if not exists public.billing_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id) on delete cascade,
  cycle text not null check (cycle in ('weekly','biweekly','monthly','quarterly','semiannual','yearly')),
  billing_type text not null default 'UNDEFINED' check (billing_type in ('UNDEFINED','BOLETO','CREDIT_CARD','PIX')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, cycle, billing_type)
);

create table if not exists public.billing_plan_solutions (
  plan_id uuid not null references public.billing_plans(id) on delete cascade,
  solution_id uuid not null references public.solutions(id) on delete restrict,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (plan_id, solution_id)
);

create table if not exists public.commercial_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_number bigint generated always as identity unique,
  lead_id uuid not null references public.marketing_leads(id) on delete restrict,
  plan_id uuid references public.billing_plans(id) on delete restrict,
  team_id uuid references public.platform_teams(id) on delete set null,
  owner_platform_member_id uuid references public.platform_members(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','sent','accepted','rejected','expired','cancelled')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  cycle text check (cycle is null or cycle in ('weekly','biweekly','monthly','quarterly','semiannual','yearly')),
  billing_type text check (billing_type is null or billing_type in ('UNDEFINED','BOLETO','CREDIT_CARD','PIX')),
  valid_until date,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  notes text,
  approval_notes text,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number bigint generated always as identity unique,
  proposal_id uuid unique references public.commercial_proposals(id) on delete restrict,
  lead_id uuid not null references public.marketing_leads(id) on delete restrict,
  tenant_id uuid unique references public.tenants(id) on delete restrict,
  plan_id uuid references public.billing_plans(id) on delete restrict,
  team_id uuid references public.platform_teams(id) on delete set null,
  owner_platform_member_id uuid references public.platform_members(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_tax_id text,
  customer_phone text,
  owner_name text,
  owner_email text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','pending_payment','active','past_due','suspended','cancelled','expired')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  cycle text not null check (cycle in ('weekly','biweekly','monthly','quarterly','semiannual','yearly')),
  billing_type text not null default 'UNDEFINED' check (billing_type in ('UNDEFINED','BOLETO','CREDIT_CARD','PIX')),
  grace_days integer not null default 5 check (grace_days >= 0),
  starts_on date,
  ends_on date,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  cancelled_at timestamptz,
  cancellation_at_period_end boolean not null default true,
  external_reference uuid not null default gen_random_uuid() unique,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.commercial_contracts(id) on delete cascade,
  solution_id uuid not null references public.solutions(id) on delete restrict,
  description text,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (contract_id, solution_id)
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas' check (provider in ('asaas')),
  tenant_id uuid references public.tenants(id) on delete restrict,
  lead_id uuid references public.marketing_leads(id) on delete restrict,
  contract_id uuid references public.commercial_contracts(id) on delete restrict,
  provider_customer_id text not null,
  external_reference uuid not null unique,
  name text not null,
  email text,
  tax_id_last4 text,
  status text not null default 'active' check (status in ('active','inactive','deleted')),
  provider_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas' check (provider in ('asaas')),
  contract_id uuid not null unique references public.commercial_contracts(id) on delete restrict,
  customer_id uuid not null references public.billing_customers(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete restrict,
  provider_subscription_id text not null,
  external_reference uuid not null unique,
  status text not null default 'pending' check (status in ('pending','active','past_due','inactive','cancelled','deleted')),
  provider_status text,
  cycle text not null,
  billing_type text not null,
  amount_cents integer not null check (amount_cents >= 0),
  next_due_date date,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas' check (provider in ('asaas')),
  provider_payment_id text not null,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  contract_id uuid references public.commercial_contracts(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete restrict,
  external_reference uuid,
  status text not null default 'pending' check (status in ('pending','confirmed','received','overdue','refused','refunded','partially_refunded','chargeback','deleted','restored')),
  provider_status text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  net_amount_cents integer check (net_amount_cents is null or net_amount_cents >= 0),
  due_date date,
  confirmed_at timestamptz,
  received_at timestamptz,
  paid_period_starts_on date,
  paid_period_ends_on date,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas' check (provider in ('asaas')),
  provider_event_id text not null,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processing','processed','ignored','failed')),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  payload jsonb not null,
  correlation_id uuid not null default gen_random_uuid(),
  unique (provider, provider_event_id)
);

create table if not exists public.billing_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  contract_id uuid references public.commercial_contracts(id) on delete cascade,
  payment_id uuid references public.billing_payments(id) on delete set null,
  webhook_event_id uuid references public.billing_webhook_events(id) on delete set null,
  from_status text,
  to_status text not null,
  reason text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas' check (provider in ('asaas')),
  status text not null default 'running' check (status in ('running','completed','completed_with_errors','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  checked_count integer not null default 0,
  corrected_count integer not null default 0,
  divergence_count integer not null default 0,
  error_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  triggered_by_user_id uuid references auth.users(id) on delete set null
);

create table if not exists public.tenant_billing_state (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  contract_id uuid unique references public.commercial_contracts(id) on delete restrict,
  subscription_id uuid unique references public.billing_subscriptions(id) on delete set null,
  access_status text not null default 'pending_payment' check (access_status in ('trial','pending_payment','active','grace','suspended','cancelled','review')),
  paid_through date,
  grace_ends_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  last_payment_id uuid references public.billing_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_activities_lead_idx on public.commercial_activities(lead_id, created_at desc);
create index if not exists commercial_activities_tenant_idx on public.commercial_activities(tenant_id, created_at desc);
create index if not exists commercial_demos_lead_idx on public.commercial_demos(lead_id, created_at desc);
create index if not exists commercial_proposals_lead_idx on public.commercial_proposals(lead_id, created_at desc);
create index if not exists commercial_contracts_status_idx on public.commercial_contracts(status, created_at desc);
create index if not exists billing_payments_due_idx on public.billing_payments(status, due_date);
create index if not exists billing_webhook_events_status_idx on public.billing_webhook_events(status, received_at);
create index if not exists billing_status_history_tenant_idx on public.billing_status_history(tenant_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'commercial_activities','commercial_demos','billing_plans','billing_plan_prices',
    'billing_plan_solutions','commercial_proposals','commercial_contracts',
    'commercial_contract_items','billing_customers','billing_subscriptions',
    'billing_payments','billing_webhook_events','billing_status_history',
    'billing_reconciliation_runs','tenant_billing_state'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

grant usage, select on all sequences in schema public to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'commercial_activities','commercial_demos','billing_plans','billing_plan_prices',
    'commercial_proposals','commercial_contracts','billing_customers','billing_subscriptions',
    'billing_payments','tenant_billing_state'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function ordum_private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

insert into public.platform_permissions (key, category, description)
values
  ('platform.commercial.read', 'sales', 'Visualizar atividades, demonstrações, propostas e contratos no escopo autorizado'),
  ('platform.commercial.manage', 'sales', 'Registrar atividades e preparar propostas no escopo autorizado'),
  ('platform.commercial.approve', 'sales', 'Aprovar condições comerciais e contratos dentro da alçada'),
  ('platform.billing.read', 'billing', 'Visualizar situação financeira no escopo autorizado'),
  ('platform.billing.manage', 'billing', 'Administrar planos, assinaturas e conciliação financeira'),
  ('platform.billing.webhooks.manage', 'billing', 'Reprocessar eventos financeiros com falha')
on conflict (key) do update set
  category = excluded.category,
  description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_id)
select r.id, p.id
from public.platform_roles r
cross join public.platform_permissions p
where (r.key = 'admin' and p.key in (
  'platform.commercial.read','platform.commercial.manage','platform.commercial.approve',
  'platform.billing.read','platform.billing.manage','platform.billing.webhooks.manage'
)) or (r.key = 'manager' and p.key in (
  'platform.commercial.read','platform.commercial.manage','platform.commercial.approve','platform.billing.read'
)) or (r.key = 'sales' and p.key in (
  'platform.commercial.read','platform.commercial.manage','platform.billing.read'
))
on conflict do nothing;

comment on table public.billing_webhook_events is 'Raw provider payloads. Server-only; never grant browser roles.';
comment on table public.billing_customers is 'Billing provider customer mapping. Store only tax-id last four digits.';
comment on table public.tenant_billing_state is 'Ordum-owned access state derived from confirmed financial events.';
