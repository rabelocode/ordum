-- Ordum Integridade Phase 4: additive operational core.
-- Existing reports remain immutable source records; cases become the treatment aggregate.

create table if not exists public.integrity_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  introduction text not null default 'Este canal recebe relatos de integridade com tratamento confidencial.',
  instructions text,
  allows_anonymous boolean not null default true,
  allows_identified boolean not null default false,
  default_sla_hours integer not null default 120 check (default_sla_hours between 1 and 8760),
  automatic_acknowledgement text not null default 'Seu relato foi recebido e será analisado.',
  branding jsonb not null default '{}'::jsonb,
  attachment_policy jsonb not null default '{"enabled":false,"max_files":0,"max_size_mb":0}'::jsonb,
  routing_rules jsonb not null default '[]'::jsonb,
  configured_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid references public.memberships(id) on delete set null
);

create table if not exists public.integrity_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.integrity_channel_categories (
  channel_id uuid not null references public.integrity_channels(id) on delete cascade,
  category_id uuid not null references public.integrity_categories(id) on delete cascade,
  sort_order integer not null default 0,
  active boolean not null default true,
  primary key (channel_id, category_id)
);

alter table public.integrity_channels
  add column if not exists public_title text,
  add column if not exists introduction text,
  add column if not exists instructions text,
  add column if not exists allows_identified boolean not null default false,
  add column if not exists branding jsonb not null default '{}'::jsonb,
  add column if not exists attachment_policy jsonb not null default '{}'::jsonb;

alter table public.integrity_categories
  add column if not exists description text,
  add column if not exists default_risk_level text not null default 'medium',
  add column if not exists sla_hours integer,
  add column if not exists color text;

alter table public.integrity_reports
  add column if not exists subject text,
  add column if not exists unit_id uuid references public.integrity_units(id) on delete set null,
  add column if not exists submitted_payload jsonb not null default '{}'::jsonb;

create table if not exists public.integrity_report_identities (
  report_id uuid primary key references public.integrity_reports(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text,
  email text,
  phone text,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.integrity_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_id uuid not null unique references public.integrity_reports(id) on delete restrict,
  protocol text not null unique,
  status text not null default 'received' check (status in ('received','triage','investigation','waiting_information','decision','closed','reopened','archived')),
  classification text,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  category_id uuid references public.integrity_categories(id) on delete set null,
  unit_id uuid references public.integrity_units(id) on delete set null,
  owner_membership_id uuid references public.memberships(id) on delete set null,
  team_label text,
  sla_due_at timestamptz,
  first_action_at timestamptz,
  closed_at timestamptz,
  conclusion text,
  measures_taken text,
  final_classification text,
  closure_reason text,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integrity_case_events add column if not exists case_id uuid references public.integrity_cases(id) on delete cascade;
alter table public.integrity_case_assignments add column if not exists case_id uuid references public.integrity_cases(id) on delete cascade;

create table if not exists public.integrity_case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.integrity_cases(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 200),
  description text,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_at timestamptz,
  assignee_membership_id uuid references public.memberships(id) on delete set null,
  created_by_membership_id uuid not null references public.memberships(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integrity_case_conflicts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.integrity_cases(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  active boolean not null default true,
  created_by_membership_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (case_id, membership_id)
);

insert into public.integrity_settings (tenant_id)
select distinct tenant_id from public.integrity_channels on conflict (tenant_id) do nothing;

insert into public.integrity_channel_categories (channel_id, category_id)
select channel.id, category.id
from public.integrity_channels channel
join public.integrity_categories category on category.tenant_id = channel.tenant_id
on conflict do nothing;

insert into public.integrity_cases (tenant_id, report_id, protocol, status, severity, category_id, unit_id, sla_due_at, created_at, updated_at)
select report.tenant_id, report.id, report.protocol,
  case report.status when 'in_review' then 'investigation' when 'waiting' then 'waiting_information' when 'resolved' then 'closed' else report.status end,
  coalesce(report.risk_level, category.default_risk_level, 'medium'), report.category_id, report.unit_id,
  report.created_at + make_interval(hours => coalesce(category.sla_hours, settings.default_sla_hours, 120)),
  report.created_at, report.updated_at
from public.integrity_reports report
left join public.integrity_categories category on category.id = report.category_id
left join public.integrity_settings settings on settings.tenant_id = report.tenant_id
on conflict (report_id) do nothing;

update public.integrity_case_events event set case_id = cases.id
from public.integrity_cases cases where event.report_id = cases.report_id and event.case_id is null;
update public.integrity_case_assignments assignment set case_id = cases.id
from public.integrity_cases cases where assignment.report_id = cases.report_id and assignment.case_id is null;

create index if not exists integrity_cases_tenant_status_created_idx on public.integrity_cases(tenant_id, status, created_at desc);
create index if not exists integrity_cases_tenant_sla_idx on public.integrity_cases(tenant_id, sla_due_at) where status not in ('closed','archived');
create index if not exists integrity_cases_owner_idx on public.integrity_cases(owner_membership_id, status) where owner_membership_id is not null;
create index if not exists integrity_case_events_case_created_idx on public.integrity_case_events(case_id, created_at desc);
create index if not exists integrity_case_tasks_case_status_idx on public.integrity_case_tasks(case_id, status, due_at);
create index if not exists integrity_units_tenant_active_idx on public.integrity_units(tenant_id, active, name);

alter table public.integrity_settings enable row level security;
alter table public.integrity_units enable row level security;
alter table public.integrity_channel_categories enable row level security;
alter table public.integrity_report_identities enable row level security;
alter table public.integrity_cases enable row level security;
alter table public.integrity_case_tasks enable row level security;
alter table public.integrity_case_conflicts enable row level security;

drop policy if exists integrity_settings_read on public.integrity_settings;
create policy integrity_settings_read on public.integrity_settings for select to authenticated
using (public.has_permission(tenant_id, 'integrity.settings.manage'));
drop policy if exists integrity_settings_manage on public.integrity_settings;
create policy integrity_settings_manage on public.integrity_settings for all to authenticated
using (public.has_permission(tenant_id, 'integrity.settings.manage'))
with check (public.has_permission(tenant_id, 'integrity.settings.manage'));

drop policy if exists integrity_units_read on public.integrity_units;
create policy integrity_units_read on public.integrity_units for select to authenticated
using (public.has_permission(tenant_id, 'integrity.cases.read') or public.has_permission(tenant_id, 'integrity.settings.manage'));
drop policy if exists integrity_units_manage on public.integrity_units;
create policy integrity_units_manage on public.integrity_units for all to authenticated
using (public.has_permission(tenant_id, 'integrity.settings.manage'))
with check (public.has_permission(tenant_id, 'integrity.settings.manage'));

drop policy if exists integrity_channel_categories_internal on public.integrity_channel_categories;
create policy integrity_channel_categories_internal on public.integrity_channel_categories for all to authenticated
using (exists(select 1 from public.integrity_channels channel where channel.id=channel_id and public.has_permission(channel.tenant_id,'integrity.settings.manage')))
with check (exists(select 1 from public.integrity_channels channel where channel.id=channel_id and public.has_permission(channel.tenant_id,'integrity.settings.manage')));

drop policy if exists integrity_cases_read on public.integrity_cases;
create policy integrity_cases_read on public.integrity_cases for select to authenticated
using (public.has_permission(tenant_id, 'integrity.cases.read'));
drop policy if exists integrity_cases_manage on public.integrity_cases;
create policy integrity_cases_manage on public.integrity_cases for all to authenticated
using (public.has_permission(tenant_id, 'integrity.cases.manage'))
with check (public.has_permission(tenant_id, 'integrity.cases.manage'));

drop policy if exists integrity_identities_read on public.integrity_report_identities;
create policy integrity_identities_read on public.integrity_report_identities for select to authenticated
using (public.has_permission(tenant_id, 'integrity.identity.read'));

drop policy if exists integrity_tasks_access on public.integrity_case_tasks;
create policy integrity_tasks_access on public.integrity_case_tasks for all to authenticated
using (exists(select 1 from public.integrity_cases cases where cases.id=case_id and public.has_permission(cases.tenant_id,'integrity.cases.manage')))
with check (exists(select 1 from public.integrity_cases cases where cases.id=case_id and public.has_permission(cases.tenant_id,'integrity.cases.manage')));

drop policy if exists integrity_conflicts_access on public.integrity_case_conflicts;
create policy integrity_conflicts_access on public.integrity_case_conflicts for all to authenticated
using (exists(select 1 from public.integrity_cases cases where cases.id=case_id and public.has_permission(cases.tenant_id,'integrity.cases.assign')))
with check (exists(select 1 from public.integrity_cases cases where cases.id=case_id and public.has_permission(cases.tenant_id,'integrity.cases.assign')));

insert into public.permissions(key, description)
values
 ('integrity.access','Acessar o módulo Integridade'),
 ('integrity.cases.assign','Atribuir responsáveis de Integridade'),
 ('integrity.messages.send','Enviar comunicações de Integridade'),
 ('integrity.evidence.manage','Gerenciar evidências de Integridade'),
 ('integrity.analytics.read','Consultar indicadores de Integridade'),
 ('integrity.identity.read','Consultar identidade protegida do relator')
on conflict (key) do nothing;

insert into public.role_permissions(role_id,permission_id)
select role.id, permission.id from public.roles role cross join public.permissions permission
where role.key='tenant_admin' and permission.key like 'integrity.%'
on conflict (role_id,permission_id) do nothing;

create or replace function public.integrity_case_event_immutable()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin raise exception 'integrity_case_events_are_immutable'; end; $$;
drop trigger if exists integrity_case_events_immutable on public.integrity_case_events;
create trigger integrity_case_events_immutable before update or delete on public.integrity_case_events
for each row execute function public.integrity_case_event_immutable();
revoke all on function public.integrity_case_event_immutable() from public, anon, authenticated;

create or replace function public.get_integrity_channel(p_channel_slug text)
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, extensions as $$
select jsonb_build_object(
 'channel_name',coalesce(channel.public_title,channel.name), 'introduction',coalesce(channel.introduction,settings.introduction),
 'instructions',coalesce(channel.instructions,settings.instructions), 'allows_anonymous',channel.allows_anonymous and settings.allows_anonymous,
 'allows_identified',channel.allows_identified and settings.allows_identified, 'branding',settings.branding || channel.branding,
 'attachment_policy',settings.attachment_policy || channel.attachment_policy,
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',category.id,'slug',category.slug,'name',category.name,'description',category.description) order by relation.sort_order,category.name)
   from public.integrity_channel_categories relation join public.integrity_categories category on category.id=relation.category_id
   where relation.channel_id=channel.id and relation.active and category.active),'[]'::jsonb),
 'units',coalesce((select jsonb_agg(jsonb_build_object('id',unit.id,'name',unit.name) order by unit.name) from public.integrity_units unit where unit.tenant_id=channel.tenant_id and unit.active),'[]'::jsonb)
)
from public.integrity_channels channel
join public.integrity_settings settings on settings.tenant_id=channel.tenant_id
where channel.public_slug=lower(trim(p_channel_slug))::extensions.citext and channel.active;
$$;

create or replace function public.submit_integrity_report_v2(
 p_channel_slug text, p_category_slug text, p_reporter_mode text, p_subject text,
 p_description text, p_occurred_at date default null, p_unit_id uuid default null, p_identity jsonb default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, extensions as $$
declare v_channel public.integrity_channels%rowtype; v_settings public.integrity_settings%rowtype;
 v_category public.integrity_categories%rowtype; v_report_id uuid; v_case_id uuid; v_protocol text; v_secret text; v_sla integer;
begin
 if char_length(trim(p_description)) < 20 then raise exception 'description_too_short'; end if;
 if p_reporter_mode not in ('anonymous','identified') then raise exception 'invalid_reporter_mode'; end if;
 select * into v_channel from public.integrity_channels where public_slug=lower(trim(p_channel_slug))::extensions.citext and active;
 if not found then raise exception 'channel_not_found'; end if;
 select * into v_settings from public.integrity_settings where tenant_id=v_channel.tenant_id;
 if p_reporter_mode='anonymous' and not (v_channel.allows_anonymous and v_settings.allows_anonymous) then raise exception 'anonymous_not_allowed'; end if;
 if p_reporter_mode='identified' and not (v_channel.allows_identified and v_settings.allows_identified) then raise exception 'identified_not_allowed'; end if;
 select category.* into v_category from public.integrity_categories category join public.integrity_channel_categories relation on relation.category_id=category.id
 where relation.channel_id=v_channel.id and relation.active and category.active and category.slug=lower(trim(p_category_slug))::extensions.citext;
 if v_category.id is null then raise exception 'category_not_found'; end if;
 if p_unit_id is not null and not exists(select 1 from public.integrity_units where id=p_unit_id and tenant_id=v_channel.tenant_id and active) then raise exception 'unit_not_found'; end if;
 v_protocol := 'ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)); v_secret := encode(gen_random_bytes(24),'hex');
 insert into public.integrity_reports(tenant_id,channel_id,category_id,unit_id,protocol,subject,description,occurred_at,reporter_mode)
 values(v_channel.tenant_id,v_channel.id,v_category.id,p_unit_id,v_protocol,nullif(trim(p_subject),''),trim(p_description),p_occurred_at,p_reporter_mode) returning id into v_report_id;
 insert into public.integrity_report_secrets(report_id,secret_hash) values(v_report_id,crypt(v_secret,gen_salt('bf')));
 if p_reporter_mode='identified' then
   if nullif(trim(p_identity->>'name'),'') is null then raise exception 'identity_name_required'; end if;
   insert into public.integrity_report_identities(report_id,tenant_id,name,email,phone) values(v_report_id,v_channel.tenant_id,trim(p_identity->>'name'),nullif(trim(p_identity->>'email'),''),nullif(trim(p_identity->>'phone'),''));
 end if;
 v_sla := coalesce(v_category.sla_hours,v_settings.default_sla_hours,120);
 insert into public.integrity_cases(tenant_id,report_id,protocol,category_id,unit_id,severity,sla_due_at)
 values(v_channel.tenant_id,v_report_id,v_protocol,v_category.id,p_unit_id,v_category.default_risk_level,now()+make_interval(hours=>v_sla)) returning id into v_case_id;
 insert into public.integrity_case_events(report_id,case_id,event_type,to_status,metadata) values(v_report_id,v_case_id,'report_received','received',jsonb_build_object('reporter_mode',p_reporter_mode));
 insert into public.integrity_report_messages(report_id,author_type,body,visible_to_reporter) values(v_report_id,'system',v_settings.automatic_acknowledgement,true);
 return jsonb_build_object('protocol',v_protocol,'access_secret',v_secret);
end; $$;

create or replace function public.read_integrity_report_v2(p_protocol text,p_access_secret text)
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, extensions as $$
select jsonb_build_object('protocol',report.protocol,'status',cases.status,'created_at',report.created_at,'closed_at',cases.closed_at,
 'messages',coalesce((select jsonb_agg(jsonb_build_object('id',message.id,'author_type',message.author_type,'body',message.body,'created_at',message.created_at) order by message.created_at)
 from public.integrity_report_messages message where message.report_id=report.id and message.visible_to_reporter),'[]'::jsonb))
from public.integrity_reports report join public.integrity_report_secrets secret on secret.report_id=report.id
join public.integrity_cases cases on cases.report_id=report.id
where report.protocol=upper(trim(p_protocol)) and secret.secret_hash=crypt(p_access_secret,secret.secret_hash);
$$;

revoke all on function public.get_integrity_channel(text) from public;
revoke all on function public.submit_integrity_report_v2(text,text,text,text,text,date,uuid,jsonb) from public;
revoke all on function public.read_integrity_report_v2(text,text) from public;
grant execute on function public.get_integrity_channel(text) to anon, authenticated, service_role;
grant execute on function public.submit_integrity_report_v2(text,text,text,text,text,date,uuid,jsonb) to anon, authenticated, service_role;
grant execute on function public.read_integrity_report_v2(text,text) to anon, authenticated, service_role;

grant select,insert,update,delete on public.integrity_settings,public.integrity_units,public.integrity_channel_categories,public.integrity_cases,public.integrity_case_tasks,public.integrity_case_conflicts to authenticated;
grant select on public.integrity_report_identities to authenticated;
grant select,insert,update,delete on public.integrity_settings,public.integrity_units,public.integrity_channel_categories,public.integrity_report_identities,public.integrity_cases,public.integrity_case_tasks,public.integrity_case_conflicts to service_role;
