create or replace function public.platform_role_catalog(p_actor_user_id uuid)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
  select app_private.platform_role_catalog(p_actor_user_id);
$function$;

create or replace function public.manage_platform_custom_role(
  p_actor_user_id uuid,
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permission_keys text[]
)
returns jsonb
language sql
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
  select app_private.manage_platform_custom_role(
    p_actor_user_id,
    p_role_id,
    p_name,
    p_description,
    p_permission_keys
  );
$function$;

revoke all on function public.platform_role_catalog(uuid) from public, anon, authenticated;
revoke all on function public.manage_platform_custom_role(uuid, uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.platform_role_catalog(uuid) to service_role;
grant execute on function public.manage_platform_custom_role(uuid, uuid, text, text, text[]) to service_role;
