begin;

insert into public.permissions(key, description) values
  ('integrity.deployment.manage','Gerenciar a implantação e publicação do Integridade'),
  ('integrity.pending.read','Consultar a fila operacional do Integridade'),
  ('integrity.executive.export','Exportar relatório executivo agregado do Integridade')
on conflict (key) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('tenant_admin','integrity_compliance')
  and p.key in ('integrity.deployment.manage','integrity.pending.read','integrity.executive.export')
on conflict (role_id,permission_id) do nothing;

alter table public.integrity_units
  add column if not exists is_headquarters boolean not null default false,
  add column if not exists responsible_membership_id uuid references public.memberships(id) on delete set null;
create unique index if not exists integrity_units_one_headquarters_idx
  on public.integrity_units(tenant_id) where is_headquarters and active;

create table if not exists public.integrity_departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.integrity_units(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  code text,
  responsible_membership_id uuid references public.memberships(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,unit_id,name)
);

alter table public.integrity_reports add column if not exists department_id uuid references public.integrity_departments(id) on delete set null;
alter table public.integrity_cases add column if not exists department_id uuid references public.integrity_departments(id) on delete set null;

alter table public.integrity_channels
  add column if not exists privacy_notice text,
  add column if not exists confirmation_message text;

alter table public.integrity_settings
  add column if not exists alert_lead_hours integer not null default 24 check (alert_lead_hours between 1 and 720),
  add column if not exists stale_case_hours integer not null default 168 check (stale_case_hours between 24 and 8760),
  add column if not exists deployment_state text not null default 'not_started'
    check (deployment_state in ('not_started','incomplete','ready_for_test','ready_for_publish','published')),
  add column if not exists deployment_updated_at timestamptz;

create table if not exists public.integrity_custom_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel_id uuid references public.integrity_channels(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  label text not null check (char_length(trim(label)) between 2 and 120),
  help_text text,
  field_type text not null check (field_type in ('short_text','long_text','single_select','multi_select','date','boolean')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options)='array'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,channel_id,field_key)
);

create table if not exists public.integrity_report_custom_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  report_id uuid not null references public.integrity_reports(id) on delete cascade,
  field_id uuid not null references public.integrity_custom_fields(id) on delete restrict,
  text_value text,
  text_array_value text[],
  date_value date,
  boolean_value boolean,
  created_at timestamptz not null default now(),
  unique(report_id,field_id),
  check (num_nonnulls(text_value,text_array_value,date_value,boolean_value)=1)
);

alter table public.integrity_routing_rules
  add column if not exists department_id uuid references public.integrity_departments(id) on delete cascade,
  add column if not exists severity text check (severity is null or severity in ('low','medium','high','critical')),
  add column if not exists reporter_mode text check (reporter_mode is null or reporter_mode in ('anonymous','identified')),
  add column if not exists requires_conflict boolean,
  add column if not exists target_sla_hours integer check (target_sla_hours is null or target_sla_hours between 1 and 17520),
  add column if not exists target_priority text check (target_priority is null or target_priority in ('low','normal','high','urgent')),
  add column if not exists escalation_committee_id uuid references public.integrity_committees(id) on delete set null,
  add column if not exists escalation_membership_id uuid references public.memberships(id) on delete set null;

create table if not exists public.integrity_routing_rule_collaborators (
  rule_id uuid not null references public.integrity_routing_rules(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(rule_id,membership_id)
);

-- Atribuições automáticas são atores de sistema e, por isso, não possuem membership humano.
alter table public.integrity_case_collaborators alter column added_by_membership_id drop not null;

alter table public.integrity_notifications drop constraint if exists integrity_notifications_notification_type_check;
alter table public.integrity_notifications add constraint integrity_notifications_notification_type_check check (notification_type in (
  'new_case','case_assigned','sla_due_soon','sla_overdue','new_task','task_overdue',
  'external_message','conflict_detected','recommendation_ready','decision_pending','case_reopened',
  'case_unassigned','case_stale','retention_due'
));

create table if not exists public.integrity_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  notification_id uuid references public.integrity_notifications(id) on delete cascade,
  case_id uuid references public.integrity_cases(id) on delete cascade,
  recipient_membership_id uuid references public.memberships(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','whatsapp','webhook')),
  event_type text not null,
  safe_subject text not null check (char_length(trim(safe_subject)) between 2 and 160),
  safe_preview text,
  status text not null default 'pending' check (status in ('pending','delivered','failed','disabled')),
  dedupe_key text not null unique,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.integrity_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  status text not null check (status in ('running','completed','failed')),
  stats jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.integrity_retention_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid not null references public.integrity_cases(id) on delete cascade,
  reviewed_by_membership_id uuid not null references public.memberships(id) on delete restrict,
  decision text not null check (decision in ('archive','keep_active','defer')),
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  defer_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists integrity_departments_tenant_unit_active_idx on public.integrity_departments(tenant_id,unit_id,active,name);
create index if not exists integrity_cases_department_created_idx on public.integrity_cases(tenant_id,department_id,created_at desc);
create index if not exists integrity_custom_fields_channel_active_idx on public.integrity_custom_fields(tenant_id,channel_id,active,sort_order);
create index if not exists integrity_custom_values_report_idx on public.integrity_report_custom_values(report_id,field_id);
create index if not exists integrity_routing_phase4g_match_idx on public.integrity_routing_rules(tenant_id,category_id,unit_id,department_id,severity,reporter_mode,priority) where active and status='active';
create index if not exists integrity_outbox_pending_idx on public.integrity_notification_outbox(status,available_at) where status in ('pending','failed');
create index if not exists integrity_cases_operational_pending_idx on public.integrity_cases(tenant_id,status,updated_at,first_response_due_at,treatment_due_at) where status not in ('closed','archived');
create index if not exists integrity_retention_reviews_case_idx on public.integrity_retention_reviews(case_id,created_at desc);

alter table public.integrity_departments enable row level security;
alter table public.integrity_custom_fields enable row level security;
alter table public.integrity_report_custom_values enable row level security;
alter table public.integrity_routing_rule_collaborators enable row level security;
alter table public.integrity_notification_outbox enable row level security;
alter table public.integrity_scheduler_runs enable row level security;
alter table public.integrity_retention_reviews enable row level security;

create policy integrity_departments_read on public.integrity_departments for select to authenticated
using (public.has_permission(tenant_id,'integrity.access'));
create policy integrity_departments_manage on public.integrity_departments for all to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'))
with check (public.has_permission(tenant_id,'integrity.settings.manage'));
create policy integrity_custom_fields_read on public.integrity_custom_fields for select to authenticated
using (public.has_permission(tenant_id,'integrity.access'));
create policy integrity_custom_fields_manage on public.integrity_custom_fields for all to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'))
with check (public.has_permission(tenant_id,'integrity.settings.manage'));
create policy integrity_custom_values_read on public.integrity_report_custom_values for select to authenticated
using (exists(select 1 from public.integrity_cases c where c.report_id=report_id and private.can_access_integrity_case(c.id)));
create policy integrity_routing_collaborators_read on public.integrity_routing_rule_collaborators for select to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'));
create policy integrity_routing_collaborators_manage on public.integrity_routing_rule_collaborators for all to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'))
with check (public.has_permission(tenant_id,'integrity.settings.manage'));
create policy integrity_retention_reviews_read on public.integrity_retention_reviews for select to authenticated
using (public.has_permission(tenant_id,'integrity.retention.manage') and private.can_access_integrity_case(case_id));
create policy integrity_retention_reviews_manage on public.integrity_retention_reviews for insert to authenticated
with check (public.has_permission(tenant_id,'integrity.retention.manage') and private.can_access_integrity_case(case_id));

revoke all on public.integrity_notification_outbox, public.integrity_scheduler_runs from public,anon,authenticated;
grant select,insert,update,delete on public.integrity_notification_outbox, public.integrity_scheduler_runs to service_role;
grant select,insert,update,delete on public.integrity_departments, public.integrity_custom_fields,
  public.integrity_report_custom_values, public.integrity_routing_rule_collaborators,
  public.integrity_retention_reviews to authenticated,service_role;

commit;
