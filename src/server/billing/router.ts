import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { AsaasBillingProvider } from './asaas';
import { getBillingConfig, publicBillingHealth } from './config';
import {
  SUPPORTED_ASAAS_EVENTS,
  accessTransitionForPaymentStatus,
  addGracePeriod,
  centsFromProvider,
  normalizePaymentStatus,
  paidPeriod,
  preserveSettledPaymentStatus,
  safeProviderMetadata,
  type BillingCycle,
} from './domain';

function hasPermission(context: any, permission: string) {
  return context.role?.key === 'admin' || context.permissions.includes(permission);
}

export function webhookTokenMatches(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Falha desconhecida';
  return message.replace(/\$aact_[A-Za-z0-9_\-]+/g, '[REDACTED]').slice(0, 500);
}

function slugDate(value?: string) {
  return value?.slice(0, 10) || new Date().toISOString().slice(0, 10);
}

async function ensureOwnerUser(db: any, contract: any) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find((user: any) => user.email?.toLowerCase() === contract.owner_email.toLowerCase());
  if (existing) return existing;

  const baseUrl = process.env.APP_URL || 'https://ordum-ordum.vercel.app';
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(contract.owner_email, {
    redirectTo: `${baseUrl.replace(/\/$/, '')}/#/auth/accept-invite`,
    data: { full_name: contract.owner_name || contract.customer_name },
  });
  if (inviteError) throw inviteError;
  return invited.user;
}

async function resolveContract(db: any, payment: any, subscriptionId?: string | null) {
  if (subscriptionId) {
    const { data: subscription } = await db
      .from('billing_subscriptions')
      .select('*, commercial_contracts(*)')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle();
    if (subscription?.commercial_contracts) return { contract: subscription.commercial_contracts, subscription };
  }

  const externalReference = payment?.externalReference;
  if (externalReference) {
    const { data: contract } = await db
      .from('commercial_contracts')
      .select('*')
      .eq('external_reference', externalReference)
      .maybeSingle();
    if (contract) return { contract, subscription: null };
  }
  return { contract: null, subscription: null };
}

async function processPaymentEvent(db: any, eventRow: any, payload: any) {
  const payment = payload.payment;
  if (!payment?.id) return 'ignored';

  const { contract, subscription } = await resolveContract(db, payment, payment.subscription);
  const providerStatus = payment.status ? String(payment.status) : undefined;
  let normalizedStatus = normalizePaymentStatus(payload.event, providerStatus);

  const { data: existingPayment } = await db
    .from('billing_payments')
    .select('*')
    .eq('provider_payment_id', payment.id)
    .maybeSingle();

  normalizedStatus = preserveSettledPaymentStatus(existingPayment?.status, normalizedStatus);

  const dueDate = slugDate(payment.dueDate);
  let startsOn = existingPayment?.paid_period_starts_on ?? null;
  let endsOn = existingPayment?.paid_period_ends_on ?? null;
  if (contract && ['confirmed', 'received'].includes(normalizedStatus) && !existingPayment?.paid_period_ends_on) {
    const currentState = contract.tenant_id
      ? (await db.from('tenant_billing_state').select('paid_through').eq('tenant_id', contract.tenant_id).maybeSingle()).data
      : null;
    const period = paidPeriod(dueDate, contract.cycle as BillingCycle, currentState?.paid_through);
    startsOn = period.startsOn;
    endsOn = period.endsOn;
  }

  const paymentValues = {
    provider: 'asaas',
    provider_payment_id: payment.id,
    subscription_id: subscription?.id ?? existingPayment?.subscription_id ?? null,
    contract_id: contract?.id ?? existingPayment?.contract_id ?? null,
    tenant_id: contract?.tenant_id ?? existingPayment?.tenant_id ?? null,
    external_reference: payment.externalReference || existingPayment?.external_reference || null,
    status: normalizedStatus,
    provider_status: providerStatus || null,
    amount_cents: centsFromProvider(payment.value),
    net_amount_cents: payment.netValue == null ? null : centsFromProvider(payment.netValue),
    due_date: dueDate,
    confirmed_at: normalizedStatus === 'confirmed' ? (payment.confirmedDate || payment.clientPaymentDate || new Date().toISOString()) : existingPayment?.confirmed_at ?? null,
    received_at: normalizedStatus === 'received' ? (payment.paymentDate || payment.clientPaymentDate || new Date().toISOString()) : existingPayment?.received_at ?? null,
    paid_period_starts_on: startsOn,
    paid_period_ends_on: endsOn,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    metadata: safeProviderMetadata(payment),
  };

  const { data: savedPayment, error: paymentError } = await db
    .from('billing_payments')
    .upsert(paymentValues, { onConflict: 'provider,provider_payment_id' })
    .select()
    .single();
  if (paymentError) throw paymentError;

  if (!contract) return 'ignored';

  const accessStatus = accessTransitionForPaymentStatus(normalizedStatus);
  if (accessStatus === 'active') {
    const owner = await ensureOwnerUser(db, contract);
    const { data: tenantId, error: provisionError } = await db.rpc('provision_paid_contract', {
      p_contract_id: contract.id,
      p_payment_id: savedPayment.id,
      p_owner_user_id: owner.id,
      p_actor_user_id: null,
    });
    if (provisionError) throw provisionError;
    await db.from('billing_payments').update({ tenant_id: tenantId }).eq('id', savedPayment.id);
  } else if (accessStatus === 'grace' && contract.tenant_id) {
    const graceEndsAt = addGracePeriod(dueDate, contract.grace_days);
    await db.from('tenant_billing_state').upsert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      subscription_id: subscription?.id ?? null,
      access_status: 'grace',
      grace_ends_at: graceEndsAt,
      last_payment_id: savedPayment.id,
    }, { onConflict: 'tenant_id' });
    await db.from('commercial_contracts').update({ status: 'past_due' }).eq('id', contract.id);
    await db.from('billing_status_history').insert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      payment_id: savedPayment.id,
      webhook_event_id: eventRow.id,
      from_status: contract.status,
      to_status: 'grace',
      reason: 'payment_overdue',
    });
  } else if (accessStatus === 'review' && contract.tenant_id) {
    await db.from('tenant_billing_state').upsert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      access_status: 'review',
      suspended_at: new Date().toISOString(),
      suspension_reason: normalizedStatus,
      last_payment_id: savedPayment.id,
    }, { onConflict: 'tenant_id' });
    await db.from('tenants').update({ status: 'suspended' }).eq('id', contract.tenant_id);
    await db.from('commercial_contracts').update({ status: 'suspended' }).eq('id', contract.id);
  }

  return 'processed';
}

async function processSubscriptionEvent(db: any, payload: any) {
  const subscription = payload.subscription;
  if (!subscription?.id) return 'ignored';
  const { data: local } = await db
    .from('billing_subscriptions')
    .select('*')
    .eq('provider_subscription_id', subscription.id)
    .maybeSingle();
  if (!local) return 'ignored';

  const status = payload.event === 'SUBSCRIPTION_DELETED'
    ? 'deleted'
    : payload.event === 'SUBSCRIPTION_INACTIVATED'
      ? 'inactive'
      : String(subscription.status || '').toUpperCase() === 'ACTIVE' ? 'active' : local.status;
  const { error } = await db.from('billing_subscriptions').update({
    status,
    provider_status: subscription.status || null,
    next_due_date: subscription.nextDueDate || local.next_due_date,
    metadata: safeProviderMetadata(subscription),
  }).eq('id', local.id);
  if (error) throw error;
  return 'processed';
}

async function processStoredEvent(db: any, eventRow: any) {
  const payload = eventRow.payload;
  if (!SUPPORTED_ASAAS_EVENTS.has(eventRow.event_type)) return 'ignored';
  if (eventRow.event_type.startsWith('PAYMENT_') || eventRow.event_type.startsWith('AWAITING_')) {
    return processPaymentEvent(db, eventRow, payload);
  }
  if (eventRow.event_type.startsWith('SUBSCRIPTION_')) return processSubscriptionEvent(db, payload);
  return 'ignored';
}

export function createBillingRouters(getSupabaseAdmin: () => any, requirePlatformAuth: any) {
  const publicRouter = Router();
  const adminRouter = Router();
  const internalRouter = Router();

  publicRouter.post('/asaas', async (req, res) => {
    const db = getSupabaseAdmin();
    let config;
    try {
      config = getBillingConfig();
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
    if (!config.enabled) return res.status(503).json({ error: 'Cobrança desabilitada.' });
    if (!webhookTokenMatches(req.header('asaas-access-token'), config.webhookToken)) {
      return res.status(401).json({ error: 'Webhook não autorizado.' });
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object' || !payload.id || !payload.event) {
      return res.status(400).json({ error: 'Evento inválido.' });
    }

    const insert = await db.from('billing_webhook_events').insert({
      provider: 'asaas',
      provider_event_id: String(payload.id),
      event_type: String(payload.event),
      occurred_at: payload.dateCreated || null,
      payload,
      status: 'received',
    }).select().single();

    let eventRow = insert.data;
    if (insert.error?.code === '23505') {
      const existing = await db.from('billing_webhook_events')
        .select('*').eq('provider', 'asaas').eq('provider_event_id', String(payload.id)).single();
      if (existing.error) return res.status(500).json({ error: 'Falha ao recuperar evento persistido.' });
      if (['processed', 'ignored', 'processing'].includes(existing.data.status)) {
        return res.status(200).json({ received: true, duplicate: true, status: existing.data.status });
      }
      eventRow = existing.data;
    } else if (insert.error) {
      return res.status(500).json({ error: 'Falha ao persistir evento.' });
    }

    try {
      await db.from('billing_webhook_events').update({
        status: 'processing', attempts: (eventRow.attempts || 0) + 1, last_error: null,
      }).eq('id', eventRow.id);
      const status = await processStoredEvent(db, { ...eventRow, payload, event_type: String(payload.event) });
      await db.from('billing_webhook_events').update({
        status, processed_at: new Date().toISOString(), last_error: null,
      }).eq('id', eventRow.id);
      return res.status(200).json({ received: true, status });
    } catch (error) {
      await db.from('billing_webhook_events').update({ status: 'failed', last_error: cleanError(error) }).eq('id', eventRow.id);
      return res.status(500).json({ error: 'Evento persistido, mas o processamento falhou.' });
    }
  });

  adminRouter.get('/billing/overview', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.read')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const [plans, subscriptions, overdue, failures, lastWebhook, lastReconciliation] = await Promise.all([
      db.from('billing_plans').select('*', { count: 'exact', head: true }).eq('active', true),
      db.from('billing_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('billing_payments').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
      db.from('billing_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      db.from('billing_webhook_events').select('event_type,status,received_at').order('received_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('billing_reconciliation_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    return res.json({
      configuration: publicBillingHealth(),
      counts: { plans: plans.count || 0, activeSubscriptions: subscriptions.count || 0, overduePayments: overdue.count || 0, failedWebhooks: failures.count || 0 },
      lastWebhook: lastWebhook.data || null,
      lastReconciliation: lastReconciliation.data || null,
    });
  });

  adminRouter.get('/billing/plans', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.read')) return res.status(403).json({ error: 'Forbidden' });
    const { data, error } = await getSupabaseAdmin().from('billing_plans')
      .select('*, billing_plan_prices(*), billing_plan_solutions(*, solutions(id,key,name))')
      .order('code').order('version', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  adminRouter.post('/billing/plans', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.manage')) return res.status(403).json({ error: 'Forbidden' });
    const { code, name, description, trial_days, grace_days, limits, amount_cents, cycle, billing_type, solution_ids } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Código e nome são obrigatórios.' });
    const db = getSupabaseAdmin();
    const { data: latest } = await db.from('billing_plans').select('version').eq('code', code).order('version', { ascending: false }).limit(1).maybeSingle();
    await db.from('billing_plans').update({ active: false, archived_at: new Date().toISOString() }).eq('code', code).eq('active', true);
    const { data, error } = await db.from('billing_plans').insert({
      code, version: (latest?.version || 0) + 1, name, description: description || null,
      trial_days: Number(trial_days || 0), grace_days: Number(grace_days ?? 5), limits: limits || {},
      created_by_user_id: req.user.id,
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    if (amount_cents !== undefined) {
      const { error: priceError } = await db.from('billing_plan_prices').insert({
        plan_id: data.id,
        amount_cents: Number(amount_cents),
        cycle: cycle || 'monthly',
        billing_type: billing_type || 'UNDEFINED',
      });
      if (priceError) return res.status(400).json({ error: priceError.message });
    }
    if (Array.isArray(solution_ids) && solution_ids.length) {
      const { error: solutionError } = await db.from('billing_plan_solutions').insert(
        solution_ids.map((solutionId: string) => ({ plan_id: data.id, solution_id: solutionId })),
      );
      if (solutionError) return res.status(400).json({ error: solutionError.message });
    }
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'billing.plan.created', entity_type: 'billing_plans', entity_id: data.id, severity: 'info' });
    return res.status(201).json(data);
  });

  adminRouter.get('/commercial/catalog', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.read')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const [solutions, teams] = await Promise.all([
      db.from('solutions').select('id,key,name').order('name'),
      db.from('platform_teams').select('id,name,status').eq('status', 'active').order('name'),
    ]);
    if (solutions.error || teams.error) return res.status(500).json({ error: solutions.error?.message || teams.error?.message });
    const scopedTeams = req.platformContext.role.key === 'admin'
      ? teams.data
      : teams.data.filter((team: any) => req.platformContext.teams.some((own: any) => own.id === team.id));
    return res.json({ solutions: solutions.data, teams: scopedTeams });
  });

  adminRouter.get('/commercial/demos', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.read')) return res.status(403).json({ error: 'Forbidden' });
    let query = getSupabaseAdmin().from('commercial_demos')
      .select('*, marketing_leads(id,name,email,company,status), platform_teams(id,name)')
      .order('created_at', { ascending: false });
    if (req.platformContext.role.key !== 'admin') {
      const teamIds = req.platformContext.teams.map((team: any) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in('team_id', teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  adminRouter.post('/commercial/leads/:leadId/activities', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    const { activity_type, subject, description, scheduled_at, status } = req.body;
    if (!activity_type || !subject) return res.status(400).json({ error: 'Tipo e assunto são obrigatórios.' });
    const db = getSupabaseAdmin();
    const { data: assignment } = await db.from('platform_lead_assignments').select('*').eq('lead_id', req.params.leadId).maybeSingle();
    if (req.platformContext.role.key !== 'admin' && (!assignment || !req.platformContext.teams.some((team: any) => team.id === assignment.team_id))) {
      return res.status(403).json({ error: 'Lead fora do seu escopo.' });
    }
    const { data, error } = await db.from('commercial_activities').insert({
      lead_id: req.params.leadId,
      team_id: assignment?.team_id || null,
      owner_platform_member_id: assignment?.owner_platform_member_id || req.platformContext.platformMember.id,
      activity_type,
      subject,
      description: description || null,
      scheduled_at: scheduled_at || null,
      status: status || 'planned',
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      created_by_user_id: req.user.id,
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  adminRouter.get('/commercial/proposals', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.read')) return res.status(403).json({ error: 'Forbidden' });
    let query = getSupabaseAdmin().from('commercial_proposals')
      .select('*, marketing_leads(id,name,email,company), billing_plans(id,name,code,version)')
      .order('created_at', { ascending: false });
    if (req.platformContext.role.key !== 'admin') {
      const teamIds = req.platformContext.teams.map((team: any) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in('team_id', teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  adminRouter.post('/commercial/proposals', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    const input = req.body;
    if (!input.lead_id || !input.plan_id || !Number.isInteger(Number(input.amount_cents))) return res.status(400).json({ error: 'Lead, plano e valor são obrigatórios.' });
    if (req.platformContext.role.key !== 'admin' && (!input.team_id || !req.platformContext.teams.some((team: any) => team.id === input.team_id))) {
      return res.status(403).json({ error: 'Equipe fora do seu escopo.' });
    }
    const { data, error } = await getSupabaseAdmin().from('commercial_proposals').insert({
      lead_id: input.lead_id, plan_id: input.plan_id, team_id: input.team_id || null,
      owner_platform_member_id: input.owner_platform_member_id || req.platformContext.platformMember.id,
      status: 'pending_approval', amount_cents: Number(input.amount_cents), cycle: input.cycle,
      billing_type: input.billing_type || 'UNDEFINED', valid_until: input.valid_until || null,
      discount_cents: Number(input.discount_cents || 0), notes: input.notes || null,
      created_by_user_id: req.user.id,
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await getSupabaseAdmin().from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.proposal.created', entity_type: 'commercial_proposals', entity_id: data.id, team_id: data.team_id, severity: 'info' });
    return res.status(201).json(data);
  });

  adminRouter.post('/commercial/proposals/:id/approve', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.approve')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const { data: proposal, error: readError } = await db.from('commercial_proposals').select('*').eq('id', req.params.id).single();
    if (readError) return res.status(404).json({ error: 'Proposta não encontrada.' });
    if (req.platformContext.role.key !== 'admin' && !req.platformContext.managedTeams.some((team: any) => team.id === proposal.team_id)) {
      return res.status(403).json({ error: 'Proposta fora da sua alçada.' });
    }
    const { data, error } = await db.from('commercial_proposals').update({
      status: 'approved', approved_by_user_id: req.user.id, approved_at: new Date().toISOString(), approval_notes: req.body.approval_notes || null,
    }).eq('id', proposal.id).eq('status', 'pending_approval').select().single();
    if (error) return res.status(409).json({ error: error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.proposal.approved', entity_type: 'commercial_proposals', entity_id: proposal.id, team_id: proposal.team_id, severity: 'info' });
    return res.json(data);
  });

  adminRouter.post('/commercial/proposals/:id/create-contract', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const { data: proposal, error } = await db.from('commercial_proposals')
      .select('*, marketing_leads(*), billing_plans(*)').eq('id', req.params.id).single();
    if (error || !proposal) return res.status(404).json({ error: 'Proposta não encontrada.' });
    if (proposal.status !== 'approved') return res.status(409).json({ error: 'A proposta precisa estar aprovada.' });
    if (req.platformContext.role.key !== 'admin' && !req.platformContext.teams.some((team: any) => team.id === proposal.team_id)) {
      return res.status(403).json({ error: 'Proposta fora do seu escopo.' });
    }
    const lead = proposal.marketing_leads;
    const { data: contract, error: contractError } = await db.from('commercial_contracts').insert({
      proposal_id: proposal.id, lead_id: proposal.lead_id, plan_id: proposal.plan_id,
      team_id: proposal.team_id, owner_platform_member_id: proposal.owner_platform_member_id,
      customer_name: lead.company, customer_email: lead.email,
      customer_tax_id: req.body.customer_tax_id || null, customer_phone: req.body.customer_phone || lead.phone,
      owner_name: lead.name, owner_email: lead.email, status: 'pending_approval',
      amount_cents: proposal.amount_cents, currency: proposal.currency, cycle: proposal.cycle,
      billing_type: proposal.billing_type || 'UNDEFINED', grace_days: proposal.billing_plans?.grace_days ?? 5,
      created_by_user_id: req.user.id,
    }).select().single();
    if (contractError) return res.status(contractError.code === '23505' ? 409 : 400).json({ error: contractError.code === '23505' ? 'Esta proposta já possui contrato.' : contractError.message });
    const { data: planSolutions } = await db.from('billing_plan_solutions').select('solution_id,limits').eq('plan_id', proposal.plan_id);
    if (planSolutions?.length) await db.from('commercial_contract_items').insert(planSolutions.map((item: any) => ({ contract_id: contract.id, solution_id: item.solution_id, limits: item.limits })));
    await db.from('commercial_proposals').update({ status: 'accepted' }).eq('id', proposal.id);
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.contract.created_from_proposal', entity_type: 'commercial_contracts', entity_id: contract.id, team_id: proposal.team_id, severity: 'info', metadata: { proposal_id: proposal.id } });
    return res.status(201).json(contract);
  });

  adminRouter.get('/commercial/contracts', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.read')) return res.status(403).json({ error: 'Forbidden' });
    let query = getSupabaseAdmin().from('commercial_contracts')
      .select('*, billing_plans(name,code,version), commercial_contract_items(*, solutions(id,key,name)), billing_subscriptions(id,status,provider_subscription_id), tenant_billing_state(access_status,paid_through,grace_ends_at)')
      .order('created_at', { ascending: false });
    if (req.platformContext.role.key !== 'admin') {
      const teamIds = req.platformContext.teams.map((team: any) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in('team_id', teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  adminRouter.post('/commercial/contracts', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    return res.status(405).json({ error: 'Crie o contrato a partir de uma proposta aprovada.' });
  });

  adminRouter.post('/commercial/contracts/:id/approve', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.approve')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const { data: contract, error: readError } = await db.from('commercial_contracts').select('*').eq('id', req.params.id).single();
    if (readError) return res.status(404).json({ error: 'Contrato não encontrado.' });
    if (req.platformContext.role.key !== 'admin' && !req.platformContext.managedTeams.some((team: any) => team.id === contract.team_id)) {
      return res.status(403).json({ error: 'Contrato fora da sua alçada.' });
    }
    const { data, error } = await db.from('commercial_contracts').update({ status: 'approved', approved_by_user_id: req.user.id, approved_at: new Date().toISOString() }).eq('id', contract.id).in('status', ['draft','pending_approval']).select().single();
    if (error) return res.status(409).json({ error: error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.contract.approved', entity_type: 'commercial_contracts', entity_id: contract.id, team_id: contract.team_id, severity: 'info' });
    return res.json(data);
  });

  adminRouter.post('/commercial/contracts/:id/start-billing', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.manage')) return res.status(403).json({ error: 'Forbidden' });
    try {
      const config = getBillingConfig();
      const provider = new AsaasBillingProvider(config);
      const db = getSupabaseAdmin();
      const { data: contract, error } = await db.from('commercial_contracts').select('*').eq('id', req.params.id).single();
      if (error || !contract) return res.status(404).json({ error: 'Contrato não encontrado.' });
      if (contract.status !== 'approved') return res.status(409).json({ error: 'O contrato precisa estar aprovado.' });
      if (!contract.customer_tax_id) return res.status(400).json({ error: 'CPF/CNPJ é obrigatório para criar o cliente no Asaas.' });

      let { data: customer } = await db.from('billing_customers').select('*').eq('contract_id', contract.id).maybeSingle();
      if (!customer) {
        const remote = await provider.findCustomerByExternalReference(contract.external_reference)
          || await provider.createCustomer({ name: contract.customer_name, email: contract.customer_email, cpfCnpj: contract.customer_tax_id, mobilePhone: contract.customer_phone, externalReference: contract.external_reference });
        const saved = await db.from('billing_customers').insert({
          contract_id: contract.id, lead_id: contract.lead_id, provider_customer_id: remote.id,
          external_reference: contract.external_reference, name: contract.customer_name, email: contract.customer_email,
          tax_id_last4: contract.customer_tax_id.replace(/\D/g, '').slice(-4), provider_status: 'ACTIVE',
        }).select().single();
        if (saved.error) throw saved.error;
        customer = saved.data;
      }

      const nextDueDate = req.body.next_due_date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate || '')) return res.status(400).json({ error: 'next_due_date deve usar YYYY-MM-DD.' });
      const { data: existingSubscription } = await db.from('billing_subscriptions').select('*').eq('contract_id', contract.id).maybeSingle();
      if (existingSubscription) return res.status(200).json(existingSubscription);
      const remoteSubscription = await provider.findSubscriptionByExternalReference(contract.external_reference) || await provider.createSubscription({
        customerId: customer.provider_customer_id,
        billingType: contract.billing_type,
        cycle: contract.cycle,
        amountCents: contract.amount_cents,
        nextDueDate,
        externalReference: contract.external_reference,
        description: `Contrato Ordum #${contract.contract_number}`,
      });
      const savedSubscription = await db.from('billing_subscriptions').insert({
        contract_id: contract.id, customer_id: customer.id, provider_subscription_id: remoteSubscription.id,
        external_reference: contract.external_reference, status: 'pending', provider_status: remoteSubscription.status || null,
        cycle: contract.cycle, billing_type: contract.billing_type, amount_cents: contract.amount_cents, next_due_date: nextDueDate,
      }).select().single();
      if (savedSubscription.error) throw savedSubscription.error;
      await db.from('commercial_contracts').update({ status: 'pending_payment' }).eq('id', contract.id);
      await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'billing.subscription.created', entity_type: 'billing_subscriptions', entity_id: savedSubscription.data.id, team_id: contract.team_id, severity: 'info' });
      return res.status(201).json(savedSubscription.data);
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
  });

  adminRouter.get('/billing/webhooks', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.webhooks.manage')) return res.status(403).json({ error: 'Forbidden' });
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    let query = getSupabaseAdmin().from('billing_webhook_events')
      .select('id,provider_event_id,event_type,status,received_at,processed_at,attempts,last_error,correlation_id')
      .order('received_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  adminRouter.post('/billing/webhooks/:id/reprocess', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.webhooks.manage')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const { data: eventRow, error } = await db.from('billing_webhook_events').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Evento não encontrado.' });
    try {
      await db.from('billing_webhook_events').update({ status: 'processing', attempts: eventRow.attempts + 1, last_error: null }).eq('id', eventRow.id);
      const status = await processStoredEvent(db, eventRow);
      await db.from('billing_webhook_events').update({ status, processed_at: new Date().toISOString() }).eq('id', eventRow.id);
      return res.json({ success: true, status });
    } catch (reprocessError) {
      const message = cleanError(reprocessError);
      await db.from('billing_webhook_events').update({ status: 'failed', last_error: message }).eq('id', eventRow.id);
      return res.status(500).json({ error: message });
    }
  });

  internalRouter.get('/reconcile', async (req, res) => {
    if (!webhookTokenMatches(req.header('authorization')?.replace(/^Bearer\s+/i, ''), process.env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
    const db = getSupabaseAdmin();
    const run = await db.from('billing_reconciliation_runs').insert({ provider: 'asaas', status: 'running' }).select().single();
    if (run.error) return res.status(500).json({ error: 'Não foi possível iniciar a conciliação.' });
    try {
      const config = getBillingConfig();
      if (!config.enabled) {
        await db.from('billing_reconciliation_runs').update({ status: 'completed', completed_at: new Date().toISOString(), summary: { skipped: 'billing_disabled' } }).eq('id', run.data.id);
        return res.json({ skipped: true, reason: 'billing_disabled' });
      }
      const provider = new AsaasBillingProvider(config);
      const { data: subscriptions, error } = await db.from('billing_subscriptions').select('*').in('status', ['pending','active','past_due']);
      if (error) throw error;
      let divergences = 0;
      let errors = 0;
      for (const subscription of subscriptions || []) {
        try {
          const remote = await provider.getSubscription(subscription.provider_subscription_id);
          if (remote.status && remote.status !== subscription.provider_status) {
            divergences += 1;
            await db.from('billing_subscriptions').update({ provider_status: remote.status }).eq('id', subscription.id);
          }
        } catch {
          errors += 1;
        }
      }
      const now = new Date().toISOString();
      const { data: expiredGrace } = await db.from('tenant_billing_state').select('tenant_id,contract_id,access_status').eq('access_status', 'grace').lt('grace_ends_at', now);
      for (const state of expiredGrace || []) {
        await db.from('tenant_billing_state').update({ access_status: 'suspended', suspended_at: now, suspension_reason: 'grace_expired' }).eq('tenant_id', state.tenant_id);
        await db.from('tenants').update({ status: 'suspended' }).eq('id', state.tenant_id);
        await db.from('commercial_contracts').update({ status: 'suspended' }).eq('id', state.contract_id);
      }
      const status = errors ? 'completed_with_errors' : 'completed';
      await db.from('billing_reconciliation_runs').update({ status, completed_at: now, checked_count: subscriptions?.length || 0, divergence_count: divergences, corrected_count: divergences, error_count: errors, summary: { graceSuspensions: expiredGrace?.length || 0 } }).eq('id', run.data.id);
      return res.json({ status, checked: subscriptions?.length || 0, divergences, errors, graceSuspensions: expiredGrace?.length || 0 });
    } catch (error) {
      await db.from('billing_reconciliation_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_count: 1, summary: { error: cleanError(error) } }).eq('id', run.data.id);
      return res.status(500).json({ error: 'Falha na conciliação.' });
    }
  });

  return { publicRouter, adminRouter, internalRouter };
}
