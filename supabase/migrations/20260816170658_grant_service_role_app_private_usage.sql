grant usage on schema app_private to service_role;

revoke usage on schema app_private from public, anon, authenticated;

revoke all on function public.platform_role_catalog(uuid)
from public, anon, authenticated;

grant execute on function public.platform_role_catalog(uuid)
to service_role;

revoke all on function public.manage_platform_custom_role(uuid, uuid, text, text, text[])
from public, anon, authenticated;

grant execute on function public.manage_platform_custom_role(uuid, uuid, text, text, text[])
to service_role;
