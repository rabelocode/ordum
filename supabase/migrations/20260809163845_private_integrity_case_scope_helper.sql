begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.can_access_integrity_case(uuid) set schema private;
revoke all on function private.can_access_integrity_case(uuid) from public, anon;
grant execute on function private.can_access_integrity_case(uuid) to authenticated, service_role;

commit;
