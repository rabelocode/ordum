create or replace function public.admin_create_billing_plan_version(
  p_code text,
  p_name text,
  p_description text,
  p_trial_days integer,
  p_grace_days integer,
  p_limits jsonb,
  p_amount_cents integer,
  p_cycle text,
  p_billing_type text,
  p_solution_ids uuid[],
  p_solution_limits jsonb,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_code text := lower(trim(p_code));
  v_plan_id uuid;
  v_version integer;
begin
  if v_code = '' or trim(p_name) = '' then raise exception 'Code and name are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('billing_plan:' || v_code, 0));
  select coalesce(max(version), 0) + 1 into v_version from public.billing_plans where code = v_code;
  update public.billing_plans set active = false, archived_at = now() where code = v_code and active;

  insert into public.billing_plans(code, version, name, description, trial_days, grace_days, limits, created_by_user_id)
  values (v_code, v_version, trim(p_name), nullif(trim(p_description), ''), p_trial_days, p_grace_days, coalesce(p_limits, '{}'::jsonb), p_actor_user_id)
  returning id into v_plan_id;

  if p_amount_cents is not null then
    insert into public.billing_plan_prices(plan_id, amount_cents, cycle, billing_type)
    values (v_plan_id, p_amount_cents, p_cycle, p_billing_type);
  end if;

  insert into public.billing_plan_solutions(plan_id, solution_id, limits)
  select v_plan_id, solution_id, coalesce(p_solution_limits -> solution_id::text, '{}'::jsonb)
  from (select distinct unnest(coalesce(p_solution_ids, array[]::uuid[])) as solution_id) selected;

  return v_plan_id;
end;
$$;

revoke all on function public.admin_create_billing_plan_version(text,text,text,integer,integer,jsonb,integer,text,text,uuid[],jsonb,uuid) from public, anon, authenticated;
grant execute on function public.admin_create_billing_plan_version(text,text,text,integer,integer,jsonb,integer,text,text,uuid[],jsonb,uuid) to service_role;
