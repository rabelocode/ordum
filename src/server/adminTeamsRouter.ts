import { Router } from 'express';
import { z } from 'zod';
import { auditContext } from './operational';
import { authenticateRequest, resolvePlatformContext, requirePlatformPermission } from './tenantAuth';

export function createAdminTeamsRouter(getSupabaseAdmin: any, _old_requirePlatformAuth: any) {
  const router = Router();

  // GET /api/admin/teams
  router.get('/', authenticateRequest, resolvePlatformContext, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin().from('platform_teams').select('*').order('name');
      
      if (platformContext.role?.key !== 'admin') {
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
  const createTeamSchema = z.object({
    name: z.string().min(1),
    team_type: z.string(),
    channel: z.string(),
    description: z.string().optional(),
    member_lead_visibility: z.string(),
    member_client_visibility: z.string(),
    allow_self_claim: z.boolean()
  });

  router.post('/', authenticateRequest, resolvePlatformContext, requirePlatformPermission('platform.teams.create'), async (req: any, res: any) => {
    try {
      const input = createTeamSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: 'Payload de criação inválido' });
      const { name, team_type, channel, description, member_lead_visibility, member_client_visibility, allow_self_claim } = input.data;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const { data, error } = await getSupabaseAdmin()
        .from('platform_teams')
        .insert({
          name, slug, team_type, channel, description, 
          member_lead_visibility, member_client_visibility, allow_self_claim,
          status: 'active',
          created_by: req.user.id
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
        severity: 'info',
        ...auditContext(req, { result: 'success', after: { name: data.name, team_type: data.team_type, channel: data.channel } })
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/teams/:id
  router.get('/:id', authenticateRequest, resolvePlatformContext, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      
      if (platformContext.role?.key !== 'admin') {
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
  const updateTeamSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    team_type: z.string().optional(),
    channel: z.string().optional(),
    status: z.string().optional(),
    member_lead_visibility: z.string().optional(),
    member_client_visibility: z.string().optional(),
    allow_self_claim: z.boolean().optional(),
    settings: z.any().optional()
  });

  router.patch('/:id', authenticateRequest, resolvePlatformContext, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      
      let isManager = false;
      if (platformContext.role?.key !== 'admin') {
        // Check if user is manager of this team
        isManager = platformContext.managedTeams.some((t: any) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const input = updateTeamSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: 'Payload de atualização inválido' });
      
      const allowedFields = isManager
        ? ['description', 'member_lead_visibility', 'member_client_visibility', 'allow_self_claim']
        : ['name', 'description', 'team_type', 'channel', 'status', 'member_lead_visibility', 'member_client_visibility', 'allow_self_claim', 'settings'];
      const updates = Object.fromEntries(Object.entries(input.data).filter(([key, val]) => allowedFields.includes(key) && val !== undefined));
      if (updates.settings && typeof updates.settings === 'object') {
        for (const key of ['proposal_approval_limit_cents', 'contract_approval_limit_cents']) {
          const value = (updates.settings as any)[key];
          if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
            return res.status(400).json({ error: `${key} deve ser um inteiro não negativo em centavos.` });
          }
        }
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

      const before = await getSupabaseAdmin().from('platform_teams').select('*').eq('id', teamId).single();
      
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
        team_id: teamId,
        ...auditContext(req, { result: 'success', before: before.data, after: data })
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/teams/:id/members
  router.get('/:id/members', authenticateRequest, resolvePlatformContext, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      
      if (platformContext.role?.key !== 'admin') {
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
  const teamMemberSchema = z.object({
    platform_member_id: z.string().uuid(),
    team_role: z.string()
  });

  router.post('/:id/members', authenticateRequest, resolvePlatformContext, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const input = teamMemberSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: 'Membro ou função inválidos' });
      const { platform_member_id, team_role } = input.data;
      
      let isManager = false;
      const hasGlobal = platformContext.role?.key === 'admin';
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
  router.delete('/:id/members/:memberId', authenticateRequest, resolvePlatformContext, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const platform_member_id = req.params.memberId;
      
      let isManager = false;
      if (platformContext.role?.key !== 'admin') {
        isManager = platformContext.managedTeams.some((t: any) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
        const { data: target } = await getSupabaseAdmin().from('platform_team_members')
          .select('team_role, platform_members(platform_roles(key))')
          .eq('team_id', teamId)
          .eq('platform_member_id', platform_member_id)
          .maybeSingle();
        if (target?.team_role === 'manager' || target?.platform_members?.platform_roles?.key !== 'sales') {
          return res.status(403).json({ error: 'Managers can only remove Sales members from their team' });
        }
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
