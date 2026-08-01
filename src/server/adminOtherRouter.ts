import { Router } from 'express';
import { publicBillingHealth } from './billing/config';

export function createAdminOtherRouter(getSupabaseAdmin: any, requirePlatformAuth: any) {
  const router = Router();

  // GET /api/admin/staff
  router.get('/staff', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes('platform.staff.read') && platformContext.role?.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
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
        metadata: { email, role_key, relationship_type: finalRelationshipType }
      });

      res.json({ success: true, member });
    } catch (e: any) {
      console.error('Error in POST /api/admin/staff:', e);
      res.status(500).json({ error: e.message });
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
      
      let query = getSupabaseAdmin()
        .from('platform_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (platformContext.role?.key !== 'admin') {
        if (!platformContext.permissions.includes('platform.audit.team.read')) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        const teamIds = platformContext.managedTeams.map((t: any) => t.id);
        if (teamIds.length === 0) return res.json([]);
        query = query.in('team_id', teamIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const result = data.map((log: any) => {
        const user = usersData?.users?.find((u: any) => u.id === log.actor_user_id);
        return { ...log, actor_email: user?.email || 'Sistema' };
      });
      
      res.json(result);
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
      
      const { data, error } = await getSupabaseAdmin().from('platform_roles').select('id').limit(1);
      
      res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: error ? 'error' : 'connected',
        auth: 'connected',
        billing: publicBillingHealth(),
        uptime: process.uptime()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
