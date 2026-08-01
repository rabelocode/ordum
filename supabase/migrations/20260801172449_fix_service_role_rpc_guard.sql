-- Modern sb_secret keys are authorized by PostgREST without exposing a legacy JWT
-- role claim. EXECUTE grants remain the authoritative guard for this RPC.
do $migration$
declare
  v_definition text;
  v_guard text := $guard$  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

$guard$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'provision_paid_contract'
    and pg_get_function_identity_arguments(p.oid) = 'p_contract_id uuid, p_payment_id uuid, p_owner_user_id uuid, p_actor_user_id uuid';

  if v_definition is null or position(v_guard in v_definition) = 0 then
    raise exception 'provision_paid_contract_guard_not_found';
  end if;

  execute replace(v_definition, v_guard, '');
end;
$migration$;

revoke all on function public.provision_paid_contract(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.provision_paid_contract(uuid, uuid, uuid, uuid) to service_role;
