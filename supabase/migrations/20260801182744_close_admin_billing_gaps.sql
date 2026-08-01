-- Close the authorization, operational workflow, and durable billing queue gaps.

alter table public.marketing_leads
  add column if not exists priority text not null default 'normal';

alter table public.marketing_leads
  drop constraint if exists marketing_leads_priority_check;
alter table public.marketing_leads
  add constraint marketing_leads_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent')) not valid;
alter table public.marketing_leads validate constraint marketing_leads_priority_check;

alter table public.commercial_activities
  add column if not exists result text,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz;

alter table public.commercial_demos
  add column if not exists result text,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz;

alter table public.tenants
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.tenants
  drop constraint if exists tenants_onboarding_status_check;
alter table public.tenants
  add constraint tenants_onboarding_status_check
  check (onboarding_status in ('not_started', 'in_progress', 'blocked', 'completed')) not valid;
alter table public.tenants validate constraint tenants_onboarding_status_check;

alter table public.billing_webhook_events
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz;

create table if not exists public.billing_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_run_id uuid not null references public.billing_reconciliation_runs(id) on delete cascade,
  resource_type text not null check (resource_type in ('subscription', 'payment', 'access')),
  provider_resource_id text,
  local_resource_id uuid,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'auto_corrected', 'reviewed', 'ignored')),
  kind text not null,
  safe_summary jsonb not null default '{}'::jsonb,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_rate_limits (
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (key_hash, window_started_at)
);

alter table public.billing_reconciliation_items enable row level security;
alter table public.billing_webhook_rate_limits enable row level security;
revoke all on table public.billing_reconciliation_items from public, anon, authenticated;
revoke all on table public.billing_webhook_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_reconciliation_items to service_role;
grant select, insert, update, delete on table public.billing_webhook_rate_limits to service_role;

create index if not exists marketing_leads_status_created_idx
  on public.marketing_leads(status, created_at desc, id desc);
create index if not exists marketing_leads_priority_created_idx
  on public.marketing_leads(priority, created_at desc, id desc);
create index if not exists commercial_demos_team_created_idx
  on public.commercial_demos(team_id, created_at desc, id desc);
create index if not exists commercial_proposals_team_created_idx
  on public.commercial_proposals(team_id, created_at desc, id desc);
create index if not exists commercial_contracts_team_created_idx
  on public.commercial_contracts(team_id, created_at desc, id desc);
create index if not exists platform_audit_logs_team_created_idx
  on public.platform_audit_logs(team_id, created_at desc, id desc);
create index if not exists billing_webhook_events_queue_idx
  on public.billing_webhook_events(next_attempt_at, received_at)
  where status in ('received', 'failed');
create index if not exists billing_reconciliation_items_run_idx
  on public.billing_reconciliation_items(reconciliation_run_id, severity, status);
create index if not exists billing_webhook_rate_limits_expiry_idx
  on public.billing_webhook_rate_limits(expires_at);

create or replace function public.claim_billing_webhook_events(p_limit integer default 10)
returns setof public.billing_webhook_events
language sql
security definer
set search_path = pg_catalog, public
as $$
  with candidates as (
    select id
    from public.billing_webhook_events
    where status in ('received', 'failed')
      and next_attempt_at <= now()
      and (locked_at is null or locked_at < now() - interval '5 minutes')
    order by received_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.billing_webhook_events event
  set status = 'processing',
      locked_at = now(),
      attempts = event.attempts + 1,
      last_error = null
  from candidates
  where event.id = candidates.id
  returning event.*;
$$;

revoke all on function public.claim_billing_webhook_events(integer) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_events(integer) to service_role;

create or replace function public.check_billing_webhook_rate_limit(
  p_key_hash text,
  p_limit integer default 120,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    return false;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / greatest(10, p_window_seconds)) * greatest(10, p_window_seconds)
  );

  insert into public.billing_webhook_rate_limits(key_hash, window_started_at, request_count, expires_at)
  values (p_key_hash, v_window, 1, v_window + make_interval(secs => greatest(10, p_window_seconds) * 2))
  on conflict (key_hash, window_started_at)
  do update set request_count = public.billing_webhook_rate_limits.request_count + 1
  returning request_count into v_count;

  delete from public.billing_webhook_rate_limits where expires_at < now();
  return v_count <= greatest(1, least(coalesce(p_limit, 120), 1000));
end;
$$;

revoke all on function public.check_billing_webhook_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_billing_webhook_rate_limit(text, integer, integer) to service_role;

create or replace function public.admin_replace_tenant_solutions(
  p_tenant_id uuid,
  p_solution_keys text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Tenant not found';
  end if;
  if coalesce(array_length(p_solution_keys, 1), 0) <> (
    select count(*) from public.solutions where key = any(coalesce(p_solution_keys, array[]::text[]))
  ) then
    raise exception 'Unknown solution key';
  end if;

  delete from public.tenant_solutions where tenant_id = p_tenant_id;
  insert into public.tenant_solutions(tenant_id, solution_id, status)
  select p_tenant_id, solution.id, 'active'
  from public.solutions solution
  where solution.key = any(coalesce(p_solution_keys, array[]::text[]));
end;
$$;

revoke all on function public.admin_replace_tenant_solutions(uuid, text[]) from public, anon, authenticated;
grant execute on function public.admin_replace_tenant_solutions(uuid, text[]) to service_role;

create or replace function public.admin_terminate_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  v_count integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_terminate_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_terminate_user_sessions(uuid) to service_role;

-- Managers may inspect financial state in their team, but only global admins may
-- provision clients, suspend them, or directly change contracted entitlements.
delete from public.platform_role_permissions rp
using public.platform_roles role, public.platform_permissions permission
where rp.role_id = role.id
  and rp.permission_id = permission.id
  and role.key = 'manager'
  and permission.key in (
    'platform.solutions.manage',
    'platform.clients.provision',
    'platform.clients.suspend'
  );

comment on column public.platform_teams.settings is
  'Operational policy. proposal_approval_limit_cents and contract_approval_limit_cents are integer BRL-cent manager limits; null means admin approval.';
comment on table public.billing_reconciliation_items is
  'Safe, durable reconciliation findings. Raw provider payloads remain in the restricted webhook table.';
