-- Run with `supabase test db` against a disposable/local database.
begin;

do $$
declare
  table_name text;
  actor_id uuid;
  v_plan_id uuid;
begin
  foreach table_name in array array[
    'billing_customers','billing_subscriptions','billing_payments','billing_webhook_events',
    'billing_reconciliation_runs','billing_reconciliation_items','billing_webhook_rate_limits','tenant_billing_state'
  ] loop
    if not coalesce((select relrowsecurity from pg_class where oid = format('public.%I', table_name)::regclass), false) then
      raise exception 'RLS is disabled on %', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') then
      raise exception 'Browser role can read restricted table %', table_name;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.claim_billing_webhook_events(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.claim_billing_webhook_events(integer)', 'EXECUTE') then
    raise exception 'Browser role can claim billing jobs';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_public_read'
  ) then
    raise exception 'Public storage objects can still be listed by browser roles';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) setting
        where setting like 'search_path=%'
      )
  ) then
    raise exception 'A public SECURITY DEFINER function lacks an explicit approved search_path';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public'
      and p.prosecdef
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC can execute a SECURITY DEFINER function';
  end if;

  if exists (
    select 1 from public.platform_role_permissions rp
    join public.platform_roles role on role.id = rp.role_id
    join public.platform_permissions permission on permission.id = rp.permission_id
    where role.key = 'manager' and permission.key in ('platform.solutions.manage','platform.clients.provision','platform.clients.suspend')
  ) then
    raise exception 'Manager retains a global provisioning/entitlement permission';
  end if;

  select pm.user_id into actor_id
  from public.platform_members pm
  join public.platform_roles role on role.id = pm.role_id
  where role.key = 'admin' and pm.status = 'active'
  limit 1;
  if actor_id is null then raise exception 'No active platform admin for integration test'; end if;

  insert into public.platform_teams(name, slug, team_type, channel, created_by)
  values ('Migration test', 'migration-test-' || substr(gen_random_uuid()::text, 1, 8), 'sales', 'internal', actor_id);

  v_plan_id := public.admin_create_billing_plan_version(
    'migration-test-' || substr(gen_random_uuid()::text, 1, 8), 'Migration test', '', 0, 5,
    '{}'::jsonb, 1000, 'monthly', 'PIX', array[]::uuid[], '{}'::jsonb, actor_id
  );
  if not exists (select 1 from public.billing_plan_prices where billing_plan_prices.plan_id = v_plan_id and amount_cents = 1000) then
    raise exception 'Transactional plan RPC did not persist its price';
  end if;
end $$;

rollback;
