begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ordum-integrity', 'ordum-integrity', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain','audio/mpeg','audio/wav','video/mp4']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Integridade uses server-side uploads and short-lived signed URLs only.
drop policy if exists storage_authenticated_insert on storage.objects;
create policy storage_authenticated_insert on storage.objects for insert to authenticated
with check (
  bucket_id = any(array['ordum-private','ordum-talentos','ordum-public'])
  and public.is_tenant_member(public.safe_uuid((storage.foldername(name))[1]))
);
drop policy if exists storage_private_read on storage.objects;
create policy storage_private_read on storage.objects for select to authenticated
using (
  bucket_id = any(array['ordum-private','ordum-talentos'])
  and public.can_read_storage_path(bucket_id, name)
);

alter table public.files
  add column if not exists case_id uuid references public.integrity_cases(id) on delete set null,
  add column if not exists validation_status text not null default 'pending' check (validation_status in ('pending','validated','rejected','quarantined')),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_membership_id uuid references public.memberships(id) on delete set null,
  add column if not exists delete_reason text;

alter table public.integrity_attachments
  add column if not exists case_id uuid references public.integrity_cases(id) on delete cascade,
  add column if not exists visible_to_reporter boolean not null default false,
  add column if not exists evidence_kind text not null default 'document' check (evidence_kind in ('document','image','audio','video','other')),
  add column if not exists description text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_membership_id uuid references public.memberships(id) on delete set null,
  add column if not exists delete_reason text;

update public.integrity_attachments attachment set case_id = cases.id
from public.integrity_cases cases
where cases.report_id = attachment.report_id and attachment.case_id is null;

alter table public.integrity_case_tasks
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  add column if not exists completed_by_membership_id uuid references public.memberships(id) on delete set null,
  add column if not exists reopened_at timestamptz;

alter table public.integrity_cases
  add column if not exists first_response_due_at timestamptz,
  add column if not exists treatment_due_at timestamptz,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by_membership_id uuid references public.memberships(id) on delete set null,
  add column if not exists internal_justification text,
  add column if not exists reporter_outcome text;

update public.integrity_cases set
  first_response_due_at = coalesce(first_response_due_at, sla_due_at),
  treatment_due_at = coalesce(treatment_due_at, created_at + interval '30 days')
where first_response_due_at is null or treatment_due_at is null;

create table if not exists public.integrity_committees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.integrity_committee_members (
  committee_id uuid not null references public.integrity_committees(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role text not null default 'member' check (role in ('chair','member','observer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (committee_id, membership_id)
);

create table if not exists public.integrity_routing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  category_id uuid references public.integrity_categories(id) on delete cascade,
  unit_id uuid references public.integrity_units(id) on delete cascade,
  assignee_membership_id uuid references public.memberships(id) on delete cascade,
  committee_id uuid references public.integrity_committees(id) on delete cascade,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assignee_membership_id is not null or committee_id is not null)
);

alter table public.integrity_settings
  add column if not exists default_assignee_membership_id uuid references public.memberships(id) on delete set null,
  add column if not exists default_committee_id uuid references public.integrity_committees(id) on delete set null,
  add column if not exists treatment_sla_hours integer not null default 720 check (treatment_sla_hours between 1 and 17520);

alter table public.integrity_cases
  add column if not exists committee_id uuid references public.integrity_committees(id) on delete set null;

create table if not exists public.integrity_public_rate_limits (
  key_hash text not null,
  action text not null check (action in ('submit','track','message','upload')),
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  blocked_until timestamptz,
  expires_at timestamptz not null,
  primary key (key_hash, action)
);
alter table public.integrity_public_rate_limits enable row level security;
revoke all on public.integrity_public_rate_limits from public, anon, authenticated;
grant select,insert,update,delete on public.integrity_public_rate_limits to service_role;

create index if not exists integrity_attachments_case_created_idx on public.integrity_attachments(case_id, created_at desc) where deleted_at is null;
create index if not exists integrity_files_case_idx on public.files(case_id, created_at desc) where deleted_at is null;
create index if not exists integrity_tasks_due_idx on public.integrity_case_tasks(case_id, status, due_at) where status in ('open','in_progress');
create index if not exists integrity_cases_sla_operational_idx on public.integrity_cases(tenant_id, first_response_due_at, treatment_due_at) where status not in ('closed','archived');
create index if not exists integrity_routing_match_idx on public.integrity_routing_rules(tenant_id, category_id, unit_id, priority) where active;
create index if not exists integrity_rate_limits_expiry_idx on public.integrity_public_rate_limits(expires_at);

alter table public.integrity_committees enable row level security;
alter table public.integrity_committee_members enable row level security;
alter table public.integrity_routing_rules enable row level security;

drop policy if exists integrity_committees_read on public.integrity_committees;
create policy integrity_committees_read on public.integrity_committees for select to authenticated
using (public.has_permission(tenant_id,'integrity.cases.read') or public.has_permission(tenant_id,'integrity.settings.manage'));
drop policy if exists integrity_committees_manage on public.integrity_committees;
create policy integrity_committees_manage on public.integrity_committees for all to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'))
with check (public.has_permission(tenant_id,'integrity.settings.manage'));
drop policy if exists integrity_committee_members_read on public.integrity_committee_members;
create policy integrity_committee_members_read on public.integrity_committee_members for select to authenticated
using (exists(select 1 from public.integrity_committees c where c.id=committee_id and (public.has_permission(c.tenant_id,'integrity.cases.read') or public.has_permission(c.tenant_id,'integrity.settings.manage'))));
drop policy if exists integrity_committee_members_manage on public.integrity_committee_members;
create policy integrity_committee_members_manage on public.integrity_committee_members for all to authenticated
using (exists(select 1 from public.integrity_committees c where c.id=committee_id and public.has_permission(c.tenant_id,'integrity.settings.manage')))
with check (exists(select 1 from public.integrity_committees c where c.id=committee_id and public.has_permission(c.tenant_id,'integrity.settings.manage')));
drop policy if exists integrity_routing_read on public.integrity_routing_rules;
create policy integrity_routing_read on public.integrity_routing_rules for select to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'));
drop policy if exists integrity_routing_manage on public.integrity_routing_rules;
create policy integrity_routing_manage on public.integrity_routing_rules for all to authenticated
using (public.has_permission(tenant_id,'integrity.settings.manage'))
with check (public.has_permission(tenant_id,'integrity.settings.manage'));

drop policy if exists integrity_attachments_read on public.integrity_attachments;
drop policy if exists integrity_attachments_manage on public.integrity_attachments;
create policy integrity_attachments_read on public.integrity_attachments for select to authenticated
using (deleted_at is null and exists(select 1 from public.integrity_cases c where c.id=case_id and public.has_permission(c.tenant_id,'integrity.cases.read')));
create policy integrity_attachments_manage on public.integrity_attachments for all to authenticated
using (exists(select 1 from public.integrity_cases c where c.id=case_id and public.has_permission(c.tenant_id,'integrity.evidence.manage')))
with check (exists(select 1 from public.integrity_cases c join public.files f on f.id=file_id where c.id=case_id and f.tenant_id=c.tenant_id and public.has_permission(c.tenant_id,'integrity.evidence.manage')));

grant select,insert,update,delete on public.integrity_committees,public.integrity_committee_members,public.integrity_routing_rules to authenticated, service_role;
grant select,insert,update,delete on public.integrity_public_rate_limits to service_role;

create or replace function public.check_integrity_public_rate_limit(
  p_key_hash text, p_action text, p_limit integer, p_window_seconds integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.integrity_public_rate_limits%rowtype; v_now timestamptz := clock_timestamp();
begin
  if length(p_key_hash) <> 64 or p_action not in ('submit','track','message','upload') or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_arguments';
  end if;
  insert into public.integrity_public_rate_limits(key_hash,action,window_started_at,request_count,expires_at)
  values(p_key_hash,p_action,v_now,1,v_now+make_interval(secs=>p_window_seconds))
  on conflict(key_hash,action) do update set
    window_started_at = case when public.integrity_public_rate_limits.expires_at <= v_now then v_now else public.integrity_public_rate_limits.window_started_at end,
    request_count = case when public.integrity_public_rate_limits.expires_at <= v_now then 1 else public.integrity_public_rate_limits.request_count+1 end,
    expires_at = case when public.integrity_public_rate_limits.expires_at <= v_now then v_now+make_interval(secs=>p_window_seconds) else public.integrity_public_rate_limits.expires_at end,
    blocked_until = case when public.integrity_public_rate_limits.expires_at > v_now and public.integrity_public_rate_limits.request_count+1 > p_limit then public.integrity_public_rate_limits.expires_at else null end
  returning * into v_row;
  return jsonb_build_object('allowed',v_row.request_count<=p_limit,'remaining',greatest(p_limit-v_row.request_count,0),'retry_after_seconds',greatest(ceil(extract(epoch from (v_row.expires_at-v_now)))::integer,0));
end $$;
revoke all on function public.check_integrity_public_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.check_integrity_public_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.authorize_integrity_reporter(p_protocol text,p_access_secret text)
returns table(report_id uuid,case_id uuid,tenant_id uuid,status text)
language sql stable security definer set search_path = pg_catalog,public,extensions as $$
  select r.id,c.id,r.tenant_id,c.status
  from public.integrity_reports r
  join public.integrity_report_secrets s on s.report_id=r.id
  join public.integrity_cases c on c.report_id=r.id
  where r.protocol=upper(trim(p_protocol)) and s.secret_hash=crypt(p_access_secret,s.secret_hash)
$$;
revoke all on function public.authorize_integrity_reporter(text,text) from public,anon,authenticated;
grant execute on function public.authorize_integrity_reporter(text,text) to service_role;

create or replace function public.route_integrity_case()
returns trigger language plpgsql security definer set search_path = public,pg_temp as $$
declare v_rule public.integrity_routing_rules%rowtype; v_settings public.integrity_settings%rowtype; v_assignee uuid; v_committee uuid;
begin
  select * into v_settings from public.integrity_settings where tenant_id=new.tenant_id;
  select rule.* into v_rule from public.integrity_routing_rules rule
  where rule.tenant_id=new.tenant_id and rule.active
    and (rule.category_id is null or rule.category_id=new.category_id)
    and (rule.unit_id is null or rule.unit_id=new.unit_id)
  order by ((rule.category_id is not null)::int+(rule.unit_id is not null)::int) desc,rule.priority asc,rule.created_at asc limit 1;
  v_assignee:=coalesce(v_rule.assignee_membership_id,v_settings.default_assignee_membership_id);
  v_committee:=coalesce(v_rule.committee_id,v_settings.default_committee_id);
  if v_assignee is not null and exists(select 1 from public.memberships m where m.id=v_assignee and m.tenant_id=new.tenant_id and m.status='active')
     and not exists(select 1 from public.integrity_case_conflicts x where x.case_id=new.id and x.membership_id=v_assignee and x.active) then
    update public.integrity_cases set owner_membership_id=v_assignee,committee_id=v_committee where id=new.id;
    insert into public.integrity_case_assignments(report_id,case_id,membership_id) values(new.report_id,new.id,v_assignee) on conflict do nothing;
    insert into public.integrity_case_events(report_id,case_id,event_type,to_status,metadata)
    values(new.report_id,new.id,'routed','received',jsonb_build_object('rule_id',v_rule.id,'assignee_membership_id',v_assignee,'committee_id',v_committee));
  elsif v_committee is not null then
    update public.integrity_cases set committee_id=v_committee where id=new.id;
    insert into public.integrity_case_events(report_id,case_id,event_type,to_status,metadata)
    values(new.report_id,new.id,'routed','received',jsonb_build_object('rule_id',v_rule.id,'committee_id',v_committee));
  end if;
  return new;
end $$;
drop trigger if exists integrity_case_auto_route on public.integrity_cases;
create trigger integrity_case_auto_route after insert on public.integrity_cases for each row execute function public.route_integrity_case();
revoke all on function public.route_integrity_case() from public,anon,authenticated;

create or replace function public.decide_and_close_integrity_case(
  p_case_id uuid,p_tenant_id uuid,p_actor_membership_id uuid,p_final_classification text,
  p_conclusion text,p_measures_taken text,p_internal_justification text,p_reporter_outcome text,p_expected_lock_version integer
) returns table(status text,lock_version integer) language plpgsql security definer set search_path=public,pg_temp as $$
declare v_case public.integrity_cases%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if not exists(select 1 from public.memberships m where m.id=p_actor_membership_id and m.tenant_id=p_tenant_id and m.status='active') then raise exception 'actor_not_authorized' using errcode='42501'; end if;
  select * into v_case from public.integrity_cases where id=p_case_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'case_not_found' using errcode='P0002'; end if;
  if v_case.lock_version<>p_expected_lock_version then raise exception 'case_version_conflict' using errcode='40001'; end if;
  if v_case.status<>'decision' then raise exception 'case_not_ready_for_decision' using errcode='22023'; end if;
  if least(length(trim(p_final_classification)),length(trim(p_conclusion)),length(trim(p_measures_taken)),length(trim(p_internal_justification)))<3 then raise exception 'decision_fields_required' using errcode='22023'; end if;
  update public.integrity_cases c set status='closed',final_classification=trim(p_final_classification),conclusion=trim(p_conclusion),measures_taken=trim(p_measures_taken),internal_justification=trim(p_internal_justification),reporter_outcome=nullif(trim(coalesce(p_reporter_outcome,'')),''),decided_at=v_now,decided_by_membership_id=p_actor_membership_id,closed_at=v_now,closure_reason=trim(p_internal_justification),lock_version=c.lock_version+1,updated_at=v_now where c.id=p_case_id returning c.status,c.lock_version into status,lock_version;
  insert into public.integrity_case_events(report_id,case_id,event_type,from_status,to_status,note,actor_membership_id,metadata) values(v_case.report_id,p_case_id,'decision_recorded',v_case.status,'closed','Decisão interna registrada.',p_actor_membership_id,jsonb_build_object('final_classification',trim(p_final_classification)));
  if nullif(trim(coalesce(p_reporter_outcome,'')),'') is not null then insert into public.integrity_report_messages(report_id,author_type,body,visible_to_reporter,author_membership_id) values(v_case.report_id,'case_manager',trim(p_reporter_outcome),true,p_actor_membership_id); end if;
  return next;
end $$;
revoke all on function public.decide_and_close_integrity_case(uuid,uuid,uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.decide_and_close_integrity_case(uuid,uuid,uuid,text,text,text,text,text,integer) to service_role;

commit;
