-- Run against a disposable database or as one transaction through the SQL API.
-- Every fixture is synthetic and rolled back, including auth users.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000001','authenticated','authenticated','tenant-admin@pilot-fixture.invalid','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000002','authenticated','authenticated','manager@pilot-fixture.invalid','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000003','authenticated','authenticated','employee@pilot-fixture.invalid','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000004','authenticated','authenticated','recruiter@pilot-fixture.invalid','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000005','authenticated','authenticated','compliance@pilot-fixture.invalid','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000006','authenticated','authenticated','outsider@pilot-fixture.invalid','',now(),'{}','{}',now(),now(),'','','','');

select set_config('pilot.tenant_a', public.provision_tenant('Pilot Fixture Trial', 'pilot-fixture-trial-20260803', 'f1000000-0000-4000-8000-000000000001')::text, false);
select set_config('pilot.tenant_b', public.provision_tenant('Pilot Fixture External', 'pilot-fixture-external-20260803', 'f1000000-0000-4000-8000-000000000006')::text, false);

select public.admin_add_membership(current_setting('pilot.tenant_a')::uuid, 'f1000000-0000-4000-8000-000000000002', 'geral', 'manager', array['manager']);
select public.admin_add_membership(current_setting('pilot.tenant_a')::uuid, 'f1000000-0000-4000-8000-000000000003', 'geral', 'analyst', array['employee']);
select public.admin_add_membership(current_setting('pilot.tenant_a')::uuid, 'f1000000-0000-4000-8000-000000000004', 'talentos', 'analyst', array['recruiter']);
select public.admin_add_membership(current_setting('pilot.tenant_a')::uuid, 'f1000000-0000-4000-8000-000000000005', 'compliance', 'manager', array['compliance']);

update public.tenants
set status = 'trial', trial_ends_at = now() + interval '14 days'
where id = current_setting('pilot.tenant_a')::uuid;

insert into public.people_request_types (id, tenant_id, name)
values ('f2000000-0000-4000-8000-000000000001', current_setting('pilot.tenant_a')::uuid, 'Solicitação fixture');

insert into public.billing_webhook_events (provider_event_id, event_type, payload)
values ('evt-pilot-fixture-duplicate', 'PAYMENT_CONFIRMED', '{"event":"PAYMENT_CONFIRMED"}'::jsonb);
do $$
begin
  begin
    insert into public.billing_webhook_events (provider_event_id, event_type, payload)
    values ('evt-pilot-fixture-duplicate', 'PAYMENT_CONFIRMED', '{"event":"PAYMENT_CONFIRMED"}'::jsonb);
    raise exception 'duplicate webhook was accepted';
  exception when unique_violation then
    null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
do $$
begin
  if not public.is_tenant_member(current_setting('pilot.tenant_a')::uuid) then raise exception 'employee lost own trial tenant'; end if;
  if public.is_tenant_member(current_setting('pilot.tenant_b')::uuid) then raise exception 'cross-tenant membership leaked'; end if;
  if (select count(*) from public.tenants where status = 'trial') <> 1 then raise exception 'trial tenant is not visible to its employee'; end if;
  if public.has_permission(current_setting('pilot.tenant_a')::uuid, 'people.requests.manage') then raise exception 'employee can manage requests'; end if;

  insert into public.people_requests (id, tenant_id, requester_membership_id, request_type_id, subject)
  select 'f3000000-0000-4000-8000-000000000001', current_setting('pilot.tenant_a')::uuid, membership.id,
         'f2000000-0000-4000-8000-000000000001', 'Pedido de fixture'
  from public.memberships membership
  where membership.user_id = auth.uid() and membership.tenant_id = current_setting('pilot.tenant_a')::uuid;
  if (select count(*) from public.people_requests) <> 1 then raise exception 'employee cannot read own request'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
do $$
begin
  if not public.has_permission(current_setting('pilot.tenant_a')::uuid, 'people.team.read') then raise exception 'manager role missing team read'; end if;
  if public.has_permission(current_setting('pilot.tenant_a')::uuid, 'people.requests.manage') then raise exception 'manager gained tenant-wide request management'; end if;
  if exists (select 1 from public.tenants where id = current_setting('pilot.tenant_b')::uuid) then raise exception 'manager can read external tenant'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000004', true);
do $$
begin
  if not public.has_permission(current_setting('pilot.tenant_a')::uuid, 'talents.jobs.manage') then raise exception 'recruiter cannot manage jobs'; end if;
  insert into public.talent_jobs (id, tenant_id, title, slug, description, created_by_membership_id)
  select 'f4000000-0000-4000-8000-000000000001', current_setting('pilot.tenant_a')::uuid,
         'Vaga fixture', 'vaga-fixture', 'Descrição fixture', membership.id
  from public.memberships membership where membership.user_id = auth.uid();
  if (select count(*) from public.talent_jobs where id = 'f4000000-0000-4000-8000-000000000001') <> 1 then raise exception 'recruiter cannot read own job'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000005', true);
do $$
begin
  if not public.has_permission(current_setting('pilot.tenant_a')::uuid, 'integrity.cases.manage') then raise exception 'integrity owner lost case access'; end if;
  if public.has_permission(current_setting('pilot.tenant_b')::uuid, 'integrity.cases.read') then raise exception 'integrity permission crossed tenants'; end if;
end $$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
do $$
begin
  if not public.has_permission(current_setting('pilot.tenant_a')::uuid, 'people.requests.manage') then raise exception 'new tenant_admin missing People permission'; end if;
  if not public.has_permission(current_setting('pilot.tenant_a')::uuid, 'talents.candidates.manage') then raise exception 'new tenant_admin missing Talentos permission'; end if;
  if not public.has_permission(current_setting('pilot.tenant_a')::uuid, 'integrity.cases.manage') then raise exception 'new tenant_admin missing Integridade permission'; end if;
  update public.people_requests set status = 'resolved', resolved_at = now() where id = 'f3000000-0000-4000-8000-000000000001';
  if (select status from public.people_requests where id = 'f3000000-0000-4000-8000-000000000001') <> 'resolved' then raise exception 'tenant_admin cannot update request status'; end if;
end $$;

reset role;
rollback;
