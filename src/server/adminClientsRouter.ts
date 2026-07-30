import { Router } from 'express';

export function createAdminClientsRouter(getSupabaseAdmin: any, requirePlatformAuth: any) {
  const router = Router();

  // GET /api/admin/clients
  router.get('/', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      
      const { data, error } = await getSupabaseAdmin()
        .from('tenants')
        .select('*, tenant_solutions(*), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))))')
        .in('status', ['active', 'suspended']);

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
      
      // Filter based on scope
      if (!platformContext.permissions.includes('platform.clients.read')) {
        const myTeamIds = platformContext.teams.map((t: any) => t.id);
        const myMemberId = platformContext.platformMember.id;
        
        clients = clients.filter((c: any) => {
          const a = c.assignment;
          if (!a) return false;
          if (a.owner_platform_member_id === myMemberId) return true;
          
          if (myTeamIds.includes(a.team_id)) {
            const team = platformContext.teams.find((t: any) => t.id === a.team_id);
            if (platformContext.managedTeams.some((t: any) => t.id === a.team_id)) return true;
            if (team?.member_client_visibility === 'team' || team?.member_client_visibility === 'all') return true;
          }
          return false;
        });
      }
      
      res.json(clients);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // GET /api/admin/clients/:id
  router.get('/:id', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      
      const { data, error } = await getSupabaseAdmin()
        .from('tenants')
        .select('*, tenant_solutions(solution_id, status, solutions(key)), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))))')
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
      if (!platformContext.permissions.includes('platform.clients.read')) {
        const myTeamIds = platformContext.teams.map((t: any) => t.id);
        const myMemberId = platformContext.platformMember.id;
        let canView = false;
        
        if (assignment && assignment.owner_platform_member_id === myMemberId) canView = true;
        else if (assignment && myTeamIds.includes(assignment.team_id)) {
           const team = platformContext.teams.find((t: any) => t.id === assignment.team_id);
           if (platformContext.managedTeams.some((t: any) => t.id === assignment.team_id)) canView = true;
           else if (team?.member_client_visibility === 'team' || team?.member_client_visibility === 'all') canView = true;
        }
        
        if (!canView) return res.status(403).json({ error: 'Forbidden' });
      }
      
      res.json({ ...data, assignment, owner });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/clients/:id/assign
  router.post('/:id/assign', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const { team_id, owner_platform_member_id } = req.body;
      
      if (!platformContext.permissions.includes('platform.clients.manage')) {
        const isManager = platformContext.managedTeams.some((t: any) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data, error } = await getSupabaseAdmin()
        .from('platform_client_assignments')
        .upsert({
          tenant_id: clientId,
          team_id,
          owner_platform_member_id: owner_platform_member_id || null,
          assigned_by: platformContext.platformMember.id,
          status: 'active'
        }, { onConflict: 'tenant_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'client.assigned',
        entity_type: 'platform_client_assignments',
        entity_id: clientId,
        severity: 'info',
        team_id: team_id
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/admin/clients/:id/solutions
  router.put('/:id/solutions', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const { solutionKeys } = req.body; // e.g. ['integrity', 'people']
      
      if (!platformContext.permissions.includes('platform.solutions.manage')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      await getSupabaseAdmin().from('tenant_solutions').delete().eq('tenant_id', clientId);
      
      if (solutionKeys && solutionKeys.length > 0) {
        const { data: dbSolutions, error: sErr } = await getSupabaseAdmin()
          .from('solutions')
          .select('id, key')
          .in('key', solutionKeys);
          
        if (sErr) throw sErr;
        
        if (dbSolutions && dbSolutions.length > 0) {
          const solutionsToInsert = dbSolutions.map((s: any) => ({
            tenant_id: clientId,
            solution_id: s.id,
            status: 'contracted'
          }));
          await getSupabaseAdmin().from('tenant_solutions').insert(solutionsToInsert);
        }
      }
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'solution.updated',
        entity_type: 'tenant_solutions',
        entity_id: clientId,
        severity: 'info',
        metadata: { solutions: solutionKeys }
      });
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
