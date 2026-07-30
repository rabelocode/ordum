import { Router } from 'express';

export function createAdminTeamsRouter(getSupabaseAdmin: any, requirePlatformAuth: any) {
  const router = Router();

  // GET /api/admin/teams
  router.get('/', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin().from('platform_teams').select('*').order('name');
      
      if (!platformContext.permissions.includes('platform.teams.read')) {
        const teamIds = platformContext.teams.map((t: any) => t.id);
        if (teamIds.length === 0) return res.json([]);
        query = query.in('id', teamIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/teams
  router.post('/', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes('platform.teams.manage')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { name, team_type, channel, description, member_lead_visibility, member_client_visibility, allow_self_claim } = req.body;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const { data, error } = await getSupabaseAdmin()
        .from('platform_teams')
        .insert({
          name, slug, team_type, channel, description, 
          member_lead_visibility, member_client_visibility, allow_self_claim,
          status: 'active',
          created_by: platformContext.platformMember.id
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Audit log
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'team.created',
        entity_type: 'platform_teams',
        entity_id: data.id,
        severity: 'info'
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/teams/:id
  router.get('/:id', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      
      if (!platformContext.permissions.includes('platform.teams.read')) {
        const isMember = platformContext.teams.some((t: any) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data, error } = await getSupabaseAdmin().from('platform_teams').select('*').eq('id', teamId).single();
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/teams/:id
  router.patch('/:id', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      
      let isManager = false;
      if (!platformContext.permissions.includes('platform.teams.manage')) {
        // Check if user is manager of this team
        isManager = platformContext.managedTeams.some((t: any) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const updates = { ...req.body };
      delete updates.id; // Prevent updating ID
      
      const { data, error } = await getSupabaseAdmin()
        .from('platform_teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single();
        
      if (error) throw error;
      
      // Audit log
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'team.updated',
        entity_type: 'platform_teams',
        entity_id: data.id,
        severity: 'info',
        team_id: teamId
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/teams/:id/members
  router.get('/:id/members', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      
      if (!platformContext.permissions.includes('platform.teams.read')) {
        const isMember = platformContext.teams.some((t: any) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data: teamMembers, error } = await getSupabaseAdmin()
        .from('platform_team_members')
        .select(`
          team_role,
          status,
          joined_at,
          platform_members (
            id,
            user_id,
            relationship_type,
            status,
            platform_roles ( key, name )
          )
        `)
        .eq('team_id', teamId);
        
      if (error) throw error;
      
      // Get users
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      
      const result = teamMembers.map((tm: any) => {
        const member = tm.platform_members;
        const user = usersData?.users?.find((u: any) => u.id === member.user_id);
        const role = member?.platform_roles;
        
        return {
          platform_member_id: member.id,
          team_role: tm.team_role,
          status: tm.status,
          joined_at: tm.joined_at,
          member_status: member.status,
          relationship_type: member.relationship_type,
          user: user ? { email: user.email, name: user.user_metadata?.full_name } : null,
          role: role
        };
      });
      
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/teams/:id/members
  router.post('/:id/members', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const { platform_member_id, team_role } = req.body;
      
      let isManager = false;
      const hasGlobal = platformContext.permissions.includes('platform.teams.manage');
      if (!hasGlobal) {
        isManager = platformContext.managedTeams.some((t: any) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
        // Manager can only add Sales to their team
        // Let's verify the target member is a Sales
        const { data: tgtMember } = await getSupabaseAdmin().from('platform_members')
          .select('platform_roles(key)').eq('id', platform_member_id).single();
        if (tgtMember?.platform_roles?.key !== 'sales') {
          return res.status(403).json({ error: 'Managers can only add Sales to their team' });
        }
        if (team_role === 'manager') {
          return res.status(403).json({ error: 'Managers cannot create other Managers' });
        }
      }
      
      // Upsert
      const { data, error } = await getSupabaseAdmin()
        .from('platform_team_members')
        .upsert({
          team_id: teamId,
          platform_member_id,
          team_role,
          status: 'active'
        }, { onConflict: 'team_id,platform_member_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: team_role === 'manager' ? 'team.manager.added' : 'team.member.added',
        entity_type: 'platform_team_members',
        entity_id: platform_member_id,
        severity: 'info',
        team_id: teamId
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/admin/teams/:id/members/:memberId
  router.delete('/:id/members/:memberId', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const platform_member_id = req.params.memberId;
      
      let isManager = false;
      if (!platformContext.permissions.includes('platform.teams.manage')) {
        isManager = platformContext.managedTeams.some((t: any) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { error } = await getSupabaseAdmin()
        .from('platform_team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('platform_member_id', platform_member_id);
        
      if (error) throw error;
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'team.member.removed',
        entity_type: 'platform_team_members',
        entity_id: platform_member_id,
        severity: 'info',
        team_id: teamId
      });
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
