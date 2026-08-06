/**
 * Domain Transition Module
 * Shared source of truth for valid entity state transitions and status labels.
 */

export const LEAD_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'rejected'],
  contacted: ['qualified', 'rejected'],
  qualified: ['approved', 'rejected'],
  approved: ['converted'],
  rejected: ['new'],
  converted: ['contacted'],
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  converted: 'Convertido',
};

export const PROPOSAL_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'rejected'],
  approved: ['accepted', 'rejected', 'superseded'],
  rejected: ['superseded'],
  accepted: [],
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovada',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  superseded: 'Substituída',
};

export const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'draft'],
  approved: ['pending_payment', 'awaiting_payment'],
  pending_payment: ['active'],
  awaiting_payment: ['active'],
  active: ['renewal_due', 'cancellation_requested', 'suspended'],
  suspended: ['active', 'closed'],
  renewal_due: ['active', 'cancellation_requested'],
  cancellation_requested: ['cancelled'],
  cancelled: ['closed'],
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  pending_payment: 'Aguardando pagamento',
  awaiting_payment: 'Aguardando pagamento',
  active: 'Ativo',
  past_due: 'Em atraso',
  suspended: 'Suspenso',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  closed: 'Encerrado',
};

export const TENANT_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  opportunity: ['approved'],
  approved: ['awaiting_payment'],
  awaiting_payment: ['onboarding'],
  onboarding: ['active'],
  active: ['at_risk', 'delinquent', 'suspended', 'cancelled'],
  at_risk: ['active', 'delinquent'],
  delinquent: ['active', 'suspended'],
  suspended: ['active', 'cancelled', 'closed'],
  cancelled: ['closed'],
};

export function getLeadNextStatuses(currentStatus: string): string[] {
  return LEAD_TRANSITIONS[currentStatus] || [];
}

export function getProposalNextStatuses(currentStatus: string): string[] {
  return PROPOSAL_TRANSITIONS[currentStatus] || [];
}

export function getContractNextStatuses(currentStatus: string): string[] {
  return CONTRACT_TRANSITIONS[currentStatus] || [];
}

export function getTenantNextStatuses(currentStatus: string): string[] {
  return TENANT_LIFECYCLE_TRANSITIONS[currentStatus] || [];
}

export function isValidLeadTransition(fromStatus: string, toStatus: string): boolean {
  return getLeadNextStatuses(fromStatus).includes(toStatus);
}
