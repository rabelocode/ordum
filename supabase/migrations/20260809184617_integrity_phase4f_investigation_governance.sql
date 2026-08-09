begin;

insert into public.permissions(key, description) values
  ('integrity.investigators.manage','Gerenciar investigadores adicionais em casos acessíveis'),
  ('integrity.templates.read','Consultar templates operacionais do Integridade'),
  ('integrity.templates.manage','Gerenciar templates operacionais do Integridade'),
  ('integrity.notifications.read','Consultar notificações internas do Integridade'),
  ('integrity.retention.manage','Gerenciar política de retenção do Integridade'),
  ('integrity.dossier.export','Exportar dossiê PDF sanitizado de caso autorizado')
on conflict (key) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select role.id,permission.id
from public.roles role
join public.permissions permission on permission.key like 'integrity.%'
where role.key in ('tenant_admin','integrity_compliance')
on conflict (role_id,permission_id) do nothing;

insert into public.role_permissions(role_id,permission_id)
select role.id,permission.id
from public.roles role
join public.permissions permission on permission.key=any(array[
  'integrity.templates.read','integrity.notifications.read'
])
where role.key='integrity_investigator'
on conflict (role_id,permission_id) do nothing;

alter table public.files
  add column if not exists checksum_sha256 text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='files_checksum_sha256_format' and conrelid='public.files'::regclass) then
    alter table public.files add constraint files_checksum_sha256_format check (
      checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'
    ) not valid;
  end if;
end $$;
alter table public.files validate constraint files_checksum_sha256_format;

alter table public.integrity_case_tasks
  add column if not exists parent_task_id uuid references public.integrity_case_tasks(id) on delete set null;

alter table public.integrity_settings
  add column if not exists retention_days integer not null default 1825 check (retention_days between 30 and 7300),
  add column if not exists evidence_retention_days integer not null default 1825 check (evidence_retention_days between 30 and 7300),
  add column if not exists message_retention_days integer not null default 1825 check (message_retention_days between 30 and 7300),
  add column if not exists post_closure_action text not null default 'archive' check (post_closure_action in ('archive','anonymize')),
  add column if not exists anonymization_enabled boolean not null default false;

alter table public.integrity_cases
  add column if not exists retention_state text not null default 'active' check (retention_state in ('active','retention_due','archived','anonymized')),
  add column if not exists retention_due_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists anonymized_at timestamptz;

create table if not exists public.integrity_case_collaborators (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid not null references public.integrity_cases(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role text not null default 'investigator' check (role in ('investigator','participant')),
  active boolean not null default true,
  added_by_membership_id uuid not null references public.memberships(id) on delete restrict,
  removed_at timestamptz,
  removed_by_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(case_id,membership_id)
);

create table if not exists public.integrity_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_type text not null check (template_type in ('task','reporter_message','information_request','recommendation','decision')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  title text,
  body text not null check (char_length(trim(body)) between 2 and 10000),
  active boolean not null default true,
  created_by_membership_id uuid not null references public.memberships(id) on delete restrict,
  updated_by_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,template_type,name)
);

create table if not exists public.integrity_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_membership_id uuid not null references public.memberships(id) on delete cascade,
  case_id uuid references public.integrity_cases(id) on delete cascade,
  event_id bigint references public.integrity_case_events(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'new_case','case_assigned','sla_due_soon','sla_overdue','new_task','task_overdue',
    'external_message','conflict_detected','recommendation_ready','decision_pending','case_reopened'
  )),
  title text not null check (char_length(trim(title)) between 2 and 160),
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_membership_id,event_id,notification_type)
);

create index if not exists integrity_collaborators_case_active_idx
  on public.integrity_case_collaborators(case_id,membership_id) where active;
create index if not exists integrity_collaborators_member_active_idx
  on public.integrity_case_collaborators(membership_id,case_id) where active;
create index if not exists integrity_tasks_parent_idx
  on public.integrity_case_tasks(parent_task_id) where parent_task_id is not null;
create index if not exists integrity_templates_tenant_type_idx
  on public.integrity_templates(tenant_id,template_type,active,name);
create index if not exists integrity_notifications_recipient_unread_idx
  on public.integrity_notifications(recipient_membership_id,created_at desc) where read_at is null;
create index if not exists integrity_notifications_case_idx
  on public.integrity_notifications(case_id,created_at desc) where case_id is not null;
create index if not exists integrity_cases_retention_due_idx
  on public.integrity_cases(tenant_id,retention_due_at) where retention_state='retention_due';

alter table public.integrity_case_collaborators enable row level security;
alter table public.integrity_templates enable row level security;
alter table public.integrity_notifications enable row level security;

create policy integrity_collaborators_read on public.integrity_case_collaborators for select to authenticated
using (private.can_access_integrity_case(case_id));
create policy integrity_collaborators_manage on public.integrity_case_collaborators for all to authenticated
using (
  private.can_access_integrity_case(case_id)
  and public.has_permission(tenant_id,'integrity.investigators.manage')
)
with check (
  private.can_access_integrity_case(case_id)
  and public.has_permission(tenant_id,'integrity.investigators.manage')
  and exists(select 1 from public.integrity_cases c where c.id=case_id and c.tenant_id=tenant_id)
  and exists(select 1 from public.memberships m where m.id=membership_id and m.tenant_id=tenant_id and m.status='active')
);

create policy integrity_templates_read on public.integrity_templates for select to authenticated
using (public.has_permission(tenant_id,'integrity.templates.read') or public.has_permission(tenant_id,'integrity.templates.manage'));
create policy integrity_templates_manage on public.integrity_templates for all to authenticated
using (public.has_permission(tenant_id,'integrity.templates.manage'))
with check (public.has_permission(tenant_id,'integrity.templates.manage'));

create policy integrity_notifications_read on public.integrity_notifications for select to authenticated
using (
  public.has_permission(tenant_id,'integrity.notifications.read')
  and recipient_membership_id in (
    select m.id from public.memberships m
    where m.tenant_id=integrity_notifications.tenant_id and m.user_id=(select auth.uid()) and m.status='active'
  )
);
create policy integrity_notifications_update on public.integrity_notifications for update to authenticated
using (
  public.has_permission(tenant_id,'integrity.notifications.read')
  and recipient_membership_id in (
    select m.id from public.memberships m
    where m.tenant_id=integrity_notifications.tenant_id and m.user_id=(select auth.uid()) and m.status='active'
  )
)
with check (
  public.has_permission(tenant_id,'integrity.notifications.read')
  and recipient_membership_id in (
    select m.id from public.memberships m
    where m.tenant_id=integrity_notifications.tenant_id and m.user_id=(select auth.uid()) and m.status='active'
  )
);

grant select,insert,update,delete on public.integrity_case_collaborators,public.integrity_templates to authenticated,service_role;
grant select,update on public.integrity_notifications to authenticated;
grant select,insert,update,delete on public.integrity_notifications to service_role;

create or replace function public.integrity_case_retention_lifecycle()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_days integer;
begin
  if new.status='closed' and old.status is distinct from 'closed' then
    select retention_days into v_days from public.integrity_settings where tenant_id=new.tenant_id;
    new.retention_state := 'active';
    new.retention_due_at := coalesce(new.closed_at,clock_timestamp()) + make_interval(days=>coalesce(v_days,1825));
    new.archived_at := null;
    new.anonymized_at := null;
  elsif new.status in ('reopened','triage','investigation','waiting_information','decision') and old.status is distinct from new.status then
    new.retention_state := 'active';
    new.retention_due_at := null;
    new.archived_at := null;
    new.anonymized_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.integrity_case_retention_lifecycle() from public,anon,authenticated;
drop trigger if exists integrity_cases_retention_lifecycle on public.integrity_cases;
create trigger integrity_cases_retention_lifecycle
before update of status on public.integrity_cases
for each row execute function public.integrity_case_retention_lifecycle();

create or replace function private.can_access_integrity_case(p_case_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public as $$
  select exists(
    select 1
    from public.integrity_cases c
    where c.id=p_case_id
      and (
        public.has_permission(c.tenant_id,'integrity.cases.read')
        or (
          public.has_permission(c.tenant_id,'integrity.cases.read_assigned')
          and exists(
            select 1 from public.memberships m
            where m.tenant_id=c.tenant_id and m.user_id=(select auth.uid()) and m.status='active'
              and (
                c.owner_membership_id=m.id
                or exists(select 1 from public.integrity_committee_members cm where cm.committee_id=c.committee_id and cm.membership_id=m.id and cm.active)
                or exists(select 1 from public.integrity_case_collaborators cc where cc.case_id=c.id and cc.membership_id=m.id and cc.active)
              )
          )
        )
      )
  );
$$;
revoke all on function private.can_access_integrity_case(uuid) from public,anon;
grant execute on function private.can_access_integrity_case(uuid) to authenticated,service_role;

create or replace function public.integrity_notification_from_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_case public.integrity_cases%rowtype;
  v_type text;
  v_title text;
begin
  select * into v_case from public.integrity_cases where id=new.case_id;
  if v_case.id is null then return new; end if;
  v_type := case
    when new.event_type='status_changed' and new.to_status='reopened' then 'case_reopened'
    when new.event_type='status_changed' and new.to_status='decision' then 'decision_pending'
    else case new.event_type
    when 'routed' then 'new_case'
    when 'assigned' then 'case_assigned'
    when 'task_created' then 'new_task'
    when 'reporter_message_received' then 'external_message'
    when 'conflict_registered' then 'conflict_detected'
    when 'decision_recommended' then 'recommendation_ready'
    else null end end;
  if v_type is null then return new; end if;
  v_title := case v_type
    when 'new_case' then 'Novo caso de Integridade'
    when 'case_assigned' then 'Caso atribuído'
    when 'new_task' then 'Nova tarefa de investigação'
    when 'external_message' then 'Nova mensagem do denunciante'
    when 'conflict_detected' then 'Conflito de interesse detectado'
    when 'recommendation_ready' then 'Recomendação pronta para decisão'
    when 'decision_pending' then 'Caso aguardando decisão'
    when 'case_reopened' then 'Caso reaberto'
  end;
  insert into public.integrity_notifications(tenant_id,recipient_membership_id,case_id,event_id,notification_type,title)
  select v_case.tenant_id,recipient.id,v_case.id,new.id,v_type,v_title
  from (
    select v_case.owner_membership_id id
    union
    select cm.membership_id from public.integrity_committee_members cm where cm.committee_id=v_case.committee_id and cm.active
    union
    select cc.membership_id from public.integrity_case_collaborators cc where cc.case_id=v_case.id and cc.active
    union
    select t.assignee_membership_id from public.integrity_case_tasks t
      where t.id=public.safe_uuid(new.metadata->>'task_id') and t.assignee_membership_id is not null
  ) recipient
  join public.memberships m on m.id=recipient.id and m.tenant_id=v_case.tenant_id and m.status='active'
  where recipient.id is not null
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.integrity_notification_from_event() from public,anon,authenticated;
drop trigger if exists integrity_case_events_create_notification on public.integrity_case_events;
create trigger integrity_case_events_create_notification
after insert on public.integrity_case_events
for each row execute function public.integrity_notification_from_event();

create or replace function public.provision_integrity_system_roles()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_key text;
begin
  foreach v_key in array array['integrity_investigator','integrity_compliance'] loop
    insert into public.roles(tenant_id,key,name,description,is_system) values(
      new.id,v_key,
      case when v_key='integrity_investigator' then 'Investigador de Integridade' else 'Compliance de Integridade' end,
      case when v_key='integrity_investigator' then 'Acesso apenas a casos atribuídos, colaborados ou vinculados ao seu comitê.' else 'Gestão tenant-scoped do módulo Integridade.' end,
      true
    ) on conflict (tenant_id,key) do nothing;
  end loop;
  insert into public.role_permissions(role_id,permission_id)
  select r.id,p.id from public.roles r join public.permissions p on
    (r.key='integrity_investigator' and p.key=any(array[
      'integrity.access','integrity.cases.read_assigned','integrity.cases.investigate','integrity.notes.create',
      'integrity.messages.send','integrity.evidence.manage','integrity.cases.recommend','integrity.templates.read','integrity.notifications.read'
    ]))
    or (r.key='integrity_compliance' and p.key like 'integrity.%')
  where r.tenant_id=new.id on conflict (role_id,permission_id) do nothing;
  return new;
end; $$;
revoke all on function public.provision_integrity_system_roles() from public,anon,authenticated;

create or replace function public.cleanup_integrity_e2e_fixture(p_run_id text)
returns jsonb language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare
  v_tenant_ids uuid[]; v_case_ids uuid[]; v_report_ids uuid[];
  v_deleted_tenants integer:=0; v_storage_objects integer:=0;
begin
  if current_user not in ('service_role','postgres') or p_run_id !~ '^integrity_e2e_[0-9]{13}_[a-f0-9]{8}$' then
    raise exception 'invalid_integrity_e2e_cleanup' using errcode='42501';
  end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into v_tenant_ids from public.tenants
  where settings->>'e2e_run_id'=p_run_id and slug like 'e2e-integrity-%' and created_at>=clock_timestamp()-interval '24 hours';
  if cardinality(v_tenant_ids)=0 then return jsonb_build_object('tenants_deleted',0,'run_id',p_run_id); end if;
  select count(*) into v_storage_objects from storage.objects object
  where object.bucket_id='ordum-integrity' and split_part(object.name,'/',1)=any(v_tenant_ids::text[]);
  if v_storage_objects>0 then raise exception 'integrity_e2e_storage_cleanup_required:%',v_storage_objects; end if;
  perform set_config('ordum.integrity_e2e_cleanup_run_id',p_run_id,true);
  select coalesce(array_agg(id),'{}'::uuid[]) into v_case_ids from public.integrity_cases where tenant_id=any(v_tenant_ids);
  select coalesce(array_agg(id),'{}'::uuid[]) into v_report_ids from public.integrity_reports where tenant_id=any(v_tenant_ids);
  delete from public.integrity_notifications where tenant_id=any(v_tenant_ids);
  delete from public.integrity_templates where tenant_id=any(v_tenant_ids);
  delete from public.integrity_case_collaborators where tenant_id=any(v_tenant_ids);
  delete from public.integrity_attachments where case_id=any(v_case_ids) or report_id=any(v_report_ids);
  delete from public.files where tenant_id=any(v_tenant_ids) and bucket='ordum-integrity';
  delete from public.integrity_case_events where case_id=any(v_case_ids) or report_id=any(v_report_ids);
  delete from public.integrity_case_tasks where case_id=any(v_case_ids);
  delete from public.integrity_case_conflicts where case_id=any(v_case_ids);
  delete from public.integrity_case_assignments where case_id=any(v_case_ids) or report_id=any(v_report_ids);
  delete from public.integrity_cases where id=any(v_case_ids);
  delete from public.integrity_reports where id=any(v_report_ids);
  delete from public.tenants where id=any(v_tenant_ids);
  get diagnostics v_deleted_tenants=row_count;
  return jsonb_build_object('tenants_deleted',v_deleted_tenants,'run_id',p_run_id,'storage_objects_remaining',0);
end;
$$;
revoke all on function public.cleanup_integrity_e2e_fixture(text) from public,anon,authenticated;
grant execute on function public.cleanup_integrity_e2e_fixture(text) to service_role;

commit;
