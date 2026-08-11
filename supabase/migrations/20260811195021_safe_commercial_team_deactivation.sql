begin;

create or replace function public.admin_deactivate_commercial_team(
  p_team_id uuid,
  p_destination_team_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_active_records integer;
begin
  if not exists (select 1 from public.platform_teams where id = p_team_id and status = 'active') then
    raise exception using errcode = 'P0001', message = 'team_not_active';
  end if;

  select
    (select count(*) from public.platform_lead_assignments where team_id = p_team_id) +
    (select count(*) from public.platform_client_assignments where team_id = p_team_id and status = 'active')
  into v_active_records;

  if v_active_records > 0 and p_destination_team_id is null then
    raise exception using errcode = 'P0001', message = 'team_transfer_required:' || v_active_records::text;
  end if;

  if p_destination_team_id is not null then
    if p_destination_team_id = p_team_id or not exists (
      select 1 from public.platform_teams where id = p_destination_team_id and status = 'active'
    ) then
      raise exception using errcode = 'P0001', message = 'destination_team_invalid';
    end if;

    update public.platform_lead_assignments set team_id = p_destination_team_id, updated_at = now() where team_id = p_team_id;
    update public.platform_client_assignments set team_id = p_destination_team_id, updated_at = now() where team_id = p_team_id;
    update public.commercial_demos set team_id = p_destination_team_id, updated_at = now() where team_id = p_team_id;
    update public.commercial_proposals set team_id = p_destination_team_id, updated_at = now() where team_id = p_team_id;
    update public.commercial_contracts set team_id = p_destination_team_id, updated_at = now() where team_id = p_team_id;
  end if;

  update public.platform_teams set status = 'inactive', updated_at = now() where id = p_team_id;
  return v_active_records;
end;
$$;

revoke all on function public.admin_deactivate_commercial_team(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_deactivate_commercial_team(uuid, uuid) to service_role;

commit;
