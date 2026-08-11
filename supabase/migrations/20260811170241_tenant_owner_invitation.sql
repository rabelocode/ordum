create or replace function public.admin_prepare_tenant_owner_invitation(
  p_tenant_id uuid,
  p_user_id uuid,
  p_email text,
  p_membership_status text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_membership_id uuid;
  v_role_id uuid;
  v_invitation_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_membership_status not in ('invited','active') then
    raise exception 'invalid_membership_status';
  end if;
  if not exists(select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'tenant_not_found';
  end if;

  select id into v_role_id
  from public.roles
  where tenant_id = p_tenant_id and key = 'tenant_admin';
  if v_role_id is null then
    raise exception 'tenant_admin_role_not_found';
  end if;

  insert into public.memberships(tenant_id,user_id,status,employment_level)
  values(p_tenant_id,p_user_id,p_membership_status,'manager')
  on conflict (tenant_id,user_id) do update set
    status = excluded.status,
    updated_at = now()
  returning id into v_membership_id;

  insert into public.membership_roles(membership_id,role_id)
  values(v_membership_id,v_role_id)
  on conflict (membership_id,role_id) do nothing;

  select id into v_invitation_id
  from public.invitations
  where tenant_id = p_tenant_id
    and lower(email) = lower(trim(p_email))
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if v_invitation_id is null then
    insert into public.invitations(tenant_id,email,role_keys,status,expires_at)
    values(
      p_tenant_id,
      lower(trim(p_email)),
      array['tenant_admin']::text[],
      case when p_membership_status = 'active' then 'accepted' else 'pending' end,
      case when p_membership_status = 'active' then null else p_expires_at end
    );
  else
    update public.invitations set
      role_keys = array['tenant_admin']::text[],
      status = case when p_membership_status = 'active' then 'accepted' else 'pending' end,
      expires_at = case when p_membership_status = 'active' then null else coalesce(p_expires_at,expires_at) end
    where id = v_invitation_id;
  end if;

  return v_membership_id;
end;
$$;

revoke all on function public.admin_prepare_tenant_owner_invitation(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_prepare_tenant_owner_invitation(uuid,uuid,text,text,timestamptz) to service_role;

comment on function public.admin_prepare_tenant_owner_invitation(uuid,uuid,text,text,timestamptz)
  is 'Atomically prepares a tenant owner membership, tenant_admin role and invitation. Service role only.';
