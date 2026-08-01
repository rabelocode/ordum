import { BillingCycle } from './domain';

export interface CreateBillingCustomerInput {
  name: string;
  email?: string;
  cpfCnpj: string;
  mobilePhone?: string;
  externalReference: string;
}

export interface CreateBillingSubscriptionInput {
  customerId: string;
  billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  cycle: BillingCycle;
  amountCents: number;
  nextDueDate: string;
  externalReference: string;
  description?: string;
}

export interface BillingProvider {
  findCustomerByExternalReference(externalReference: string): Promise<Record<string, unknown> | null>;
  findSubscriptionByExternalReference(externalReference: string): Promise<Record<string, unknown> | null>;
  createCustomer(input: CreateBillingCustomerInput): Promise<Record<string, unknown>>;
  createSubscription(input: CreateBillingSubscriptionInput): Promise<Record<string, unknown>>;
  getPayment(id: string): Promise<Record<string, unknown>>;
  getSubscription(id: string): Promise<Record<string, unknown>>;
}
