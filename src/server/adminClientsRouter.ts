import { Router } from 'express';
import { z } from 'zod';
import { canReadAssignedResource } from './authorization';
import { auditContext, pageResult, parsePagination } from './operational';
import { authenticateRequest, resolvePlatformContext, requirePlatformPermission } from './tenantAuth';

export function createAdminClientsRouter(getSupabaseAdmin: any) {
  const router = Router();

  // GET /api/admin/clients
  router.get('/', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.clients.read', 'platform.commercial.read']), async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const { page, pageSize, from, to } = parsePagination(req.query);
      const paginated = req.query.page !== undefined;
      let visibleTenantIds: string[] | null = null;
      if (platformContext.role?.key !== 'admin') {
        const visibleTeams = platformContext.teams
          .filter((team: any) => platformContext.managedTeams.some((managed: any) => managed.id === team.id) || ['team', 'all'].includes(team.member_client_visibility))
          .map((team: any) => team.id);
        let assignmentQuery = getSupabaseAdmin().from('platform_client_assignments').select('tenant_id');
        const clauses = [`owner_platform_member_id.eq.${platformContext.platformMember.id}`];
        if (visibleTeams.length) clauses.push(`team_id.in.(${visibleTeams.join(',')})`);
        assignmentQuery = assignmentQuery.or(clauses.join(','));
        const assignmentResult = await assignmentQuery;
        if (assignmentResult.error) throw assignmentResult.error;
        visibleTenantIds = [...new Set<string>((assignmentResult.data || []).map((item: any) => String(item.tenant_id)))];
        if (!visibleTenantIds.length) return res.json(paginated ? pageResult([], 0, page, pageSize) : []);
      }

      let query = getSupabaseAdmin()
        .from('tenants')
        .select('*, tenant_solutions(*), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))), tenant_billing_state(*), tenant_domains(*), memberships(id,status,user_id,employment_level), departments(id,name,active)', { count: 'exact' })
        .in('status', ['active', 'trial', 'suspended'])
        .order('created_at', { ascending: false });
      if (visibleTenantIds) query = query.in('id', visibleTenantIds);
      if (typeof req.query.status === 'string' && req.query.status) query = query.eq('status', req.query.status);
      if (typeof req.query.search === 'string' && req.query.search.trim()) query = query.ilike('name', `%${req.query.search.trim().slice(0, 100)}%`);
      if (paginated) query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      
      let clients = data.map((c: any) => {
        const assignment = c.platform_client_assignments?.[0];
        let owner = null;
        if (assignment?.platform_members?.user_id) {
          const u = usersData?.users?.find((u: any) => u.id === assignment.platform_members.user_id);
          if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
        }
        return { ...c, assignment, owner };
      });
      
      res.json(paginated ? pageResult(clients, count, page, pageSize) : clients);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // GET /api/admin/clients/:id
  router.get('/:id', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.clients.read', 'platform.commercial.read']), async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      
      const { data, error } = await getSupabaseAdmin()
        .from('tenants')
        .select('*, tenant_solutions(solution_id, status, solutions(key,name)), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))), tenant_domains(*), departments(*), memberships(id,user_id,status,employment_level,joined_at), tenant_billing_state(*), commercial_contracts(*, billing_subscriptions(*), billing_payments(*))')
        .eq('id', clientId)
        .single();
        
      if (error) throw error;
      
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const assignment = data.platform_client_assignments?.[0];
      let owner = null;
      if (assignment?.platform_members?.user_id) {
        const u = usersData?.users?.find((u: any) => u.id === assignment.platform_members.user_id);
        if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
      }
      
      // Checking permissions (similar to list)
      if (platformContext.role?.key !== 'admin') {
        if (!canReadAssignedResource(platformContext, assignment, 'member_client_visibility')) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data: audit } = await getSupabaseAdmin().from('platform_audit_logs')
        .select('id,action,severity,metadata,created_at,actor_user_id,request_id')
        .eq('entity_id', clientId).order('created_at', { ascending: false }).limit(50);
      res.json({ ...data, assignment, owner, audit: audit || [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/clients/:id/assign
  router.post('/:id/assign', authenticateRequest, resolvePlatformContext, requirePlatformPermission(['platform.clients.manage', 'platform.commercial.manage']), async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const schema = z.object({ team_id: z.string().uuid(), owner_platform_member_id: z.string().uuid().optional().nullable(), reason: z.string().min(3) });
      const parse = schema.safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: 'Equipe e motivo são obrigatórios.', details: parse.error.issues });
      const { team_id, owner_platform_member_id, reason } = parse.data;
      if (!team_id || !reason) return res.status(400).json({ error: 'Equipe e motivo da transferência são obrigatórios.' });
      const previous = await getSupabaseAdmin().from('platform_client_assignments').select('*')
        .eq('tenant_id', clientId).eq('assignment_type', 'commercial').maybeSingle();
      if (previous.error) throw previous.error;
      
      if (platformContext.role?.key !== 'admin') {
        const isManager = platformContext.managedTeams.some((t: any) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
        if (!previous.data || !platformContext.managedTeams.some((team: any) => team.id === previous.data.team_id)) {
          return res.status(403).json({ error: 'Cliente fora do escopo gerenciado.' });
        }
      }
      if (owner_platform_member_id) {
        const target = await getSupabaseAdmin().from('platform_team_members').select('platform_member_id')
          .eq('team_id', team_id).eq('platform_member_id', owner_platform_member_id).eq('status', 'active').maybeSingle();
        if (!target.data) return res.status(400).json({ error: 'O responsável precisa ser membro ativo da equipe.' });
      }
      
      const { data, error } = await getSupabaseAdmin()
        .from('platform_client_assignments')
        .upsert({
          tenant_id: clientId,
          team_id,
          owner_platform_member_id: owner_platform_member_id || null,
          assigned_by_user_id: req.user.id,
          assignment_type: 'commercial',
          status: 'active'
        }, { onConflict: 'tenant_id,team_id,assignment_type' })
        .select()
        .single();
        
      if (error) throw error;
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'client.assigned',
        entity_type: 'platform_client_assignments',
        entity_id: clientId,
        severity: 'info',
        team_id: team_id,
        ...auditContext(req, { result: 'success', reason, before: previous.data ? { team_id: previous.data.team_id, owner_platform_member_id: previous.data.owner_platform_member_id } : null, after: { team_id, owner_platform_member_id: owner_platform_member_id || null } })
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/clients/:id/suspend
  router.post('/:id/suspend', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.clients.manage'), async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const parse = z.object({ reason: z.string().min(5) }).safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: 'Motivo da suspensão é obrigatório.' });
      
      const db = getSupabaseAdmin();
      const existing = await db.from('tenants').select('status, lifecycle_status').eq('id', clientId).single();
      if (existing.error) return res.status(404).json({ error: 'Cliente não encontrado.' });
      if (existing.data.status === 'suspended') return res.status(400).json({ error: 'Cliente já está suspenso.' });

      const updated = await db.from('tenants').update({ status: 'suspended', lifecycle_status: 'churn', updated_at: new Date().toISOString() }).eq('id', clientId).select().single();
      if (updated.error) throw updated.error;
      
      await db.from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'client.suspended',
        entity_type: 'tenants',
        entity_id: clientId,
        severity: 'high',
        ...auditContext(req, { result: 'success', reason: parse.data.reason, before: existing.data, after: { status: 'suspended', lifecycle_status: 'churn' } })
      });
      res.json({ success: true, tenant: updated.data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/clients/:id/reactivate
  router.post('/:id/reactivate', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.clients.manage'), async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const parse = z.object({ reason: z.string().min(5) }).safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: 'Motivo da reativação é obrigatório.' });
      
      const db = getSupabaseAdmin();
      const existing = await db.from('tenants').select('status, lifecycle_status').eq('id', clientId).single();
      if (existing.error) return res.status(404).json({ error: 'Cliente não encontrado.' });
      if (existing.data.status === 'active') return res.status(400).json({ error: 'Cliente já está ativo.' });

      const updated = await db.from('tenants').update({ status: 'active', lifecycle_status: 'active', updated_at: new Date().toISOString() }).eq('id', clientId).select().single();
      if (updated.error) throw updated.error;
      
      await db.from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'client.reactivated',
        entity_type: 'tenants',
        entity_id: clientId,
        severity: 'info',
        ...auditContext(req, { result: 'success', reason: parse.data.reason, before: existing.data, after: { status: 'active', lifecycle_status: 'active' } })
      });
      res.json({ success: true, tenant: updated.data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/admin/clients/:id/solutions
  router.put('/:id/solutions', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.solutions.manage'), async (req: any, res: any) => {
    try {
      const clientId = req.params.id;
      const parse = z.object({ solutionKeys: z.array(z.string()) }).safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: 'solutionKeys deve ser uma lista de chaves válidas.' });
      const { solutionKeys } = parse.data;
      const before = await getSupabaseAdmin().from('tenant_solutions').select('solutions(key)').eq('tenant_id', clientId);
      const replaced = await getSupabaseAdmin().rpc('admin_replace_tenant_solutions', {
        p_tenant_id: clientId,
        p_solution_keys: [...new Set(solutionKeys)],
      });
      if (replaced.error) throw replaced.error;
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'solution.updated',
        entity_type: 'tenant_solutions',
        entity_id: clientId,
        severity: 'info',
        ...auditContext(req, { result: 'success', before: before.data, after: { solutions: solutionKeys } })
      });
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
