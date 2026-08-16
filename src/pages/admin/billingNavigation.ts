export type BillingView = 'overview' | 'subscriptions' | 'payments' | 'overdue';

export function billingViewFromHash(hash: string): BillingView {
  const value = new URLSearchParams(hash.split('?')[1] || '').get('view');
  return value === 'subscriptions' || value === 'payments' || value === 'overdue' ? value : 'overview';
}
