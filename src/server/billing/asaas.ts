import { BillingConfig } from './config';
import { BillingProvider, CreateBillingCustomerInput, CreateBillingSubscriptionInput } from './provider';

const CYCLE_MAP = {
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  semiannual: 'SEMIANNUALLY',
  yearly: 'YEARLY',
} as const;

export class AsaasBillingProvider implements BillingProvider {
  constructor(private readonly config: BillingConfig) {
    if (!config.enabled || !config.apiKey) throw new Error('Integração Asaas Sandbox não está habilitada.');
  }

  private async request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.config.userAgent,
        access_token: this.config.apiKey!,
        ...init?.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const description = Array.isArray(body?.errors) ? body.errors.map((item: any) => item.description).filter(Boolean).join('; ') : '';
      throw new Error(`Asaas respondeu ${response.status}${description ? `: ${description}` : ''}`);
    }
    return body;
  }

  createCustomer(input: CreateBillingCustomerInput) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        mobilePhone: input.mobilePhone,
        externalReference: input.externalReference,
        notificationDisabled: false,
      }),
    });
  }

  async findCustomerByExternalReference(externalReference: string) {
    const result = await this.request(`/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
    return Array.isArray(result.data) ? (result.data[0] || null) : null;
  }

  createSubscription(input: CreateBillingSubscriptionInput) {
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: input.customerId,
        billingType: input.billingType,
        cycle: CYCLE_MAP[input.cycle],
        value: input.amountCents / 100,
        nextDueDate: input.nextDueDate,
        externalReference: input.externalReference,
        description: input.description,
      }),
    });
  }

  async findSubscriptionByExternalReference(externalReference: string) {
    const result = await this.request(`/subscriptions?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
    return Array.isArray(result.data) ? (result.data[0] || null) : null;
  }

  getPayment(id: string) {
    return this.request(`/payments/${encodeURIComponent(id)}`);
  }

  getSubscription(id: string) {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`);
  }

  cancelSubscription(id: string) {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  listSubscriptions(offset = 0, limit = 100) {
    return this.request(`/subscriptions?includeDeleted=true&limit=${Math.min(100, limit)}&offset=${Math.max(0, offset)}`);
  }

  listPayments(filters: { subscriptionId?: string; dateCreatedFrom?: string; offset?: number; limit?: number } = {}) {
    const params = new URLSearchParams({
      limit: String(Math.min(100, filters.limit || 100)),
      offset: String(Math.max(0, filters.offset || 0)),
    });
    if (filters.subscriptionId) params.set('subscription', filters.subscriptionId);
    if (filters.dateCreatedFrom) params.set('dateCreated[ge]', filters.dateCreatedFrom);
    return this.request(`/payments?${params.toString()}`);
  }
}
