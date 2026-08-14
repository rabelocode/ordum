begin;

create or replace function public.submit_integrity_report_v2(
 p_channel_slug text,
 p_category_slug text,
 p_reporter_mode text,
 p_subject text,
 p_description text,
 p_occurred_at date default null::date,
 p_unit_id uuid default null::uuid,
 p_identity jsonb default null::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
 v_channel public.integrity_channels%rowtype;
 v_settings public.integrity_settings%rowtype;
 v_category public.integrity_categories%rowtype;
 v_report_id uuid;
 v_case_id uuid;
 v_protocol text;
 v_secret text;
 v_sla integer;
 v_attempt integer;
 v_random integer;
 v_random_bytes bytea;
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

 for v_attempt in 1..20 loop
   v_random_bytes := gen_random_bytes(3);
   v_random := (
     get_byte(v_random_bytes,0)::integer * 65536
     + get_byte(v_random_bytes,1)::integer * 256
     + get_byte(v_random_bytes,2)::integer
   ) % 1000000;
   v_protocol := 'INT-' || to_char(timezone('America/Sao_Paulo', now()), 'YYYY') || '-' || lpad(v_random::text, 6, '0');
   begin
     insert into public.integrity_reports(tenant_id,channel_id,category_id,unit_id,protocol,subject,description,occurred_at,reporter_mode)
     values(v_channel.tenant_id,v_channel.id,v_category.id,p_unit_id,v_protocol,nullif(trim(p_subject),''),trim(p_description),p_occurred_at,p_reporter_mode)
     returning id into v_report_id;
     exit;
   exception when unique_violation then
     v_report_id := null;
   end;
 end loop;
 if v_report_id is null then raise exception 'protocol_generation_failed'; end if;

 v_secret := encode(gen_random_bytes(24),'hex');
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
end; $function$;

revoke all on function public.submit_integrity_report_v2(text,text,text,text,text,date,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.submit_integrity_report_v2(text,text,text,text,text,date,uuid,jsonb) to service_role;

commit;

