-- Defense in depth for legacy SECURITY DEFINER functions.
-- Every function keeps its existing owner, body and grants; only deterministic
-- schema resolution changes. Browser-exposed public RPCs remain intentionally
-- available to the roles already granted in the baseline schema.

alter function public.admin_add_membership(uuid, uuid, text, text, text[])
  set search_path = pg_catalog, public;
alter function public.can_read_file(uuid)
  set search_path = pg_catalog, public;
alter function public.can_read_membership(uuid)
  set search_path = pg_catalog, public;
alter function public.can_read_profile(uuid)
  set search_path = pg_catalog, public;
alter function public.can_read_storage_path(text, text)
  set search_path = pg_catalog, public;
alter function public.current_membership_id(uuid)
  set search_path = pg_catalog, public;
alter function public.handle_new_user()
  set search_path = pg_catalog, public;
alter function public.has_permission(uuid, text)
  set search_path = pg_catalog, public;
alter function public.is_own_membership(uuid)
  set search_path = pg_catalog, public;
alter function public.is_tenant_member(uuid)
  set search_path = pg_catalog, public;
alter function public.provision_tenant(text, text, uuid)
  set search_path = pg_catalog, public;

alter function public.get_integrity_form(text)
  set search_path = pg_catalog, public, extensions;
alter function public.post_integrity_reporter_message(text, text, text)
  set search_path = pg_catalog, public, extensions;
alter function public.read_integrity_report(text, text)
  set search_path = pg_catalog, public, extensions;
alter function public.submit_integrity_report(text, text, text, date)
  set search_path = pg_catalog, public, extensions;
alter function public.submit_marketing_lead(text, text, text, text, text, text[], text, boolean, text, jsonb)
  set search_path = pg_catalog, public, extensions;
alter function public.submit_talent_application(uuid, text, text, text, text, text, boolean)
  set search_path = pg_catalog, public, extensions;

-- New tenants must receive the same tenant-scoped module permissions that the
-- previous backfill granted to existing tenant administrators.
create or replace function public.grant_new_tenant_admin_module_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.key = 'tenant_admin' then
    insert into public.role_permissions (role_id, permission_id)
    select new.id, permission.id
    from public.permissions permission
    where permission.key like 'integrity.%'
       or permission.key like 'people.%'
       or permission.key like 'talents.%'
    on conflict (role_id, permission_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.grant_new_tenant_admin_module_permissions() from public, anon, authenticated;
grant execute on function public.grant_new_tenant_admin_module_permissions() to service_role;

drop trigger if exists grant_new_tenant_admin_module_permissions on public.roles;
create trigger grant_new_tenant_admin_module_permissions
after insert on public.roles
for each row
when (new.key = 'tenant_admin')
execute function public.grant_new_tenant_admin_module_permissions();
