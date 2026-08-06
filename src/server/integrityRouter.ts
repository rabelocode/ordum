import express from 'express';
import { z } from 'zod';
import { authenticateRequest, resolveTenantContext, requireTenantSolution, requireTenantPermission } from './tenantAuth';

const stateTransitionSchema = z.object({
  action: z.enum(['received', 'triage', 'in_review', 'waiting', 'resolved', 'archived']),
  note: z.string().optional()
});

const assignmentSchema = z.object({
  membershipId: z.string().uuid()
});

const messageSchema = z.object({
  body: z.string().min(1, "Mensagem vazia").max(5000),
  visible_to_reporter: z.boolean().default(false)
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  risk_level: z.string().optional(),
  category_id: z.string().uuid().optional(),
  channel_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  days_open_min: z.string().regex(/^\d+$/).transform(Number).optional()
}).catchall(z.any());

export function createIntegrityRouter(getSupabaseAdmin: () => any, authOverrides?: any) {
  const router = express.Router();
  const auth = authOverrides || { authenticateRequest, resolveTenantContext, requireTenantSolution, requireTenantPermission };

  // Middleware to apply tenant rules
  router.use(auth.authenticateRequest);
  router.use(auth.resolveTenantContext);
  router.use(auth.requireTenantSolution('integrity'));

  const asyncHandler = (fn: express.RequestHandler): express.RequestHandler => 
    (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // List all cases for tenant
  router.get('/cases', auth.requireTenantPermission('integrity.cases.read'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const db = getSupabaseAdmin();
    const parsedQuery = listQuerySchema.safeParse(req.query);
    const q = parsedQuery.success ? parsedQuery.data : {};

    let query = db
      .from('integrity_reports')
      .select(`
        id, created_at, status, risk_level, protocol, 
        integrity_categories(name), 
        integrity_channels(name),
        integrity_case_assignments(membership_id)
      `)
      .eq('tenant_id', tenantContext.tenant.id);

    if (q.status) query = query.eq('status', q.status);
    if (q.risk_level) query = query.eq('risk_level', q.risk_level);
    if (q.category_id) query = query.eq('category_id', q.category_id);
    if (q.channel_id) query = query.eq('channel_id', q.channel_id);
    
    // We cannot easily filter by assignment or days_open natively without RPC or double-query
    // For now we process them in memory if given.
    
    const { data: cases, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    let filteredCases = cases || [];
    if (q.assigned_to) {
       filteredCases = filteredCases.filter((c: any) => c.integrity_case_assignments?.some((a: any) => a.membership_id === q.assigned_to));
    }
    if (q.days_open_min !== undefined) {
       const cutoff = new Date(Date.now() - q.days_open_min * 86400000);
       filteredCases = filteredCases.filter((c: any) => new Date(c.created_at) <= cutoff);
    }

    res.json({ success: true, cases: filteredCases });
  }));

  // Helper function to resolve/check if a report belongs to this tenant
  const getTenantReport = async (db: any, tenantId: string, reportId: string) => {
    const { data, error } = await db.from('integrity_reports').select('id, status').eq('id', reportId).eq('tenant_id', tenantId).maybeSingle();
    return { report: data, error };
  };

  // View case metadata
  router.get('/cases/:id', auth.requireTenantPermission('integrity.cases.read'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id } = req.params;
    const db = getSupabaseAdmin();

    const { data: report, error } = await db
      .from('integrity_reports')
      .select('*, integrity_categories(name), integrity_channels(name), integrity_attachments(file_id, uploaded_by_type), integrity_case_assignments(membership_id)')
      .eq('id', id)
      .eq('tenant_id', tenantContext.tenant.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });
    
    // Explicitly hide any hash (though it's in a different table, ensure it's not joined)
    res.json({ success: true, report });
  }));

  // View case timeline
  router.get('/cases/:id/timeline', auth.requireTenantPermission('integrity.cases.read'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id } = req.params;
    const db = getSupabaseAdmin();

    const { report } = await getTenantReport(db, tenantContext.tenant.id, id);
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });

    const { data: events, error } = await db
      .from('integrity_case_events')
      .select(`*`)
      .eq('report_id', id)
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, events });
  }));

  // Perform case state transition
  router.post('/cases/:id/events', auth.requireTenantPermission('integrity.cases.manage'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id } = req.params;
    const db = getSupabaseAdmin();

    const parsed = stateTransitionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido', issues: parsed.error.issues });
    
    const { report } = await getTenantReport(db, tenantContext.tenant.id, id);
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });

    const fromStatus = report.status;
    const toStatus = parsed.data.action;

    // Validate sane transitions
    const validStates = ['received', 'triage', 'in_review', 'waiting', 'resolved', 'archived'];
    if (!validStates.includes(toStatus)) {
      return res.status(400).json({ error: 'Status de transição inválido' });
    }

    // Update report
    const { error: updError } = await db.from('integrity_reports').update({ status: toStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (updError) return res.status(500).json({ error: 'Erro ao transicionar status' });

    // Append to events audit trail
    await db.from('integrity_case_events').insert({
      report_id: id,
      event_type: 'status_changed',
      from_status: fromStatus,
      to_status: toStatus,
      note: parsed.data.note || null,
      actor_membership_id: tenantContext.membership.id,
      metadata: {}
    });

    res.json({ success: true, status: toStatus });
  }));

  // Create assignments
  router.post('/cases/:id/assignments', auth.requireTenantPermission('integrity.cases.manage'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id } = req.params;
    const db = getSupabaseAdmin();

    const parsed = assignmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido', issues: parsed.error.issues });
    
    const { report } = await getTenantReport(db, tenantContext.tenant.id, id);
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });

    // Validate assignment candidate
    const { data: targetMembership, error: targetErr } = await db
      .from('memberships')
      .select('id, status')
      .eq('id', parsed.data.membershipId)
      .eq('tenant_id', tenantContext.tenant.id)
      .maybeSingle();
    
    if (targetErr || !targetMembership) return res.status(400).json({ error: 'Membro não encontrado no tenant' });
    if (targetMembership.status !== 'active') return res.status(400).json({ error: 'Membro inativo ou não elegível' });

    // Idempotent upsert logic or existence check
    const { data: existing } = await db.from('integrity_case_assignments').select('*').eq('report_id', id).eq('membership_id', parsed.data.membershipId).maybeSingle();
    if (!existing) {
        await db.from('integrity_case_assignments').insert({
            report_id: id,
            membership_id: parsed.data.membershipId,
            assigned_by_membership_id: tenantContext.membership.id
        });
        await db.from('integrity_case_events').insert({
            report_id: id,
            event_type: 'assigned',
            actor_membership_id: tenantContext.membership.id,
            metadata: { assigned_membership: parsed.data.membershipId }
        });
    }

    res.json({ success: true });
  }));

  // Delete assignment
  router.delete('/cases/:id/assignments/:membershipId', auth.requireTenantPermission('integrity.cases.manage'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id, membershipId } = req.params;
    const db = getSupabaseAdmin();

    const { report } = await getTenantReport(db, tenantContext.tenant.id, id);
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });

    await db.from('integrity_case_assignments').delete().eq('report_id', id).eq('membership_id', membershipId);
    
    await db.from('integrity_case_events').insert({
        report_id: id,
        event_type: 'unassigned',
        actor_membership_id: tenantContext.membership.id,
        metadata: { unassigned_membership: membershipId }
    });
    
    res.json({ success: true });
  }));

  // List messages
  router.get('/cases/:id/messages', auth.requireTenantPermission('integrity.cases.read'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id } = req.params;
    const db = getSupabaseAdmin();

    const { report } = await getTenantReport(db, tenantContext.tenant.id, id);
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });

    const { data: messages, error } = await db
      .from('integrity_report_messages')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: true });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, messages });
  }));

  // Post message in anonymous channel
  router.post('/cases/:id/messages', auth.requireTenantPermission('integrity.cases.manage'), asyncHandler(async (req, res) => {
    const { tenantContext } = req as any;
    const { id } = req.params;
    const db = getSupabaseAdmin();

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido', issues: parsed.error.issues });
    
    const { report } = await getTenantReport(db, tenantContext.tenant.id, id);
    if (!report) return res.status(404).json({ error: 'Caso não encontrado' });

    const { error: msgErr } = await db.from('integrity_report_messages').insert({
        report_id: id,
        body: parsed.data.body,
        visible_to_reporter: parsed.data.visible_to_reporter,
        author_type: 'case_manager',
        author_membership_id: tenantContext.membership.id
    });

    if (msgErr) return res.status(500).json({ error: 'Erro ao registrar mensagem' });

    // Trail audit
    await db.from('integrity_case_events').insert({
        report_id: id,
        event_type: 'message_posted',
        actor_membership_id: tenantContext.membership.id,
        metadata: { visible_to_reporter: parsed.data.visible_to_reporter }
    });

    res.json({ success: true });
  }));

  return router;
}
