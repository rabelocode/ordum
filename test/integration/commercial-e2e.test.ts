import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_URL = process.env.APP_URL || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app';

describe('E2E Commercial Lifecycle Integration Test', () => {
  let db: any;
  let adminAccessToken: string = '';
  let adminUser: any = null;

  // Cleanup tracking IDs
  let createdLeadId: string | null = null;
  let createdProposalId: string | null = null;
  let createdContractId: string | null = null;
  let createdTenantId: string | null = null;
  let createdAsaasCustomerId: string | null = null;
  let createdAsaasSubId: string | null = null;

  const testEmail = `e2e_commercial_${Date.now()}@ordum-test.internal`;
  const validTaxId = '11144477735'; // Valid test CPF

  before(async () => {
    if (!SERVICE_ROLE_KEY) {
      console.warn('SUPABASE_SECRET_KEY ausente. Teste real será ignorado.');
      return;
    }

    db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Requisito 10: Criar usuário E2E administrativo para login e obtenção do access token de usuário
    const password = `OrdumTest#${Date.now()}`;
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email: testEmail,
      password,
      email_confirm: true,
      user_metadata: { name: 'E2E Test Admin' },
    });

    if (authErr) throw new Error('Falha ao criar usuário de teste no Auth: ' + authErr.message);
    adminUser = authUser.user;

    // Vincular permissão de admin na platform_members
    await db.from('platform_members').insert({
      user_id: adminUser.id,
      email: testEmail,
      name: 'E2E Test Admin',
      role_key: 'admin',
      status: 'active',
    });

    // Fazer login real via client do Supabase para obter o Access Token do usuário (Requisito 10)
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || SERVICE_ROLE_KEY;
    const client = createClient(SUPABASE_URL, anonKey);
    const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password,
    });

    if (signInErr || !signInData.session) {
      throw new Error('Falha ao autenticar usuário E2E: ' + (signInErr?.message || 'Sessão nula'));
    }

    adminAccessToken = signInData.session.access_token;
  });

  after(async () => {
    // Requisito 10: Remoção ordenada no try/finally/after
    if (!db) return;

    try {
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
    } catch (cleanErr) {
      console.error('Erro na limpeza do teste E2E:', cleanErr);
    }
  });

  async function apiFetch(path: string, options: RequestInit = {}) {
    const url = `${APP_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
        ...options.headers,
      },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  it('Executa o fluxo real completo de comercialização até o provisionamento do tenant e ativação de solução', async () => {
    if (!adminAccessToken) return;

    // 1. Criar Lead Fixture
    const leadRes = await apiFetch('/api/admin/leads', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cliente Teste E2E',
        email: testEmail,
        company: 'Empresa Teste E2E LTDA',
        phone: '11999998888',
      }),
    });
    assert.equal(leadRes.status, 201, `Erro ao criar lead: ${JSON.stringify(leadRes.body)}`);
    createdLeadId = leadRes.body.id;

    // 2. Mudar status do Lead
    const leadTransRes = await apiFetch(`/api/admin/leads/${createdLeadId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ to_status: 'contacted', reason: 'Contato E2E real realizado' }),
    });
    assert.equal(leadTransRes.status, 200, `Erro ao transicionar lead: ${JSON.stringify(leadTransRes.body)}`);

    // 3. Buscar Planos Ativos para incluir proposta com itens
    const { data: plans } = await db.from('billing_plans').select('id, billing_plan_prices(cycle, billing_type)').eq('active', true).limit(1);
    assert.ok(plans && plans.length > 0, 'Nenhum plano ativo encontrado no banco');
    const plan = plans[0];
    const price = plan.billing_plan_prices[0] || { cycle: 'monthly', billing_type: 'CREDIT_CARD' };

    // 4. Criar Proposta
    const proposalRes = await apiFetch('/api/admin/commercial/proposals', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: createdLeadId,
        plan_id: plan.id,
        cycle: price.cycle,
        billing_type: price.billing_type,
        notes: 'Proposta de teste E2E',
      }),
    });
    assert.equal(proposalRes.status, 201, `Erro ao criar proposta: ${JSON.stringify(proposalRes.body)}`);
    createdProposalId = proposalRes.body.id;

    // Confirmar inclusão dos itens da proposta
    const { data: proposalItems } = await db.from('commercial_proposal_items').select('*').eq('proposal_id', createdProposalId);
    assert.ok(proposalItems && proposalItems.length > 0, 'A proposta deveria conter itens vinculados do plano');

    // 5. Aprovar Proposta
    const appPropRes = await apiFetch(`/api/admin/commercial/proposals/${createdProposalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approval_notes: 'Aprovado em teste automatizado E2E' }),
    });
    assert.equal(appPropRes.status, 200, `Erro ao aprovar proposta: ${JSON.stringify(appPropRes.body)}`);

    // 6. Registrar Aceite
    const accPropRes = await apiFetch(`/api/admin/commercial/proposals/${createdProposalId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cliente aceitou a proposta via portal' }),
    });
    assert.equal(accPropRes.status, 200, `Erro ao registrar aceite: ${JSON.stringify(accPropRes.body)}`);

    // 7. Gerar Contrato com CPF/CNPJ válido
    const contractRes = await apiFetch(`/api/admin/commercial/proposals/${createdProposalId}/create-contract`, {
      method: 'POST',
      body: JSON.stringify({ customer_tax_id: validTaxId }),
    });
    assert.equal(contractRes.status, 201, `Erro ao gerar contrato: ${JSON.stringify(contractRes.body)}`);
    createdContractId = contractRes.body.id;

    // 8. Confirmar itens do contrato
    const { data: contractItems } = await db.from('commercial_contract_items').select('*').eq('contract_id', createdContractId);
    assert.ok(contractItems && contractItems.length > 0, 'O contrato gerado precisa conter os itens copiados da proposta');

    // 9. Aprovar Contrato
    const appCntRes = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Aprovação de contrato E2E' }),
    });
    assert.equal(appCntRes.status, 200, `Erro ao aprovar contrato: ${JSON.stringify(appCntRes.body)}`);

    // 10. Iniciar Assinatura Sandbox (start-billing)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const startBillingRes = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/start-billing`, {
      method: 'POST',
      body: JSON.stringify({ next_due_date: tomorrow }),
    });
    assert.equal(startBillingRes.status, 201, `Erro ao iniciar billing: ${JSON.stringify(startBillingRes.body)}`);
    createdAsaasSubId = startBillingRes.body.provider_subscription_id;

    // 11. Repetir chamada start-billing para Comprovar Idempotência (Requisito 11)
    const repeatBillingRes = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/start-billing`, {
      method: 'POST',
      body: JSON.stringify({ next_due_date: tomorrow }),
    });
    assert.equal(repeatBillingRes.status, 200, 'A repetição do start-billing deveria retornar status 200 sem duplicar');
    assert.equal(repeatBillingRes.body.provider_subscription_id, createdAsaasSubId, 'Nenhuma segunda assinatura deve ser gerada no Asaas');

    // 12. Simular Pagamento Sandbox
    const mockPayRes = await apiFetch(`/api/admin/commercial/contracts/${createdContractId}/mock-sandbox-payment`, {
      method: 'POST',
    });
    assert.equal(mockPayRes.status, 200, `Erro ao simular pagamento: ${JSON.stringify(mockPayRes.body)}`);
    assert.equal(mockPayRes.body.simulated, true);

    // 13. Confirmar que o Contrato passou para ACTIVE
    const { data: updatedContract } = await db.from('commercial_contracts').select('*').eq('id', createdContractId).single();
    assert.equal(updatedContract.status, 'active', 'O status do contrato deve ser active após confirmação do pagamento');
    createdTenantId = updatedContract.tenant_id;

    // 14. Confirmar Tenant e Soluções Ativas
    assert.ok(createdTenantId, 'O tenant deve ter sido provisionado');
    const { data: tenantSolutions } = await db.from('tenant_solutions').select('*').eq('tenant_id', createdTenantId);
    assert.ok(tenantSolutions && tenantSolutions.length > 0, 'As soluções do contrato devem ter sido ativadas no tenant');

    // 15. Confirmar Onboarding iniciado
    const { data: onboardingRun } = await db.from('tenant_onboarding_runs').select('*').eq('tenant_id', createdTenantId).maybeSingle();
    assert.ok(onboardingRun, 'O processo de onboarding deve ter sido iniciado');
  });
});
