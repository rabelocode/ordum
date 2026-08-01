-- Harden legacy administrative RPCs and add the payment-gated provisioning transaction.
revoke all on function public.provision_tenant(text, text, uuid) from public, anon, authenticated;
grant execute on function public.provision_tenant(text, text, uuid) to service_role;

revoke all on function public.admin_add_membership(uuid, uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_add_membership(uuid, uuid, text, text, text[]) to service_role;

create or replace function public.provision_paid_contract(
  p_contract_id uuid,
  p_payment_id uuid,
  p_owner_user_id uuid,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_contract public.commercial_contracts%rowtype;
  v_payment public.billing_payments%rowtype;
  v_tenant_id uuid;
  v_slug text;
  v_previous_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select * into v_contract
  from public.commercial_contracts
  where id = p_contract_id
  for update;

  if not found then
    raise exception 'contract_not_found';
  end if;

  select * into v_payment
  from public.billing_payments
  where id = p_payment_id
    and contract_id = p_contract_id
  for update;

  if not found or v_payment.status not in ('confirmed', 'received') then
    raise exception 'confirmed_payment_required';
  end if;

  if v_contract.status not in ('approved','pending_payment','active','past_due','suspended') then
    raise exception 'contract_not_eligible';
  end if;

  v_previous_status := v_contract.status;
  v_tenant_id := v_contract.tenant_id;

  if v_tenant_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(unaccent(v_contract.customer_name)), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then
      v_slug := 'cliente';
    end if;
    v_slug := left(v_slug, 48) || '-' || left(replace(v_contract.id::text, '-', ''), 8);
    v_tenant_id := public.provision_tenant(v_contract.customer_name, v_slug, p_owner_user_id);

    update public.commercial_contracts
      set tenant_id = v_tenant_id
      where id = v_contract.id and tenant_id is null;
  end if;

  delete from public.tenant_solutions where tenant_id = v_tenant_id;
  insert into public.tenant_solutions (tenant_id, solution_id, status, config)
  select v_tenant_id, item.solution_id, 'active', jsonb_build_object('contract_id', v_contract.id, 'limits', item.limits)
  from public.commercial_contract_items item
  where item.contract_id = v_contract.id
  on conflict (tenant_id, solution_id) do update
    set status = 'active', config = excluded.config, updated_at = now();

  update public.commercial_contracts
    set tenant_id = v_tenant_id, status = 'active', starts_on = coalesce(starts_on, current_date)
    where id = v_contract.id;

  update public.billing_customers set tenant_id = v_tenant_id where contract_id = v_contract.id;
  update public.billing_subscriptions set tenant_id = v_tenant_id, status = 'active' where contract_id = v_contract.id;
  update public.billing_payments set tenant_id = v_tenant_id where id = v_payment.id;
  update public.marketing_leads set status = 'won', updated_at = now() where id = v_contract.lead_id;
  update public.tenants set status = 'active', updated_at = now() where id = v_tenant_id;

  insert into public.tenant_billing_state (
    tenant_id, contract_id, subscription_id, access_status, paid_through,
    grace_ends_at, suspended_at, suspension_reason, last_payment_id
  ) values (
    v_tenant_id,
    v_contract.id,
    v_payment.subscription_id,
    'active',
    v_payment.paid_period_ends_on,
    null,
    null,
    null,
    v_payment.id
  )
  on conflict (tenant_id) do update set
    contract_id = excluded.contract_id,
    subscription_id = coalesce(excluded.subscription_id, public.tenant_billing_state.subscription_id),
    access_status = 'active',
    paid_through = greatest(public.tenant_billing_state.paid_through, excluded.paid_through),
    grace_ends_at = null,
    suspended_at = null,
    suspension_reason = null,
    last_payment_id = excluded.last_payment_id,
    updated_at = now();

  if v_contract.team_id is not null then
    insert into public.platform_client_assignments (
      tenant_id, team_id, owner_platform_member_id, assignment_type, status, assigned_by_user_id
    ) values (
      v_tenant_id, v_contract.team_id, v_contract.owner_platform_member_id, 'commercial', 'active', p_actor_user_id
    )
    on conflict (tenant_id, team_id, assignment_type) do update set
      owner_platform_member_id = excluded.owner_platform_member_id,
      status = 'active',
      assigned_by_user_id = excluded.assigned_by_user_id,
      updated_at = now();
  end if;

  insert into public.billing_status_history (
    tenant_id, contract_id, payment_id, from_status, to_status, reason, actor_user_id
  ) values (
    v_tenant_id, v_contract.id, v_payment.id, v_previous_status, 'active', 'confirmed_payment', p_actor_user_id
  );

  insert into public.platform_audit_logs (
    actor_user_id, action, entity_type, entity_id, severity, metadata
  ) values (
    p_actor_user_id, 'tenant.provisioned_after_payment', 'commercial_contracts', v_contract.id, 'info',
    jsonb_build_object('tenant_id', v_tenant_id, 'payment_id', v_payment.id)
  );

  return v_tenant_id;
end;
$$;

revoke all on function public.provision_paid_contract(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.provision_paid_contract(uuid, uuid, uuid, uuid) to service_role;

comment on function public.provision_paid_contract(uuid, uuid, uuid, uuid)
  is 'Idempotent service-only transaction that provisions/reactivates access after a locally persisted confirmed payment.';
