import { Router } from 'express';
import { canReadAssignedResource } from './authorization';

export function createAdminLeadsRouter(getSupabaseAdmin: any, requirePlatformAuth: any) {
  const router = Router();

  // GET /api/admin/leads
  router.get('/', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      
      let query = getSupabaseAdmin().from('marketing_leads').select('*, platform_lead_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name)))').order('created_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Get users to attach names
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      
      let leads = data.map((l: any) => {
        const assignment = l.platform_lead_assignments?.[0];
        let owner = null;
        if (assignment?.platform_members?.user_id) {
          const u = usersData?.users?.find((u: any) => u.id === assignment.platform_members.user_id);
          if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
        }
        return { ...l, assignment, owner };
      });
      
      // Filter based on scope
      if (platformContext.role?.key !== 'admin') {
        leads = leads.filter((lead: any) => canReadAssignedResource(platformContext, lead.assignment, 'member_lead_visibility'));
      }
      
      res.json(leads);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/leads/:id/assign
  router.post('/:id/assign', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const leadId = req.params.id;
      const { team_id, owner_platform_member_id } = req.body;
      
      // Basic permission check
      if (platformContext.role?.key !== 'admin') {
        // Can a manager assign? Yes, if it's within their team.
        const isManager = platformContext.managedTeams.some((t: any) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
      }
      
      // Use RPC for safety or direct insert if we are admin
      const { data, error } = await getSupabaseAdmin()
        .from('platform_lead_assignments')
        .upsert({
          lead_id: leadId,
          team_id,
          owner_platform_member_id: owner_platform_member_id || null,
          assigned_by_user_id: req.user.id
        }, { onConflict: 'lead_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'lead.assigned',
        entity_type: 'platform_lead_assignments',
        entity_id: leadId,
        severity: 'info',
        team_id: team_id
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/leads/:id/claim
  router.post('/:id/claim', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const leadId = req.params.id;
      const myMemberId = platformContext.platformMember.id;
      
      // Get current assignment
      const { data: assignment, error: err1 } = await getSupabaseAdmin()
        .from('platform_lead_assignments')
        .select('*, platform_teams(allow_self_claim)')
        .eq('lead_id', leadId)
        .single();
        
      if (err1 || !assignment) return res.status(404).json({ error: 'Lead assignment not found' });
      
      if (!assignment.platform_teams?.allow_self_claim) {
        return res.status(403).json({ error: 'Self claim not allowed for this team' });
      }
      
      if (assignment.owner_platform_member_id) {
        return res.status(409).json({ error: 'Lead already claimed' });
      }
      
      // Must be member of the team
      if (!platformContext.teams.some((t: any) => t.id === assignment.team_id)) {
        return res.status(403).json({ error: 'You are not in this team' });
      }
      
      // Concurrency safe update
      const { data, error } = await getSupabaseAdmin()
        .from('platform_lead_assignments')
        .update({ owner_platform_member_id: myMemberId, updated_at: new Date().toISOString() })
        .eq('lead_id', leadId)
        .is('owner_platform_member_id', null)
        .select()
        .single();
        
      if (error || !data) {
        return res.status(409).json({ error: 'Failed to claim lead. It may have been claimed by someone else.' });
      }
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'lead.claimed',
        entity_type: 'platform_lead_assignments',
        entity_id: leadId,
        severity: 'info',
        team_id: assignment.team_id
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
