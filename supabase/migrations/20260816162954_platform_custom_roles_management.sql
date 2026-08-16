alter table public.platform_roles
  add column if not exists system_managed boolean not null default false;

update public.platform_roles
set system_managed = true
where key in ('admin', 'manager', 'sales');

create or replace function app_private.platform_role_catalog(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
declare
  v_allowed boolean;
  v_result jsonb;
begin
  v_allowed := app_private.has_platform_permission(p_actor_user_id, 'platform.access.simulate')
    or app_private.has_platform_permission(p_actor_user_id, 'platform.staff.manage');

  if not coalesce(v_allowed, false) then
    raise exception 'platform_role_catalog_forbidden';
  end if;

  select coalesce(jsonb_agg(role_row order by (role_row->>'rank')::integer desc, role_row->>'name'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', r.id,
      'key', r.key,
      'name', r.name,
      'description', r.description,
      'rank', r.rank,
      'active', r.active,
      'system_managed', r.system_managed,
      'member_count', (select count(*) from public.platform_members m where m.role_id = r.id),
      'active_member_count', (select count(*) from public.platform_members m where m.role_id = r.id and m.status = 'active'),
      'permission_keys', coalesce((
        select jsonb_agg(p.key order by p.category, p.key)
        from public.platform_role_permissions rp
        join public.platform_permissions p on p.id = rp.permission_id
        where rp.role_id = r.id
      ), '[]'::jsonb)
    ) as role_row
    from public.platform_roles r
    where r.active = true
  ) roles;

  return v_result;
end;
$function$;

create or replace function app_private.manage_platform_custom_role(
  p_actor_user_id uuid,
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permission_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'extensions'
as $function$
declare
  v_role public.platform_roles%rowtype;
  v_role_id uuid;
  v_permission_keys text[];
  v_permission_ids uuid[];
  v_unknown_keys text[];
  v_before jsonb;
  v_after jsonb;
  v_is_create boolean := p_role_id is null;
begin
  if not coalesce(app_private.has_platform_permission(p_actor_user_id, 'platform.staff.manage'), false) then
    raise exception 'platform_role_manage_forbidden';
  end if;

  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 80 then
    raise exception 'platform_role_invalid_name';
  end if;

  select array_agg(distinct key order by key)
  into v_permission_keys
  from unnest(coalesce(p_permission_keys, array[]::text[]) || array['platform.access']) as key;

  select array_agg(key order by key)
  into v_unknown_keys
  from unnest(v_permission_keys) as key
  where not exists (
    select 1 from public.platform_permissions p where p.key = key
  );

  if coalesce(array_length(v_unknown_keys, 1), 0) > 0 then
    raise exception 'platform_role_unknown_permissions:%', array_to_string(v_unknown_keys, ',');
  end if;

  select array_agg(id order by key)
  into v_permission_ids
  from public.platform_permissions
  where key = any(v_permission_keys);

  if v_is_create then
    insert into public.platform_roles(key, name, description, rank, active, system_managed)
    values (
      'custom_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      10,
      true,
      false
    )
    returning * into v_role;
    v_role_id := v_role.id;
    v_before := null;
  else
    select * into v_role
    from public.platform_roles
    where id = p_role_id
    for update;

    if not found then
      raise exception 'platform_role_not_found';
    end if;

    if v_role.system_managed or v_role.key in ('admin','manager','sales') then
      raise exception 'platform_system_role_protected';
    end if;

    v_role_id := v_role.id;
    v_before := jsonb_build_object(
      'name', v_role.name,
      'description', v_role.description,
      'permission_keys', coalesce((
        select jsonb_agg(p.key order by p.key)
        from public.platform_role_permissions rp
        join public.platform_permissions p on p.id = rp.permission_id
        where rp.role_id = v_role.id
      ), '[]'::jsonb)
    );

    update public.platform_roles
    set name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        updated_at = now()
    where id = v_role_id
    returning * into v_role;
  end if;

  delete from public.platform_role_permissions where role_id = v_role_id;

  insert into public.platform_role_permissions(role_id, permission_id)
  select v_role_id, permission_id
  from unnest(v_permission_ids) as permission_id
  on conflict do nothing;

  v_after := jsonb_build_object(
    'name', v_role.name,
    'description', v_role.description,
    'permission_keys', to_jsonb(v_permission_keys)
  );

  insert into public.platform_audit_logs(
    actor_user_id, action, entity_type, entity_id, severity, metadata
  ) values (
    p_actor_user_id,
    case when v_is_create then 'platform.role.created' else 'platform.role.updated' end,
    'platform_roles',
    v_role_id::text,
    'warning',
    jsonb_build_object('before', v_before, 'after', v_after, 'system_managed', false)
  );

  return jsonb_build_object(
    'id', v_role_id,
    'key', v_role.key,
    'name', v_role.name,
    'description', v_role.description,
    'rank', v_role.rank,
    'active', v_role.active,
    'system_managed', false,
    'permission_keys', to_jsonb(v_permission_keys)
  );
end;
$function$;

revoke all on function app_private.platform_role_catalog(uuid) from public, anon, authenticated;
revoke all on function app_private.manage_platform_custom_role(uuid, uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function app_private.platform_role_catalog(uuid) to service_role;
grant execute on function app_private.manage_platform_custom_role(uuid, uuid, text, text, text[]) to service_role;
