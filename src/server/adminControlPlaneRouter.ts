import { Router } from 'express';
import { canReadAssignedResource, isGlobalAdmin } from './authorization';
import { auditContext, pageResult, parsePagination } from './operational';
import { authenticateRequest, resolvePlatformContext, requirePlatformPermission } from './tenantAuth';

const MODULES: Record<string, {
  table: string;
  select: string;
  permission: string;
  tenantField?: string;
  teamField?: string;
  ownerField?: string;
  orderField: string;
}> = {
  onboarding: { table: 'onboarding_runs', select: '*, tenants(id,name,lifecycle_status), onboarding_items(*)', permission: 'platform.onboarding.read', tenantField: 'tenant_id', ownerField: 'owner_platform_member_id', orderField: 'created_at' },
  success: { table: 'customer_success_accounts', select: '*, tenants(id,name,lifecycle_status,risk_level)', permission: 'platform.success.read', tenantField: 'tenant_id', ownerField: 'manager_platform_member_id', orderField: 'updated_at' },
  support: { table: 'support_tickets', select: '*, tenants(id,name), solutions(id,key,name)', permission: 'platform.support.read', tenantField: 'tenant_id', teamField: 'team_id', ownerField: 'owner_platform_member_id', orderField: 'created_at' },
  privacy: { table: 'lgpd_requests', select: 'id,request_number,tenant_id,request_type,status,data_subject_reference,legal_hold,retention_until,due_at,owner_platform_member_id,reason,result_summary,excludes_integrity_data,created_at,updated_at,completed_at,tenants(id,name)', permission: 'platform.privacy.read', tenantField: 'tenant_id', ownerField: 'owner_platform_member_id', orderField: 'created_at' },
  targets: { table: 'sales_targets', select: '*', permission: 'platform.targets.read', teamField: 'team_id', ownerField: 'platform_member_id', orderField: 'period_start' },
  operations: { table: 'platform_operational_events', select: 'id,source,event_type,status,correlation_id,attempts,last_error,payload_summary,next_attempt_at,started_at,completed_at,created_at', permission: 'platform.operations.read', orderField: 'created_at' },
};

function hasPermission(context: any, permission: string) {
  return context.role?.key === 'admin' || context.permissions.includes(permission);
}

export function cleanUuidList(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const values = value.split(',').map((item) => item.trim()).filter((item) => /^[0-9a-f-]{36}$/i.test(item));
  return values.length ? [...new Set(values)].slice(0, 100) : null;
}

function validDate(value: unknown, fallback: Date) {
  if (typeof value !== 'string') return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}

async function visibleTenantIds(db: any, context: any): Promise<string[] | null> {
  if (isGlobalAdmin(context)) return null;
  const visibleTeams = context.teams
    .filter((team: any) => context.managedTeams.some((managed: any) => managed.id === team.id) || ['team', 'all'].includes(team.member_client_visibility))
    .map((team: any) => team.id);
  const clauses = [`owner_platform_member_id.eq.${context.platformMember.id}`];
  if (visibleTeams.length) clauses.push(`team_id.in.(${visibleTeams.join(',')})`);
  const result = await db.from('platform_client_assignments').select('tenant_id').eq('assignment_type', 'commercial').or(clauses.join(','));
  if (result.error) throw result.error;
  return [...new Set<string>((result.data || []).map((item: any) => String(item.tenant_id)))];
}

export function intersectAllowed(requested: string[] | null, allowed: string[] | null) {
  if (allowed === null) return requested;
  if (requested === null) return allowed;
  const allowedSet = new Set(allowed);
  return requested.filter((id) => allowedSet.has(id));
}

export function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

export function createAdminControlPlaneRouter(getSupabaseAdmin: any) {
  const router = Router();

  router.get('/control-plane/metrics', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.commercial.read', 'platform.clients.read', 'platform.billing.read', 'platform.support.read']), async (req: any, res) => {
    try {
      const db = getSupabaseAdmin();
      const now = new Date();
      const defaultFrom = new Date(now.valueOf() - 30 * 86400000);
      const from = validDate(req.query.from, defaultFrom);
      const to = validDate(req.query.to, now);
      if (from >= to || to.valueOf() - from.valueOf() > 366 * 86400000) return res.status(400).json({ error: 'Período inválido ou superior a 366 dias.' });

      const requestedTeams = cleanUuidList(req.query.team);
      const requestedOwners = cleanUuidList(req.query.owner);
      const requestedTenants = cleanUuidList(req.query.tenant);
      const requestedPlans = cleanUuidList(req.query.plan);
      const context = req.platformContext;
      const allowedTenants = await visibleTenantIds(db, context);
      const tenantIds = intersectAllowed(requestedTenants, allowedTenants);
      if (allowedTenants !== null && tenantIds?.length === 0) {
        return res.json({ current: null, previous: null, emptyReason: 'Nenhum registro está disponível no escopo e filtros selecionados.' });
      }

      let teamIds = requestedTeams;
      let ownerIds = requestedOwners;
      if (!isGlobalAdmin(context)) {
        const managed = context.managedTeams.map((team: any) => team.id);
        const visible = context.teams.filter((team: any) => ['team', 'all'].includes(team.member_lead_visibility)).map((team: any) => team.id);
        const allowedTeams = [...new Set([...managed, ...visible])];
        teamIds = intersectAllowed(requestedTeams, allowedTeams);
        if (!teamIds?.length) ownerIds = [context.platformMember.id];
        else if (requestedOwners?.length) ownerIds = requestedOwners.includes(context.platformMember.id) ? [context.platformMember.id] : null;
      }

      const duration = to.valueOf() - from.valueOf();
      const previousFrom = new Date(from.valueOf() - duration);
      const args = (start: Date, end: Date) => ({
        p_from: start.toISOString(), p_to: end.toISOString(), p_team_ids: teamIds,
        p_owner_ids: ownerIds, p_tenant_ids: tenantIds, p_plan_ids: requestedPlans,
        p_is_admin: isGlobalAdmin(context),
      });
      const [currentResult, previousResult] = await Promise.all([
        db.rpc('admin_control_plane_metrics', args(from, to)),
        db.rpc('admin_control_plane_metrics', args(previousFrom, from)),
      ]);
      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;
      return res.json({ current: currentResult.data, previous: previousResult.data, emptyReason: currentResult.data?.has_commercial_data || currentResult.data?.has_financial_data ? null : 'Ainda não há dados suficientes no período selecionado.' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/control-plane/filters', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.commercial.read', 'platform.clients.read']), async (req: any, res: any) => {
    try {
      const db = getSupabaseAdmin();
      const context = req.platformContext;
      const teamIds = isGlobalAdmin(context) ? null : context.teams.map((team: any) => team.id);
      let teamsQuery = db.from('platform_teams').select('id,name,status').eq('status', 'active').order('name');
      if (teamIds !== null) {
        if (!teamIds.length) return res.json({ teams: [], people: [], plans: [], solutions: [] });
        teamsQuery = teamsQuery.in('id', teamIds);
      }
      const [teams, members, plans, solutions] = await Promise.all([
        teamsQuery,
        db.from('platform_members').select('id,user_id,status,relationship_type,platform_roles(key,name)').eq('status', 'active'),
        db.from('billing_plans').select('id,code,version,name,active').order('name'),
        db.from('solutions').select('id,key,name').order('name'),
      ]);
      for (const result of [teams, members, plans, solutions]) if (result.error) throw result.error;
      return res.json({ teams: teams.data || [], people: members.data || [], plans: plans.data || [], solutions: solutions.data || [] });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/control-plane/modules/:module', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.commercial.read', 'platform.operations.read', 'platform.onboarding.read', 'platform.success.read', 'platform.support.read', 'platform.privacy.read']), async (req: any, res: any) => {
    try {
      const config = MODULES[req.params.module];
      if (!config) return res.status(404).json({ error: 'Módulo não encontrado.' });
      if (!hasPermission(req.platformContext, config.permission)) return res.status(403).json({ error: 'Forbidden' });
      if (req.params.module === 'operations' && !isGlobalAdmin(req.platformContext)) return res.status(403).json({ error: 'Operações globais exigem perfil admin.' });
      const db = getSupabaseAdmin();
      const { page, pageSize, from, to } = parsePagination(req.query);
      let query = db.from(config.table).select(config.select, { count: 'exact' }).order(config.orderField, { ascending: false }).range(from, to);
      const tenants = config.tenantField ? await visibleTenantIds(db, req.platformContext) : null;
      if (config.tenantField && tenants !== null) {
        if (!tenants.length) return res.json(pageResult([], 0, page, pageSize));
        query = query.in(config.tenantField, tenants);
      }
      if (config.teamField && !isGlobalAdmin(req.platformContext)) {
        const teamIds = req.platformContext.teams.map((team: any) => team.id);
        if (!teamIds.length && config.ownerField) query = query.eq(config.ownerField, req.platformContext.platformMember.id);
        else if (teamIds.length) query = query.or(`${config.teamField}.in.(${teamIds.join(',')}),${config.ownerField}.eq.${req.platformContext.platformMember.id}`);
      }
      if (typeof req.query.status === 'string' && req.query.status) query = query.eq('status', req.query.status);
      const result = await query;
      if (result.error) throw result.error;
      return res.json(pageResult(result.data || [], result.count, page, pageSize));
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/control-plane/transition', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.commercial.manage', 'platform.onboarding.manage', 'platform.support.manage', 'platform.privacy.manage', 'platform.clients.manage']), async (req: any, res: any) => {
    try {
      const { entityType, entityId, toStatus, reason, teamId, tenantId, requestId, metadata } = req.body || {};
      if (!['lead', 'proposal', 'contract', 'tenant', 'onboarding', 'support', 'lgpd'].includes(entityType)) return res.status(400).json({ error: 'Tipo de recurso inválido.' });
      if (!entityId || !toStatus || typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'Recurso, próximo estado e motivo são obrigatórios.' });
      const permission = entityType === 'onboarding' ? 'platform.onboarding.manage' : entityType === 'support' ? 'platform.support.manage' : entityType === 'lgpd' ? 'platform.privacy.manage' : entityType === 'tenant' ? 'platform.clients.manage' : 'platform.commercial.manage';
      if (!hasPermission(req.platformContext, permission)) return res.status(403).json({ error: 'Forbidden' });
      if (!isGlobalAdmin(req.platformContext) && teamId && !req.platformContext.managedTeams.some((team: any) => team.id === teamId)) return res.status(403).json({ error: 'Recurso fora do escopo gerenciado.' });
      const result = await getSupabaseAdmin().rpc('admin_transition_control_plane', {
        p_entity_type: entityType, p_entity_id: entityId, p_to_status: toStatus,
        p_actor_user_id: req.user.id, p_reason: reason.trim(), p_request_id: requestId || req.requestId || null,
        p_team_id: teamId || null, p_tenant_id: tenantId || null, p_metadata: metadata || {},
      });
      if (result.error) return res.status(409).json({ error: result.error.message });
      return res.json({ status: result.data });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/control-plane/onboarding/start', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.onboarding.manage'), async (req: any, res: any) => {
    if (!hasPermission(req.platformContext, 'platform.onboarding.manage')) return res.status(403).json({ error: 'Forbidden' });
    const tenants = await visibleTenantIds(getSupabaseAdmin(), req.platformContext);
    if (tenants !== null && !tenants.includes(req.body?.tenantId)) return res.status(403).json({ error: 'Cliente fora do escopo.' });
    const result = await getSupabaseAdmin().rpc('admin_start_onboarding', {
      p_tenant_id: req.body?.tenantId, p_template_id: req.body?.templateId,
      p_actor_user_id: req.user.id, p_owner_platform_member_id: req.body?.ownerId || null,
    });
    if (result.error) return res.status(409).json({ error: result.error.message });
    return res.status(201).json({ id: result.data });
  });

  router.post('/control-plane/onboarding/:id/refresh', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.onboarding.manage'), async (req: any, res: any) => {
    if (!hasPermission(req.platformContext, 'platform.onboarding.manage')) return res.status(403).json({ error: 'Forbidden' });
    const result = await getSupabaseAdmin().rpc('admin_refresh_onboarding_progress', { p_run_id: req.params.id, p_actor_user_id: req.user.id });
    if (result.error) return res.status(409).json({ error: result.error.message });
    return res.json({ progressPercent: result.data });
  });

  router.get('/control-plane/tenants/:id/entitlements', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.clients.read'), async (req: any, res: any) => {
    if (!hasPermission(req.platformContext, 'platform.clients.read')) return res.status(403).json({ error: 'Forbidden' });
    const tenants = await visibleTenantIds(getSupabaseAdmin(), req.platformContext);
    if (tenants !== null && !tenants.includes(req.params.id)) return res.status(403).json({ error: 'Cliente fora do escopo.' });
    const result = await getSupabaseAdmin().rpc('admin_effective_entitlements', { p_tenant_id: req.params.id });
    if (result.error) throw result.error;
    return res.json(result.data);
  });

  router.get('/access/matrix', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.access.simulate'), async (req: any, res: any) => {
    if (!hasPermission(req.platformContext, 'platform.access.simulate')) return res.status(403).json({ error: 'Forbidden' });
    const db = getSupabaseAdmin();
    const [members, permissions, memberships] = await Promise.all([
      db.from('platform_members').select('id,user_id,status,relationship_type,platform_roles(id,key,name)'),
      db.from('platform_role_permissions').select('role_id,platform_permissions(key,category,description)'),
      db.from('platform_team_members').select('platform_member_id,team_id,team_role,status,platform_teams(id,name)'),
    ]);
    for (const result of [members, permissions, memberships]) if (result.error) throw result.error;
    return res.json({ members: members.data || [], rolePermissions: permissions.data || [], teamMemberships: memberships.data || [], rule: 'relationship_type é informativo e nunca concede privilégios.' });
  });

  router.post('/access/simulate', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.access.simulate'), async (req: any, res: any) => {
    if (!hasPermission(req.platformContext, 'platform.access.simulate')) return res.status(403).json({ error: 'Forbidden' });
    const { platformMemberId, permission, teamId, ownerPlatformMemberId } = req.body || {};
    const db = getSupabaseAdmin();
    const member = await db.from('platform_members').select('id,status,relationship_type,platform_roles(id,key,name)').eq('id', platformMemberId).maybeSingle();
    if (member.error || !member.data) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const role: any = member.data.platform_roles;
    const rolePermission = await db.from('platform_role_permissions').select('platform_permissions!inner(key)').eq('role_id', role.id).eq('platform_permissions.key', permission).maybeSingle();
    const membership = teamId ? await db.from('platform_team_members').select('team_role,status,platform_teams(name,member_lead_visibility,member_client_visibility)').eq('platform_member_id', platformMemberId).eq('team_id', teamId).maybeSingle() : { data: null, error: null };
    let allowed = member.data.status === 'active' && (role.key === 'admin' || Boolean(rolePermission.data));
    let origin = allowed ? `papel:${role.key}` : member.data.status !== 'active' ? 'usuário suspenso' : `papel:${role.key} sem ${permission}`;
    if (allowed && role.key !== 'admin' && teamId) {
      const teamScope = membership.data?.status === 'active' && (membership.data.team_role === 'manager' || ownerPlatformMemberId === platformMemberId || ['team', 'all'].includes(membership.data.platform_teams?.member_client_visibility));
      allowed = Boolean(teamScope);
      origin = allowed ? `equipe:${membership.data?.platform_teams?.name || teamId}` : 'fora do escopo da equipe/owner';
    }
    return res.json({ allowed, role: role.key, relationshipType: member.data.relationship_type, teamId: teamId || null, permission, origin, note: 'relationship_type não participa da decisão.' });
  });

  router.get('/control-plane/search', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.commercial.read', 'platform.clients.read', 'platform.billing.read']), async (req: any, res: any) => {
    const term = typeof req.query.q === 'string' ? req.query.q.trim().replace(/[%(),]/g, '').slice(0, 80) : '';
    if (term.length < 2) return res.json({ items: [] });
    const db = getSupabaseAdmin();
    const tenantScope = await visibleTenantIds(db, req.platformContext);
    let tenantQuery = db.from('tenants').select('id,name,slug,lifecycle_status').ilike('name', `%${term}%`).limit(8);
    if (tenantScope !== null) {
      if (!tenantScope.length) tenantQuery = tenantQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      else tenantQuery = tenantQuery.in('id', tenantScope);
    }
    const tenants = await tenantQuery;
    if (tenants.error) throw tenants.error;
    return res.json({ items: (tenants.data || []).map((item: any) => ({ type: 'client', id: item.id, title: item.name, subtitle: item.lifecycle_status, href: `#/admin/empresas/${item.id}` })) });
  });

  router.get('/control-plane/export/:resource', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.exports.execute'), async (req: any, res: any) => {
    if (!hasPermission(req.platformContext, 'platform.exports.execute')) return res.status(403).json({ error: 'Forbidden' });
    const resource = String(req.params.resource);
    const allowed: Record<string, { table: string; columns: string; permission: string; tenantField?: string }> = {
      clients: { table: 'tenants', columns: 'id,name,slug,status,lifecycle_status,risk_level,created_at', permission: 'platform.clients.read', tenantField: 'id' },
      support: { table: 'support_tickets', columns: 'id,ticket_number,tenant_id,category,priority,severity,status,subject,sla_due_at,created_at', permission: 'platform.support.read', tenantField: 'tenant_id' },
    };
    const config = allowed[resource];
    if (!config || !hasPermission(req.platformContext, config.permission)) return res.status(404).json({ error: 'Exportação indisponível.' });
    const db = getSupabaseAdmin();
    const tenants = await visibleTenantIds(db, req.platformContext);
    let query = db.from(config.table).select(config.columns).limit(1000);
    if (tenants !== null) {
      if (!tenants.length) return res.status(204).end();
      query = query.in(config.tenantField!, tenants);
    }
    const result = await query;
    if (result.error) throw result.error;
    const rows = result.data || [];
    const headers = rows.length ? Object.keys(rows[0]) : config.columns.split(',');
    const csv = ['sep=,', headers.map(csvCell).join(','), ...rows.map((row: any) => headers.map((header) => csvCell(row[header])).join(','))].join('\r\n');
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'admin.exported', entity_type: resource, severity: 'info', ...auditContext(req, { result: 'success', row_count: rows.length, excludes_integrity_data: true }) });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ordum-${resource}.csv"`);
    return res.send(`\ufeff${csv}`);
  });

  return router;
}
