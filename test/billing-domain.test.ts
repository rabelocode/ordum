import assert from 'node:assert/strict';
import test from 'node:test';
import { accessTransitionForEvent, accessTransitionForPaymentStatus, centsFromProvider, normalizePaymentStatus, paidPeriod, preserveSettledPaymentStatus, safeProviderMetadata } from '../src/server/billing/domain';
import { getBillingConfig } from '../src/server/billing/config';
import { webhookTokenMatches } from '../src/server/billing/router';

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
