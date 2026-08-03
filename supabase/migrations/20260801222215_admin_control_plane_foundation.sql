-- Ordum admin control-plane foundation. All objects are server-only by default.

alter table public.marketing_leads
  add column if not exists organization_domain text,
  add column if not exists tax_id_normalized text,
  add column if not exists score integer not null default 0 check (score between 0 and 100),
  add column if not exists score_explanation jsonb not null default '[]'::jsonb,
  add column if not exists qualification_state text not null default 'unqualified'
    check (qualification_state in ('unqualified','marketing_qualified','sales_qualified','disqualified')),
  add column if not exists first_contact_due_at timestamptz,
  add column if not exists first_contact_at timestamptz,
  add column if not exists won_reason text,
  add column if not exists lost_reason text,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by_user_id uuid references auth.users(id),
  add column if not exists lock_version integer not null default 1 check (lock_version > 0);

alter table public.marketing_leads drop constraint if exists marketing_leads_status_check;
alter table public.marketing_leads add constraint marketing_leads_status_check
  check (status in ('new','contacted','qualified','approved','converted','won','lost','rejected'));

alter table public.commercial_demos
  add column if not exists participants jsonb not null default '[]'::jsonb,
  add column if not exists solution_ids uuid[] not null default '{}'::uuid[],
  add column if not exists objections text[] not null default '{}'::text[],
  add column if not exists rescheduled_from_id uuid references public.commercial_demos(id),
  add column if not exists no_show_reason text,
  add column if not exists lock_version integer not null default 1 check (lock_version > 0);

alter table public.commercial_proposals
  add column if not exists root_proposal_id uuid references public.commercial_proposals(id),
  add column if not exists supersedes_proposal_id uuid references public.commercial_proposals(id),
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists vigency_starts_on date,
  add column if not exists vigency_ends_on date,
  add column if not exists limits_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists lock_version integer not null default 1 check (lock_version > 0);

alter table public.commercial_proposals drop constraint if exists commercial_proposals_status_check;
alter table public.commercial_proposals add constraint commercial_proposals_status_check
  check (status in ('draft','pending_approval','approved','sent','accepted','rejected','expired','cancelled','superseded'));

update public.commercial_proposals set root_proposal_id = id where root_proposal_id is null;

alter table public.commercial_contracts
  add column if not exists renewal_at date,
  add column if not exists cancellation_reason text,
  add column if not exists transition_reason text,
  add column if not exists lock_version integer not null default 1 check (lock_version > 0);

alter table public.commercial_contracts drop constraint if exists commercial_contracts_status_check;
alter table public.commercial_contracts add constraint commercial_contracts_status_check
  check (status in (
    'draft','pending_approval','approved','pending_payment','awaiting_payment','active','past_due',
    'renewal_due','cancellation_requested','suspended','cancelled','expired','closed'
  ));

alter table public.tenants
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists tax_id_normalized text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists stakeholders jsonb not null default '[]'::jsonb,
  add column if not exists lifecycle_status text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists success_manager_platform_member_id uuid references public.platform_members(id),
  add column if not exists risk_level text not null default 'unknown'
    check (risk_level in ('unknown','healthy','attention','high','critical')),
  add column if not exists cancellation_reason text,
  add column if not exists lock_version integer not null default 1 check (lock_version > 0);

update public.tenants set lifecycle_status = case
  when status = 'trial' then 'onboarding'
  when status = 'active' then 'active'
  when status = 'suspended' then 'suspended'
  when status = 'cancelled' then 'cancelled'
  else 'opportunity'
end where lifecycle_status is null;

alter table public.tenants alter column lifecycle_status set default 'opportunity';
alter table public.tenants alter column lifecycle_status set not null;
alter table public.tenants drop constraint if exists tenants_lifecycle_status_check;
alter table public.tenants add constraint tenants_lifecycle_status_check
  check (lifecycle_status in (
    'opportunity','approved','awaiting_payment','onboarding','active','at_risk',
    'delinquent','suspended','cancelled','closed'
  ));

create table if not exists public.commercial_lead_identity_keys (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.marketing_leads(id) on delete cascade,
  key_type text not null check (key_type in ('company','domain','tax_id','email','phone')),
  key_hash text not null,
  created_at timestamptz not null default now(),
  unique (lead_id, key_type, key_hash)
);

create index if not exists commercial_lead_identity_lookup_idx
  on public.commercial_lead_identity_keys(key_type, key_hash);

create table if not exists public.commercial_lead_assignment_history (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.marketing_leads(id) on delete cascade,
  from_team_id uuid references public.platform_teams(id),
  to_team_id uuid references public.platform_teams(id),
  from_owner_platform_member_id uuid references public.platform_members(id),
  to_owner_platform_member_id uuid references public.platform_members(id),
  reason text not null,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists commercial_lead_assignment_history_lead_idx
  on public.commercial_lead_assignment_history(lead_id, created_at desc);

create table if not exists public.commercial_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  field text not null,
  operator text not null check (operator in ('equals','contains','present','in','gte','lte')),
  comparison_value jsonb not null default 'null'::jsonb,
  points integer not null check (points between -100 and 100),
  active boolean not null default true,
  priority integer not null default 100,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_scoring_rules_active_idx
  on public.commercial_scoring_rules(priority, id) where active;

create table if not exists public.commercial_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.commercial_proposals(id) on delete cascade,
  solution_id uuid references public.solutions(id),
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commercial_proposal_items_proposal_idx
  on public.commercial_proposal_items(proposal_id);
create unique index if not exists commercial_proposals_root_version_uidx
  on public.commercial_proposals(root_proposal_id, version) where root_proposal_id is not null;

create table if not exists public.platform_state_transitions (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  tenant_id uuid references public.tenants(id),
  team_id uuid references public.platform_teams(id),
  from_status text,
  to_status text not null,
  reason text not null,
  actor_user_id uuid not null references auth.users(id),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_state_transitions_entity_idx
  on public.platform_state_transitions(entity_type, entity_id, created_at desc);
create index if not exists platform_state_transitions_tenant_idx
  on public.platform_state_transitions(tenant_id, created_at desc) where tenant_id is not null;

create table if not exists public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid references public.billing_plans(id),
  solution_id uuid references public.solutions(id),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  step_key text not null,
  title text not null,
  description text,
  position integer not null check (position >= 0),
  default_due_days integer check (default_due_days is null or default_due_days >= 0),
  requires_evidence boolean not null default false,
  dependency_step_keys text[] not null default '{}'::text[],
  unique (template_id, step_key),
  unique (template_id, position)
);

create table if not exists public.onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_id uuid references public.onboarding_templates(id),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','blocked','completed','cancelled')),
  owner_platform_member_id uuid references public.platform_members(id),
  starts_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_runs_status_due_idx
  on public.onboarding_runs(status, due_at) where status in ('not_started','in_progress','blocked');
create index if not exists onboarding_runs_tenant_idx on public.onboarding_runs(tenant_id, created_at desc);
create unique index if not exists onboarding_runs_tenant_open_uidx on public.onboarding_runs(tenant_id)
  where status in ('not_started','in_progress','blocked');

create table if not exists public.onboarding_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.onboarding_runs(id) on delete cascade,
  template_step_id uuid references public.onboarding_template_steps(id),
  step_key text not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending','ready','in_progress','blocked','completed','skipped')),
  owner_platform_member_id uuid references public.platform_members(id),
  due_at timestamptz,
  completed_at timestamptz,
  observation text,
  evidence jsonb not null default '[]'::jsonb,
  dependencies text[] not null default '{}'::text[],
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, step_key)
);

create index if not exists onboarding_items_run_status_idx on public.onboarding_items(run_id, status);
create index if not exists onboarding_items_overdue_idx on public.onboarding_items(due_at)
  where status not in ('completed','skipped');

create table if not exists public.customer_success_accounts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  manager_platform_member_id uuid references public.platform_members(id),
  status text not null default 'unassigned'
    check (status in ('unassigned','onboarding','healthy','attention','at_risk','churned')),
  health_score integer check (health_score is null or health_score between 0 and 100),
  health_factors jsonb not null default '{}'::jsonb,
  health_weights jsonb not null default '{}'::jsonb,
  success_plan jsonb not null default '{}'::jsonb,
  next_review_at timestamptz,
  renewal_at date,
  churn_reason text,
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_success_accounts_status_review_idx
  on public.customer_success_accounts(status, next_review_at);

create table if not exists public.customer_success_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type text not null check (event_type in ('task','meeting','note','risk','incident','nps','expansion','renewal','churn')),
  status text not null default 'open',
  title text not null,
  description text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  score integer check (score is null or score between 0 and 10),
  owner_platform_member_id uuid references public.platform_members(id),
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists customer_success_events_tenant_time_idx
  on public.customer_success_events(tenant_id, occurred_at desc);
create index if not exists customer_success_events_open_due_idx
  on public.customer_success_events(due_at) where status = 'open';

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  tenant_id uuid not null references public.tenants(id),
  solution_id uuid references public.solutions(id),
  category text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  severity text not null default 'minor' check (severity in ('minor','major','critical')),
  status text not null default 'open' check (status in ('open','triage','in_progress','waiting_customer','resolved','closed','cancelled')),
  subject text not null,
  description text not null,
  sla_due_at timestamptz,
  owner_platform_member_id uuid references public.platform_members(id),
  team_id uuid references public.platform_teams(id),
  satisfaction_score integer check (satisfaction_score is null or satisfaction_score between 0 and 10),
  lock_version integer not null default 1 check (lock_version > 0),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create index if not exists support_tickets_tenant_status_idx on public.support_tickets(tenant_id, status, created_at desc);
create index if not exists support_tickets_team_owner_idx on public.support_tickets(team_id, owner_platform_member_id, status);
create index if not exists support_tickets_sla_idx on public.support_tickets(sla_due_at) where status not in ('resolved','closed','cancelled');

create table if not exists public.support_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null check (event_type in ('internal_comment','external_communication','status_change','assignment','attachment','incident_link','satisfaction')),
  body text,
  private boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_events_ticket_idx on public.support_ticket_events(ticket_id, created_at desc);

create table if not exists public.lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  tenant_id uuid references public.tenants(id),
  request_type text not null check (request_type in ('access','export','correction','anonymization','deletion','restriction','revocation')),
  status text not null default 'received' check (status in ('received','identity_verification','analysis','in_progress','blocked','completed','rejected','cancelled')),
  data_subject_reference text not null,
  consent_version text,
  consent_source text,
  legal_hold boolean not null default false,
  retention_until date,
  due_at timestamptz not null,
  owner_platform_member_id uuid references public.platform_members(id),
  reason text,
  result_summary text,
  excludes_integrity_data boolean not null default true,
  lock_version integer not null default 1 check (lock_version > 0),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists lgpd_requests_status_due_idx on public.lgpd_requests(status, due_at);
create index if not exists lgpd_requests_tenant_idx on public.lgpd_requests(tenant_id, created_at desc);

create table if not exists public.lgpd_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.lgpd_requests(id) on delete cascade,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists lgpd_request_events_request_idx on public.lgpd_request_events(request_id, created_at desc);

create table if not exists public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.platform_teams(id),
  platform_member_id uuid references public.platform_members(id),
  period_start date not null,
  period_end date not null,
  metric text not null check (metric in ('new_sales','expansion','renewal','received_revenue')),
  target_cents integer check (target_cents is null or target_cents >= 0),
  target_count integer check (target_count is null or target_count >= 0),
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check ((team_id is not null) <> (platform_member_id is not null))
);

create index if not exists sales_targets_period_team_idx on public.sales_targets(period_start, period_end, team_id);
create index if not exists sales_targets_period_member_idx on public.sales_targets(period_start, period_end, platform_member_id);

create table if not exists public.sales_commissions (
  id uuid primary key default gen_random_uuid(),
  platform_member_id uuid not null references public.platform_members(id),
  team_id uuid references public.platform_teams(id),
  contract_id uuid not null references public.commercial_contracts(id),
  payment_id uuid references public.billing_payments(id),
  kind text not null check (kind in ('new_sale','expansion','renewal')),
  status text not null default 'forecast' check (status in ('forecast','eligible','approved','reversed','cancelled')),
  base_amount_cents integer not null check (base_amount_cents >= 0),
  commission_amount_cents integer not null check (commission_amount_cents >= 0),
  rule_snapshot jsonb not null,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_member_id, contract_id, payment_id, kind)
);

create index if not exists sales_commissions_member_status_idx on public.sales_commissions(platform_member_id, status, created_at desc);

create table if not exists public.tenant_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  solution_id uuid references public.solutions(id),
  override_type text not null check (override_type in ('trial','courtesy','limit','activation','suspension_exception')),
  limits jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text not null,
  status text not null default 'scheduled' check (status in ('scheduled','active','expired','revoked')),
  created_by_user_id uuid not null references auth.users(id),
  revoked_by_user_id uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create index if not exists tenant_entitlement_overrides_effective_idx
  on public.tenant_entitlement_overrides(tenant_id, solution_id, starts_at, expires_at)
  where status in ('scheduled','active');

create table if not exists public.platform_saved_views (
  id uuid primary key default gen_random_uuid(),
  platform_member_id uuid not null references public.platform_members(id) on delete cascade,
  resource text not null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_member_id, resource, name)
);

create table if not exists public.platform_operational_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  status text not null check (status in ('pending','processing','succeeded','failed','ignored')),
  correlation_id uuid not null default gen_random_uuid(),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  payload_summary jsonb not null default '{}'::jsonb,
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_operational_events_queue_idx
  on public.platform_operational_events(status, next_attempt_at, created_at)
  where status in ('pending','failed');
create index if not exists platform_operational_events_correlation_idx
  on public.platform_operational_events(correlation_id);

create table if not exists public.billing_dunning_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid references public.billing_plans(id),
  active boolean not null default true,
  notice_before_days integer[] not null default '{}'::integer[],
  notice_on_due_date boolean not null default true,
  grace_days integer not null default 0 check (grace_days >= 0),
  suspend_after_days integer check (suspend_after_days is null or suspend_after_days >= 0),
  close_after_days integer check (close_after_days is null or close_after_days >= 0),
  create_internal_tasks boolean not null default true,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_dunning_events (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.billing_dunning_policies(id),
  tenant_id uuid not null references public.tenants(id),
  payment_id uuid references public.billing_payments(id),
  event_type text not null check (event_type in ('notice_due','notice_overdue','collection_task','grace_started','suspended','recovered','reactivated','closed')),
  status text not null default 'generated' check (status in ('generated','actioned','cancelled')),
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_dunning_events_tenant_idx on public.billing_dunning_events(tenant_id, created_at desc);
create index if not exists billing_dunning_events_due_idx on public.billing_dunning_events(status, due_at) where status = 'generated';

-- Server-only access. The Express backend applies platform/team/tenant scope.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'commercial_lead_identity_keys','commercial_lead_assignment_history','commercial_scoring_rules',
    'commercial_proposal_items','platform_state_transitions','onboarding_templates',
    'onboarding_template_steps','onboarding_runs','onboarding_items','customer_success_accounts',
    'customer_success_events','support_tickets','support_ticket_events','lgpd_requests',
    'lgpd_request_events','sales_targets','sales_commissions','tenant_entitlement_overrides',
    'platform_saved_views','platform_operational_events','billing_dunning_policies','billing_dunning_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

grant usage, select on all sequences in schema public to service_role;

create or replace function public.sync_marketing_lead_identity_keys()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized text;
begin
  delete from public.commercial_lead_identity_keys where lead_id = new.id;

  normalized := lower(trim(coalesce(new.company, '')));
  if length(normalized) >= 2 then
    insert into public.commercial_lead_identity_keys(lead_id,key_type,key_hash)
    values(new.id,'company',encode(extensions.digest(normalized,'sha256'),'hex'));
  end if;

  normalized := lower(trim(coalesce(new.organization_domain, split_part(new.email::text, '@', 2), '')));
  if length(normalized) >= 3 then
    insert into public.commercial_lead_identity_keys(lead_id,key_type,key_hash)
    values(new.id,'domain',encode(extensions.digest(normalized,'sha256'),'hex'));
  end if;

  normalized := regexp_replace(coalesce(new.tax_id_normalized,''),'[^0-9]','','g');
  if length(normalized) >= 11 then
    insert into public.commercial_lead_identity_keys(lead_id,key_type,key_hash)
    values(new.id,'tax_id',encode(extensions.digest(normalized,'sha256'),'hex'));
  end if;

  normalized := lower(trim(coalesce(new.email::text,'')));
  if position('@' in normalized) > 1 then
    insert into public.commercial_lead_identity_keys(lead_id,key_type,key_hash)
    values(new.id,'email',encode(extensions.digest(normalized,'sha256'),'hex'));
  end if;

  normalized := regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
  if length(normalized) >= 8 then
    insert into public.commercial_lead_identity_keys(lead_id,key_type,key_hash)
    values(new.id,'phone',encode(extensions.digest(normalized,'sha256'),'hex'));
  end if;
  return new;
end;
$$;

revoke all on function public.sync_marketing_lead_identity_keys() from public, anon, authenticated;
grant execute on function public.sync_marketing_lead_identity_keys() to service_role;

drop trigger if exists marketing_leads_identity_keys on public.marketing_leads;
create trigger marketing_leads_identity_keys
after insert or update of company,email,phone,organization_domain,tax_id_normalized
on public.marketing_leads for each row execute function public.sync_marketing_lead_identity_keys();

insert into public.commercial_lead_identity_keys(lead_id,key_type,key_hash)
select l.id, source.key_type, encode(extensions.digest(source.normalized,'sha256'),'hex')
from public.marketing_leads l
cross join lateral (values
  ('company', lower(trim(coalesce(l.company,'')))),
  ('domain', lower(trim(coalesce(l.organization_domain, split_part(l.email::text,'@',2),'')))),
  ('tax_id', regexp_replace(coalesce(l.tax_id_normalized,''),'[^0-9]','','g')),
  ('email', lower(trim(coalesce(l.email::text,'')))),
  ('phone', regexp_replace(coalesce(l.phone,''),'[^0-9]','','g'))
) source(key_type,normalized)
where case source.key_type
  when 'company' then length(source.normalized) >= 2
  when 'domain' then length(source.normalized) >= 3
  when 'tax_id' then length(source.normalized) >= 11
  when 'email' then position('@' in source.normalized) > 1
  when 'phone' then length(source.normalized) >= 8
end
on conflict do nothing;

create or replace function public.admin_auto_assign_lead(
  p_lead_id uuid,
  p_team_id uuid,
  p_actor_user_id uuid,
  p_reason text default 'automatic_distribution'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_member_id uuid;
  previous_assignment public.platform_lead_assignments%rowtype;
  assignment_mode text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));

  select coalesce(settings->>'assignment_mode','manual') into assignment_mode
  from public.platform_teams where id=p_team_id and status='active' for update;
  if assignment_mode not in ('round_robin','least_loaded') then raise exception 'automatic_assignment_disabled'; end if;

  select * into previous_assignment from public.platform_lead_assignments where lead_id=p_lead_id for update;

  select tm.platform_member_id into selected_member_id
  from public.platform_team_members tm
  join public.platform_members pm on pm.id=tm.platform_member_id and pm.status='active'
  join public.platform_roles pr on pr.id=pm.role_id and pr.key='sales'
  left join lateral (
    select count(*)::integer open_count
    from public.platform_lead_assignments pla
    join public.marketing_leads ml on ml.id=pla.lead_id
    where pla.owner_platform_member_id=tm.platform_member_id
      and ml.status not in ('converted','rejected','lost')
  ) load on true
  where tm.team_id=p_team_id and tm.status='active'
  order by coalesce(load.open_count,0), tm.joined_at, tm.platform_member_id
  limit 1;

  if selected_member_id is null then raise exception 'no_eligible_sales_member'; end if;

  insert into public.platform_lead_assignments(lead_id,team_id,owner_platform_member_id,assigned_by_user_id)
  values(p_lead_id,p_team_id,selected_member_id,p_actor_user_id)
  on conflict(lead_id) do update set team_id=excluded.team_id,
    owner_platform_member_id=excluded.owner_platform_member_id,
    assigned_by_user_id=excluded.assigned_by_user_id,updated_at=now();

  insert into public.commercial_lead_assignment_history(
    lead_id,from_team_id,to_team_id,from_owner_platform_member_id,to_owner_platform_member_id,reason,actor_user_id
  ) values(
    p_lead_id,previous_assignment.team_id,p_team_id,previous_assignment.owner_platform_member_id,selected_member_id,p_reason,p_actor_user_id
  );
  return selected_member_id;
end;
$$;

revoke all on function public.admin_auto_assign_lead(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_auto_assign_lead(uuid,uuid,uuid,text) to service_role;

create or replace function public.admin_create_proposal_version(
  p_proposal_id uuid,
  p_actor_user_id uuid,
  p_changes jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  previous public.commercial_proposals%rowtype;
  root_id uuid;
  next_version integer;
  new_id uuid;
begin
  select * into previous from public.commercial_proposals where id=p_proposal_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  root_id := coalesce(previous.root_proposal_id, previous.id);
  perform pg_advisory_xact_lock(hashtextextended(root_id::text, 1));
  select coalesce(max(version),0)+1 into next_version from public.commercial_proposals where root_proposal_id=root_id;

  insert into public.commercial_proposals(
    lead_id,plan_id,team_id,owner_platform_member_id,status,amount_cents,currency,cycle,billing_type,
    valid_until,discount_cents,notes,created_by_user_id,root_proposal_id,supersedes_proposal_id,version,
    vigency_starts_on,vigency_ends_on,limits_snapshot
  ) values(
    previous.lead_id,coalesce((p_changes->>'plan_id')::uuid,previous.plan_id),previous.team_id,previous.owner_platform_member_id,'draft',
    coalesce((p_changes->>'amount_cents')::integer,previous.amount_cents),previous.currency,
    coalesce(p_changes->>'cycle',previous.cycle),coalesce(p_changes->>'billing_type',previous.billing_type),
    coalesce((p_changes->>'valid_until')::date,previous.valid_until),
    coalesce((p_changes->>'discount_cents')::integer,previous.discount_cents),
    coalesce(p_changes->>'notes',previous.notes),p_actor_user_id,root_id,previous.id,next_version,
    coalesce((p_changes->>'vigency_starts_on')::date,previous.vigency_starts_on),
    coalesce((p_changes->>'vigency_ends_on')::date,previous.vigency_ends_on),
    coalesce(p_changes->'limits_snapshot',previous.limits_snapshot)
  ) returning id into new_id;

  insert into public.commercial_proposal_items(proposal_id,solution_id,description,quantity,unit_amount_cents,limits)
  select new_id,solution_id,description,quantity,unit_amount_cents,limits
  from public.commercial_proposal_items where proposal_id=previous.id;

  update public.commercial_proposals set status='superseded',updated_at=now(),lock_version=lock_version+1 where id=previous.id;
  return new_id;
end;
$$;

revoke all on function public.admin_create_proposal_version(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_create_proposal_version(uuid,uuid,jsonb) to service_role;

create or replace function public.admin_transition_control_plane(
  p_entity_type text,
  p_entity_id uuid,
  p_to_status text,
  p_actor_user_id uuid,
  p_reason text,
  p_request_id uuid default null,
  p_team_id uuid default null,
  p_tenant_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  from_status text;
  creator_id uuid;
  actor_allowed boolean;
  allowed boolean := false;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
  select exists(
    select 1 from public.platform_members pm
    join public.platform_roles pr on pr.id=pm.role_id
    left join public.platform_role_permissions rp on rp.role_id=pr.id
    left join public.platform_permissions pp on pp.id=rp.permission_id
    where pm.user_id=p_actor_user_id and pm.status='active'
      and (pr.key='admin' or pp.key in ('platform.commercial.manage','platform.commercial.approve','platform.clients.manage','platform.clients.suspend'))
  ) into actor_allowed;
  if not actor_allowed then raise exception 'actor_not_authorized'; end if;

  if p_entity_type='lead' then
    select status, null::uuid into from_status,creator_id from public.marketing_leads where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('new','contacted'),('contacted','qualified'),('qualified','approved'),('approved','converted'),('new','rejected'),('contacted','rejected'),('qualified','rejected'),('rejected','new'),('converted','contacted'));
    if allowed then update public.marketing_leads set status=p_to_status,updated_at=now(),lock_version=lock_version+1,
      reopened_at=case when from_status in ('rejected','converted') then now() else reopened_at end,
      reopened_by_user_id=case when from_status in ('rejected','converted') then p_actor_user_id else reopened_by_user_id end
      where id=p_entity_id; end if;
  elsif p_entity_type='proposal' then
    select status,created_by_user_id into from_status,creator_id from public.commercial_proposals where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('draft','pending_approval'),('pending_approval','approved'),('pending_approval','rejected'),('approved','accepted'),('approved','rejected'),('approved','superseded'),('rejected','superseded'));
    if p_to_status='approved' and creator_id=p_actor_user_id then raise exception 'self_approval_forbidden'; end if;
    if allowed then update public.commercial_proposals set status=p_to_status,updated_at=now(),lock_version=lock_version+1,
      approved_by_user_id=case when p_to_status='approved' then p_actor_user_id else approved_by_user_id end,
      approved_at=case when p_to_status='approved' then now() else approved_at end,
      accepted_at=case when p_to_status='accepted' then now() else accepted_at end,
      rejected_at=case when p_to_status='rejected' then now() else rejected_at end,
      rejection_reason=case when p_to_status='rejected' then p_reason else rejection_reason end
      where id=p_entity_id; end if;
  elsif p_entity_type='contract' then
    select status,created_by_user_id into from_status,creator_id from public.commercial_contracts where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('draft','pending_approval'),('pending_approval','approved'),('pending_approval','draft'),('approved','awaiting_payment'),('awaiting_payment','active'),('active','renewal_due'),('renewal_due','active'),('active','cancellation_requested'),('renewal_due','cancellation_requested'),('cancellation_requested','cancelled'),('active','suspended'),('suspended','active'),('cancelled','closed'),('suspended','closed'));
    if p_to_status='approved' and creator_id=p_actor_user_id then raise exception 'self_approval_forbidden'; end if;
    if allowed then update public.commercial_contracts set status=p_to_status,updated_at=now(),lock_version=lock_version+1,
      transition_reason=p_reason,
      approved_by_user_id=case when p_to_status='approved' then p_actor_user_id else approved_by_user_id end,
      approved_at=case when p_to_status='approved' then now() else approved_at end,
      cancelled_at=case when p_to_status in ('cancelled','closed') then now() else cancelled_at end,
      cancellation_reason=case when p_to_status in ('cancellation_requested','cancelled','closed') then p_reason else cancellation_reason end
      where id=p_entity_id; end if;
  elsif p_entity_type='tenant' then
    select lifecycle_status,null::uuid into from_status,creator_id from public.tenants where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('opportunity','approved'),('approved','awaiting_payment'),('awaiting_payment','onboarding'),('onboarding','active'),('active','at_risk'),('at_risk','active'),('active','delinquent'),('at_risk','delinquent'),('delinquent','active'),('delinquent','suspended'),('active','suspended'),('suspended','active'),('active','cancelled'),('suspended','cancelled'),('cancelled','closed'));
    if allowed then update public.tenants set lifecycle_status=p_to_status,updated_at=now(),lock_version=lock_version+1,
      cancellation_reason=case when p_to_status in ('cancelled','closed') then p_reason else cancellation_reason end
      where id=p_entity_id; end if;
  elsif p_entity_type='onboarding' then
    select status,null::uuid into from_status,creator_id from public.onboarding_runs where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('not_started','in_progress'),('in_progress','blocked'),('blocked','in_progress'),('in_progress','completed'),('not_started','cancelled'),('in_progress','cancelled'),('blocked','cancelled'));
    if allowed then update public.onboarding_runs set status=p_to_status,updated_at=now(),
      starts_at=case when p_to_status='in_progress' and starts_at is null then now() else starts_at end,
      completed_at=case when p_to_status='completed' then now() else completed_at end where id=p_entity_id; end if;
  elsif p_entity_type='support' then
    select status,created_by_user_id into from_status,creator_id from public.support_tickets where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('open','triage'),('triage','in_progress'),('in_progress','waiting_customer'),('waiting_customer','in_progress'),('in_progress','resolved'),('resolved','closed'),('resolved','in_progress'),('open','cancelled'),('triage','cancelled'));
    if allowed then update public.support_tickets set status=p_to_status,updated_at=now(),lock_version=lock_version+1,
      resolved_at=case when p_to_status='resolved' then now() else resolved_at end,
      closed_at=case when p_to_status='closed' then now() else closed_at end where id=p_entity_id; end if;
  elsif p_entity_type='lgpd' then
    select status,created_by_user_id into from_status,creator_id from public.lgpd_requests where id=p_entity_id for update;
    allowed := (from_status,p_to_status) in (('received','identity_verification'),('identity_verification','analysis'),('analysis','in_progress'),('analysis','rejected'),('in_progress','blocked'),('blocked','in_progress'),('in_progress','completed'),('received','cancelled'),('identity_verification','cancelled'));
    if allowed then update public.lgpd_requests set status=p_to_status,updated_at=now(),lock_version=lock_version+1,
      completed_at=case when p_to_status='completed' then now() else completed_at end,
      reason=case when p_to_status in ('rejected','cancelled','blocked') then p_reason else reason end where id=p_entity_id; end if;
  else
    raise exception 'unsupported_entity_type';
  end if;

  if from_status is null then raise exception 'entity_not_found'; end if;
  if from_status=p_to_status then return from_status; end if;
  if not allowed then raise exception 'invalid_transition:%->%',from_status,p_to_status; end if;

  insert into public.platform_state_transitions(entity_type,entity_id,tenant_id,team_id,from_status,to_status,reason,actor_user_id,request_id,metadata)
  values(p_entity_type,p_entity_id,p_tenant_id,p_team_id,from_status,p_to_status,p_reason,p_actor_user_id,p_request_id,coalesce(p_metadata,'{}'::jsonb));
  insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,severity,team_id,request_id,metadata)
  values(p_actor_user_id,p_entity_type||'.transitioned',p_entity_type,p_entity_id::text,'info',p_team_id,p_request_id,
    jsonb_build_object('before',jsonb_build_object('status',from_status),'after',jsonb_build_object('status',p_to_status),'reason',p_reason,'result','success'));
  return p_to_status;
end;
$$;

revoke all on function public.admin_transition_control_plane(text,uuid,text,uuid,text,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_transition_control_plane(text,uuid,text,uuid,text,uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.admin_start_onboarding(
  p_tenant_id uuid,
  p_template_id uuid,
  p_actor_user_id uuid,
  p_owner_platform_member_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  run_id uuid;
  maximum_due_days integer;
begin
  if not exists(select 1 from public.tenants where id=p_tenant_id) then raise exception 'tenant_not_found'; end if;
  if not exists(select 1 from public.onboarding_templates where id=p_template_id and active) then
    raise exception 'active_template_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 17));
  select id into run_id from public.onboarding_runs
    where tenant_id=p_tenant_id and status in ('not_started','in_progress','blocked')
    order by created_at desc limit 1 for update;
  if run_id is not null then return run_id; end if;

  select max(default_due_days) into maximum_due_days
    from public.onboarding_template_steps where template_id=p_template_id;
  insert into public.onboarding_runs(
    tenant_id,template_id,status,owner_platform_member_id,starts_at,due_at,created_by_user_id
  ) values(
    p_tenant_id,p_template_id,'in_progress',p_owner_platform_member_id,now(),
    case when maximum_due_days is null then null else now() + make_interval(days => maximum_due_days) end,
    p_actor_user_id
  ) returning id into run_id;

  insert into public.onboarding_items(
    run_id,template_step_id,step_key,title,status,owner_platform_member_id,due_at,dependencies
  )
  select run_id,s.id,s.step_key,s.title,
    case when cardinality(s.dependency_step_keys)=0 then 'ready' else 'pending' end,
    p_owner_platform_member_id,
    case when s.default_due_days is null then null else now() + make_interval(days => s.default_due_days) end,
    s.dependency_step_keys
  from public.onboarding_template_steps s where s.template_id=p_template_id order by s.position;

  update public.tenants set lifecycle_status='onboarding',onboarding_status='in_progress',
    onboarding_started_at=coalesce(onboarding_started_at,now()),updated_at=now()
  where id=p_tenant_id and lifecycle_status in ('approved','awaiting_payment','onboarding');

  insert into public.platform_audit_logs(actor_user_id,action,entity_type,entity_id,severity,metadata)
  values(p_actor_user_id,'onboarding.started','onboarding_run',run_id::text,'info',
    jsonb_build_object('tenant_id',p_tenant_id,'template_id',p_template_id,'result','success'));
  return run_id;
end;
$$;

revoke all on function public.admin_start_onboarding(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_start_onboarding(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.admin_refresh_onboarding_progress(p_run_id uuid,p_actor_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  progress integer;
  total_count integer;
  completed_count integer;
  tenant uuid;
begin
  select tenant_id into tenant from public.onboarding_runs where id=p_run_id for update;
  if tenant is null then raise exception 'onboarding_run_not_found'; end if;
  select count(*),count(*) filter(where status in ('completed','skipped'))
    into total_count,completed_count from public.onboarding_items where run_id=p_run_id;
  progress := case when total_count=0 then 0 else round(100.0*completed_count/total_count)::integer end;
  update public.onboarding_runs set progress_percent=progress,updated_at=now(),
    status=case when progress=100 then 'completed' else status end,
    completed_at=case when progress=100 then coalesce(completed_at,now()) else completed_at end
  where id=p_run_id;
  if progress=100 then
    update public.tenants set onboarding_status='completed',onboarding_completed_at=coalesce(onboarding_completed_at,now()),
      updated_at=now() where id=tenant;
  end if;
  return progress;
end;
$$;

revoke all on function public.admin_refresh_onboarding_progress(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_refresh_onboarding_progress(uuid,uuid) to service_role;

create or replace function public.admin_control_plane_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_team_ids uuid[] default null,
  p_owner_ids uuid[] default null,
  p_tenant_ids uuid[] default null,
  p_plan_ids uuid[] default null,
  p_is_admin boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
with
lead_scope as (
  select l.* from public.marketing_leads l
  left join public.platform_lead_assignments a on a.lead_id=l.id
  where l.created_at>=p_from and l.created_at<p_to
    and (p_team_ids is null or a.team_id=any(p_team_ids))
    and (p_owner_ids is null or a.owner_platform_member_id=any(p_owner_ids))
),
demo_scope as (
  select d.* from public.commercial_demos d where d.created_at>=p_from and d.created_at<p_to
    and (p_team_ids is null or d.team_id=any(p_team_ids))
    and (p_owner_ids is null or d.owner_platform_member_id=any(p_owner_ids))
    and (p_tenant_ids is null or d.tenant_id=any(p_tenant_ids))
),
proposal_scope as (
  select p.* from public.commercial_proposals p where p.created_at>=p_from and p.created_at<p_to
    and (p_team_ids is null or p.team_id=any(p_team_ids))
    and (p_owner_ids is null or p.owner_platform_member_id=any(p_owner_ids))
    and (p_plan_ids is null or p.plan_id=any(p_plan_ids))
),
contract_scope as (
  select c.* from public.commercial_contracts c where c.created_at>=p_from and c.created_at<p_to
    and (p_team_ids is null or c.team_id=any(p_team_ids))
    and (p_owner_ids is null or c.owner_platform_member_id=any(p_owner_ids))
    and (p_tenant_ids is null or c.tenant_id=any(p_tenant_ids))
    and (p_plan_ids is null or c.plan_id=any(p_plan_ids))
),
tenant_scope as (
  select t.* from public.tenants t where (p_tenant_ids is null or t.id=any(p_tenant_ids))
    and (p_plan_ids is null or exists(select 1 from public.commercial_contracts c where c.tenant_id=t.id and c.plan_id=any(p_plan_ids)))
),
subscription_scope as (
  select s.* from public.billing_subscriptions s where (p_tenant_ids is null or s.tenant_id=any(p_tenant_ids))
    and (p_plan_ids is null or exists(select 1 from public.commercial_contracts c where c.id=s.contract_id and c.plan_id=any(p_plan_ids)))
),
payment_scope as (
  select p.* from public.billing_payments p where p.created_at>=p_from and p.created_at<p_to
    and (p_tenant_ids is null or p.tenant_id=any(p_tenant_ids))
    and (p_plan_ids is null or exists(select 1 from public.commercial_contracts c where c.id=p.contract_id and c.plan_id=any(p_plan_ids)))
),
mrr as (
  select round(sum(case s.cycle
    when 'weekly' then s.amount_cents*52.0/12.0 when 'biweekly' then s.amount_cents*26.0/12.0
    when 'monthly' then s.amount_cents when 'quarterly' then s.amount_cents/3.0
    when 'semiannual' then s.amount_cents/6.0 when 'yearly' then s.amount_cents/12.0 else 0 end))::bigint value
  from subscription_scope s where s.status='active'
),
commercial as (
  select
    (select count(*) from lead_scope) leads_received,
    (select count(*) from lead_scope where qualification_state in ('marketing_qualified','sales_qualified') or status='qualified') leads_qualified,
    (select count(*) from demo_scope) demos,
    (select count(*) from proposal_scope where status<>'superseded') proposals,
    (select count(*) from contract_scope) contracts,
    (select avg(extract(epoch from (updated_at-created_at))/3600.0) from lead_scope where status in ('converted','won')) avg_funnel_hours
),
financial as (
  select
    count(*) filter(where status in ('confirmed','received')) payment_received_count,
    sum(amount_cents) filter(where status in ('confirmed','received')) received_cents,
    sum(amount_cents) filter(where status='pending') pending_cents,
    sum(amount_cents) filter(where status='overdue') overdue_cents,
    count(*) filter(where status='overdue') overdue_count,
    count(*) filter(where status='chargeback') chargeback_count,
    count(*) filter(where status in ('refunded','partially_refunded')) refund_count
  from payment_scope
),
operations as (
  select
    (select count(*) from public.billing_webhook_events where p_is_admin and status='failed' and received_at>=p_from and received_at<p_to) webhook_failures,
    (select coalesce(sum(divergence_count),0) from public.billing_reconciliation_runs where p_is_admin and started_at>=p_from and started_at<p_to) reconciliation_divergences,
    (select count(*) from public.platform_operational_events where p_is_admin and status='failed' and created_at>=p_from and created_at<p_to) operational_failures
),
tasks as (
  select
    (select count(*) from public.onboarding_items i join public.onboarding_runs r on r.id=i.run_id
      where i.due_at<now() and i.status not in ('completed','skipped') and (p_tenant_ids is null or r.tenant_id=any(p_tenant_ids))) +
    (select count(*) from public.customer_success_events e where e.event_type='task' and e.status='open' and e.due_at<now()
      and (p_tenant_ids is null or e.tenant_id=any(p_tenant_ids))) +
    (select count(*) from public.support_tickets s where s.sla_due_at<now() and s.status not in ('resolved','closed','cancelled')
      and (p_tenant_ids is null or s.tenant_id=any(p_tenant_ids))) overdue_tasks
)
select jsonb_build_object(
  'range',jsonb_build_object('from',p_from,'to',p_to),
  'last_updated_at',greatest(
    coalesce((select max(updated_at) from public.marketing_leads),'-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.tenants),'-infinity'::timestamptz),
    coalesce((select max(updated_at) from public.billing_payments),'-infinity'::timestamptz)
  ),
  'has_commercial_data',(commercial.leads_received+commercial.demos+commercial.proposals+commercial.contracts)>0,
  'has_financial_data',(financial.payment_received_count+financial.overdue_count+(select count(*) from subscription_scope))>0,
  'leads_received',commercial.leads_received,
  'leads_qualified',commercial.leads_qualified,
  'demos',commercial.demos,
  'proposals',commercial.proposals,
  'contracts',commercial.contracts,
  'lead_to_contract_percent',case when commercial.leads_received=0 then null else round(100.0*commercial.contracts/commercial.leads_received,2) end,
  'average_funnel_hours',round(commercial.avg_funnel_hours::numeric,1),
  'onboarding_clients',(select count(*) from public.onboarding_runs r where r.status in ('not_started','in_progress','blocked') and (p_tenant_ids is null or r.tenant_id=any(p_tenant_ids))),
  'active_tenants',(select count(*) from tenant_scope where lifecycle_status='active'),
  'suspended_tenants',(select count(*) from tenant_scope where lifecycle_status='suspended'),
  'cancelled_tenants',(select count(*) from tenant_scope where lifecycle_status in ('cancelled','closed')),
  'active_trials',(select count(*) from tenant_scope where trial_ends_at>now()),
  'trials_expiring',(select count(*) from tenant_scope where trial_ends_at>now() and trial_ends_at<=now()+interval '14 days'),
  'mrr_cents',(select value from mrr),
  'arr_cents',(select value*12 from mrr),
  'received_cents',financial.received_cents,
  'pending_cents',financial.pending_cents,
  'overdue_cents',financial.overdue_cents,
  'delinquent_tenants',(select count(*) from tenant_scope where lifecycle_status='delinquent'),
  'churn_percent',case when (select count(*) from tenant_scope where lifecycle_status in ('active','cancelled','closed'))=0 then null
    else round(100.0*(select count(*) from tenant_scope where lifecycle_status in ('cancelled','closed'))/(select count(*) from tenant_scope where lifecycle_status in ('active','cancelled','closed')),2) end,
  'renewals_due',(select count(*) from public.commercial_contracts c where c.renewal_at between current_date and current_date+60
    and (p_tenant_ids is null or c.tenant_id=any(p_tenant_ids)) and (p_plan_ids is null or c.plan_id=any(p_plan_ids))),
  'expansion_cents',(select sum(amount_cents) from public.customer_success_events e where e.event_type='expansion' and e.status in ('won','completed')
    and e.occurred_at>=p_from and e.occurred_at<p_to and (p_tenant_ids is null or e.tenant_id=any(p_tenant_ids))),
  'webhook_failures',case when p_is_admin then operations.webhook_failures else null end,
  'reconciliation_divergences',case when p_is_admin then operations.reconciliation_divergences else null end,
  'operational_failures',case when p_is_admin then operations.operational_failures else null end,
  'overdue_tasks',tasks.overdue_tasks,
  'at_risk_clients',(select count(*) from tenant_scope where lifecycle_status='at_risk' or risk_level in ('high','critical')),
  'refund_count',financial.refund_count,
  'chargeback_count',financial.chargeback_count
)
from commercial,financial,operations,tasks;
$$;

revoke all on function public.admin_control_plane_metrics(timestamptz,timestamptz,uuid[],uuid[],uuid[],uuid[],boolean) from public, anon, authenticated;
grant execute on function public.admin_control_plane_metrics(timestamptz,timestamptz,uuid[],uuid[],uuid[],uuid[],boolean) to service_role;

create or replace function public.admin_effective_entitlements(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
with tenant_row as (
  select * from public.tenants where id=p_tenant_id
), contract_row as (
  select c.* from public.commercial_contracts c where c.tenant_id=p_tenant_id order by c.created_at desc limit 1
), subscription_row as (
  select s.* from public.billing_subscriptions s where s.tenant_id=p_tenant_id order by s.created_at desc limit 1
), solution_rows as (
  select distinct s.id,s.key,s.name,
    bp.limits plan_limits,ts.config tenant_config,ts.status tenant_solution_status,
    o.override_type,o.limits override_limits,o.expires_at,
    case
      when t.lifecycle_status in ('suspended','cancelled','closed') then false
      when o.id is not null and o.override_type in ('trial','courtesy','activation','suspension_exception') then true
      when sr.status='active' and (ts.status='active' or bps.solution_id is not null) then true
      else false
    end enabled,
    case
      when t.lifecycle_status in ('suspended','cancelled','closed') then 'tenant_'||t.lifecycle_status
      when o.id is not null then 'temporary_override:'||o.override_type
      when sr.status<>'active' or sr.status is null then 'billing_not_active'
      when ts.status='active' then 'tenant_solution_active'
      when bps.solution_id is not null then 'contracted_plan'
      else 'not_contracted'
    end decision_reason
  from public.solutions s
  cross join tenant_row t
  left join contract_row c on true
  left join subscription_row sr on true
  left join public.billing_plans bp on bp.id=c.plan_id
  left join public.billing_plan_solutions bps on bps.plan_id=bp.id and bps.solution_id=s.id
  left join public.tenant_solutions ts on ts.tenant_id=t.id and ts.solution_id=s.id
  left join lateral (
    select x.* from public.tenant_entitlement_overrides x
    where x.tenant_id=t.id and (x.solution_id=s.id or x.solution_id is null)
      and x.status in ('scheduled','active') and x.starts_at<=now() and x.expires_at>now()
    order by x.created_at desc limit 1
  ) o on true
  where bps.solution_id is not null or ts.solution_id is not null or o.id is not null
)
select jsonb_build_object(
  'tenant_id',p_tenant_id,
  'tenant_status',(select lifecycle_status from tenant_row),
  'contract',(select jsonb_build_object('id',id,'status',status,'plan_id',plan_id,'renewal_at',renewal_at) from contract_row),
  'subscription',(select jsonb_build_object('id',id,'status',status,'cycle',cycle,'next_due_date',next_due_date) from subscription_row),
  'solutions',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'key',key,'name',name,'enabled',enabled,'decision_reason',decision_reason,
    'plan_limits',coalesce(plan_limits,'{}'::jsonb),'tenant_config',coalesce(tenant_config,'{}'::jsonb),
    'override',case when override_type is null then null else jsonb_build_object('type',override_type,'limits',override_limits,'expires_at',expires_at) end
  ) order by name) from solution_rows),'[]'::jsonb),
  'authorization_note','Entitlement habilita o produto; RBAC continua sendo validado separadamente no servidor.'
);
$$;

revoke all on function public.admin_effective_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.admin_effective_entitlements(uuid) to service_role;

-- Permissions for new control-plane areas. Admin receives all; manager receives scoped
-- operational access; sales receives own commercial/CS task visibility only.
insert into public.platform_permissions(key,category,description) values
  ('platform.onboarding.read','operations','Visualizar onboarding no escopo autorizado'),
  ('platform.onboarding.manage','operations','Gerenciar checklists de onboarding no escopo autorizado'),
  ('platform.success.read','success','Visualizar Customer Success no escopo autorizado'),
  ('platform.success.manage','success','Gerenciar Customer Success no escopo autorizado'),
  ('platform.support.read','support','Visualizar suporte interno no escopo autorizado'),
  ('platform.support.manage','support','Gerenciar suporte interno no escopo autorizado'),
  ('platform.privacy.read','privacy','Visualizar solicitações LGPD'),
  ('platform.privacy.manage','privacy','Executar solicitações LGPD autorizadas'),
  ('platform.targets.read','compensation','Visualizar metas e comissões no escopo autorizado'),
  ('platform.targets.manage','compensation','Configurar metas e aprovar comissões'),
  ('platform.operations.read','operations','Visualizar filas, jobs e conciliações'),
  ('platform.operations.manage','operations','Reprocessar operações autorizadas'),
  ('platform.access.simulate','security','Simular autorização sem alterar permissões'),
  ('platform.exports.execute','security','Exportar dados administrativos autorizados')
on conflict(key) do update set category=excluded.category,description=excluded.description;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_roles r cross join public.platform_permissions p
where r.key='admin' and p.key in (
  'platform.onboarding.read','platform.onboarding.manage','platform.success.read','platform.success.manage',
  'platform.support.read','platform.support.manage','platform.privacy.read','platform.privacy.manage',
  'platform.targets.read','platform.targets.manage','platform.operations.read','platform.operations.manage',
  'platform.access.simulate','platform.exports.execute'
) on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_roles r cross join public.platform_permissions p
where r.key='manager' and p.key in (
  'platform.onboarding.read','platform.onboarding.manage','platform.success.read','platform.success.manage',
  'platform.support.read','platform.support.manage','platform.targets.read','platform.operations.read'
) on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_roles r cross join public.platform_permissions p
where r.key='sales' and p.key in ('platform.onboarding.read','platform.success.read','platform.support.read','platform.targets.read')
on conflict do nothing;
