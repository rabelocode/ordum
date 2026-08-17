do $$
declare
  v_actor_user_id uuid;
  v_template_id uuid;
begin
  select pm.user_id
    into v_actor_user_id
  from public.platform_members pm
  left join public.platform_roles pr on pr.id = pm.role_id
  where pm.status = 'active'
    and pm.user_id is not null
  order by case when pr.key = 'admin' then 0 else 1 end, pm.created_at
  limit 1;

  if v_actor_user_id is null then
    raise exception 'active_platform_member_required_for_default_onboarding_template';
  end if;

  select id
    into v_template_id
  from public.onboarding_templates
  where active = true
    and plan_id is null
    and solution_id is null
    and name = 'Onboarding padrão de cliente'
  order by version desc
  limit 1;

  if v_template_id is null then
    insert into public.onboarding_templates (
      name,
      plan_id,
      solution_id,
      version,
      active,
      created_by_user_id
    ) values (
      'Onboarding padrão de cliente',
      null,
      null,
      1,
      true,
      v_actor_user_id
    )
    returning id into v_template_id;
  end if;

  insert into public.onboarding_template_steps (
    template_id,
    step_key,
    title,
    description,
    position,
    default_due_days,
    requires_evidence,
    dependency_step_keys
  ) values
    (v_template_id, 'confirm_customer_data', 'Confirmar dados do cliente', 'Validar dados cadastrais, contatos e responsáveis informados no contrato.', 0, 1, false, array[]::text[]),
    (v_template_id, 'confirm_contract_and_plan', 'Confirmar contrato, plano e módulos', 'Conferir contrato ativo, plano selecionado, limites e solutions provisionadas.', 1, 1, false, array['confirm_customer_data']::text[]),
    (v_template_id, 'configure_tenant', 'Configurar ambiente do cliente', 'Revisar slug, domínio, configurações iniciais e responsáveis administrativos.', 2, 3, true, array['confirm_contract_and_plan']::text[]),
    (v_template_id, 'invite_customer_admin', 'Convidar administrador do cliente', 'Criar ou vincular o primeiro administrador autorizado do tenant.', 3, 4, true, array['configure_tenant']::text[]),
    (v_template_id, 'configure_solutions', 'Configurar módulos contratados', 'Executar as configurações iniciais específicas das solutions contratadas.', 4, 7, true, array['configure_tenant']::text[]),
    (v_template_id, 'customer_training', 'Realizar treinamento inicial', 'Orientar responsáveis do cliente sobre acesso, operação e suporte.', 5, 10, true, array['invite_customer_admin','configure_solutions']::text[]),
    (v_template_id, 'go_live_validation', 'Validar entrada em operação', 'Confirmar acessos, configurações e aceite operacional para início do uso.', 6, 14, true, array['customer_training']::text[])
  on conflict (template_id, step_key) do update set
    title = excluded.title,
    description = excluded.description,
    position = excluded.position,
    default_due_days = excluded.default_due_days,
    requires_evidence = excluded.requires_evidence,
    dependency_step_keys = excluded.dependency_step_keys;
end
$$;
