begin;

create or replace function public.transition_integrity_case(
  p_case_id uuid,
  p_tenant_id uuid,
  p_actor_membership_id uuid,
  p_to_status text,
  p_reason text,
  p_expected_lock_version integer
)
returns table(status text, lock_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.integrity_cases%rowtype;
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if not exists (
    select 1
      from public.memberships m
     where m.id = p_actor_membership_id
       and m.tenant_id = p_tenant_id
       and m.status = 'active'
  ) then
    raise exception 'actor_not_authorized' using errcode = '42501';
  end if;

  select * into v_case
    from public.integrity_cases c
   where c.id = p_case_id
     and c.tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'case_not_found' using errcode = 'P0002';
  end if;

  if v_case.lock_version <> p_expected_lock_version then
    raise exception 'case_version_conflict' using errcode = '40001';
  end if;

  v_allowed := case v_case.status
    when 'received' then p_to_status in ('triage', 'archived')
    when 'triage' then p_to_status in ('investigation', 'waiting_information', 'archived')
    when 'investigation' then p_to_status in ('waiting_information', 'decision', 'archived')
    when 'waiting_information' then p_to_status in ('investigation', 'decision', 'archived')
    when 'decision' then p_to_status in ('closed', 'investigation')
    when 'closed' then p_to_status = 'reopened'
    when 'reopened' then p_to_status = 'triage'
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_case_transition' using errcode = '22023';
  end if;

  if p_to_status in ('closed', 'reopened', 'archived') and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'transition_reason_required' using errcode = '22023';
  end if;

  update public.integrity_cases c
     set status = p_to_status,
         lock_version = c.lock_version + 1,
         first_action_at = case
           when c.first_action_at is null and p_to_status <> 'received' then v_now
           else c.first_action_at
         end,
         closed_at = case
           when p_to_status = 'closed' then v_now
           when p_to_status = 'reopened' then null
           else c.closed_at
         end,
         updated_at = v_now
   where c.id = p_case_id
  returning c.status, c.lock_version into status, lock_version;

  insert into public.integrity_case_events (
    report_id, case_id, event_type, from_status, to_status,
    note, actor_membership_id, metadata
  ) values (
    v_case.report_id, p_case_id, 'status_changed', v_case.status, p_to_status,
    nullif(trim(coalesce(p_reason, '')), ''), p_actor_membership_id, '{}'::jsonb
  );

  return next;
end;
$$;

revoke all on function public.transition_integrity_case(uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.transition_integrity_case(uuid, uuid, uuid, text, text, integer) to service_role;

commit;
