export type BillingCycle = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export type AccessStatus = 'trial' | 'pending_payment' | 'active' | 'grace' | 'suspended' | 'cancelled' | 'review';

export const SUPPORTED_ASAAS_EVENTS = new Set([
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  'PAYMENT_DUNNING_RECEIVED',
  'PAYMENT_DUNNING_REQUESTED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED',
]);

const PAYMENT_STATUS: Record<string, string> = {
  PAYMENT_CREATED: 'pending',
  PAYMENT_UPDATED: 'pending',
  PAYMENT_CONFIRMED: 'confirmed',
  PAYMENT_RECEIVED: 'received',
  PAYMENT_OVERDUE: 'overdue',
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: 'refused',
  PAYMENT_DELETED: 'deleted',
  PAYMENT_RESTORED: 'restored',
  PAYMENT_REFUNDED: 'refunded',
  PAYMENT_PARTIALLY_REFUNDED: 'partially_refunded',
  PAYMENT_CHARGEBACK_REQUESTED: 'chargeback',
  PAYMENT_CHARGEBACK_DISPUTE: 'chargeback',
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: 'chargeback',
  PAYMENT_DUNNING_RECEIVED: 'received',
  PAYMENT_DUNNING_REQUESTED: 'overdue',
};

export function normalizePaymentStatus(eventType: string, providerStatus?: string): string {
  return PAYMENT_STATUS[eventType] ?? normalizeProviderPaymentStatus(providerStatus);
}

export function normalizeProviderPaymentStatus(providerStatus?: string): string {
  const status = providerStatus?.toUpperCase();
  if (status === 'CONFIRMED') return 'confirmed';
  if (status === 'RECEIVED' || status === 'RECEIVED_IN_CASH') return 'received';
  if (status === 'OVERDUE' || status === 'DUNNING_REQUESTED') return 'overdue';
  if (status === 'REFUNDED') return 'refunded';
  if (status === 'REFUND_REQUESTED') return 'pending';
  if (status === 'PARTIALLY_REFUNDED') return 'partially_refunded';
  if (status === 'CHARGEBACK_REQUESTED' || status === 'CHARGEBACK_DISPUTE') return 'chargeback';
  if (status === 'DELETED') return 'deleted';
  return 'pending';
}

export function preserveSettledPaymentStatus(existingStatus: string | null | undefined, incomingStatus: string) {
  if (existingStatus && ['confirmed', 'received'].includes(existingStatus) && ['pending', 'overdue', 'refused', 'restored'].includes(incomingStatus)) return existingStatus;
  return incomingStatus;
}

export function accessTransitionForEvent(eventType: string): AccessStatus | null {
  if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_DUNNING_RECEIVED') return 'active';
  if (eventType === 'PAYMENT_OVERDUE' || eventType === 'PAYMENT_DUNNING_REQUESTED') return 'grace';
  if (eventType === 'PAYMENT_CHARGEBACK_REQUESTED' || eventType === 'PAYMENT_CHARGEBACK_DISPUTE' || eventType === 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL') return 'review';
  if (eventType === 'PAYMENT_REFUNDED') return 'review';
  return null;
}

export function accessTransitionForPaymentStatus(status: string): AccessStatus | null {
  if (status === 'confirmed' || status === 'received') return 'active';
  if (status === 'overdue') return 'grace';
  if (status === 'chargeback' || status === 'refunded') return 'review';
  return null;
}

function asUtcDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addCycle(start: Date, cycle: BillingCycle): Date {
  const result = new Date(start);
  if (cycle === 'weekly') result.setUTCDate(result.getUTCDate() + 7);
  if (cycle === 'biweekly') result.setUTCDate(result.getUTCDate() + 14);
  if (cycle === 'monthly') result.setUTCMonth(result.getUTCMonth() + 1);
  if (cycle === 'quarterly') result.setUTCMonth(result.getUTCMonth() + 3);
  if (cycle === 'semiannual') result.setUTCMonth(result.getUTCMonth() + 6);
  if (cycle === 'yearly') result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
}

export function paidPeriod(
  dueDate: string,
  cycle: BillingCycle,
  currentPaidThrough?: string | null,
): { startsOn: string; endsOn: string } {
  const due = asUtcDate(dueDate);
  const existingEnd = currentPaidThrough ? asUtcDate(currentPaidThrough) : null;
  const start = existingEnd && existingEnd >= due
    ? new Date(existingEnd.getTime() + 86_400_000)
    : due;
  const exclusiveEnd = addCycle(start, cycle);
  const end = new Date(exclusiveEnd.getTime() - 86_400_000);
  return { startsOn: isoDate(start), endsOn: isoDate(end) };
}

export function addGracePeriod(dueDate: string, graceDays: number): string {
  const value = asUtcDate(dueDate);
  value.setUTCDate(value.getUTCDate() + Math.max(0, graceDays));
  return value.toISOString();
}

export function centsFromProvider(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function safeProviderMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const allowed = ['description', 'billingType', 'cycle', 'installmentCount', 'deleted', 'anticipated'];
  return Object.fromEntries(allowed.filter((key) => key in source).map((key) => [key, source[key]]));
}
