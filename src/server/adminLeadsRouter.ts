import { Router } from 'express';
import { canReadAssignedResource } from './authorization';
import { auditContext, pageResult, parsePagination } from './operational';

export function createAdminLeadsRouter(getSupabaseAdmin: any, requirePlatformAuth: any) {
  const router = Router();

  // GET /api/admin/leads
  router.get('/', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      
      const { page, pageSize, from, to } = parsePagination(req.query);
      const paginated = req.query.page !== undefined;
      let visibleLeadIds: string[] | null = null;
      if (platformContext.role?.key !== 'admin') {
        const visibleTeams = platformContext.teams
          .filter((team: any) => platformContext.managedTeams.some((managed: any) => managed.id === team.id) || ['team', 'all'].includes(team.member_lead_visibility))
          .map((team: any) => team.id);
        let assignmentQuery = getSupabaseAdmin().from('platform_lead_assignments').select('lead_id');
        const clauses = [`owner_platform_member_id.eq.${platformContext.platformMember.id}`];
        if (visibleTeams.length) clauses.push(`team_id.in.(${visibleTeams.join(',')})`);
        assignmentQuery = assignmentQuery.or(clauses.join(','));
        const assignmentResult = await assignmentQuery;
        if (assignmentResult.error) throw assignmentResult.error;
        visibleLeadIds = [...new Set<string>((assignmentResult.data || []).map((item: any) => String(item.lead_id)))];
        if (!visibleLeadIds.length) return res.json(paginated ? pageResult([], 0, page, pageSize) : []);
      }

      let query = getSupabaseAdmin().from('marketing_leads')
        .select('*, platform_lead_assignments(*, platform_teams(name,allow_self_claim), platform_members(user_id, platform_roles(key, name))), commercial_activities(id,activity_type,subject,status,scheduled_at,result,next_action,next_action_at,created_at), commercial_demos(id,status,starts_at,expires_at,result,next_action,next_action_at)', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (visibleLeadIds) query = query.in('id', visibleLeadIds);
      if (typeof req.query.status === 'string' && req.query.status) query = query.eq('status', req.query.status);
      if (typeof req.query.priority === 'string' && req.query.priority) query = query.eq('priority', req.query.priority);
      if (typeof req.query.search === 'string' && req.query.search.trim()) {
        const term = req.query.search.trim().replace(/[%(),]/g, '').slice(0, 100);
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
      }
      if (paginated) query = query.range(from, to);
      const { data, error, count } = await query;
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
      
      res.json(paginated ? pageResult(leads, count, page, pageSize) : leads);
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
      if (!team_id || typeof req.body?.reason !== 'string' || !req.body.reason.trim()) {
        return res.status(400).json({ error: 'Equipe e motivo da transferência são obrigatórios.' });
      }
      const current = await getSupabaseAdmin().from('platform_lead_assignments').select('*').eq('lead_id', leadId).maybeSingle();
      if (current.error) throw current.error;
      
      // Basic permission check
      if (platformContext.role?.key !== 'admin') {
        // Can a manager assign? Yes, if it's within their team.
        const isManager = platformContext.managedTeams.some((t: any) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: 'Forbidden' });
        if (!current.data || !platformContext.managedTeams.some((team: any) => team.id === current.data.team_id)) {
          return res.status(403).json({ error: 'Lead fora do escopo gerenciado.' });
        }
      }
      if (owner_platform_member_id) {
        const target = await getSupabaseAdmin().from('platform_team_members').select('platform_member_id')
          .eq('team_id', team_id).eq('platform_member_id', owner_platform_member_id).eq('status', 'active').maybeSingle();
        if (!target.data) return res.status(400).json({ error: 'O responsável precisa ser membro ativo da equipe.' });
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

      await getSupabaseAdmin().from('commercial_lead_assignment_history').insert({
        lead_id: leadId,
        from_team_id: current.data?.team_id || null,
        to_team_id: team_id,
        from_owner_platform_member_id: current.data?.owner_platform_member_id || null,
        to_owner_platform_member_id: owner_platform_member_id || null,
        reason: req.body.reason.trim(),
        actor_user_id: req.user.id,
      });
      
      await getSupabaseAdmin().from('platform_audit_logs').insert({
        actor_user_id: req.user.id,
        action: 'lead.assigned',
        entity_type: 'platform_lead_assignments',
        entity_id: leadId,
        severity: 'info',
        team_id: team_id,
        ...auditContext(req, { result: 'success', after: { team_id, owner_platform_member_id: owner_platform_member_id || null } })
      });
      
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/:id', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const db = getSupabaseAdmin();
      const { data: lead, error: leadError } = await db.from('marketing_leads')
        .select('*, platform_lead_assignments(*)').eq('id', req.params.id).single();
      if (leadError || !lead) return res.status(404).json({ error: 'Lead não encontrado.' });
      const assignment = lead.platform_lead_assignments?.[0];
      if (req.platformContext.role?.key !== 'admin' && !canReadAssignedResource(req.platformContext, assignment, 'member_lead_visibility')) {
        return res.status(403).json({ error: 'Lead fora do seu escopo.' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        return res.status(409).json({ error: 'Alterações de estado usam a máquina de transição e exigem motivo.' });
      }
      const allowed = ['priority', 'qualification_state', 'first_contact_at', 'won_reason', 'lost_reason'];
      const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
      if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nenhum campo permitido.' });
      const saved = await db.from('marketing_leads').update(updates).eq('id', lead.id).select().single();
      if (saved.error) return res.status(400).json({ error: saved.error.message });
      await db.from('platform_audit_logs').insert({
        actor_user_id: req.user.id, action: 'lead.updated', entity_type: 'marketing_leads', entity_id: lead.id,
        team_id: assignment?.team_id || null, severity: 'info',
        ...auditContext(req, { result: 'success', before: { status: lead.status, priority: lead.priority }, after: updates }),
      });
      return res.json(saved.data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/duplicates', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const db = getSupabaseAdmin();
      const leadResult = await db.from('marketing_leads').select('id,platform_lead_assignments(*)').eq('id', req.params.id).maybeSingle();
      if (leadResult.error || !leadResult.data) return res.status(404).json({ error: 'Lead não encontrado.' });
      const assignment = leadResult.data.platform_lead_assignments?.[0];
      if (!canReadAssignedResource(req.platformContext, assignment, 'member_lead_visibility')) return res.status(403).json({ error: 'Lead fora do seu escopo.' });
      const keys = await db.from('commercial_lead_identity_keys').select('key_type,key_hash').eq('lead_id', req.params.id);
      if (keys.error) throw keys.error;
      if (!keys.data?.length) return res.json({ duplicates: [], matchedBy: [] });
      const hashes = [...new Set(keys.data.map((key: any) => key.key_hash))];
      const matches = await db.from('commercial_lead_identity_keys').select('lead_id,key_type').in('key_hash', hashes).neq('lead_id', req.params.id).limit(100);
      if (matches.error) throw matches.error;
      const leadIds = [...new Set<string>((matches.data || []).map((item: any) => item.lead_id))];
      if (!leadIds.length) return res.json({ duplicates: [], matchedBy: [] });
      const leads = await db.from('marketing_leads').select('id,name,email,company,phone,status,created_at,platform_lead_assignments(*)').in('id', leadIds);
      if (leads.error) throw leads.error;
      const visible = (leads.data || []).filter((lead: any) => canReadAssignedResource(req.platformContext, lead.platform_lead_assignments?.[0], 'member_lead_visibility'));
      return res.json({ duplicates: visible, matches: (matches.data || []).filter((match: any) => visible.some((lead: any) => lead.id === match.lead_id)) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/auto-assign', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const teamId = req.body?.teamId;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (!teamId || !reason) return res.status(400).json({ error: 'Equipe e motivo são obrigatórios.' });
      if (req.platformContext.role?.key !== 'admin' && !req.platformContext.managedTeams.some((team: any) => team.id === teamId)) return res.status(403).json({ error: 'Equipe fora do escopo gerenciado.' });
      const result = await getSupabaseAdmin().rpc('admin_auto_assign_lead', { p_lead_id: req.params.id, p_team_id: teamId, p_actor_user_id: req.user.id, p_reason: reason });
      if (result.error) return res.status(409).json({ error: result.error.message });
      return res.json({ ownerPlatformMemberId: result.data });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/recalculate-score', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const db = getSupabaseAdmin();
      const lead = await db.from('marketing_leads').select('*').eq('id', req.params.id).maybeSingle();
      if (lead.error || !lead.data) return res.status(404).json({ error: 'Lead não encontrado.' });
      const assignmentResult = await db.from('platform_lead_assignments').select('*').eq('lead_id', req.params.id).maybeSingle();
      if (!canReadAssignedResource(req.platformContext, assignmentResult.data, 'member_lead_visibility')) return res.status(403).json({ error: 'Lead fora do seu escopo.' });
      const rules = await db.from('commercial_scoring_rules').select('*').eq('active', true).order('priority').limit(100);
      if (rules.error) throw rules.error;
      const explanations: any[] = [];
      let score = 0;
      for (const rule of rules.data || []) {
        const actual = rule.field.split('.').reduce((value: any, key: string) => value?.[key], lead.data);
        const expected = rule.comparison_value;
        const matched = rule.operator === 'present' ? actual !== null && actual !== undefined && String(actual).trim() !== ''
          : rule.operator === 'equals' ? String(actual ?? '').toLowerCase() === String(expected ?? '').toLowerCase()
          : rule.operator === 'contains' ? String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
          : rule.operator === 'in' ? Array.isArray(expected) && expected.map(String).includes(String(actual))
          : rule.operator === 'gte' ? Number(actual) >= Number(expected)
          : rule.operator === 'lte' ? Number(actual) <= Number(expected) : false;
        if (matched) { score += Number(rule.points); explanations.push({ ruleId: rule.id, name: rule.name, points: rule.points }); }
      }
      score = Math.max(0, Math.min(100, score));
      const saved = await db.from('marketing_leads').update({ score, score_explanation: explanations, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('id,score,score_explanation').single();
      if (saved.error) throw saved.error;
      await db.from('platform_audit_logs').insert({ actor_user_id: req.user.id, action: 'lead.score_recalculated', entity_type: 'marketing_leads', entity_id: req.params.id, severity: 'info', ...auditContext(req, { result: 'success', after: { score, matched_rules: explanations.length } }) });
      return res.json(saved.data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
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
