begin;

insert into public.permissions(key, description) values
  ('integrity.audit.read','Consultar a trilha de governança do Integridade'),
  ('integrity.exports.execute','Exportar listagens autorizadas do Integridade'),
  ('integrity.case_report.export','Exportar relatório individual autorizado do caso')
on conflict (key) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.key like 'integrity.%'
where r.key in ('tenant_admin','integrity_compliance')
on conflict (role_id,permission_id) do nothing;

alter table public.integrity_settings
  add column if not exists channel_tested_at timestamptz,
  add column if not exists channel_published_at timestamptz;

create unique index if not exists onboarding_templates_solution_version_uidx
  on public.onboarding_templates(solution_id,version)
  where plan_id is null and solution_id is not null;

create or replace function public.ensure_integrity_onboarding_template(p_actor_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solution_id uuid;
  v_template_id uuid;
begin
  if p_actor_user_id is null or not exists(select 1 from auth.users where id=p_actor_user_id) then
    raise exception 'valid_actor_required';
  end if;
  select id into v_solution_id from public.solutions where key='integridade' limit 1;
  if v_solution_id is null then raise exception 'integrity_solution_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended('integrity_onboarding_template', 41));
  select id into v_template_id
  from public.onboarding_templates
  where solution_id=v_solution_id and plan_id is null and version=1
  limit 1;

  if v_template_id is null then
    insert into public.onboarding_templates(name,solution_id,version,active,created_by_user_id)
    values('Onboarding Ordum Integridade',v_solution_id,1,true,p_actor_user_id)
    returning id into v_template_id;
  else
    update public.onboarding_templates set active=true,updated_at=now() where id=v_template_id;
  end if;

  insert into public.onboarding_template_steps(
    template_id,step_key,title,description,position,default_due_days,requires_evidence,dependency_step_keys
  ) values
    (v_template_id,'organization_data','Confirmar dados da organização','Revisar dados e identidade pública da organização.',0,2,false,'{}'),
    (v_template_id,'integrity_owners','Definir responsáveis','Definir compliance e responsáveis operacionais.',1,3,false,'{organization_data}'),
    (v_template_id,'integrity_units','Cadastrar unidades e setores','Cadastrar o escopo organizacional do canal.',2,4,false,'{organization_data}'),
    (v_template_id,'integrity_categories','Configurar categorias','Definir categorias e severidade padrão.',3,4,false,'{organization_data}'),
    (v_template_id,'integrity_committee','Criar comitê','Criar comitê e indicar seus membros.',4,5,false,'{integrity_owners}'),
    (v_template_id,'integrity_investigators','Configurar investigadores','Atribuir papéis e revisar permissões.',5,5,false,'{integrity_owners}'),
    (v_template_id,'integrity_anonymity','Definir política de anonimato','Escolher os modos de identificação permitidos.',6,5,false,'{organization_data}'),
    (v_template_id,'integrity_sla','Definir SLAs','Definir primeira resposta e prazo de tratamento.',7,6,false,'{integrity_categories}'),
    (v_template_id,'integrity_communication','Configurar comunicação','Definir mensagens e complementações permitidas.',8,6,false,'{integrity_anonymity}'),
    (v_template_id,'integrity_routing','Configurar roteamento','Criar regras por categoria/unidade e fallback.',9,7,false,'{integrity_committee,integrity_categories,integrity_units}'),
    (v_template_id,'integrity_channel','Criar canal','Configurar textos, slug e branding básico.',10,7,false,'{integrity_anonymity}'),
    (v_template_id,'integrity_channel_test','Testar canal','Executar teste funcional do canal e acompanhamento.',11,8,true,'{integrity_channel,integrity_routing}'),
    (v_template_id,'integrity_final_check','Validar checklist final','Revisar configuração, papéis, SLA e roteamento.',12,9,false,'{integrity_channel_test}'),
    (v_template_id,'integrity_publish','Publicar canal','Ativar o canal para entrada em operação.',13,10,false,'{integrity_final_check}')
  on conflict (template_id,step_key) do update set
    title=excluded.title,description=excluded.description,position=excluded.position,
    default_due_days=excluded.default_due_days,requires_evidence=excluded.requires_evidence,
    dependency_step_keys=excluded.dependency_step_keys;
  return v_template_id;
end;
$$;

revoke all on function public.ensure_integrity_onboarding_template(uuid) from public, anon, authenticated;
grant execute on function public.ensure_integrity_onboarding_template(uuid) to service_role;

create or replace function public.initialize_integrity_solution_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status='active' and exists(select 1 from public.solutions s where s.id=new.solution_id and s.key='integridade') then
    insert into public.integrity_settings(tenant_id) values(new.tenant_id)
    on conflict (tenant_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.initialize_integrity_solution_settings() from public, anon, authenticated;
drop trigger if exists tenant_solutions_initialize_integrity on public.tenant_solutions;
create trigger tenant_solutions_initialize_integrity
after insert or update of status on public.tenant_solutions
for each row execute function public.initialize_integrity_solution_settings();

insert into public.integrity_settings(tenant_id)
select ts.tenant_id
from public.tenant_solutions ts
join public.solutions s on s.id=ts.solution_id and s.key='integridade'
where ts.status='active'
on conflict (tenant_id) do nothing;

commit;
