-- Narrow cleanup boundary for deterministic, disposable Integridade E2E tenants.
-- It cannot target ordinary tenants and refuses cleanup while Storage objects remain.
create or replace function public.integrity_case_event_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_run_id text := current_setting('ordum.integrity_e2e_cleanup_run_id', true);
begin
  if tg_op = 'DELETE'
     and current_user in ('service_role', 'postgres')
     and v_run_id ~ '^integrity_e2e_[0-9]{13}_[a-f0-9]{8}$'
     and exists (
       select 1
       from public.integrity_cases cases
       join public.tenants tenant on tenant.id = cases.tenant_id
       where cases.id = old.case_id
         and tenant.settings ->> 'e2e_run_id' = v_run_id
         and tenant.slug like 'e2e-integrity-%'
       union all
       select 1
       from public.integrity_reports report
       join public.tenants tenant on tenant.id = report.tenant_id
       where report.id = old.report_id
         and tenant.settings ->> 'e2e_run_id' = v_run_id
         and tenant.slug like 'e2e-integrity-%'
     ) then
    return old;
  end if;
  raise exception 'integrity_case_events_are_immutable';
end;
$$;
revoke all on function public.integrity_case_event_immutable() from public, anon, authenticated;

create or replace function public.cleanup_integrity_e2e_fixture(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_tenant_ids uuid[];
  v_case_ids uuid[];
  v_report_ids uuid[];
  v_deleted_tenants integer := 0;
  v_storage_objects integer := 0;
begin
  if current_user not in ('service_role', 'postgres')
     or p_run_id !~ '^integrity_e2e_[0-9]{13}_[a-f0-9]{8}$' then
    raise exception 'invalid_integrity_e2e_cleanup' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_tenant_ids
  from public.tenants
  where settings ->> 'e2e_run_id' = p_run_id
    and slug like 'e2e-integrity-%'
    and created_at >= clock_timestamp() - interval '24 hours';

  if cardinality(v_tenant_ids) = 0 then
    return jsonb_build_object('tenants_deleted', 0, 'run_id', p_run_id);
  end if;

  select count(*) into v_storage_objects
  from storage.objects object
  where object.bucket_id = 'ordum-integrity'
    and split_part(object.name, '/', 1) = any(v_tenant_ids::text[]);
  if v_storage_objects > 0 then
    raise exception 'integrity_e2e_storage_cleanup_required:%', v_storage_objects;
  end if;

  perform set_config('ordum.integrity_e2e_cleanup_run_id', p_run_id, true);
  select coalesce(array_agg(id), '{}'::uuid[]) into v_case_ids
  from public.integrity_cases where tenant_id = any(v_tenant_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into v_report_ids
  from public.integrity_reports where tenant_id = any(v_tenant_ids);

  delete from public.integrity_attachments
  where case_id = any(v_case_ids) or report_id = any(v_report_ids);
  delete from public.files
  where tenant_id = any(v_tenant_ids) and bucket = 'ordum-integrity';
  delete from public.integrity_case_events
  where case_id = any(v_case_ids) or report_id = any(v_report_ids);
  delete from public.integrity_case_tasks where case_id = any(v_case_ids);
  delete from public.integrity_case_conflicts where case_id = any(v_case_ids);
  delete from public.integrity_case_assignments
  where case_id = any(v_case_ids) or report_id = any(v_report_ids);
  delete from public.integrity_cases where id = any(v_case_ids);
  delete from public.integrity_reports where id = any(v_report_ids);
  delete from public.tenants where id = any(v_tenant_ids);
  get diagnostics v_deleted_tenants = row_count;

  return jsonb_build_object(
    'tenants_deleted', v_deleted_tenants,
    'run_id', p_run_id,
    'storage_objects_remaining', 0
  );
end;
$$;
revoke all on function public.cleanup_integrity_e2e_fixture(text) from public, anon, authenticated;
grant execute on function public.cleanup_integrity_e2e_fixture(text) to service_role;
