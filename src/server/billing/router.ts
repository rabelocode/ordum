import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { waitUntil } from '@vercel/functions';
import { AsaasBillingProvider } from './asaas';
import type { BillingProvider } from './provider';
import { canReadAssignedResource } from '../authorization';
import { auditContext, pageResult, parsePagination, withinManagerApprovalLimit } from '../operational';
import { getBillingConfig, publicBillingHealth } from './config';
import {
  SUPPORTED_ASAAS_EVENTS,
  accessTransitionForPaymentStatus,
  addGracePeriod,
  centsFromProvider,
  normalizePaymentStatus,
  normalizeProviderPaymentStatus,
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

function needsProviderVerification(eventType: string) {
  return ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'].includes(eventType);
}

async function processPaymentEvent(db: any, eventRow: any, payload: any, provider?: BillingProvider) {
  let payment = payload.payment;
  if (!payment?.id) return 'ignored';

  if (needsProviderVerification(payload.event)) {
    if (!provider) throw new Error('Consulta ao provedor é obrigatória para esta transição.');
    payment = await provider.getPayment(payment.id);
  }

  const { contract, subscription } = await resolveContract(db, payment, payment.subscription);
  const providerStatus = payment.status ? String(payment.status) : undefined;
  let normalizedStatus = needsProviderVerification(payload.event)
    ? normalizeProviderPaymentStatus(providerStatus)
    : normalizePaymentStatus(payload.event, providerStatus);

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

export async function processStoredEvent(db: any, eventRow: any, provider?: BillingProvider) {
  const payload = eventRow.payload;
  if (!SUPPORTED_ASAAS_EVENTS.has(eventRow.event_type)) return 'ignored';
  if (eventRow.event_type.startsWith('PAYMENT_')) {
    return processPaymentEvent(db, eventRow, payload, provider);
  }
  if (eventRow.event_type.startsWith('SUBSCRIPTION_')) return processSubscriptionEvent(db, payload);
  return 'ignored';
}

export async function processPendingWebhookEvents(db: any, provider?: BillingProvider, limit = 10) {
  const claim = await db.rpc('claim_billing_webhook_events', { p_limit: limit });
  if (claim.error) throw claim.error;
  const results: Array<{ id: string; status: string }> = [];
  for (const eventRow of claim.data || []) {
    try {
      const status = await processStoredEvent(db, eventRow, provider);
      await db.from('billing_webhook_events').update({
        status, processed_at: new Date().toISOString(), locked_at: null, last_error: null,
      }).eq('id', eventRow.id);
      results.push({ id: eventRow.id, status });
    } catch (error) {
      const delaySeconds = Math.min(3600, 2 ** Math.min(eventRow.attempts || 1, 10));
      await db.from('billing_webhook_events').update({
        status: 'failed', locked_at: null, last_error: cleanError(error),
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      }).eq('id', eventRow.id);
      results.push({ id: eventRow.id, status: 'failed' });
    }
  }
  return results;
}

function scheduleBackgroundWork(work: Promise<unknown>) {
  try {
    waitUntil(work);
  } catch {
    void work;
  }
}

async function scopedContractIds(db: any, context: any): Promise<string[] | null> {
  if (context.role?.key === 'admin') return null;
  const result = await db.from('commercial_contracts').select('id,team_id,owner_platform_member_id');
  if (result.error) throw result.error;
  return (result.data || [])
    .filter((contract: any) => canReadAssignedResource(context, contract, 'member_client_visibility'))
    .map((contract: any) => contract.id);
}

function eventForRemotePayment(payment: any) {
  const status = String(payment?.status || '').toUpperCase();
  if (status === 'RECEIVED' || status === 'RECEIVED_IN_CASH') return 'PAYMENT_RECEIVED';
  if (status === 'CONFIRMED') return 'PAYMENT_CONFIRMED';
  if (status === 'OVERDUE' || status === 'DUNNING_REQUESTED') return 'PAYMENT_OVERDUE';
  if (status === 'REFUNDED') return 'PAYMENT_REFUNDED';
  if (status === 'PARTIALLY_REFUNDED') return 'PAYMENT_PARTIALLY_REFUNDED';
  if (status === 'CHARGEBACK_REQUESTED') return 'PAYMENT_CHARGEBACK_REQUESTED';
  if (status === 'CHARGEBACK_DISPUTE') return 'PAYMENT_CHARGEBACK_DISPUTE';
  if (status === 'DELETED') return 'PAYMENT_DELETED';
  return 'PAYMENT_UPDATED';
}

async function runBillingReconciliation(db: any, triggeredByUserId?: string | null) {
  const run = await db.from('billing_reconciliation_runs').insert({
    provider: 'asaas', status: 'running', triggered_by_user_id: triggeredByUserId || null,
  }).select().single();
  if (run.error) throw new Error('Não foi possível iniciar a conciliação.');
  const runId = run.data.id;
  try {
    const config = getBillingConfig();
    if (!config.enabled) {
      const summary = { skipped: 'billing_disabled', queueProcessed: 0 };
      await db.from('billing_reconciliation_runs').update({ status: 'completed', completed_at: new Date().toISOString(), summary }).eq('id', runId);
      return { skipped: true, reason: 'billing_disabled' };
    }
    const provider = new AsaasBillingProvider(config);
    const queue = await processPendingWebhookEvents(db, provider, 50);
    const localResult = await db.from('billing_subscriptions').select('*');
    if (localResult.error) throw localResult.error;
    const localSubscriptions = localResult.data || [];
    let checked = 0; let divergences = 0; let corrected = 0; let errors = 0; let recoveredPayments = 0; let critical = 0;

    for (const subscription of localSubscriptions) {
      try {
        const remote = await provider.getSubscription(subscription.provider_subscription_id);
        checked += 1;
        if (remote.externalReference && String(remote.externalReference) !== String(subscription.external_reference)) {
          divergences += 1; critical += 1;
          await db.from('billing_reconciliation_items').insert({ reconciliation_run_id: runId, resource_type: 'subscription', provider_resource_id: subscription.provider_subscription_id, local_resource_id: subscription.id, severity: 'critical', kind: 'external_reference_mismatch', safe_summary: { local: subscription.external_reference, remote: remote.externalReference } });
          continue;
        }
        if (remote.status && remote.status !== subscription.provider_status) {
          divergences += 1; corrected += 1;
          const normalized = String(remote.status).toUpperCase() === 'ACTIVE' ? 'active' : String(remote.status).toUpperCase() === 'INACTIVE' ? 'inactive' : subscription.status;
          await db.from('billing_subscriptions').update({ provider_status: remote.status, status: normalized, next_due_date: remote.nextDueDate || subscription.next_due_date }).eq('id', subscription.id);
          await db.from('billing_reconciliation_items').insert({ reconciliation_run_id: runId, resource_type: 'subscription', provider_resource_id: subscription.provider_subscription_id, local_resource_id: subscription.id, severity: 'warning', status: 'auto_corrected', kind: 'provider_status_drift', safe_summary: { from: subscription.provider_status, to: remote.status } });
        }

        let offset = 0; let hasMore = true;
        while (hasMore) {
          const page = await provider.listPayments({ subscriptionId: subscription.provider_subscription_id, offset, limit: 100 });
          const payments = Array.isArray(page.data) ? page.data as any[] : [];
          for (const payment of payments) {
            checked += 1;
            const eventType = eventForRemotePayment(payment);
            const providerEventId = `reconcile:${payment.id}:${String(payment.status || 'unknown')}`;
            const inserted = await db.from('billing_webhook_events').insert({ provider: 'asaas', provider_event_id: providerEventId, event_type: eventType, occurred_at: payment.dateCreated || null, payload: { id: providerEventId, event: eventType, dateCreated: new Date().toISOString(), payment }, status: 'processing', attempts: 1, locked_at: new Date().toISOString() }).select().single();
            if (inserted.error?.code === '23505') continue;
            if (inserted.error) throw inserted.error;
            const result = await processStoredEvent(db, inserted.data, provider);
            await db.from('billing_webhook_events').update({ status: result, processed_at: new Date().toISOString(), locked_at: null }).eq('id', inserted.data.id);
            recoveredPayments += 1; corrected += 1; divergences += 1;
            await db.from('billing_reconciliation_items').insert({ reconciliation_run_id: runId, resource_type: 'payment', provider_resource_id: payment.id, local_resource_id: inserted.data.id, severity: 'warning', status: 'auto_corrected', kind: 'missing_or_changed_payment', safe_summary: { provider_status: payment.status } });
          }
          hasMore = Boolean(page.hasMore);
          offset += payments.length;
          if (!payments.length) hasMore = false;
        }
      } catch (error) {
        errors += 1;
        await db.from('billing_reconciliation_items').insert({ reconciliation_run_id: runId, resource_type: 'subscription', provider_resource_id: subscription.provider_subscription_id, local_resource_id: subscription.id, severity: 'critical', kind: 'provider_query_failed', safe_summary: { error: cleanError(error) } });
      }
    }

    let remoteOffset = 0; let remoteHasMore = true;
    const localProviderIds = new Set(localSubscriptions.map((item: any) => item.provider_subscription_id));
    while (remoteHasMore) {
      const page = await provider.listSubscriptions(remoteOffset, 100);
      const rows = Array.isArray(page.data) ? page.data as any[] : [];
      for (const remote of rows) {
        if (!localProviderIds.has(remote.id) && remote.externalReference) {
          divergences += 1; critical += 1;
          await db.from('billing_reconciliation_items').insert({ reconciliation_run_id: runId, resource_type: 'subscription', provider_resource_id: remote.id, severity: 'critical', kind: 'remote_subscription_missing_locally', safe_summary: { external_reference: remote.externalReference, provider_status: remote.status } });
        }
      }
      remoteHasMore = Boolean(page.hasMore); remoteOffset += rows.length; if (!rows.length) remoteHasMore = false;
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const expiredGrace = await db.from('tenant_billing_state').select('tenant_id,contract_id').eq('access_status', 'grace').lt('grace_ends_at', now);
    for (const state of expiredGrace.data || []) {
      await db.from('tenant_billing_state').update({ access_status: 'suspended', suspended_at: now, suspension_reason: 'grace_expired' }).eq('tenant_id', state.tenant_id);
      await db.from('tenants').update({ status: 'suspended' }).eq('id', state.tenant_id);
      await db.from('commercial_contracts').update({ status: 'suspended' }).eq('id', state.contract_id);
      corrected += 1;
    }
    const cancelledContracts = await db.from('commercial_contracts').select('id,tenant_id').eq('status', 'cancelled').not('tenant_id', 'is', null);
    for (const contract of cancelledContracts.data || []) {
      const state = await db.from('tenant_billing_state').select('paid_through,access_status').eq('tenant_id', contract.tenant_id).maybeSingle();
      if (state.data?.paid_through && state.data.paid_through < today && state.data.access_status !== 'cancelled') {
        await db.from('tenant_billing_state').update({ access_status: 'cancelled', suspended_at: now, suspension_reason: 'cancelled_period_ended' }).eq('tenant_id', contract.tenant_id);
        await db.from('tenants').update({ status: 'suspended' }).eq('id', contract.tenant_id);
        corrected += 1;
      }
    }
    const status = errors || critical ? 'completed_with_errors' : 'completed';
    const summary = { queueProcessed: queue.length, recoveredPayments, graceSuspensions: expiredGrace.data?.length || 0, criticalReview: critical };
    await db.from('billing_reconciliation_runs').update({ status, completed_at: now, checked_count: checked, divergence_count: divergences, corrected_count: corrected, error_count: errors, summary }).eq('id', runId);
    return { status, checked, divergences, corrected, errors, ...summary };
  } catch (error) {
    await db.from('billing_reconciliation_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_count: 1, summary: { error: cleanError(error) } }).eq('id', runId);
    throw error;
  }
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

    const rateKey = createHash('sha256')
      .update(`${req.header('x-forwarded-for')?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'}:asaas`)
      .digest('hex');
    const rate = await db.rpc('check_billing_webhook_rate_limit', {
      p_key_hash: rateKey, p_limit: 120, p_window_seconds: 60,
    });
    if (rate.error) return res.status(500).json({ error: 'Falha ao validar limite do webhook.' });
    if (!rate.data) return res.status(429).json({ error: 'Limite de webhook excedido.' });

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
      if (['processed', 'ignored', 'processing', 'received'].includes(existing.data.status)) {
        return res.status(200).json({ received: true, duplicate: true, status: existing.data.status });
      }
      eventRow = existing.data;
      await db.from('billing_webhook_events').update({
        status: 'received', next_attempt_at: new Date().toISOString(), locked_at: null,
      }).eq('id', eventRow.id);
    } else if (insert.error) {
      return res.status(500).json({ error: 'Falha ao persistir evento.' });
    }

    const provider = new AsaasBillingProvider(config);
    scheduleBackgroundWork(processPendingWebhookEvents(db, provider, 10));
    return res.status(200).json({ received: true, status: 'received', correlationId: eventRow.correlation_id });
  });

  adminRouter.get('/billing/overview', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.read')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const contractIds = await scopedContractIds(db, req.platformContext);
    if (contractIds && !contractIds.length) return res.json({
      configuration: publicBillingHealth(), counts: { plans: 0, activeSubscriptions: 0, overduePayments: 0, failedWebhooks: 0 },
      lastWebhook: null, lastReconciliation: null,
    });
    let subscriptionQuery = db.from('billing_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active');
    let overdueQuery = db.from('billing_payments').select('*', { count: 'exact', head: true }).eq('status', 'overdue');
    if (contractIds) {
      subscriptionQuery = subscriptionQuery.in('contract_id', contractIds);
      overdueQuery = overdueQuery.in('contract_id', contractIds);
    }
    const isAdmin = req.platformContext.role?.key === 'admin';
    const [plans, subscriptions, overdue, failures, lastWebhook, lastReconciliation] = await Promise.all([
      db.from('billing_plans').select('*', { count: 'exact', head: true }).eq('active', true),
      subscriptionQuery,
      overdueQuery,
      isAdmin ? db.from('billing_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'failed') : Promise.resolve({ count: 0 }),
      isAdmin ? db.from('billing_webhook_events').select('event_type,status,received_at').order('received_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      isAdmin ? db.from('billing_reconciliation_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return res.json({
      configuration: publicBillingHealth(),
      counts: { plans: plans.count || 0, activeSubscriptions: subscriptions.count || 0, overduePayments: overdue.count || 0, failedWebhooks: failures.count || 0 },
      lastWebhook: lastWebhook.data || null,
      lastReconciliation: lastReconciliation.data || null,
    });
  });

  adminRouter.get('/billing/records', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.read')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const contractIds = await scopedContractIds(db, req.platformContext);
    const { page, pageSize, from, to } = parsePagination(req.query);
    if (contractIds && !contractIds.length) return res.json({ subscriptions: pageResult([], 0, page, pageSize), payments: pageResult([], 0, page, pageSize) });
    let subscriptions = db.from('billing_subscriptions')
      .select('*, billing_customers(name,email,tax_id_last4), commercial_contracts(contract_number,customer_name,team_id,owner_platform_member_id)', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, to);
    let payments = db.from('billing_payments')
      .select('*, commercial_contracts(contract_number,customer_name,team_id,owner_platform_member_id)', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, to);
    if (contractIds) { subscriptions = subscriptions.in('contract_id', contractIds); payments = payments.in('contract_id', contractIds); }
    if (typeof req.query.status === 'string' && req.query.status) { subscriptions = subscriptions.eq('status', req.query.status); payments = payments.eq('status', req.query.status); }
    const [subscriptionResult, paymentResult] = await Promise.all([subscriptions, payments]);
    if (subscriptionResult.error || paymentResult.error) return res.status(500).json({ error: subscriptionResult.error?.message || paymentResult.error?.message });
    return res.json({
      subscriptions: pageResult(subscriptionResult.data || [], subscriptionResult.count, page, pageSize),
      payments: pageResult(paymentResult.data || [], paymentResult.count, page, pageSize),
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
    const { code, name, description, trial_days, grace_days, limits, amount_cents, cycle, billing_type, solution_ids, solution_limits } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Código e nome são obrigatórios.' });
    const db = getSupabaseAdmin();
    const created = await db.rpc('admin_create_billing_plan_version', {
      p_code: code, p_name: name, p_description: description || '', p_trial_days: Number(trial_days || 0),
      p_grace_days: Number(grace_days ?? 5), p_limits: limits || {}, p_amount_cents: amount_cents === undefined ? null : Number(amount_cents),
      p_cycle: cycle || 'monthly', p_billing_type: billing_type || 'UNDEFINED', p_solution_ids: Array.isArray(solution_ids) ? solution_ids : [],
      p_solution_limits: solution_limits || {}, p_actor_user_id: req.user.id,
    });
    if (created.error) return res.status(400).json({ error: created.error.message });
    const saved = await db.from('billing_plans').select('*,billing_plan_prices(*),billing_plan_solutions(*)').eq('id', created.data).single();
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'billing.plan.created', entity_type: 'billing_plans', entity_id: created.data, severity: 'info', ...auditContext(req, { result: 'success', after: { code, version: saved.data?.version } }) });
    return res.status(201).json(saved.data);
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
    const scoped = req.platformContext.role.key === 'admin' ? data : (data || []).filter((item: any) => canReadAssignedResource(req.platformContext, item, 'member_lead_visibility'));
    const { page, pageSize, from, to } = parsePagination(req.query);
    return res.json(req.query.page !== undefined ? pageResult(scoped.slice(from, to + 1), scoped.length, page, pageSize) : scoped);
  });

  adminRouter.patch('/commercial/demos/:id', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const existing = await db.from('commercial_demos').select('*').eq('id', req.params.id).single();
    if (existing.error) return res.status(404).json({ error: 'Demonstração não encontrada.' });
    if (!canReadAssignedResource(req.platformContext, existing.data, 'member_lead_visibility')) return res.status(403).json({ error: 'Demonstração fora do seu escopo.' });
    const allowed = ['status', 'starts_at', 'expires_at', 'notes', 'result', 'next_action', 'next_action_at'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const saved = await db.from('commercial_demos').update(updates).eq('id', existing.data.id).select().single();
    if (saved.error) return res.status(400).json({ error: saved.error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.demo.updated', entity_type: 'commercial_demos', entity_id: existing.data.id, team_id: existing.data.team_id, severity: 'info', ...auditContext(req, { result: 'success', before: existing.data, after: saved.data }) });
    return res.json(saved.data);
  });

  adminRouter.post('/commercial/leads/:leadId/activities', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    const { activity_type, subject, description, scheduled_at, status, result, next_action, next_action_at } = req.body;
    if (!activity_type || !subject) return res.status(400).json({ error: 'Tipo e assunto são obrigatórios.' });
    const db = getSupabaseAdmin();
    const { data: assignment } = await db.from('platform_lead_assignments').select('*').eq('lead_id', req.params.leadId).maybeSingle();
    if (req.platformContext.role.key !== 'admin' && !canReadAssignedResource(req.platformContext, assignment, 'member_lead_visibility')) {
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
      result: result || null,
      next_action: next_action || null,
      next_action_at: next_action_at || null,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      created_by_user_id: req.user.id,
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.activity.created', entity_type: 'commercial_activities', entity_id: data.id, team_id: data.team_id, severity: 'info', ...auditContext(req, { result: 'success', after: { activity_type, subject, status: status || 'planned' } }) });
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
    const scoped = req.platformContext.role.key === 'admin' ? data : (data || []).filter((item: any) => canReadAssignedResource(req.platformContext, item, 'member_lead_visibility'));
    const { page, pageSize, from, to } = parsePagination(req.query);
    return res.json(req.query.page !== undefined ? pageResult(scoped.slice(from, to + 1), scoped.length, page, pageSize) : scoped);
  });

  adminRouter.post('/commercial/proposals', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.commercial.manage')) return res.status(403).json({ error: 'Forbidden' });
    const input = req.body;
    if (!input.lead_id || !input.plan_id || !Number.isInteger(Number(input.amount_cents))) return res.status(400).json({ error: 'Lead, plano e valor são obrigatórios.' });
    const db = getSupabaseAdmin();
    const assignmentResult = await db.from('platform_lead_assignments').select('*').eq('lead_id', input.lead_id).maybeSingle();
    const assignment = assignmentResult.data;
    if (req.platformContext.role.key !== 'admin' && (!assignment || !canReadAssignedResource(req.platformContext, assignment, 'member_lead_visibility'))) {
      return res.status(403).json({ error: 'Lead fora do seu escopo.' });
    }
    if (req.platformContext.role.key !== 'admin' && input.team_id !== assignment.team_id) return res.status(403).json({ error: 'A proposta deve permanecer na equipe atribuída ao lead.' });
    const ownerId = req.platformContext.role.key === 'sales' ? req.platformContext.platformMember.id : (input.owner_platform_member_id || assignment?.owner_platform_member_id || req.platformContext.platformMember.id);
    if (input.team_id && ownerId) {
      const target = await db.from('platform_team_members').select('platform_member_id').eq('team_id', input.team_id).eq('platform_member_id', ownerId).eq('status', 'active').maybeSingle();
      if (!target.data) return res.status(400).json({ error: 'O responsável precisa ser membro ativo da equipe.' });
    }
    const { data, error } = await db.from('commercial_proposals').insert({
      lead_id: input.lead_id, plan_id: input.plan_id, team_id: input.team_id || null,
      owner_platform_member_id: ownerId,
      status: 'pending_approval', amount_cents: Number(input.amount_cents), cycle: input.cycle,
      billing_type: input.billing_type || 'UNDEFINED', valid_until: input.valid_until || null,
      discount_cents: Number(input.discount_cents || 0), notes: input.notes || null,
      created_by_user_id: req.user.id,
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'commercial.proposal.created', entity_type: 'commercial_proposals', entity_id: data.id, team_id: data.team_id, severity: 'info', ...auditContext(req, { result: 'success', after: { amount_cents: data.amount_cents, cycle: data.cycle, status: data.status } }) });
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
    if (req.platformContext.role.key !== 'admin') {
      const team = req.platformContext.managedTeams.find((item: any) => item.id === proposal.team_id);
      if (!withinManagerApprovalLimit(team, proposal.amount_cents, 'proposal')) return res.status(403).json({ error: 'Valor acima da alçada configurada; aprovação de admin necessária.' });
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
    if (req.platformContext.role.key !== 'admin' && !canReadAssignedResource(req.platformContext, proposal, 'member_lead_visibility')) {
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
    const scoped = req.platformContext.role.key === 'admin' ? data : (data || []).filter((item: any) => canReadAssignedResource(req.platformContext, item, 'member_client_visibility'));
    const { page, pageSize, from, to } = parsePagination(req.query);
    return res.json(req.query.page !== undefined ? pageResult(scoped.slice(from, to + 1), scoped.length, page, pageSize) : scoped);
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
    if (req.platformContext.role.key !== 'admin') {
      const team = req.platformContext.managedTeams.find((item: any) => item.id === contract.team_id);
      if (!withinManagerApprovalLimit(team, contract.amount_cents, 'contract')) return res.status(403).json({ error: 'Valor acima da alçada configurada; aprovação de admin necessária.' });
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

  adminRouter.post('/billing/subscriptions/:id/cancel', requirePlatformAuth, async (req: any, res) => {
    if (req.platformContext.role?.key !== 'admin' || !hasPermission(req.platformContext, 'platform.billing.manage')) return res.status(403).json({ error: 'Somente admin pode cancelar recorrência.' });
    if (!req.body?.reason || String(req.body.reason).trim().length < 5) return res.status(400).json({ error: 'Informe um motivo de cancelamento.' });
    const db = getSupabaseAdmin();
    const local = await db.from('billing_subscriptions').select('*, commercial_contracts(*)').eq('id', req.params.id).single();
    if (local.error || !local.data) return res.status(404).json({ error: 'Assinatura não encontrada.' });
    try {
      const provider = new AsaasBillingProvider(getBillingConfig());
      await provider.cancelSubscription(local.data.provider_subscription_id);
      const now = new Date().toISOString();
      await db.from('billing_subscriptions').update({ status: 'cancelled', cancelled_at: now }).eq('id', local.data.id);
      await db.from('commercial_contracts').update({ status: 'cancelled', cancelled_at: now, cancellation_at_period_end: true }).eq('id', local.data.contract_id);
      await db.from('platform_audit_logs').insert({
        actor_user_id: req.user.id, action: 'billing.subscription.cancelled', entity_type: 'billing_subscriptions', entity_id: local.data.id,
        team_id: local.data.commercial_contracts?.team_id || null, severity: 'warning',
        ...auditContext(req, { result: 'success', reason: String(req.body.reason).slice(0, 500), access_until: local.data.commercial_contracts?.ends_on || null }),
      });
      return res.json({ success: true, accessPolicy: 'period_end' });
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
  });

  adminRouter.get('/billing/webhooks', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.webhooks.manage')) return res.status(403).json({ error: 'Forbidden' });
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    let query = getSupabaseAdmin().from('billing_webhook_events')
      .select('id,provider_event_id,event_type,status,received_at,processed_at,attempts,last_error,correlation_id', { count: 'exact' })
      .order('received_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { page, pageSize, from, to } = parsePagination(req.query);
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(req.query.page !== undefined ? pageResult(data || [], count, page, pageSize) : data);
  });

  adminRouter.post('/billing/webhooks/:id/reprocess', requirePlatformAuth, async (req: any, res) => {
    if (!hasPermission(req.platformContext, 'platform.billing.webhooks.manage')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const { data: eventRow, error } = await db.from('billing_webhook_events').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Evento não encontrado.' });
    try {
      const provider = new AsaasBillingProvider(getBillingConfig());
      await db.from('billing_webhook_events').update({ status: 'received', next_attempt_at: new Date().toISOString(), locked_at: null, last_error: null }).eq('id', eventRow.id);
      const results = await processPendingWebhookEvents(db, provider, 1);
      await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'billing.webhook.reprocessed', entity_type: 'billing_webhook_events', entity_id: eventRow.id, severity: 'warning', ...auditContext(req, { result: results[0]?.status || 'not_claimed' }) });
      return res.json({ success: true, status: results[0]?.status || 'queued' });
    } catch (reprocessError) {
      return res.status(500).json({ error: cleanError(reprocessError) });
    }
  });

  adminRouter.post('/billing/reconcile', requirePlatformAuth, async (req: any, res) => {
    if (req.platformContext.role?.key !== 'admin' || !hasPermission(req.platformContext, 'platform.billing.manage')) return res.status(403).json({ error: 'Forbidden' });
    try {
      const result = await runBillingReconciliation(getSupabaseAdmin(), req.user.id);
      await getSupabaseAdmin().from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'billing.reconciliation.executed', entity_type: 'billing_reconciliation_runs', severity: 'warning', ...auditContext(req, { result }) });
      return res.json(result);
    } catch {
      return res.status(500).json({ error: 'Falha na conciliação.' });
    }
  });

  internalRouter.get('/reconcile', async (req, res) => {
    if (!webhookTokenMatches(req.header('authorization')?.replace(/^Bearer\s+/i, ''), process.env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.json(await runBillingReconciliation(getSupabaseAdmin()));
    } catch {
      return res.status(500).json({ error: 'Falha na conciliação.' });
    }
  });

  return { publicRouter, adminRouter, internalRouter };
}
