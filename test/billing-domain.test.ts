import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_ASAAS_EVENTS, accessTransitionForEvent, accessTransitionForPaymentStatus, addGracePeriod, centsFromProvider, normalizePaymentStatus, paidPeriod, preserveSettledPaymentStatus, safeProviderMetadata } from '../src/server/billing/domain';
import { getBillingConfig } from '../src/server/billing/config';
import { processPendingWebhookEvents, processStoredEvent, runBillingReconciliation, webhookTokenMatches } from '../src/server/billing/router';
import { AsaasBillingProvider } from '../src/server/billing/asaas';

test('billing stays disabled and Sandbox-only by default', () => {
  const config = getBillingConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.environment, 'sandbox');
});

test('production configuration is blocked even when enabled', () => {
  assert.throws(() => getBillingConfig({ BILLING_ENABLED: 'true', ASAAS_ENV: 'production' }), /produção permanece bloqueada/);
});

test('Sandbox rejects a production-shaped API key', () => {
  assert.throws(() => getBillingConfig({ ASAAS_API_KEY: '$aact_prod_invalid' }), /não parece ser uma chave Asaas Sandbox/);
});

test('provider money is normalized to integer cents', () => {
  assert.equal(centsFromProvider(199.9), 19990);
  assert.equal(centsFromProvider('0.01'), 1);
});

test('payment events drive the central access state', () => {
  assert.equal(normalizePaymentStatus('PAYMENT_CONFIRMED'), 'confirmed');
  assert.equal(accessTransitionForEvent('PAYMENT_CONFIRMED'), 'active');
  assert.equal(accessTransitionForEvent('PAYMENT_OVERDUE'), 'grace');
  assert.equal(accessTransitionForEvent('PAYMENT_CHARGEBACK_REQUESTED'), 'review');
  assert.equal(accessTransitionForEvent('PAYMENT_PARTIALLY_REFUNDED'), null);
  assert.equal(accessTransitionForEvent('PAYMENT_REFUNDED'), 'review');
  assert.equal(accessTransitionForEvent('PAYMENT_DUNNING_RECEIVED'), 'active');
  assert.equal(accessTransitionForPaymentStatus(preserveSettledPaymentStatus('received', 'overdue')), 'active');
});

test('invalid webhook authentication is rejected with constant-length comparison', () => {
  assert.equal(webhookTokenMatches('expected', 'expected'), true);
  assert.equal(webhookTokenMatches('invalid', 'expected'), false);
  assert.equal(webhookTokenMatches(undefined, 'expected'), false);
});

test('out-of-order pending updates cannot downgrade a settled payment', () => {
  assert.equal(preserveSettledPaymentStatus('confirmed', 'pending'), 'confirmed');
  assert.equal(preserveSettledPaymentStatus('received', 'pending'), 'received');
  assert.equal(preserveSettledPaymentStatus('received', 'overdue'), 'received');
  assert.equal(preserveSettledPaymentStatus('overdue', 'received'), 'received');
  assert.equal(preserveSettledPaymentStatus('received', 'chargeback'), 'chargeback');
});

test('unknown provider attributes are tolerated and sensitive fields are not copied', () => {
  assert.deepEqual(safeProviderMetadata({ description: 'Plano', newField: 'accepted', creditCard: { number: 'never' } }), { description: 'Plano' });
});

test('renewal starts after the existing paid period without duplication', () => {
  assert.deepEqual(paidPeriod('2026-08-10', 'monthly', null), { startsOn: '2026-08-10', endsOn: '2026-09-09' });
  assert.deepEqual(paidPeriod('2026-08-10', 'monthly', '2026-09-09'), { startsOn: '2026-09-10', endsOn: '2026-10-09' });
});

test('current Asaas chargeback reversal event is supported and legacy typo is not', () => {
  assert.equal(SUPPORTED_ASAAS_EVENTS.has('PAYMENT_AWAITING_CHARGEBACK_REVERSAL'), true);
  assert.equal(SUPPORTED_ASAAS_EVENTS.has('AWAITING_CHARGEBACK_REVERSAL'), false);
  assert.equal(accessTransitionForEvent('PAYMENT_AWAITING_CHARGEBACK_REVERSAL'), 'review');
});

test('grace deadline is deterministic and partial refund does not suspend access', () => {
  assert.equal(addGracePeriod('2026-08-01', 5), '2026-08-06T00:00:00.000Z');
  assert.equal(accessTransitionForEvent('PAYMENT_PARTIALLY_REFUNDED'), null);
});

test('unknown webhook events with extra fields are durably ignored by the worker', async () => {
  const event = { id: 'evt', event_type: 'FUTURE_EVENT', payload: { event: 'FUTURE_EVENT', future: { anything: true } } };
  assert.equal(await processStoredEvent({}, event), 'ignored');
  const updates: any[] = [];
  const db = {
    rpc: async () => ({ data: [{ ...event, attempts: 1 }], error: null }),
    from: () => ({ update: (value: any) => ({ eq: async () => { updates.push(value); return { error: null }; } }) }),
  };
  assert.deepEqual(await processPendingWebhookEvents(db, undefined, 1), [{ id: 'evt', status: 'ignored' }]);
  assert.equal(updates[0].status, 'ignored');
});

test('Asaas adapter uses authenticated DELETE for period-end cancellation and paginated reconciliation', async () => {
  const originalFetch = globalThis.fetch; const calls: any[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ data: [], hasMore: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }) as any;
  try {
    const provider = new AsaasBillingProvider({ enabled: true, provider: 'asaas', environment: 'sandbox', apiKey: '$aact_hml_test', webhookToken: 'token', baseUrl: 'https://api-sandbox.asaas.com/v3', userAgent: 'Ordum-Test' });
    await provider.cancelSubscription('sub_123'); await provider.listPayments({ subscriptionId: 'sub_123', offset: 100, limit: 100 });
    assert.equal(calls[0].init.method, 'DELETE'); assert.equal(calls[0].init.headers.access_token, '$aact_hml_test');
    assert.match(calls[1].url, /subscription=sub_123/); assert.match(calls[1].url, /offset=100/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Asaas Sandbox adapter covers customer, subscription, charge lookup and cancellation without real network calls', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/customers')) return new Response(JSON.stringify({ id: 'cus_sandbox' }), { status: 200 });
    if (url.endsWith('/subscriptions') && init.method === 'POST') return new Response(JSON.stringify({ id: 'sub_sandbox' }), { status: 200 });
    if (url.endsWith('/payments/pay_sandbox')) return new Response(JSON.stringify({ id: 'pay_sandbox', status: 'CONFIRMED' }), { status: 200 });
    if (url.endsWith('/subscriptions/sub_sandbox') && init.method === 'DELETE') return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    return new Response('{}', { status: 404 });
  }) as any;
  try {
    const provider = new AsaasBillingProvider({ enabled: true, provider: 'asaas', environment: 'sandbox', apiKey: '$aact_hml_fixture', webhookToken: 'fixture', baseUrl: 'https://api-sandbox.asaas.com/v3', userAgent: 'Ordum-Test' });
    assert.equal((await provider.createCustomer({ name: 'Pilot Fixture', email: 'fixture@example.invalid', cpfCnpj: '00000000000', externalReference: 'contract-fixture' })).id, 'cus_sandbox');
    assert.equal((await provider.createSubscription({ customerId: 'cus_sandbox', billingType: 'PIX', cycle: 'monthly', amountCents: 19990, nextDueDate: '2026-08-10', externalReference: 'contract-fixture', description: 'Plano fixture' })).id, 'sub_sandbox');
    assert.equal((await provider.getPayment('pay_sandbox')).status, 'CONFIRMED');
    assert.equal((await provider.cancelSubscription('sub_sandbox')).deleted, true);
    const subscriptionPayload = JSON.parse(String(calls[1].init.body));
    assert.equal(subscriptionPayload.value, 199.9);
    assert.equal(subscriptionPayload.cycle, 'MONTHLY');
    assert.ok(calls.every((call) => (call.init.headers as any).access_token === '$aact_hml_fixture'));
  } finally { globalThis.fetch = originalFetch; }
});

test('reconciliation records a safe skipped run while billing credentials are disabled', async () => {
  const updates: any[] = [];
  const db = {
    from(table: string) {
      return {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'run-fixture' }, error: null }) }) }),
        update: (value: any) => ({ eq: async () => { updates.push({ table, value }); return { error: null }; } }),
      };
    },
  };
  const previous = process.env.BILLING_ENABLED;
  delete process.env.BILLING_ENABLED;
  try {
    assert.deepEqual(await runBillingReconciliation(db), { skipped: true, reason: 'billing_disabled' });
    assert.equal(updates[0].value.status, 'completed');
    assert.deepEqual(updates[0].value.summary, { skipped: 'billing_disabled', queueProcessed: 0 });
  } finally {
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  }
});
