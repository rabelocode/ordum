import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const APP_URL = 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app';

async function runE2ETest() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SECRET_KEY precisa estar definida nas variáveis de ambiente.');
  }
  console.log('--- INICIANDO TESTE FUNCIONAL REAL E2E DE CLIENTE / COBRANÇA ---');
  console.log(`URL do Preview: ${APP_URL}`);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 0. Obter ou criar role admin
  let { data: adminRole } = await db.from('platform_roles').select('id').eq('key', 'admin').maybeSingle();
  if (!adminRole) {
    const { data: insertedRole } = await db.from('platform_roles').insert({ key: 'admin', name: 'Administrador' }).select('id').single();
    adminRole = insertedRole;
  }

  const testEmail = `e2e_admin_${Date.now()}@ordum-test.internal`;
  const password = `Ordum#Pass${Date.now()}`;

  let adminUser: any = null;
  let approverUser: any = null;
  let createdLeadId: string | null = null;
  let createdProposalId: string | null = null;
  let createdContractId: string | null = null;
  let createdTenantId: string | null = null;

  try {
    // 1. Criar Usuário no Auth do Supabase
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email: testEmail,
      password,
      email_confirm: true,
      user_metadata: { name: 'E2E Test Admin' },
    });
    if (authErr) throw new Error('Falha ao criar auth user: ' + authErr.message);
    adminUser = authUser.user;
    console.log(`✓ Usuário Auth E2E criado: ${testEmail} (${adminUser.id})`);

    // 2. Vincular na platform_members com role admin
    const { data: member, error: memberErr } = await db.from('platform_members').insert({
      user_id: adminUser.id,
      role_id: adminRole.id,
      relationship_type: 'partner',
      status: 'active',
    }).select().single();
    if (memberErr) throw new Error('Falha ao criar platform_member: ' + memberErr.message);
    console.log(`✓ Membro da Plataforma vinculado (role: admin, id: ${member.id})`);

    // 3. Autenticar usuário para obter Access Token real (Requisito 10)
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password,
    });
    if (signInErr || !signInData.session) throw new Error('Falha ao autenticar E2E user: ' + signInErr?.message);
    const userToken = signInData.session.access_token;
    console.log('✓ Token de acesso de Usuário E2E obtido com sucesso.');

    const apiFetch = async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${APP_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
          ...options.headers,
        },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    // 4. Criar Lead Fixture
    const { data: lead, error: leadErr } = await db.from('marketing_leads').insert({
      name: 'Cliente E2E Sandbox LTDA',
      email: testEmail,
      company: 'Cliente E2E Sandbox LTDA',
      phone: '11999998888',
      status: 'new',
      priority: 'normal',
    }).select().single();
    if (leadErr) throw new Error('Falha ao criar lead fixture: ' + leadErr.message);
    createdLeadId = lead.id;
    console.log(`✓ Lead Fixture criado: #${createdLeadId}`);

    // Atribuir equipe ao lead
    const { data: teams } = await db.from('platform_teams').select('id').limit(1);
    if (teams && teams.length > 0) {
      await db.from('platform_lead_assignments').insert({
        lead_id: createdLeadId,
        team_id: teams[0].id,
        assignment_type: 'manual',
      });
    }

    // 5. Transicionar Lead para contacted via API
    const transLead = await apiFetch(`/api/admin/leads/${createdLeadId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ to_status: 'contacted', reason: 'Contato E2E comercial realizado' }),
    });
    console.log(`✓ POST /api/admin/leads/:id/transition → HTTP ${transLead.status}`);
    if (transLead.status !== 200) throw new Error(`Falha na transição do lead: ${JSON.stringify(transLead.body)}`);

    // 6. Criar Proposta com plano ativo
    const { data: plans } = await db.from('billing_plans').select('id, billing_plan_prices(cycle, billing_type)').eq('active', true).limit(1);
    if (!plans || plans.length === 0) throw new Error('Nenhum plano ativo no banco');
    const plan = plans[0];
    const price = plan.billing_plan_prices[0] || { cycle: 'monthly', billing_type: 'CREDIT_CARD' };

    const createProp = await apiFetch('/api/admin/commercial/proposals', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: createdLeadId,
        plan_id: plan.id,
        cycle: price.cycle,
        billing_type: price.billing_type,
        notes: 'Proposta comercial E2E Sandbox',
      }),
    });
    console.log(`✓ POST /api/admin/commercial/proposals → HTTP ${createProp.status}`);
    if (createProp.status !== 201) throw new Error(`Falha ao criar proposta: ${JSON.stringify(createProp.body)}`);
    createdProposalId = createProp.body.id;

    // Confirmar que os itens do plano foram incluídos na proposta
    const { data: propItems } = await db.from('commercial_proposal_items').select('*').eq('proposal_id', createdProposalId);
    console.log(`✓ Itens da proposta confirmados: ${propItems?.length || 0} módulo(s) vinculados.`);
    if (!propItems || propItems.length === 0) throw new Error('Proposta criada sem itens!');

    // Criar Usuário Aprovador separado para aprovação por quatro olhos (Requisito de alçada)
    const approverEmail = `e2e_approver_${Date.now()}@ordum-test.internal`;
    const { data: approverAuth, error: appErr } = await db.auth.admin.createUser({
      email: approverEmail, password, email_confirm: true, user_metadata: { name: 'E2E Approver' }
    });
    if (appErr) throw new Error('Falha ao criar approver user: ' + appErr.message);
    approverUser = approverAuth.user;

    const { data: appMember } = await db.from('platform_members').insert({
      user_id: approverUser.id, role_id: adminRole.id, relationship_type: 'partner', status: 'active',
    }).select().single();

    const { data: appSignIn } = await client.auth.signInWithPassword({ email: approverEmail, password });
    const approverToken = appSignIn.session?.access_token;

    const approverApiFetch = async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${APP_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${approverToken}`, ...options.headers },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    // 7. Aprovar Proposta com segundo aprovador
    const appProp = await approverApiFetch(`/api/admin/commercial/proposals/${createdProposalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approval_notes: 'Justificativa de aprovação E2E por 4 olhos' }),
    });
    console.log(`✓ POST /api/admin/commercial/proposals/:id/approve → HTTP ${appProp.status}`);
    if (appProp.status !== 200) throw new Error(`Falha ao aprovar proposta: ${JSON.stringify(appProp.body)}`);

    // 8. Registrar Aceite da Proposta
    const accProp = await apiFetch(`/api/admin/commercial/proposals/${createdProposalId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Comprovante de aceite enviado pelo cliente' }),
    });
    console.log(`✓ POST /api/admin/commercial/proposals/:id/accept → HTTP ${accProp.status}`);
    if (accProp.status !== 200) throw new Error(`Falha ao aceitar proposta: ${JSON.stringify(accProp.body)}`);

    // 9. Gerar Contrato com CPF/CNPJ de teste válido (11144477735)
    const validCpf = '11144477735';
    const createContract = await apiFetch(`/api/admin/commercial/proposals/${createdProposalId}/create-contract`, {
      method: 'POST',
      body: JSON.stringify({ customer_tax_id: validCpf }),
    });
    console.log(`✓ POST /api/admin/commercial/proposals/:id/create-contract → HTTP ${createContract.status}`);
    if (createContract.status !== 201) throw new Error(`Falha ao criar contrato: ${JSON.stringify(createContract.body)}`);
    createdContractId = createContract.body.id;

    // Confirmar itens do contrato
    const { data: cntItems } = await db.from('commercial_contract_items').select('*').eq('contract_id', createdContractId);
    console.log(`✓ Itens do contrato confirmados: ${cntItems?.length || 0} módulo(s) vinculados.`);
    if (!cntItems || cntItems.length === 0) throw new Error('Contrato criado sem itens!');

    // 10. Aprovar Contrato com segundo aprovador
    const appCnt = await approverApiFetch(`/api/admin/commercial/contracts/${createdContractId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Aprovação comercial do contrato E2E por 4 olhos' }),
    });
    console.log(`✓ POST /api/admin/commercial/contracts/:id/approve → HTTP ${appCnt.status}`);
    if (appCnt.status !== 200) throw new Error(`Falha ao aprovar contrato: ${JSON.stringify(appCnt.body)}`);

    // 11. Iniciar Assinatura Sandbox (start-billing)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const startBilling = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/start-billing`, {
      method: 'POST',
      body: JSON.stringify({ next_due_date: tomorrow }),
    });
    console.log(`✓ POST /api/admin/commercial/contracts/:id/start-billing → HTTP ${startBilling.status}`);
    if (startBilling.status !== 201) throw new Error(`Falha ao iniciar cobrança: ${JSON.stringify(startBilling.body)}`);

    const subId = startBilling.body.provider_subscription_id;
    console.log(`✓ Assinatura no Asaas Sandbox gerada: ID ${subId}`);

    // 12. Repetir chamada start-billing para validar idempotência (Requisito 11)
    const repeatBilling = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/start-billing`, {
      method: 'POST',
      body: JSON.stringify({ next_due_date: tomorrow }),
    });
    console.log(`✓ Repetição do start-billing → HTTP ${repeatBilling.status}`);
    if (repeatBilling.status !== 200) throw new Error('Repetição do start-billing deveria retornar HTTP 200');
    if (repeatBilling.body.provider_subscription_id !== subId) throw new Error('Erro de idempotência: segunda assinatura foi gerada no Asaas!');
    console.log('✓ Idempotência confirmada: nenhuma assinatura duplicada foi criada no Asaas.');

    // 13. Simular Pagamento Sandbox
    const mockPayment = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/mock-sandbox-payment`, {
      method: 'POST',
    });
    console.log(`✓ POST /api/admin/commercial/contracts/:id/mock-sandbox-payment → HTTP ${mockPayment.status}`);
    if (mockPayment.status !== 200 || !mockPayment.body.simulated) throw new Error(`Falha ao simular pagamento: ${JSON.stringify(mockPayment.body)}`);

    // 14. Confirmar que o Contrato está ACTIVE e Tenant provisionado
    const { data: updatedContract } = await db.from('commercial_contracts').select('*').eq('id', createdContractId).single();
    console.log(`✓ Estado final do contrato: '${updatedContract.status}' (Tenant ID: ${updatedContract.tenant_id})`);
    if (updatedContract.status !== 'active') throw new Error('Contrato não avançou para o status active!');
    createdTenantId = updatedContract.tenant_id;

    // 15. Confirmar Solução Ativa no Tenant
    const { data: tenantSolutions } = await db.from('tenant_solutions').select('*, solutions(name)').eq('tenant_id', createdTenantId);
    console.log(`✓ Soluções ativas no tenant: ${tenantSolutions?.map((s: any) => s.solutions?.name).join(', ')}`);
    if (!tenantSolutions || tenantSolutions.length === 0) throw new Error('Nenhuma solução foi ativada no tenant!');

    // 16. Confirmar Onboarding Iniciado
    const { data: onboardingRun } = await db.from('tenant_onboarding_runs').select('*').eq('tenant_id', createdTenantId).maybeSingle();
    console.log(`✓ Processo de Onboarding iniciado: Run #${onboardingRun?.id || 'OK'}`);
    if (!onboardingRun) throw new Error('O onboarding do tenant não foi iniciado!');

    console.log('--- TESTE E2E REAL CONCLUÍDO COM SUCESSO TOTAL ---');
  } finally {
    // Requisito 10: Limpeza rigorosa no try/finally
    console.log('Iniciando limpeza dos registros de teste...');
    if (createdContractId) {
      await db.from('billing_subscriptions').delete().eq('contract_id', createdContractId);
      await db.from('billing_customers').delete().eq('contract_id', createdContractId);
      await db.from('commercial_contract_items').delete().eq('contract_id', createdContractId);
      await db.from('commercial_contracts').delete().eq('id', createdContractId);
    }
    if (createdProposalId) {
      await db.from('commercial_proposal_items').delete().eq('proposal_id', createdProposalId);
      await db.from('commercial_proposals').delete().eq('id', createdProposalId);
    }
    if (createdLeadId) {
      await db.from('platform_lead_assignments').delete().eq('lead_id', createdLeadId);
      await db.from('marketing_leads').delete().eq('id', createdLeadId);
    }
    if (createdTenantId) {
      await db.from('tenant_solutions').delete().eq('tenant_id', createdTenantId);
      await db.from('tenants').delete().eq('id', createdTenantId);
    }
    if (adminUser?.id) {
      await db.from('platform_members').delete().eq('user_id', adminUser.id);
      await db.auth.admin.deleteUser(adminUser.id);
    }
    if (approverUser?.id) {
      await db.from('platform_members').delete().eq('user_id', approverUser.id);
      await db.auth.admin.deleteUser(approverUser.id);
    }
    console.log('✓ Limpeza concluída.');
  }
}

runE2ETest().catch(err => {
  console.error('ERRO FATAL NO TESTE E2E:', err);
  process.exit(1);
});
