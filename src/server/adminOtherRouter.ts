import { Router } from 'express';
import { publicBillingHealth } from './billing/config';
import { auditContext, pageResult, parsePagination } from './operational';
import { captureServerAnalytics } from './analytics';
import { reportServerError } from './observability';
import { authenticateRequest, resolvePlatformContext, requirePlatformPermission } from './tenantAuth';

export function createAdminOtherRouter(getSupabaseAdmin: any, old_requirePlatformAuth: any) {
  const router = Router();
  const baseMiddlewares = [authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.staff.read')];

  // GET /api/admin/staff
  router.get('/staff', ...baseMiddlewares, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const { data: members, error: memberErr } = await getSupabaseAdmin()
        .from('platform_members')
        .select(`
          *,
          platform_roles(*),
          platform_team_members(*, platform_teams(*))
        `);
        
      if (memberErr) throw memberErr;
      
      const { data: usersData, error: userErr } = await getSupabaseAdmin().auth.admin.listUsers();
      if (userErr) throw userErr;
      
      let result = members.map((m: any) => {
        const user = usersData.users.find((u: any) => u.id === m.user_id);
        const role = m.platform_roles;
        const teams = (m.platform_team_members || []).map((tm: any) => tm.platform_teams);
        return {
          ...m,
          user: user ? {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            last_sign_in_at: user.last_sign_in_at,
            created_at: user.created_at
          } : null,
          role,
          teams
        };
      });

      if (platformContext.role?.key !== 'admin') {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team: any) => team.id));
        result = result.filter((member: any) => member.user_id === req.user.id || (
          member.role?.key === 'sales' && member.platform_team_members?.some((membership: any) => managedTeamIds.has(membership.team_id))
        ));
      }
      
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/staff (Invite staff member)
  router.post('/staff', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const callerRoleKey = platformContext.role?.key;

      if (!platformContext.permissions.includes('platform.staff.manage') && callerRoleKey !== 'admin') {
        if (callerRoleKey !== 'manager') {
          return res.status(403).json({ error: 'Forbidden: Insufficient permissions to invite staff.' });
        }
      }

      const { email, role_key, relationship_type, team_ids } = req.body;

      if (!email || !role_key || !relationship_type) {
        return res.status(400).json({ error: 'Campos obrigatórios: e-mail, função e vínculo.' });
      }

      // Manager escalation check: Manager can only invite Sales
      if (callerRoleKey === 'manager' && role_key !== 'sales') {
        return res.status(403).json({ error: 'Gerentes só podem convidar membros para a função Sales (Vendas).' });
      }
      if (callerRoleKey === 'manager') {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team: any) => team.id));
        if (!Array.isArray(team_ids) || team_ids.length === 0 || team_ids.some((teamId: string) => !managedTeamIds.has(teamId))) {
          return res.status(403).json({ error: 'Gerentes só podem convidar Sales para equipes que gerenciam.' });
        }
      }

      // Rule: Admin = Partner
      let finalRelationshipType = relationship_type;
      if (role_key === 'admin') {
        finalRelationshipType = 'partner';
      }

      // Determine redirect URL for invite link
      const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const redirectTo = `${origin}/#/auth/accept-invite`;

      // Assign Role lookup first
      const { data: roleData } = await getSupabaseAdmin()
        .from('platform_roles')
        .select('id')
        .eq('key', role_key)
        .single();
      if (!roleData) return res.status(400).json({ error: 'Função interna inválida.' });

      // Call Supabase Admin invite API
      let userId: string;
      const { data: inviteData, error: inviteErr } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(email, {
        redirectTo
      });

      if (inviteErr) {
        // If user already exists in auth.users, fetch their user_id
        const { data: usersList } = await getSupabaseAdmin().auth.admin.listUsers();
        const existingUser = usersList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existingUser) {
          return res.status(400).json({ error: inviteErr.message || 'Erro ao enviar convite por e-mail.' });
        }
        userId = existingUser.id;
      } else {
        userId = inviteData.user.id;
      }

      // Check if platform_member already exists for this user_id
      let { data: member } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!member) {
        const { data: newMem, error: insMemErr } = await getSupabaseAdmin()
          .from('platform_members')
          .insert({
            user_id: userId,
            relationship_type: finalRelationshipType,
            role_id: roleData?.id || null,
            status: 'invited'
          })
          .select()
          .single();

        if (insMemErr) throw insMemErr;
        member = newMem;
      } else {
        // Update relationship and role_id if member exists
        await getSupabaseAdmin()
          .from('platform_members')
          .update({ 
            relationship_type: finalRelationshipType,
            role_id: roleData?.id || member.role_id
          })
          .eq('id', member.id);
      }

      // Assign Teams if provided
      if (Array.isArray(team_ids) && team_ids.length > 0) {
        for (const teamId of team_ids) {
          await getSupabaseAdmin()
            .from('platform_team_members')
            .upsert({
              team_id: teamId,
              platform_member_id: member.id,
              team_role: 'member',
              status: 'active'
            }, { onConflict: 'team_id,platform_member_id' });
        }
      }

      // Audit Log
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'platform.member.invited',
        entity_type: 'platform_members',
        entity_id: member.id,
        severity: 'info',
        metadata: { role_key, relationship_type: finalRelationshipType }
      });

      void captureServerAnalytics('user_invited', req.user.id, { role: role_key, source: 'platform_admin' });

      res.json({ success: true, member });
    } catch (e: any) {
      reportServerError(e, req, 'platform_member_invite');
      res.status(500).json({ error: 'Não foi possível concluir o convite.' });
    }
  });

  // PATCH /api/admin/staff/:id (Update member role/relationship/teams)
  router.patch('/staff/:id', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const callerRoleKey = platformContext.role?.key;
      const isManager = callerRoleKey === 'manager';
      if (!platformContext.permissions.includes('platform.staff.manage') && callerRoleKey !== 'admin' && !isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const memberId = req.params.id;
      const { role_key, relationship_type, team_ids } = req.body;

      // Get target member
      const { data: targetMember, error: tgtErr } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*, platform_roles(key)')
        .eq('id', memberId)
        .single();

      if (tgtErr || !targetMember) {
        return res.status(404).json({ error: 'Membro não encontrado.' });
      }

      if (targetMember.user_id === req.user.id && role_key && role_key !== targetMember.platform_roles?.key) {
        return res.status(403).json({ error: 'Ninguém pode alterar a própria função global.' });
      }

      if (isManager) {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team: any) => team.id));
        const { data: targetTeams } = await getSupabaseAdmin().from('platform_team_members')
          .select('team_id').eq('platform_member_id', memberId).eq('status', 'active');
        const inScope = (targetTeams || []).some((team: any) => managedTeamIds.has(team.team_id));
        const requestedTeamsAreScoped = !Array.isArray(team_ids) || (team_ids.length > 0 && team_ids.every((teamId: string) => managedTeamIds.has(teamId)));
        if (targetMember.platform_roles?.key !== 'sales' || (role_key && role_key !== 'sales') || !inScope || !requestedTeamsAreScoped) {
          return res.status(403).json({ error: 'Gerentes só podem administrar vendedores das próprias equipes.' });
        }
      }

      const targetCurrentRole = targetMember.platform_roles?.key;

      // Protection: Last active Admin
      if (targetCurrentRole === 'admin' && role_key && role_key !== 'admin') {
        const { data: adminRole } = await getSupabaseAdmin().from('platform_roles').select('id').eq('key', 'admin').single();
        if (adminRole) {
          const { data: activeAdmins } = await getSupabaseAdmin()
            .from('platform_members')
            .select('id')
            .eq('role_id', adminRole.id)
            .eq('status', 'active');

          if ((activeAdmins || []).length <= 1) {
            return res.status(400).json({ error: 'Não é possível rebaixar a função do único Admin ativo da plataforma.' });
          }
        }
      }

      // Rule: Admin = Partner
      let finalRelationshipType = relationship_type || targetMember.relationship_type;
      if (role_key === 'admin') {
        finalRelationshipType = 'partner';
      }

      // Update relationship_type
      if (relationship_type && finalRelationshipType !== targetMember.relationship_type) {
        await getSupabaseAdmin()
          .from('platform_members')
          .update({ relationship_type: finalRelationshipType })
          .eq('id', memberId);

        await getSupabaseAdmin().from('platform_audit_logs').insert({
          actor_user_id: req.user.id,
          action: 'platform.member.relationship_changed',
          entity_type: 'platform_members',
          entity_id: memberId,
          severity: 'info',
          metadata: { old: targetMember.relationship_type, new: finalRelationshipType }
        });
      }

      // Update Role if provided
      if (role_key && role_key !== targetCurrentRole) {
        const { data: roleData } = await getSupabaseAdmin()
          .from('platform_roles')
          .select('id')
          .eq('key', role_key)
          .single();

        if (roleData) {
          await getSupabaseAdmin()
            .from('platform_members')
            .update({ role_id: roleData.id })
            .eq('id', memberId);

          await getSupabaseAdmin().from('platform_audit_logs').insert({
            actor_user_id: req.user.id,
            action: 'platform.member.role_changed',
            entity_type: 'platform_members',
            entity_id: memberId,
            severity: 'info',
            metadata: { old: targetCurrentRole, new: role_key }
          });
        }
      }

      // Sync Teams if team_ids provided
      if (Array.isArray(team_ids)) {
        await getSupabaseAdmin()
          .from('platform_team_members')
          .delete()
          .eq('platform_member_id', memberId);

        for (const teamId of team_ids) {
          await getSupabaseAdmin()
            .from('platform_team_members')
            .insert({
              team_id: teamId,
              platform_member_id: memberId,
              team_role: 'member',
              status: 'active'
            });
        }

        await getSupabaseAdmin().from('platform_audit_logs').insert({
          actor_user_id: req.user.id,
          action: 'platform.member.team_added',
          entity_type: 'platform_members',
          entity_id: memberId,
          severity: 'info',
          metadata: { team_ids }
        });
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error('Error in PATCH /api/admin/staff/:id:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/staff/:id/suspend
  router.post('/staff/:id/suspend', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes('platform.staff.manage') && platformContext.role?.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const memberId = req.params.id;

      // Check target member
      const { data: targetMember } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*, platform_roles(key)')
        .eq('id', memberId)
        .single();

      if (!targetMember) {
        return res.status(404).json({ error: 'Membro não encontrado.' });
      }

      const targetRole = targetMember.platform_roles?.key;

      // Protection: Last active Admin
      if (targetRole === 'admin' && targetMember.status === 'active') {
        const { data: adminRole } = await getSupabaseAdmin().from('platform_roles').select('id').eq('key', 'admin').single();
        if (adminRole) {
          const { data: activeAdmins } = await getSupabaseAdmin()
            .from('platform_members')
            .select('id')
            .eq('role_id', adminRole.id)
            .eq('status', 'active');

          if ((activeAdmins || []).length <= 1) {
            return res.status(400).json({ error: 'Não é possível suspender o único Admin ativo do sistema.' });
          }
        }
      }

      const { error: updErr } = await getSupabaseAdmin()
        .from('platform_members')
        .update({ status: 'suspended' })
        .eq('id', memberId);

      if (updErr) throw updErr;

      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'platform.member.suspended',
        entity_type: 'platform_members',
        entity_id: memberId,
        severity: 'warning'
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error('Error suspending member:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/staff/:id/reactivate
  router.post('/staff/:id/reactivate', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes('platform.staff.manage') && platformContext.role?.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const memberId = req.params.id;

      const { error: updErr } = await getSupabaseAdmin()
        .from('platform_members')
        .update({ status: 'active' })
        .eq('id', memberId);

      if (updErr) throw updErr;

      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'platform.member.reactivated',
        entity_type: 'platform_members',
        entity_id: memberId,
        severity: 'info'
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error('Error reactivating member:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/audit
  router.get('/audit', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      
      const { page, pageSize, from, to } = parsePagination(req.query);
      let query = getSupabaseAdmin()
        .from('platform_audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (typeof req.query.action === 'string' && req.query.action) query = query.ilike('action', `%${req.query.action.replace(/[%(),]/g, '').slice(0, 100)}%`);
      if (typeof req.query.severity === 'string' && req.query.severity) query = query.eq('severity', req.query.severity);
        
      if (platformContext.role?.key !== 'admin') {
        if (!platformContext.permissions.includes('platform.audit.team.read')) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        const teamIds = platformContext.managedTeams.map((t: any) => t.id);
        if (teamIds.length === 0) return res.json(pageResult([], 0, page, pageSize));
        query = query.in('team_id', teamIds);
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const result = data.map((log: any) => {
        const user = usersData?.users?.find((u: any) => u.id === log.actor_user_id);
        return { ...log, actor_email: user?.email || 'Sistema' };
      });
      
      res.json(pageResult(result, count, page, pageSize));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/system/health
  router.get('/system/health', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes('platform.system.read') && platformContext.role?.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const dbStart = performance.now();
      const { error } = await getSupabaseAdmin().from('platform_roles').select('id').limit(1);
      const databaseLatencyMs = Math.round(performance.now() - dbStart);
      const authStart = performance.now();
      const authCheck = await getSupabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1 });
      const authLatencyMs = Math.round(performance.now() - authStart);
      const [lastWebhook, queue, lastReconciliation] = await Promise.all([
        getSupabaseAdmin().from('billing_webhook_events').select('event_type,status,received_at').order('received_at', { ascending: false }).limit(1).maybeSingle(),
        getSupabaseAdmin().from('billing_webhook_events').select('*', { count: 'exact', head: true }).in('status', ['received', 'processing', 'failed']),
        getSupabaseAdmin().from('billing_reconciliation_runs').select('status,started_at,completed_at,error_count,summary').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      res.json({
        status: !error && !authCheck.error ? 'operational' : 'degraded',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: { status: error ? 'error' : 'connected', latencyMs: databaseLatencyMs },
        auth: { status: authCheck.error ? 'error' : 'connected', latencyMs: authLatencyMs },
        billing: publicBillingHealth(),
        webhook: { last: lastWebhook.data || null, queued: queue.count || 0 },
        reconciliation: lastReconciliation.data || null,
        deploy: { commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null, url: process.env.VERCEL_URL || null, region: process.env.VERCEL_REGION || null },
        uptime: process.uptime()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/staff/:id/terminate-sessions', requirePlatformAuth, async (req: any, res: any) => {
    if (req.platformContext.role?.key !== 'admin') return res.status(403).json({ error: 'Somente admin pode encerrar sessões.' });
    const db = getSupabaseAdmin();
    const target = await db.from('platform_members').select('id,user_id').eq('id', req.params.id).single();
    if (target.error) return res.status(404).json({ error: 'Membro não encontrado.' });
    if (target.data.user_id === req.user.id) return res.status(403).json({ error: 'Encerre sua própria sessão pelo logout.' });
    const result = await db.rpc('admin_terminate_user_sessions', { p_user_id: target.data.user_id });
    if (result.error) return res.status(500).json({ error: result.error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'platform.member.sessions_terminated', entity_type: 'platform_members', entity_id: target.data.id, severity: 'warning', ...auditContext(req, { result: 'success' }) });
    return res.json({ success: true });
  });

  router.get('/system/solutions', requirePlatformAuth, async (req: any, res: any) => {
    if (!req.platformContext.permissions.includes('platform.solutions.read') && req.platformContext.role?.key !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const result = await getSupabaseAdmin().from('solutions').select('id,key,name,created_at').order('name');
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json(result.data);
  });

  router.patch('/system/solutions/:id', requirePlatformAuth, async (req: any, res: any) => {
    if (req.platformContext.role?.key !== 'admin' || !req.platformContext.permissions.includes('platform.solutions.manage')) return res.status(403).json({ error: 'Forbidden' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
    const db = getSupabaseAdmin(); const before = await db.from('solutions').select('*').eq('id', req.params.id).single();
    if (before.error) return res.status(404).json({ error: 'Solução não encontrada.' });
    const saved = await db.from('solutions').update({ name }).eq('id', req.params.id).select().single();
    if (saved.error) return res.status(400).json({ error: saved.error.message });
    await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'platform.solution.updated', entity_type: 'solutions', entity_id: req.params.id, severity: 'info', ...auditContext(req, { result: 'success', before: { name: before.data.name }, after: { name } }) });
    return res.json(saved.data);
  });

  router.get('/system/deploy', requirePlatformAuth, async (req: any, res: any) => {
    if (!req.platformContext.permissions.includes('platform.deploy.read') && req.platformContext.role?.key !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    return res.json({ commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null, commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null, branch: process.env.VERCEL_GIT_COMMIT_REF || null, url: process.env.VERCEL_URL || null, region: process.env.VERCEL_REGION || null, environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development' });
  });

  router.get('/system/settings', requirePlatformAuth, async (req: any, res: any) => {
    if (!req.platformContext.permissions.includes('platform.settings.read') && req.platformContext.role?.key !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    return res.json({ billing: publicBillingHealth(), publicSignup: false, authProvider: 'supabase', billingProvider: 'asaas', billingEnvironment: process.env.ASAAS_ENV || 'sandbox', webhookConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN), cronConfigured: Boolean(process.env.CRON_SECRET) });
  });

  router.get('/performance/own', requirePlatformAuth, async (req: any, res: any) => {
    const db = getSupabaseAdmin();
    const memberId = req.platformContext.platformMember.id;
    const [leads, activities, proposals, contracts] = await Promise.all([
      db.from('platform_lead_assignments').select('*', { count: 'exact', head: true }).eq('owner_platform_member_id', memberId),
      db.from('commercial_activities').select('*', { count: 'exact', head: true }).eq('owner_platform_member_id', memberId).eq('status', 'completed'),
      db.from('commercial_proposals').select('*', { count: 'exact', head: true }).eq('owner_platform_member_id', memberId),
      db.from('commercial_contracts').select('amount_cents,status').eq('owner_platform_member_id', memberId).in('status', ['active', 'approved', 'pending_payment']),
    ]);
    const revenueCents = (contracts.data || []).reduce((sum: number, contract: any) => sum + Number(contract.amount_cents || 0), 0);
    return res.json({ assignedLeads: leads.count || 0, completedActivities: activities.count || 0, proposals: proposals.count || 0, contracts: contracts.data?.length || 0, contractedRecurringCents: revenueCents });
  });

  return router;
}
