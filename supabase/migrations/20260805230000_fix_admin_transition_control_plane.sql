-- Migration: Fix admin_transition_control_plane
-- Updates RPC for auto-approval, lead transition permissions, tenant status sync, and contract lifecycle alignment.

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
  actor_allowed boolean := false;
  allowed boolean := false;
  other_approver_exists boolean := false;
  effective_metadata jsonb;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'reason_required';
  end if;

  effective_metadata := coalesce(p_metadata, '{}'::jsonb);

  -- Actor authorization check by entity type
  if p_entity_type = 'lead' then
    select exists(
      select 1 from public.platform_members pm
      join public.platform_roles pr on pr.id = pm.role_id
      left join public.platform_role_permissions rp on rp.role_id = pr.id
      left join public.platform_permissions pp on pp.id = rp.permission_id
      where pm.user_id = p_actor_user_id and pm.status = 'active'
        and (pr.key = 'admin' or pp.key in ('platform.leads.assign', 'platform.leads.claim', 'platform.commercial.manage'))
    ) into actor_allowed;
  else
    select exists(
      select 1 from public.platform_members pm
      join public.platform_roles pr on pr.id = pm.role_id
      left join public.platform_role_permissions rp on rp.role_id = pr.id
      left join public.platform_permissions pp on pp.id = rp.permission_id
      where pm.user_id = p_actor_user_id and pm.status = 'active'
        and (pr.key = 'admin' or pp.key in ('platform.commercial.manage', 'platform.commercial.approve', 'platform.clients.manage', 'platform.clients.suspend'))
    ) into actor_allowed;
  end if;

  if not actor_allowed then
    raise exception 'actor_not_authorized';
  end if;

  if p_entity_type = 'lead' then
    select status, null::uuid into from_status, creator_id from public.marketing_leads where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('new', 'contacted'), ('contacted', 'qualified'), ('qualified', 'approved'),
      ('approved', 'converted'), ('new', 'rejected'), ('contacted', 'rejected'),
      ('qualified', 'rejected'), ('rejected', 'new'), ('converted', 'contacted')
    );
    if allowed then
      update public.marketing_leads
      set status = p_to_status,
          updated_at = now(),
          lock_version = lock_version + 1,
          reopened_at = case when from_status in ('rejected', 'converted') then now() else reopened_at end,
          reopened_by_user_id = case when from_status in ('rejected', 'converted') then p_actor_user_id else reopened_by_user_id end
      where id = p_entity_id;
    end if;

  elsif p_entity_type = 'proposal' then
    select status, created_by_user_id into from_status, creator_id from public.commercial_proposals where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('draft', 'pending_approval'), ('pending_approval', 'approved'), ('pending_approval', 'rejected'),
      ('approved', 'accepted'), ('approved', 'rejected'), ('approved', 'superseded'), ('rejected', 'superseded')
    );

    if p_to_status = 'approved' and creator_id = p_actor_user_id then
      select exists(
        select 1 from public.platform_members pm
        join public.platform_roles pr on pr.id = pm.role_id
        left join public.platform_role_permissions rp on rp.role_id = pr.id
        left join public.platform_permissions pp on pp.id = rp.permission_id
        where pm.user_id <> p_actor_user_id and pm.status = 'active'
          and (pr.key = 'admin' or pp.key in ('platform.commercial.approve', 'platform.commercial.manage'))
      ) into other_approver_exists;

      if other_approver_exists then
        raise exception 'self_approval_forbidden';
      else
        effective_metadata := effective_metadata || jsonb_build_object('auto_approved', true, 'auto_approval_override', 'no_other_active_approver');
      end if;
    end if;

    if allowed then
      update public.commercial_proposals
      set status = p_to_status,
          updated_at = now(),
          lock_version = lock_version + 1,
          approved_by_user_id = case when p_to_status = 'approved' then p_actor_user_id else approved_by_user_id end,
          approved_at = case when p_to_status = 'approved' then now() else approved_at end,
          accepted_at = case when p_to_status = 'accepted' then now() else accepted_at end,
          rejected_at = case when p_to_status = 'rejected' then now() else rejected_at end,
          rejection_reason = case when p_to_status = 'rejected' then p_reason else rejection_reason end
      where id = p_entity_id;
    end if;

  elsif p_entity_type = 'contract' then
    select status, created_by_user_id into from_status, creator_id from public.commercial_contracts where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('draft', 'pending_approval'), ('pending_approval', 'approved'), ('pending_approval', 'draft'),
      ('approved', 'pending_payment'), ('approved', 'awaiting_payment'), ('pending_payment', 'active'), ('awaiting_payment', 'active'),
      ('active', 'renewal_due'), ('renewal_due', 'active'), ('active', 'cancellation_requested'),
      ('renewal_due', 'cancellation_requested'), ('cancellation_requested', 'cancelled'),
      ('active', 'suspended'), ('suspended', 'active'), ('cancelled', 'closed'), ('suspended', 'closed')
    );

    if p_to_status = 'approved' and creator_id = p_actor_user_id then
      select exists(
        select 1 from public.platform_members pm
        join public.platform_roles pr on pr.id = pm.role_id
        left join public.platform_role_permissions rp on rp.role_id = pr.id
        left join public.platform_permissions pp on pp.id = rp.permission_id
        where pm.user_id <> p_actor_user_id and pm.status = 'active'
          and (pr.key = 'admin' or pp.key in ('platform.commercial.approve', 'platform.commercial.manage'))
      ) into other_approver_exists;

      if other_approver_exists then
        raise exception 'self_approval_forbidden';
      else
        effective_metadata := effective_metadata || jsonb_build_object('auto_approved', true, 'auto_approval_override', 'no_other_active_approver');
      end if;
    end if;

    if allowed then
      update public.commercial_contracts
      set status = p_to_status,
          updated_at = now(),
          lock_version = lock_version + 1,
          transition_reason = p_reason,
          approved_by_user_id = case when p_to_status = 'approved' then p_actor_user_id else approved_by_user_id end,
          approved_at = case when p_to_status = 'approved' then now() else approved_at end,
          cancelled_at = case when p_to_status in ('cancelled', 'closed') then now() else cancelled_at end,
          cancellation_reason = case when p_to_status in ('cancellation_requested', 'cancelled', 'closed') then p_reason else cancellation_reason end
      where id = p_entity_id;
    end if;

  elsif p_entity_type = 'tenant' then
    select lifecycle_status, null::uuid into from_status, creator_id from public.tenants where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('opportunity', 'approved'), ('approved', 'awaiting_payment'), ('awaiting_payment', 'onboarding'),
      ('onboarding', 'active'), ('active', 'at_risk'), ('at_risk', 'active'), ('active', 'delinquent'),
      ('at_risk', 'delinquent'), ('delinquent', 'active'), ('delinquent', 'suspended'), ('active', 'suspended'),
      ('suspended', 'active'), ('active', 'cancelled'), ('suspended', 'cancelled'), ('cancelled', 'closed')
    );
    if allowed then
      update public.tenants
      set lifecycle_status = p_to_status,
          status = case
            when p_to_status = 'suspended' then 'suspended'
            when p_to_status = 'active' then 'active'
            else status
          end,
          updated_at = now(),
          lock_version = lock_version + 1,
          cancellation_reason = case when p_to_status in ('cancelled', 'closed') then p_reason else cancellation_reason end
      where id = p_entity_id;
    end if;

  elsif p_entity_type = 'onboarding' then
    select status, null::uuid into from_status, creator_id from public.onboarding_runs where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('not_started', 'in_progress'), ('in_progress', 'blocked'), ('blocked', 'in_progress'),
      ('in_progress', 'completed'), ('not_started', 'cancelled'), ('in_progress', 'cancelled'), ('blocked', 'cancelled')
    );
    if allowed then
      update public.onboarding_runs
      set status = p_to_status,
          updated_at = now(),
          starts_at = case when p_to_status = 'in_progress' and starts_at is null then now() else starts_at end,
          completed_at = case when p_to_status = 'completed' then now() else completed_at end
      where id = p_entity_id;
    end if;

  elsif p_entity_type = 'support' then
    select status, created_by_user_id into from_status, creator_id from public.support_tickets where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('open', 'triage'), ('triage', 'in_progress'), ('in_progress', 'waiting_customer'),
      ('waiting_customer', 'in_progress'), ('in_progress', 'resolved'), ('resolved', 'closed'),
      ('resolved', 'in_progress'), ('open', 'cancelled'), ('triage', 'cancelled')
    );
    if allowed then
      update public.support_tickets
      set status = p_to_status,
          updated_at = now(),
          lock_version = lock_version + 1,
          resolved_at = case when p_to_status = 'resolved' then now() else resolved_at end,
          closed_at = case when p_to_status = 'closed' then now() else closed_at end
      where id = p_entity_id;
    end if;

  elsif p_entity_type = 'lgpd' then
    select status, created_by_user_id into from_status, creator_id from public.lgpd_requests where id = p_entity_id for update;
    allowed := (from_status, p_to_status) in (
      ('received', 'identity_verification'), ('identity_verification', 'analysis'), ('analysis', 'in_progress'),
      ('analysis', 'rejected'), ('in_progress', 'blocked'), ('blocked', 'in_progress'),
      ('in_progress', 'completed'), ('received', 'cancelled'), ('identity_verification', 'cancelled')
    );
    if allowed then
      update public.lgpd_requests
      set status = p_to_status,
          updated_at = now(),
          lock_version = lock_version + 1,
          completed_at = case when p_to_status = 'completed' then now() else completed_at end,
          reason = case when p_to_status in ('rejected', 'cancelled', 'blocked') then p_reason else reason end
      where id = p_entity_id;
    end if;

  else
    raise exception 'unsupported_entity_type';
  end if;

  if from_status is null then
    raise exception 'entity_not_found';
  end if;

  if from_status = p_to_status then
    return from_status;
  end if;

  if not allowed then
    raise exception 'invalid_transition:%->%', from_status, p_to_status;
  end if;

  insert into public.platform_state_transitions(
    entity_type, entity_id, tenant_id, team_id, from_status, to_status, reason, actor_user_id, request_id, metadata
  ) values (
    p_entity_type, p_entity_id, p_tenant_id, p_team_id, from_status, p_to_status, p_reason, p_actor_user_id, p_request_id, effective_metadata
  );

  insert into public.platform_audit_logs(
    actor_user_id, action, entity_type, entity_id, severity, team_id, request_id, metadata
  ) values (
    p_actor_user_id, p_entity_type || '.transitioned', p_entity_type, p_entity_id::text, 'info', p_team_id, p_request_id,
    jsonb_build_object('before', jsonb_build_object('status', from_status), 'after', jsonb_build_object('status', p_to_status), 'reason', p_reason, 'result', 'success')
  );

  return p_to_status;
end;
$$;

revoke all on function public.admin_transition_control_plane(text,uuid,text,uuid,text,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_transition_control_plane(text,uuid,text,uuid,text,uuid,uuid,uuid,jsonb) to service_role;
