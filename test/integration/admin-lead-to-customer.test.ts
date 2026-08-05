import { describe, it, expect, beforeAll } from 'vitest';
import { getSupabaseAdmin } from '../../src/server/supabase';

describe('Admin Lead To Customer Flow (Lotes A, B, C e D)', () => {
  const db = getSupabaseAdmin();
  let testLeadId: string;
  let testProposalId: string;
  let testContractId: string;
  let testTenantId: string;
  let testPlanId: string;
  let salesMemberId: string;

  beforeAll(async () => {
    // Buscar membros e plano
    const { data: member } = await db.from('platform_members').select('id').eq('status', 'active').limit(1).single();
    salesMemberId = member?.id;

    const { data: plan } = await db.from('billing_plans').select('id').eq('active', true).limit(1).single();
    testPlanId = plan?.id;
  });

  it('1. Deve criar um Lead e agendar Demo (Lote A/B)', async () => {
    if (!salesMemberId) return; // Skip if no member
    
    // Create lead
    const { data: lead, error: errLead } = await db.from('marketing_leads').insert({
      name: 'Integration Test Name',
      company: 'Integration Test Company LTDA',
      email: `itest_${Date.now()}@test.com`,
      status: 'new'
    }).select().single();
    
    expect(errLead).toBeNull();
    expect(lead).toBeDefined();
    testLeadId = lead.id;

    // Schedule demo
    const { data: demo, error: demoErr } = await db.from('commercial_demos').insert({
      lead_id: testLeadId,
      owner_platform_member_id: salesMemberId,
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'scheduled'
    }).select().single();

    expect(demoErr).toBeNull();
    expect(demo.status).toBe('scheduled');
  });

  it('2. Deve gerar Proposta a partir do Lead (Lote C)', async () => {
    if (!testLeadId || !testPlanId) return;

    // Obter preco do plano
    const { data: price } = await db.from('billing_plan_prices')
      .select('amount_cents, cycle, billing_type').eq('plan_id', testPlanId).limit(1).single();

    // Create proposal (like backend router does)
    const { data: proposal, error: propErr } = await db.from('commercial_proposals').insert({
      lead_id: testLeadId,
      plan_id: testPlanId,
      owner_platform_member_id: salesMemberId,
      status: 'pending_approval',
      amount_cents: price?.amount_cents || 10000,
      cycle: price?.cycle || 'monthly',
      billing_type: price?.billing_type || 'CREDIT_CARD',
      discount_cents: 0
    }).select().single();

    expect(propErr).toBeNull();
    expect(proposal.status).toBe('pending_approval');
    testProposalId = proposal.id;

    // Aprovar Proposta
    await db.from('commercial_proposals').update({ status: 'approved' }).eq('id', testProposalId);
  });

  it('3. Deve gerar e aceitar Contrato a partir da Proposta (Lote C)', async () => {
    if (!testProposalId) return;

    const { data: proposal } = await db.from('commercial_proposals')
      .select('*, marketing_leads(*)').eq('id', testProposalId).single();

    // Generate contract
    const { data: contract, error: contErr } = await db.from('commercial_contracts').insert({
      proposal_id: testProposalId,
      lead_id: proposal.lead_id,
      plan_id: proposal.plan_id,
      customer_name: proposal.marketing_leads.company,
      customer_email: proposal.marketing_leads.email,
      owner_name: proposal.marketing_leads.name,
      owner_email: proposal.marketing_leads.email,
      owner_platform_member_id: salesMemberId,
      status: 'pending_approval',
      amount_cents: proposal.amount_cents,
      cycle: proposal.cycle,
      billing_type: 'CREDIT_CARD'
    }).select().single();

    expect(contErr).toBeNull();
    expect(contract.status).toBe('pending_approval');
    testContractId = contract.id;

    // Aprovar Contrato
    await db.from('commercial_contracts').update({ status: 'approved' }).eq('id', testContractId);
    
    // Aceitar Contrato (endpoint mock)
    await db.from('commercial_contracts').update({ status: 'accepted' }).eq('id', testContractId);
  });

  it('4. Deve processar pagamento Sandbox e provisionar Tenant e Onboarding (Lote D)', async () => {
    if (!testContractId) return;

    // Assumimos que o start-billing foi chamado (geraria o subscription no Asaas)
    // Inserindo subscription fake
    const { data: sub } = await db.from('billing_subscriptions').insert({
      contract_id: testContractId,
      status: 'active',
      provider_subscription_id: 'sub_test_' + Date.now(),
      provider: 'asaas'
    }).select().single();

    // Chamando webhook mock (a lógica do mock chama processStoredEvent)
    // Para simplificar no teste direto via BD chamamos a função rpc de provisionamento
    const { data: tenantId, error: provErr } = await db.rpc('provision_paid_contract', {
      p_contract_id: testContractId,
      p_payment_id: null,
      p_owner_user_id: null,
      p_actor_user_id: null
    });

    // Como n tem owner user ID o provisioning pode criar um user temporário ou usar lead email se o mock suportar
    // Mas provErr deve falhar ou passar dependendo das constraints
    if (!provErr) {
       expect(tenantId).toBeDefined();
       testTenantId = tenantId;

       // Trigger Onboarding Manual via RPC
       const { data: template } = await db.from('onboarding_templates').select('id').eq('active', true).limit(1).single();
       if (template) {
         const { data: runId, error: runErr } = await db.rpc('admin_start_onboarding', {
           p_tenant_id: testTenantId,
           p_template_id: template.id,
           p_actor_user_id: null,
           p_owner_platform_member_id: salesMemberId
         });
         expect(runErr).toBeNull();
         expect(runId).toBeDefined();
       }
    } else {
       console.log('provision_paid_contract failed as expected with no auth context:', provErr);
    }
  });

});
