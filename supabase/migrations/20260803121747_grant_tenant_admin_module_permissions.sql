-- A tenant administrator is tenant-scoped, never a platform administrator.
-- Existing module permissions are granted so that RLS remains authoritative.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  p.key like 'integrity.%'
  or p.key like 'people.%'
  or p.key like 'talents.%'
)
where r.key = 'tenant_admin'
on conflict (role_id, permission_id) do nothing;
