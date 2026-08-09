create or replace function public.initialize_integrity_case_sla()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_response_hours integer;
  v_treatment_hours integer;
begin
  select
    coalesce(category.sla_hours, settings.default_sla_hours, 120),
    coalesce(settings.treatment_sla_hours, 720)
  into v_first_response_hours, v_treatment_hours
  from public.integrity_settings settings
  left join public.integrity_categories category
    on category.id = new.category_id
   and category.tenant_id = new.tenant_id
  where settings.tenant_id = new.tenant_id;

  v_first_response_hours := coalesce(v_first_response_hours, 120);
  v_treatment_hours := coalesce(v_treatment_hours, 720);
  new.first_response_due_at := coalesce(
    new.first_response_due_at,
    new.sla_due_at,
    new.created_at + make_interval(hours => v_first_response_hours)
  );
  new.sla_due_at := coalesce(new.sla_due_at, new.first_response_due_at);
  new.treatment_due_at := coalesce(
    new.treatment_due_at,
    new.created_at + make_interval(hours => v_treatment_hours)
  );
  return new;
end;
$$;

drop trigger if exists integrity_case_initialize_sla on public.integrity_cases;
create trigger integrity_case_initialize_sla
before insert on public.integrity_cases
for each row execute function public.initialize_integrity_case_sla();

revoke all on function public.initialize_integrity_case_sla() from public, anon, authenticated;

update public.integrity_cases cases
set
  first_response_due_at = coalesce(
    cases.first_response_due_at,
    cases.sla_due_at,
    cases.created_at + make_interval(hours => coalesce(
      (select category.sla_hours from public.integrity_categories category where category.id = cases.category_id and category.tenant_id = cases.tenant_id),
      settings.default_sla_hours,
      120
    ))
  ),
  sla_due_at = coalesce(
    cases.sla_due_at,
    cases.first_response_due_at,
    cases.created_at + make_interval(hours => coalesce(
      (select category.sla_hours from public.integrity_categories category where category.id = cases.category_id and category.tenant_id = cases.tenant_id),
      settings.default_sla_hours,
      120
    ))
  ),
  treatment_due_at = coalesce(
    cases.treatment_due_at,
    cases.created_at + make_interval(hours => coalesce(settings.treatment_sla_hours, 720))
  )
from public.integrity_settings settings
where settings.tenant_id = cases.tenant_id
  and (
    cases.first_response_due_at is null
    or cases.sla_due_at is null
    or cases.treatment_due_at is null
  );
