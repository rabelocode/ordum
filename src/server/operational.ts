import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { canReadAssignedResource, type Assignment, type AuthorizationContext } from './authorization';

export function parsePagination(query: Request['query'], defaultSize = 25) {
  const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(query.pageSize || defaultSize), 10) || defaultSize));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function pageResult<T>(items: T[], count: number | null, page: number, pageSize: number) {
  const total = count || 0;
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export function canReadLead(context: AuthorizationContext, assignment: Assignment | null | undefined) {
  return canReadAssignedResource(context, assignment, 'member_lead_visibility');
}

export function canReadClient(context: AuthorizationContext, assignment: Assignment | null | undefined) {
  return canReadAssignedResource(context, assignment, 'member_client_visibility');
}

export function withinManagerApprovalLimit(team: any, amountCents: number, kind: 'proposal' | 'contract') {
  const key = kind === 'proposal' ? 'proposal_approval_limit_cents' : 'contract_approval_limit_cents';
  const value = team?.settings?.[key];
  return Number.isInteger(value) && value >= 0 && amountCents <= value;
}

function safeIp(req: Request) {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const candidate = (forwarded || req.socket.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64);
  return isIP(candidate) ? candidate : null;
}

export function auditContext(req: Request, metadata: Record<string, unknown> = {}) {
  const requestId = String((req as any).requestId || randomUUID());
  return {
    request_id: requestId,
    ip_address: safeIp(req),
    user_agent: req.header('user-agent')?.slice(0, 500) || null,
    metadata,
  };
}
