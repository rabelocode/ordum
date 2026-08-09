begin;

insert into public.permissions(key, description) values
  ('integrity.cases.read_assigned', 'Visualizar somente casos atribuídos ou do próprio comitê'),
  ('integrity.cases.investigate', 'Executar investigação e tarefas em casos acessíveis'),
  ('integrity.notes.create', 'Registrar notas internas em casos acessíveis'),
  ('integrity.cases.recommend', 'Registrar recomendação de decisão'),
  ('integrity.cases.close', 'Concluir casos de Integridade'),
  ('integrity.cases.reopen', 'Reabrir casos de Integridade')
on conflict (key) do update set description=excluded.description;

alter table public.integrity_committees
  add column if not exists status text not null default 'active' check (status in ('active','inactive','archived')),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_membership_id uuid references public.memberships(id) on delete set null;
update public.integrity_committees set status=case when active then 'active' else 'inactive' end where status='active' and not active;

alter table public.integrity_routing_rules
  add column if not exists status text not null default 'active' check (status in ('active','inactive','archived')),
  add column if not exists is_fallback boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_membership_id uuid references public.memberships(id) on delete set null;
update public.integrity_routing_rules set status=case when active then 'active' else 'inactive' end where status='active' and not active;

alter table public.integrity_settings
  add column if not exists communication_policy jsonb not null default '{"allow_reporter_messages":true,"allow_case_messages":true}'::jsonb;

create unique index if not exists integrity_routing_single_fallback_idx
  on public.integrity_routing_rules(tenant_id)
  where is_fallback and status='active';
create index if not exists integrity_committee_members_membership_active_idx
  on public.integrity_committee_members(membership_id,committee_id) where active;

create or replace function public.route_integrity_case()
returns trigger language plpgsql security definer set search_path = public,pg_temp as $$
declare v_rule public.integrity_routing_rules%rowtype; v_settings public.integrity_settings%rowtype; v_assignee uuid; v_committee uuid;
begin
  select * into v_settings from public.integrity_settings where tenant_id=new.tenant_id;
  select rule.* into v_rule from public.integrity_routing_rules rule
  where rule.tenant_id=new.tenant_id and rule.active and rule.status='active'
    and (rule.category_id is null or rule.category_id=new.category_id)
    and (rule.unit_id is null or rule.unit_id=new.unit_id)
  order by rule.is_fallback asc,
    ((rule.category_id is not null)::int+(rule.unit_id is not null)::int) desc,
    rule.priority asc,rule.created_at asc limit 1;
  v_assignee:=coalesce(v_rule.assignee_membership_id,v_settings.default_assignee_membership_id);
  v_committee:=coalesce(v_rule.committee_id,v_settings.default_committee_id);
  if v_assignee is not null and exists(select 1 from public.memberships m where m.id=v_assignee and m.tenant_id=new.tenant_id and m.status='active') then
    update public.integrity_cases set owner_membership_id=v_assignee,committee_id=v_committee where id=new.id;
    insert into public.integrity_case_assignments(report_id,case_id,membership_id) values(new.report_id,new.id,v_assignee) on conflict do nothing;
    insert into public.integrity_case_events(report_id,case_id,event_type,to_status,metadata)
    values(new.report_id,new.id,'routed','received',jsonb_build_object('rule_id',v_rule.id,'assignee_membership_id',v_assignee,'committee_id',v_committee,'fallback',coalesce(v_rule.is_fallback,false)));
  elsif v_committee is not null then
    update public.integrity_cases set committee_id=v_committee where id=new.id;
    insert into public.integrity_case_events(report_id,case_id,event_type,to_status,metadata)
    values(new.report_id,new.id,'routed','received',jsonb_build_object('rule_id',v_rule.id,'committee_id',v_committee,'fallback',coalesce(v_rule.is_fallback,false)));
  end if;
  return new;
end $$;
revoke all on function public.route_integrity_case() from public,anon,authenticated;

create or replace function public.can_access_integrity_case(p_case_id uuid)
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
                or exists(
                  select 1 from public.integrity_committee_members cm
                  where cm.committee_id=c.committee_id and cm.membership_id=m.id and cm.active
                )
              )
          )
        )
      )
  );
$$;
revoke all on function public.can_access_integrity_case(uuid) from public, anon;
grant execute on function public.can_access_integrity_case(uuid) to authenticated, service_role;

drop policy if exists integrity_cases_read on public.integrity_cases;
create policy integrity_cases_read on public.integrity_cases for select to authenticated
using (public.can_access_integrity_case(id));

drop policy if exists integrity_attachments_read on public.integrity_attachments;
create policy integrity_attachments_read on public.integrity_attachments for select to authenticated
using (deleted_at is null and public.can_access_integrity_case(case_id));
drop policy if exists integrity_attachments_manage on public.integrity_attachments;
create policy integrity_attachments_manage on public.integrity_attachments for all to authenticated
using (public.has_permission((select c.tenant_id from public.integrity_cases c where c.id=case_id),'integrity.evidence.manage') and public.can_access_integrity_case(case_id))
with check (
  public.has_permission((select c.tenant_id from public.integrity_cases c where c.id=case_id),'integrity.evidence.manage')
  and public.can_access_integrity_case(case_id)
  and exists(select 1 from public.integrity_cases c join public.files f on f.id=file_id where c.id=case_id and f.tenant_id=c.tenant_id)
);

drop policy if exists integrity_tasks_access on public.integrity_case_tasks;
create policy integrity_tasks_read on public.integrity_case_tasks for select to authenticated
using (public.can_access_integrity_case(case_id));
create policy integrity_tasks_investigate on public.integrity_case_tasks for all to authenticated
using (public.can_access_integrity_case(case_id) and public.has_permission((select c.tenant_id from public.integrity_cases c where c.id=case_id),'integrity.cases.investigate'))
with check (public.can_access_integrity_case(case_id) and public.has_permission((select c.tenant_id from public.integrity_cases c where c.id=case_id),'integrity.cases.investigate'));

drop policy if exists integrity_identities_read on public.integrity_report_identities;
create policy integrity_identities_read on public.integrity_report_identities for select to authenticated
using (
  public.has_permission(tenant_id,'integrity.identity.read')
  and exists(select 1 from public.integrity_cases c where c.report_id=report_id and public.can_access_integrity_case(c.id))
);

drop policy if exists integrity_events_read on public.integrity_case_events;
create policy integrity_events_read on public.integrity_case_events for select to authenticated
using (case_id is not null and public.can_access_integrity_case(case_id));
drop policy if exists integrity_messages_read on public.integrity_report_messages;
create policy integrity_messages_read on public.integrity_report_messages for select to authenticated
using (exists(select 1 from public.integrity_cases c where c.report_id=report_id and public.can_access_integrity_case(c.id)));
drop policy if exists integrity_reports_read on public.integrity_reports;
create policy integrity_reports_read on public.integrity_reports for select to authenticated
using (exists(select 1 from public.integrity_cases c where c.report_id=id and public.can_access_integrity_case(c.id)));

insert into public.roles(tenant_id,key,name,description,is_system)
select t.id,'integrity_investigator','Investigador de Integridade','Acesso apenas a casos atribuídos ou vinculados ao seu comitê.',true
from public.tenants t on conflict (tenant_id,key) do nothing;
insert into public.roles(tenant_id,key,name,description,is_system)
select t.id,'integrity_compliance','Compliance de Integridade','Gestão tenant-scoped do módulo Integridade.',true
from public.tenants t on conflict (tenant_id,key) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key = any(array[
  'integrity.access','integrity.cases.read_assigned','integrity.cases.investigate','integrity.notes.create',
  'integrity.messages.send','integrity.evidence.manage','integrity.cases.recommend'
]) where r.key='integrity_investigator'
on conflict (role_id,permission_id) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key like 'integrity.%'
where r.key in ('tenant_admin','integrity_compliance')
on conflict (role_id,permission_id) do nothing;

create or replace function public.provision_integrity_system_roles()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_key text;
begin
  foreach v_key in array array['integrity_investigator','integrity_compliance'] loop
    insert into public.roles(tenant_id,key,name,description,is_system) values(
      new.id,v_key,
      case when v_key='integrity_investigator' then 'Investigador de Integridade' else 'Compliance de Integridade' end,
      case when v_key='integrity_investigator' then 'Acesso apenas a casos atribuídos ou vinculados ao seu comitê.' else 'Gestão tenant-scoped do módulo Integridade.' end,
      true
    ) on conflict (tenant_id,key) do nothing;
  end loop;
  insert into public.role_permissions(role_id,permission_id)
  select r.id,p.id from public.roles r join public.permissions p on
    (r.key='integrity_investigator' and p.key=any(array['integrity.access','integrity.cases.read_assigned','integrity.cases.investigate','integrity.notes.create','integrity.messages.send','integrity.evidence.manage','integrity.cases.recommend']))
    or (r.key='integrity_compliance' and p.key like 'integrity.%')
  where r.tenant_id=new.id on conflict (role_id,permission_id) do nothing;
  return new;
end; $$;
revoke all on function public.provision_integrity_system_roles() from public,anon,authenticated;
drop trigger if exists tenants_provision_integrity_system_roles on public.tenants;
create trigger tenants_provision_integrity_system_roles after insert on public.tenants
for each row execute function public.provision_integrity_system_roles();

commit;
