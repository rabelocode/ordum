import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const APP_URL = (process.env.APP_URL || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app').replace(/\/$/, '');
const ASAAS_KEY = process.env.ASAAS_API_KEY || '';
const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL || '';
const OPERATOR_PASSWORD = process.env.E2E_OPERATOR_PASSWORD || '';
const ASAAS_URL = 'https://api-sandbox.asaas.com/v3';

export type CommercialE2EEvidence = Record<string, string | number | boolean>;
type ApiResult = { status: number; body: any };

function required(name: string, value: string) {
  if (!value) throw new Error(`${name} is required when RUN_LIVE_E2E=1.`);
}

function data<T>(result: { data: T | null; error: any }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: no data`);
  return result.data;
}

async function remove(operation: PromiseLike<{ error: any }>, label: string, errors: string[]) {
  const { error } = await operation;
  if (error) errors.push(`${label}: ${error.message}`);
}

async function api(token: string, path: string, options: RequestInit = {}): Promise<ApiResult> {
  const response = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function asaasExists(resource: 'customers' | 'subscriptions', id: string) {
  const response = await fetch(`${ASAAS_URL}/${resource}/${id}`, { headers: { access_token: ASAAS_KEY } });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Asaas ${resource} GET: HTTP ${response.status}`);
  return (await response.json()).deleted !== true;
}

async function removeAsaas(resource: 'customers' | 'subscriptions', id: string) {
  const response = await fetch(`${ASAAS_URL}/${resource}/${id}`, { method: 'DELETE', headers: { access_token: ASAAS_KEY } });
  if (!response.ok && response.status !== 404) throw new Error(`Asaas ${resource} DELETE: HTTP ${response.status}`);
  if (await asaasExists(resource, id)) throw new Error(`Asaas ${resource} residue remains`);
}

async function verifyNoResidue(db: SupabaseClient, ids: Record<string, string | undefined>, userIds: string[], runId: string) {
  const errors: string[] = [];
  let authCount = 0;
  for (const id of userIds) {
    const result = await db.auth.admin.getUserById(id);
    if (!result.error && (result.data.user.id === id || result.data.user.user_metadata?.runId === runId)) authCount += 1;
    else if (result.error && !/not found/i.test(result.error.message)) errors.push(`verify auth.users ${id}: ${result.error.message}`);
  }
  const members = userIds.length ? await db.from('platform_members').select('id', { count: 'exact', head: true }).in('user_id', userIds) : { count: 0, error: null };
  if (members.error) errors.push(`verify platform_members: ${members.error.message}`);
  const tables: Array<[string, string, string]> = [
    ['leadId', 'marketing_leads', 'id'], ['proposalId', 'commercial_proposals', 'id'],
    ['contractId', 'commercial_contracts', 'id'], ['tenantId', 'tenants', 'id'],
  ];
  for (const [key, table, column] of tables) {
    if (!ids[key]) continue;
    const result = await db.from(table).select(column, { count: 'exact', head: true }).eq(column, ids[key]!);
    if (result.error) errors.push(`verify ${table}: ${result.error.message}`);
    if (result.count) errors.push(`${table}: ${result.count} residue(s)`);
  }
  if (authCount) errors.push(`auth.users: ${authCount} residue(s)`);
  if (members.count) errors.push(`platform_members: ${members.count} residue(s)`);
  if (errors.length) throw new Error(errors.join('; '));
  return { authCount, memberCount: members.count || 0 };
}

export async function runCommercialE2E(): Promise<CommercialE2EEvidence> {
  required('SUPABASE_SECRET_KEY', SECRET);
  required('E2E_OPERATOR_EMAIL', OPERATOR_EMAIL);
  required('E2E_OPERATOR_PASSWORD', OPERATOR_PASSWORD);
  required('ASAAS_API_KEY', ASAAS_KEY);
  const runId = `e2e_run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const evidence: CommercialE2EEvidence = { runId };
  const db = createClient(SUPABASE_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });

  // Mandatory preflight: no fixture or database mutation may occur above this point.
  const operator = createClient(SUPABASE_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });
  const operatorAuth = data(await operator.auth.signInWithPassword({ email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD }), 'operator authentication');
  if (!operatorAuth.session) throw new Error('operator authentication returned no session');
  const diagnostics = await api(operatorAuth.session.access_token, '/api/admin/billing/diagnostics');
  evidence.diagnosticsHttp = diagnostics.status;
  if (diagnostics.status !== 200) throw new Error(`Billing diagnostics: HTTP ${diagnostics.status}`);
  const diag = diagnostics.body;
  if (diag.enabled !== true || diag.configured !== true || diag.environment !== 'sandbox' || diag.webhookUrlConfigured !== true || diag.sandboxMockAvailable !== true) {
    throw new Error(`Billing diagnostics incomplete: ${JSON.stringify({ enabled: diag.enabled, configured: diag.configured, environment: diag.environment, webhookUrlConfigured: diag.webhookUrlConfigured, sandboxMockAvailable: diag.sandboxMockAvailable })}`);
  }
  Object.assign(evidence, { billingEnabled: true, billingConfigured: true, environment: 'sandbox', webhookConfigured: true, sandboxMock: true });

  const adminRole = data(await db.from('platform_roles').select('id').eq('key', 'admin').single(), 'admin role');
  const password = `Ordum#${crypto.randomBytes(18).toString('base64url')}`;
  const ids: Record<string, string | undefined> = {};
  let adminUser: any;
  let approverUser: any;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;
  let primaryError: unknown;

  try {
    adminUser = data(await db.auth.admin.createUser({ email: `${runId}_admin@ordum-test.internal`, password, email_confirm: true, user_metadata: { name: 'E2E Admin', runId } }), 'create admin auth').user;
    data(await db.from('platform_members').insert({ user_id: adminUser.id, role_id: adminRole.id, relationship_type: 'partner', status: 'active' }).select('id').single(), 'create admin member');
    approverUser = data(await db.auth.admin.createUser({ email: `${runId}_approver@ordum-test.internal`, password, email_confirm: true, user_metadata: { name: 'E2E Approver', runId } }), 'create approver auth').user;
    data(await db.from('platform_members').insert({ user_id: approverUser.id, role_id: adminRole.id, relationship_type: 'partner', status: 'active' }).select('id').single(), 'create approver member');

    const creatorAuth = data(await createClient(SUPABASE_URL, SECRET).auth.signInWithPassword({ email: adminUser.email, password }), 'creator login');
    const approverAuth = data(await createClient(SUPABASE_URL, SECRET).auth.signInWithPassword({ email: approverUser.email, password }), 'approver login');
    if (!creatorAuth.session || !approverAuth.session) throw new Error('fixture login returned no session');
    const creator = (path: string, options?: RequestInit) => api(creatorAuth.session!.access_token, path, options);
    const approver = (path: string, options?: RequestInit) => api(approverAuth.session!.access_token, path, options);

    const lead = data(await db.from('marketing_leads').insert({ name: `Cliente ${runId}`, email: adminUser.email, company: `Empresa ${runId}`, phone: '11999998888', status: 'new', priority: 'normal' }).select().single(), 'create lead');
    ids.leadId = lead.id;
    const teams = data(await db.from('platform_teams').select('id').limit(1), 'read team');
    if (teams.length) data(await db.from('platform_lead_assignments').insert({ lead_id: ids.leadId, team_id: teams[0].id, assignment_type: 'manual' }).select('id').single(), 'assign lead');
    if ((await creator(`/api/admin/leads/${ids.leadId}/transition`, { method: 'POST', body: JSON.stringify({ to_status: 'contacted', reason: runId }) })).status !== 200) throw new Error('lead transition failed');

    const plans = data(await db.from('billing_plans').select('id,billing_plan_prices(cycle,billing_type)').eq('active', true).limit(1), 'read plan');
    if (!plans.length || !plans[0].billing_plan_prices?.length) throw new Error('No active plan with price');
    const price = plans[0].billing_plan_prices[0];
    const proposal = await creator('/api/admin/commercial/proposals', { method: 'POST', body: JSON.stringify({ lead_id: ids.leadId, plan_id: plans[0].id, cycle: price.cycle, billing_type: price.billing_type, notes: runId }) });
    if (proposal.status !== 201 || !proposal.body.id) throw new Error(`proposal create: HTTP ${proposal.status}`);
    ids.proposalId = proposal.body.id;
    if (!data(await db.from('commercial_proposal_items').select('id').eq('proposal_id', ids.proposalId), 'proposal items').length) throw new Error('Proposal has no items');
    if ((await approver(`/api/admin/commercial/proposals/${ids.proposalId}/approve`, { method: 'POST', body: JSON.stringify({ approval_notes: runId }) })).status !== 200) throw new Error('proposal approval failed');
    if ((await creator(`/api/admin/commercial/proposals/${ids.proposalId}/accept`, { method: 'POST', body: JSON.stringify({ reason: runId }) })).status !== 200) throw new Error('proposal acceptance failed');

    const contract = await creator(`/api/admin/commercial/proposals/${ids.proposalId}/create-contract`, { method: 'POST', body: JSON.stringify({ customer_tax_id: '11144477735' }) });
    if (contract.status !== 201 || !contract.body.id) throw new Error(`contract create: HTTP ${contract.status}`);
    ids.contractId = contract.body.id;
    if (!data(await db.from('commercial_contract_items').select('id').eq('contract_id', ids.contractId), 'contract items').length) throw new Error('Contract has no items');
    if ((await approver(`/api/admin/commercial/contracts/${ids.contractId}/approve`, { method: 'POST', body: JSON.stringify({ reason: runId }) })).status !== 200) throw new Error('contract approval failed');

    const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const first = await creator(`/api/admin/commercial/contracts/${ids.contractId}/start-billing`, { method: 'POST', body: JSON.stringify({ next_due_date: due }) });
    evidence.startBillingFirstHttp = first.status;
    if (first.status !== 201 || !first.body.provider_subscription_id) throw new Error(`start-billing first: HTTP ${first.status}`);
    subscriptionId = first.body.provider_subscription_id;
    customerId = data(await db.from('billing_customers').select('provider_customer_id').eq('contract_id', ids.contractId).single(), 'billing customer').provider_customer_id;
    if (!(await asaasExists('customers', customerId)) || !(await asaasExists('subscriptions', subscriptionId))) throw new Error('Asaas resources not found');
    Object.assign(evidence, { asaasCustomerExists: true, asaasSubscriptionExists: true });
    const repeat = await creator(`/api/admin/commercial/contracts/${ids.contractId}/start-billing`, { method: 'POST', body: JSON.stringify({ next_due_date: due }) });
    evidence.startBillingRepeatHttp = repeat.status;
    if (repeat.status !== 200 || repeat.body.provider_subscription_id !== subscriptionId) throw new Error('start-billing idempotency failed');
    evidence.sameProviderSubscription = true;

    const mock = await creator(`/api/admin/commercial/contracts/${ids.contractId}/mock-sandbox-payment`, { method: 'POST' });
    evidence.mockPaymentHttp = mock.status;
    if (mock.status !== 200 || mock.body.simulated !== true) throw new Error(`mock payment: HTTP ${mock.status}`);
    const active = data(await db.from('commercial_contracts').select('status,tenant_id').eq('id', ids.contractId).single(), 'active contract');
    if (active.status !== 'active' || !active.tenant_id) throw new Error('Contract not activated');
    ids.tenantId = active.tenant_id;
    const tenant = data(await db.from('tenants').select('status').eq('id', ids.tenantId).single(), 'tenant');
    if (!['active', 'trial'].includes(tenant.status)) throw new Error(`Unexpected tenant status ${tenant.status}`);
    const solutions = data(await db.from('tenant_solutions').select('id,status').eq('tenant_id', ids.tenantId), 'tenant solutions');
    if (!solutions.some((item) => item.status === 'active')) throw new Error('No active solution');
    const onboarding = data(await db.from('onboarding_runs').select('id').eq('tenant_id', ids.tenantId), 'onboarding');
    if (!onboarding.length) throw new Error('No onboarding run');
    Object.assign(evidence, { contractStatus: 'active', tenantProvisioned: true, activeSolution: true, onboardingRunId: onboarding[0].id });
  } catch (error) {
    primaryError = error;
  } finally {
    const errors: string[] = [];
    try {
      if (subscriptionId) await removeAsaas('subscriptions', subscriptionId);
      if (customerId) await removeAsaas('customers', customerId);
    } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }

    let runIds: string[] = [];
    let eventIds: string[] = [];
    if (ids.tenantId) {
      const runs = await db.from('onboarding_runs').select('id').eq('tenant_id', ids.tenantId);
      if (runs.error) errors.push(`read onboarding_runs: ${runs.error.message}`); else runIds = (runs.data || []).map((row) => row.id);
      const history = await db.from('billing_status_history').select('webhook_event_id').eq('tenant_id', ids.tenantId).not('webhook_event_id', 'is', null);
      if (history.error) errors.push(`read billing_status_history: ${history.error.message}`); else eventIds = [...new Set((history.data || []).map((row) => row.webhook_event_id).filter(Boolean))] as string[];
      if (runIds.length) await remove(db.from('onboarding_items').delete().in('run_id', runIds), 'onboarding_items', errors);
      await remove(db.from('onboarding_runs').delete().eq('tenant_id', ids.tenantId), 'onboarding_runs', errors);
      const memberships = await db.from('memberships').select('id').eq('tenant_id', ids.tenantId);
      if (memberships.error) errors.push(`read memberships: ${memberships.error.message}`);
      else if (memberships.data?.length) await remove(db.from('membership_roles').delete().in('membership_id', memberships.data.map((row) => row.id)), 'membership_roles', errors);
      await remove(db.from('memberships').delete().eq('tenant_id', ids.tenantId), 'memberships', errors);
      await remove(db.from('tenant_solutions').delete().eq('tenant_id', ids.tenantId), 'tenant_solutions', errors);
      await remove(db.from('tenant_billing_state').delete().eq('tenant_id', ids.tenantId), 'tenant_billing_state', errors);
      await remove(db.from('billing_status_history').delete().eq('tenant_id', ids.tenantId), 'billing_status_history', errors);
      await remove(db.from('billing_payments').delete().eq('tenant_id', ids.tenantId), 'billing_payments', errors);
      if (eventIds.length) await remove(db.from('billing_webhook_events').delete().in('id', eventIds), 'billing_webhook_events', errors);
      await remove(db.from('platform_client_assignments').delete().eq('tenant_id', ids.tenantId), 'platform_client_assignments', errors);
    }
    if (ids.contractId) {
      await remove(db.from('billing_subscriptions').delete().eq('contract_id', ids.contractId), 'billing_subscriptions', errors);
      await remove(db.from('billing_customers').delete().eq('contract_id', ids.contractId), 'billing_customers', errors);
      await remove(db.from('commercial_contract_items').delete().eq('contract_id', ids.contractId), 'commercial_contract_items', errors);
      await remove(db.from('commercial_contracts').delete().eq('id', ids.contractId), 'commercial_contracts', errors);
    }
    if (ids.proposalId) {
      await remove(db.from('commercial_proposal_items').delete().eq('proposal_id', ids.proposalId), 'commercial_proposal_items', errors);
      await remove(db.from('commercial_proposals').delete().eq('id', ids.proposalId), 'commercial_proposals', errors);
    }
    if (ids.leadId) {
      await remove(db.from('platform_lead_assignments').delete().eq('lead_id', ids.leadId), 'platform_lead_assignments', errors);
      await remove(db.from('marketing_leads').delete().eq('id', ids.leadId), 'marketing_leads', errors);
    }
    const userIds = [adminUser?.id, approverUser?.id].filter(Boolean) as string[];
    if (ids.tenantId) await remove(db.from('platform_state_transitions').delete().eq('tenant_id', ids.tenantId), 'platform_state_transitions tenant', errors);
    if (ids.tenantId) await remove(db.from('tenants').delete().eq('id', ids.tenantId), 'tenants', errors);
    if (userIds.length) {
      await remove(db.from('platform_state_transitions').delete().in('actor_user_id', userIds), 'platform_state_transitions', errors);
      await remove(db.from('platform_audit_logs').delete().in('actor_user_id', userIds), 'platform_audit_logs', errors);
      await remove(db.from('platform_members').delete().in('user_id', userIds), 'platform_members', errors);
      for (const id of userIds) {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error) errors.push(`auth.users ${id}: ${error.message}`);
      }
    }
    try {
      const counts = await verifyNoResidue(db, ids, userIds, runId);
      const remoteClean = (!customerId || !await asaasExists('customers', customerId)) && (!subscriptionId || !await asaasExists('subscriptions', subscriptionId));
      Object.assign(evidence, { cleanupLocal: true, cleanupRemote: remoteClean, authResidual: counts.authCount, platformMemberResidual: counts.memberCount });
    } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    if (errors.length) primaryError = new Error(`${primaryError instanceof Error ? `${primaryError.message}; ` : ''}cleanup failed: ${errors.join('; ')}`);
  }

  if (primaryError) throw primaryError;
  console.log(`COMMERCIAL_E2E_EVIDENCE=${JSON.stringify(evidence)}`);
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCommercialE2E().catch((error) => {
    console.error('Commercial E2E failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
