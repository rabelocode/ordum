import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const APP_URL = process.env.APP_URL || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

async function runE2ETest() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SECRET_KEY precisa estar definida nas variáveis de ambiente.');
  }

  const runId = `e2e_run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  console.log(`=== INICIANDO FLUXO E2E AUTENTICADO DE COBRANÇA (RunId: ${runId}) ===`);
  console.log(`URL do Preview: ${APP_URL}`);

  // -------------------------------------------------------------------------
  // 1. Preflight Diagnostics (Ponto 5)
  // -------------------------------------------------------------------------
  console.log('--- ETAPA 1: PREFLIGHT DIAGNOSTICS ---');
  const diagRes = await fetch(`${APP_URL}/api/admin/billing/diagnostics`);
  const diag = await diagRes.json().catch(() => ({}));
  console.log('Resposta sanitizada de /api/admin/billing/diagnostics:', JSON.stringify(diag, null, 2));

  if (!diagRes.ok) {
    throw new Error(`Preflight falhou HTTP ${diagRes.status}: ${JSON.stringify(diag)}`);
  }

  if (
    diag.enabled !== true ||
    diag.configured !== true ||
    diag.environment !== 'sandbox' ||
    diag.webhookUrlConfigured !== true ||
    diag.sandboxMockAvailable !== true
  ) {
    throw new Error(`ABORTANDO TESTE E2E: Diagnóstico de billing não atende os requisitos de preflight!\n${JSON.stringify(diag, null, 2)}`);
  }
  console.log('✓ Preflight aprovado com sucesso!');

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 0. Obter ou criar role admin
  let { data: adminRole } = await db.from('platform_roles').select('id').eq('key', 'admin').maybeSingle();
  if (!adminRole) {
    const { data: insertedRole } = await db.from('platform_roles').insert({ key: 'admin', name: 'Administrador' }).select('id').single();
    adminRole = insertedRole;
  }

  const testEmail = `${runId}_admin@ordum-test.internal`;
  const approverEmail = `${runId}_approver@ordum-test.internal`;
  const password = `Ordum#Pass${Date.now()}`;

  let adminUser: any = null;
  let approverUser: any = null;
  let createdLeadId: string | null = null;
  let createdProposalId: string | null = null;
  let createdContractId: string | null = null;
  let createdTenantId: string | null = null;
  let createdAsaasCustomerId: string | null = null;
  let createdAsaasSubId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // 2. Setup Usuários E2E (Criador + Aprovador por 4 olhos)
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 2: SETUP USUÁRIOS E2E ---');
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email: testEmail, password, email_confirm: true, user_metadata: { name: 'E2E Test Admin', runId },
    });
    if (authErr) throw new Error('Falha ao criar auth user criador: ' + authErr.message);
    adminUser = authUser.user;

    await db.from('platform_members').insert({
      user_id: adminUser.id, role_id: adminRole.id, relationship_type: 'partner', status: 'active',
    });

    const { data: appAuth, error: appErr } = await db.auth.admin.createUser({
      email: approverEmail, password, email_confirm: true, user_metadata: { name: 'E2E Test Approver', runId },
    });
    if (appErr) throw new Error('Falha ao criar auth user aprovador: ' + appErr.message);
    approverUser = appAuth.user;

    await db.from('platform_members').insert({
      user_id: approverUser.id, role_id: adminRole.id, relationship_type: 'partner', status: 'active',
    });

    // Autenticar tokens reais de usuário
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: creatorSession } = await client.auth.signInWithPassword({ email: testEmail, password });
    const { data: approverSession } = await client.auth.signInWithPassword({ email: approverEmail, password });

    const creatorToken = creatorSession.session?.access_token;
    const approverToken = approverSession.session?.access_token;

    if (!creatorToken || !approverToken) throw new Error('Falha ao obter tokens JWT E2E');

    const creatorApi = async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${APP_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}`, ...options.headers },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    const approverApi = async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${APP_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${approverToken}`, ...options.headers },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    console.log('✓ Usuários E2E criados e autenticados.');

    // -------------------------------------------------------------------------
    // 3. Lead Fixture & Transição
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 3: LEAD & TRANSIÇÃO ---');
    const { data: lead, error: leadErr } = await db.from('marketing_leads').insert({
      name: `Cliente E2E (${runId})`,
      email: testEmail,
      company: `Empresa ${runId} LTDA`,
      phone: '11999998888',
      status: 'new',
      priority: 'normal',
    }).select().single();
    if (leadErr) throw new Error('Falha ao criar lead fixture: ' + leadErr.message);
    createdLeadId = lead.id;

    const { data: teams } = await db.from('platform_teams').select('id').limit(1);
    if (teams && teams.length > 0) {
      await db.from('platform_lead_assignments').insert({
        lead_id: createdLeadId, team_id: teams[0].id, assignment_type: 'manual',
      });
    }

    const transLead = await creatorApi(`/api/admin/leads/${createdLeadId}/transition`, {
      method: 'POST', body: JSON.stringify({ to_status: 'contacted', reason: 'Contato comercial E2E realizado' }),
    });
    console.log(`✓ Transição de Lead -> HTTP ${transLead.status}`);
    if (transLead.status !== 200) throw new Error(`Falha na transição do lead: ${JSON.stringify(transLead.body)}`);

    // -------------------------------------------------------------------------
    // 4. Proposta (Criação, Aprovação 4 Olhos, Aceite)
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 4: PROPOSTA ---');
    const { data: plans } = await db.from('billing_plans').select('id, billing_plan_prices(cycle, billing_type)').eq('active', true).limit(1);
    if (!plans || plans.length === 0) throw new Error('Nenhum plano ativo no banco');
    const plan = plans[0];
    const price = plan.billing_plan_prices[0] || { cycle: 'monthly', billing_type: 'CREDIT_CARD' };

    const createProp = await creatorApi('/api/admin/commercial/proposals', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: createdLeadId, plan_id: plan.id, cycle: price.cycle, billing_type: price.billing_type, notes: `Proposta ${runId}`,
      }),
    });
    console.log(`✓ Criação de Proposta -> HTTP ${createProp.status}`);
    if (createProp.status !== 201) throw new Error(`Falha ao criar proposta: ${JSON.stringify(createProp.body)}`);
    createdProposalId = createProp.body.id;

    const { data: propItems } = await db.from('commercial_proposal_items').select('*').eq('proposal_id', createdProposalId);
    if (!propItems || propItems.length === 0) throw new Error('Proposta criada sem itens!');

    const appProp = await approverApi(`/api/admin/commercial/proposals/${createdProposalId}/approve`, {
      method: 'POST', body: JSON.stringify({ approval_notes: 'Aprovação por 4 olhos E2E' }),
    });
    console.log(`✓ Aprovação de Proposta -> HTTP ${appProp.status}`);
    if (appProp.status !== 200) throw new Error(`Falha ao aprovar proposta: ${JSON.stringify(appProp.body)}`);

    const accProp = await creatorApi(`/api/admin/commercial/proposals/${createdProposalId}/accept`, {
      method: 'POST', body: JSON.stringify({ reason: 'Cliente aceitou proposta E2E' }),
    });
    console.log(`✓ Aceite de Proposta -> HTTP ${accProp.status}`);
    if (accProp.status !== 200) throw new Error(`Falha ao aceitar proposta: ${JSON.stringify(accProp.body)}`);

    // -------------------------------------------------------------------------
    // 5. Contrato (Gerar com CPF/CNPJ, Aprovação 4 Olhos)
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 5: CONTRATO ---');
    const validCpf = '11144477735';
    const createContract = await creatorApi(`/api/admin/commercial/proposals/${createdProposalId}/create-contract`, {
      method: 'POST', body: JSON.stringify({ customer_tax_id: validCpf }),
    });
    console.log(`✓ Geração de Contrato -> HTTP ${createContract.status}`);
    if (createContract.status !== 201) throw new Error(`Falha ao gerar contrato: ${JSON.stringify(createContract.body)}`);
    createdContractId = createContract.body.id;

    const { data: cntItems } = await db.from('commercial_contract_items').select('*').eq('contract_id', createdContractId);
    if (!cntItems || cntItems.length === 0) throw new Error('Contrato criado sem itens!');

    const appCnt = await approverApi(`/api/admin/commercial/contracts/${createdContractId}/approve`, {
      method: 'POST', body: JSON.stringify({ reason: 'Aprovação de contrato E2E por 4 olhos' }),
    });
    console.log(`✓ Aprovação de Contrato -> HTTP ${appCnt.status}`);
    if (appCnt.status !== 200) throw new Error(`Falha ao aprovar contrato: ${JSON.stringify(appCnt.body)}`);

    // -------------------------------------------------------------------------
    // 6. Iniciar Cobrança Sandbox (start-billing) + Idempotência (Ponto 11)
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 6: COBRANÇA SANDBOX & IDEMPOTÊNCIA ---');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const startBilling = await creatorApi(`/api/admin/commercial/contracts/${createdContractId}/start-billing`, {
      method: 'POST', body: JSON.stringify({ next_due_date: tomorrow }),
    });
    console.log(`✓ 1ª Chamada POST /start-billing -> HTTP ${startBilling.status}`);
    if (startBilling.status !== 201) throw new Error(`Falha no 1º start-billing: ${JSON.stringify(startBilling.body)}`);

    createdAsaasSubId = startBilling.body.provider_subscription_id;
    const { data: custLocal } = await db.from('billing_customers').select('provider_customer_id').eq('contract_id', createdContractId).single();
    createdAsaasCustomerId = custLocal?.provider_customer_id || null;

    // Mascarar IDs para relatório (Ponto 11)
    const maskedCustomer = createdAsaasCustomerId ? `${createdAsaasCustomerId.slice(0, 4)}***${createdAsaasCustomerId.slice(-4)}` : 'N/A';
    const maskedSubscription = createdAsaasSubId ? `${createdAsaasSubId.slice(0, 4)}***${createdAsaasSubId.slice(-4)}` : 'N/A';

    console.log(`  - Cliente Asaas (Mascarado): ${maskedCustomer}`);
    console.log(`  - Assinatura Asaas (Mascarada): ${maskedSubscription}`);

    // 2ª Chamada para comprovar Idempotência
    const repeatBilling = await creatorApi(`/api/admin/commercial/contracts/${createdContractId}/start-billing`, {
      method: 'POST', body: JSON.stringify({ next_due_date: tomorrow }),
    });
    console.log(`✓ 2ª Chamada POST /start-billing -> HTTP ${repeatBilling.status}`);
    if (repeatBilling.status !== 200) throw new Error('Segunda chamada start-billing deveria retornar HTTP 200!');
    if (repeatBilling.body.provider_subscription_id !== createdAsaasSubId) {
      throw new Error('Incoerência: segunda chamada gerou assinatura duplicada!');
    }
    console.log('✓ Idempotência comprovada com sucesso (0 assinaturas duplicadas).');

    // -------------------------------------------------------------------------
    // 7. Simular Pagamento Sandbox & Provisionamento de Tenant / Onboarding
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 7: MOCK PAYMENT & PROVISIONAMENTO ---');
    const mockPayment = await creatorApi(`/api/admin/commercial/contracts/${createdContractId}/mock-sandbox-payment`, {
      method: 'POST',
    });
    console.log(`✓ Mock Payment Sandbox -> HTTP ${mockPayment.status}`);
    if (mockPayment.status !== 200 || !mockPayment.body.simulated) throw new Error(`Falha no mock payment: ${JSON.stringify(mockPayment.body)}`);

    const { data: updatedContract } = await db.from('commercial_contracts').select('*').eq('id', createdContractId).single();
    if (updatedContract.status !== 'active') throw new Error(`Status do contrato é '${updatedContract.status}', esperava 'active'!`);
    if (!updatedContract.tenant_id) throw new Error('Contrato ativo sem tenant_id preenchido!');
    createdTenantId = updatedContract.tenant_id;

    const { data: tenant } = await db.from('tenants').select('*').eq('id', createdTenantId).single();
    if (tenant.status !== 'active' && tenant.status !== 'trial') throw new Error(`Status do tenant é '${tenant.status}'!`);

    const { data: tenantSolutions } = await db.from('tenant_solutions').select('*, solutions(name)').eq('tenant_id', createdTenantId);
    if (!tenantSolutions || tenantSolutions.length === 0) throw new Error('Nenhuma solução ativada no tenant!');

    // Ponto 3: Tabela real é onboarding_runs (não tenant_onboarding_runs)
    const { data: onboardingRun } = await db.from('onboarding_runs').select('*').eq('tenant_id', createdTenantId).maybeSingle();
    if (!onboardingRun) throw new Error('Registro na tabela onboarding_runs não foi criado!');

    console.log(`✓ Contrato Active (Tenant: ${createdTenantId})`);
    console.log(`✓ Solução Ativa: ${tenantSolutions[0].solutions?.name || 'Módulo'}`);
    console.log(`✓ Onboarding Run Criado: ID ${onboardingRun.id}`);

    console.log('===========================================================');
    console.log('🎉 SUCESSO TOTAL: FLUXO E2E AUTENTICADO COMPROVADO!');
    console.log('===========================================================');

  } finally {
    // -------------------------------------------------------------------------
    // 8. Cleanup Resiliente (Ponto 4) - Cada exclusão com try/catch isolado
    // -------------------------------------------------------------------------
    console.log('--- ETAPA 8: CLEANUP RESILIENTE DE DADOS ---');

    // 8.1. Remover cliente e assinatura remota do Asaas Sandbox via API
    if (ASAAS_API_KEY && (createdAsaasSubId || createdAsaasCustomerId)) {
      try {
        if (createdAsaasSubId) {
          await fetch(`https://api-sandbox.asaas.com/v3/subscriptions/${createdAsaasSubId}`, {
            method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY }
          });
          console.log('✓ Cleanup Asaas: Assinatura remota removida');
        }
      } catch (e) { console.error('Aviso cleanup Asaas sub:', e); }

      try {
        if (createdAsaasCustomerId) {
          await fetch(`https://api-sandbox.asaas.com/v3/customers/${createdAsaasCustomerId}`, {
            method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY }
          });
          console.log('✓ Cleanup Asaas: Cliente remoto removido');
        }
      } catch (e) { console.error('Aviso cleanup Asaas customer:', e); }
    }

    if (createdTenantId) {
      try { await db.from('onboarding_items').delete().eq('tenant_id', createdTenantId); console.log('✓ Cleanup: onboarding_items'); } catch (e) {}
      try { await db.from('onboarding_runs').delete().eq('tenant_id', createdTenantId); console.log('✓ Cleanup: onboarding_runs'); } catch (e) {}
      try {
        const { data: mList } = await db.from('memberships').select('id').eq('tenant_id', createdTenantId);
        for (const m of mList || []) {
          await db.from('membership_roles').delete().eq('membership_id', m.id);
        }
        await db.from('memberships').delete().eq('tenant_id', createdTenantId);
        console.log('✓ Cleanup: memberships');
      } catch (e) {}
      try { await db.from('tenant_solutions').delete().eq('tenant_id', createdTenantId); console.log('✓ Cleanup: tenant_solutions'); } catch (e) {}
      try { await db.from('tenant_billing_state').delete().eq('tenant_id', createdTenantId); console.log('✓ Cleanup: tenant_billing_state'); } catch (e) {}
      try { await db.from('billing_status_history').delete().eq('tenant_id', createdTenantId); console.log('✓ Cleanup: billing_status_history'); } catch (e) {}
      try { await db.from('billing_payments').delete().eq('tenant_id', createdTenantId); console.log('✓ Cleanup: billing_payments'); } catch (e) {}
    }

    if (createdContractId) {
      try { await db.from('billing_subscriptions').delete().eq('contract_id', createdContractId); console.log('✓ Cleanup: billing_subscriptions'); } catch (e) {}
      try { await db.from('billing_customers').delete().eq('contract_id', createdContractId); console.log('✓ Cleanup: billing_customers'); } catch (e) {}
      try { await db.from('commercial_contract_items').delete().eq('contract_id', createdContractId); console.log('✓ Cleanup: commercial_contract_items'); } catch (e) {}
      try { await db.from('commercial_contracts').delete().eq('id', createdContractId); console.log('✓ Cleanup: commercial_contracts'); } catch (e) {}
    }

    if (createdProposalId) {
      try { await db.from('commercial_proposal_items').delete().eq('proposal_id', createdProposalId); console.log('✓ Cleanup: commercial_proposal_items'); } catch (e) {}
      try { await db.from('commercial_proposals').delete().eq('id', createdProposalId); console.log('✓ Cleanup: commercial_proposals'); } catch (e) {}
    }

    if (createdLeadId) {
      try { await db.from('platform_lead_assignments').delete().eq('lead_id', createdLeadId); console.log('✓ Cleanup: platform_lead_assignments'); } catch (e) {}
      try { await db.from('marketing_leads').delete().eq('id', createdLeadId); console.log('✓ Cleanup: marketing_leads'); } catch (e) {}
    }

    if (createdTenantId) {
      try { await db.from('tenants').delete().eq('id', createdTenantId); console.log('✓ Cleanup: tenants'); } catch (e) {}
    }

    if (adminUser?.id) {
      try { await db.from('platform_members').delete().eq('user_id', adminUser.id); } catch (e) {}
      try { await db.auth.admin.deleteUser(adminUser.id); console.log('✓ Cleanup: adminUser'); } catch (e) {}
    }

    if (approverUser?.id) {
      try { await db.from('platform_members').delete().eq('user_id', approverUser.id); } catch (e) {}
      try { await db.auth.admin.deleteUser(approverUser.id); console.log('✓ Cleanup: approverUser'); } catch (e) {}
    }

    // Comprovação de zero residuais
    const { data: finalAuth } = await db.auth.admin.listUsers();
    const remAuth = (finalAuth?.users || []).filter(u => u.email?.includes(runId));
    console.log(`✓ Comprovação Final de Cleanup (RunId ${runId}): ${remAuth.length} usuários residuais.`);
  }
}

runE2ETest().catch(err => {
  console.error('ERRO NO TESTE E2E:', err);
  process.exit(1);
});
