import express from 'express';
import { z } from 'zod';
import { authenticateRequest, resolveTenantContext, requireTenantSolution } from './tenantAuth';
import { canTransitionIntegrityCase, integrityDashboard, integrityTransitionNeedsReason } from '../domain/integrity';

const listSchema = z.object({
  search: z.string().trim().max(120).optional(), status: z.string().max(40).optional(), severity: z.string().max(20).optional(),
  category_id: z.string().uuid().optional(), unit_id: z.string().uuid().optional(), owner_id: z.string().uuid().optional(),
  sla: z.enum(['due_soon', 'overdue']).optional(), page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25), order: z.enum(['created_at', 'sla_due_at', 'severity']).default('created_at'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
const transitionSchema = z.object({ to_status: z.string(), reason: z.string().trim().max(1000).optional(), lock_version: z.number().int().positive() });
const assignmentSchema = z.object({ membership_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) });
const messageSchema = z.object({ body: z.string().trim().min(2).max(5000), visible_to_reporter: z.boolean().default(false) });
const settingsSchema = z.object({
  introduction: z.string().trim().min(10).max(2000), instructions: z.string().trim().max(4000).nullable().optional(),
  allows_anonymous: z.boolean(), allows_identified: z.boolean(), default_sla_hours: z.number().int().min(1).max(8760),
  automatic_acknowledgement: z.string().trim().min(5).max(2000), branding: z.record(z.string(), z.unknown()).default({}),
  attachment_policy: z.record(z.string(), z.unknown()).default({}), routing_rules: z.array(z.unknown()).default([]),
});
const conflictSchema = z.object({ membership_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) });
const channelSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(160), public_title: z.string().trim().min(2).max(160), public_slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), active: z.boolean().default(true), allows_anonymous: z.boolean(), allows_identified: z.boolean() });
const categorySchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), description: z.string().trim().max(1000).nullable().optional(), default_risk_level: z.enum(['low','medium','high','critical']), sla_hours: z.number().int().min(1).max(8760).nullable().optional(), active: z.boolean().default(true) });
const unitSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), code: z.string().trim().max(40).nullable().optional(), active: z.boolean().default(true) });

export function createIntegrityRouter(getSupabaseAdmin: () => any, authOverrides?: any) {
  const router = express.Router();
  const auth = authOverrides || { authenticateRequest, resolveTenantContext, requireTenantSolution };
  router.use(auth.authenticateRequest, auth.resolveTenantContext, auth.requireTenantSolution('integrity'));
  const asyncHandler = (fn: express.RequestHandler): express.RequestHandler => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const requireAny = (...permissions: string[]): express.RequestHandler => (req, res, next) => {
    const granted = (req as any).tenantContext?.permissions || [];
    if (!permissions.some((permission) => granted.includes(permission))) return res.status(403).json({ error: 'Você não possui permissão para esta operação.' });
    next();
  };
  const tenantId = (req: express.Request) => (req as any).tenantContext.tenant.id as string;
  const membershipId = (req: express.Request) => (req as any).tenantContext.membership.id as string;

  async function findCase(db: any, req: express.Request, id: string, select = 'id,tenant_id,report_id,status,lock_version,owner_membership_id,first_action_at') {
    return db.from('integrity_cases').select(select).eq('id', id).eq('tenant_id', tenantId(req)).maybeSingle();
  }

  router.get('/dashboard', requireAny('integrity.analytics.read', 'integrity.cases.read'), asyncHandler(async (req, res) => {
    const db = getSupabaseAdmin();
    const { data: cases, error } = await db.from('integrity_cases').select('status,severity,sla_due_at,first_action_at,closed_at,created_at,category_id,unit_id').eq('tenant_id', tenantId(req));
    if (error) return res.status(500).json({ error: 'Não foi possível carregar os indicadores.' });
    const rows = cases || [];
    return res.json({
      ...integrityDashboard(rows),
      updated_at: new Date().toISOString(),
    });
  }));

  router.get('/members', requireAny('integrity.cases.assign', 'integrity.cases.manage'), asyncHandler(async (req, res) => {
    const db = getSupabaseAdmin();
    const memberships = await db.from('memberships').select('id,user_id').eq('tenant_id', tenantId(req)).eq('status', 'active').order('created_at');
    if (memberships.error) return res.status(500).json({ error: 'Não foi possível carregar os responsáveis.' });
    const userIds = (memberships.data || []).map((item: any) => item.user_id);
    const profiles = userIds.length ? await db.from('profiles').select('id,full_name').in('id', userIds) : { data: [], error: null };
    if (profiles.error) return res.status(500).json({ error: 'Não foi possível carregar os responsáveis.' });
    const names = new Map((profiles.data || []).map((profile: any) => [profile.id, profile.full_name]));
    return res.json({ members: (memberships.data || []).map((item: any) => ({ id: item.id, name: names.get(item.user_id) || 'Membro do tenant' })) });
  }));

  router.get('/cases', requireAny('integrity.cases.read'), asyncHandler(async (req, res) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Filtros inválidos.', issues: parsed.error.issues });
    const q = parsed.data; const from = (q.page - 1) * q.limit; const db = getSupabaseAdmin();
    let query = db.from('integrity_cases').select('id,protocol,status,severity,priority,sla_due_at,created_at,updated_at,owner_membership_id,lock_version,integrity_categories(name),integrity_units(name),integrity_reports!inner(subject)', { count: 'exact' }).eq('tenant_id', tenantId(req));
    if (q.search) query = query.ilike('protocol', `%${q.search.replace(/[%_,]/g, '')}%`);
    if (q.status) query = query.eq('status', q.status);
    if (q.severity) query = query.eq('severity', q.severity);
    if (q.category_id) query = query.eq('category_id', q.category_id);
    if (q.unit_id) query = query.eq('unit_id', q.unit_id);
    if (q.owner_id) query = query.eq('owner_membership_id', q.owner_id);
    if (q.sla === 'overdue') query = query.lt('sla_due_at', new Date().toISOString()).not('status', 'in', '(closed,archived)');
    if (q.sla === 'due_soon') query = query.gte('sla_due_at', new Date().toISOString()).lte('sla_due_at', new Date(Date.now() + 864e5).toISOString()).not('status', 'in', '(closed,archived)');
    const result = await query.order(q.order, { ascending: q.direction === 'asc' }).range(from, from + q.limit - 1);
    if (result.error) return res.status(500).json({ error: 'Não foi possível carregar os casos.' });
    return res.json({ cases: result.data || [], page: q.page, limit: q.limit, total: result.count || 0, total_pages: Math.ceil((result.count || 0) / q.limit) });
  }));

  router.get('/cases/:id', requireAny('integrity.cases.read'), asyncHandler(async (req, res) => {
    const db = getSupabaseAdmin();
    const result = await findCase(db, req, req.params.id, '*,integrity_reports!inner(id,subject,description,occurred_at,reporter_mode,created_at),integrity_categories(name),integrity_units(name),integrity_case_assignments(membership_id,created_at),integrity_case_tasks(*),integrity_case_conflicts(membership_id,reason,active)');
    if (result.error) return res.status(500).json({ error: 'Não foi possível carregar o caso.' });
    if (!result.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    return res.json({ case: result.data });
  }));

  router.get('/cases/:id/timeline', requireAny('integrity.cases.read'), asyncHandler(async (req, res) => {
    const db = getSupabaseAdmin(); const found = await findCase(db, req, req.params.id);
    if (!found.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    const result = await db.from('integrity_case_events').select('*').eq('case_id', req.params.id).order('created_at', { ascending: false }).limit(200);
    if (result.error) return res.status(500).json({ error: 'Não foi possível carregar a timeline.' });
    return res.json({ events: result.data || [] });
  }));

  router.post('/cases/:id/transitions', requireAny('integrity.cases.manage'), asyncHandler(async (req, res) => {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Transição inválida.', issues: parsed.error.issues });
    const db = getSupabaseAdmin(); const found = await findCase(db, req, req.params.id);
    if (found.error || !found.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    const { to_status, reason, lock_version } = parsed.data;
    if (!canTransitionIntegrityCase(found.data.status, to_status)) return res.status(409).json({ error: `Transição ${found.data.status} → ${to_status} não permitida.` });
    if (integrityTransitionNeedsReason(to_status) && (!reason || reason.length < 3)) return res.status(400).json({ error: 'Informe o motivo desta transição.' });
    const saved = await db.rpc('transition_integrity_case', {
      p_case_id: req.params.id,
      p_tenant_id: tenantId(req),
      p_actor_membership_id: membershipId(req),
      p_to_status: to_status,
      p_reason: reason || null,
      p_expected_lock_version: lock_version,
    });
    if (saved.error) {
      const conflict = saved.error.code === '40001' || saved.error.message?.includes('case_version_conflict');
      return res.status(conflict ? 409 : 500).json({ error: conflict ? 'O caso foi alterado por outra pessoa. Atualize a página.' : 'Não foi possível alterar o status com auditoria.' });
    }
    const result = Array.isArray(saved.data) ? saved.data[0] : saved.data;
    return res.json({ status: result.status, lock_version: result.lock_version });
  }));

  router.post('/cases/:id/assignments', requireAny('integrity.cases.assign', 'integrity.cases.manage'), asyncHandler(async (req, res) => {
    const parsed = assignmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Atribuição inválida.', issues: parsed.error.issues });
    const db = getSupabaseAdmin(); const found = await findCase(db, req, req.params.id);
    if (!found.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    const target = await db.from('memberships').select('id,status').eq('id', parsed.data.membership_id).eq('tenant_id', tenantId(req)).maybeSingle();
    if (!target.data || target.data.status !== 'active') return res.status(400).json({ error: 'Responsável não está ativo neste tenant.' });
    const conflict = await db.from('integrity_case_conflicts').select('id,reason').eq('case_id', req.params.id).eq('membership_id', parsed.data.membership_id).eq('active', true).maybeSingle();
    if (conflict.data) return res.status(409).json({ error: 'Atribuição bloqueada por conflito de interesse registrado.' });
    const assignment = await db.from('integrity_case_assignments').upsert({ report_id: found.data.report_id, case_id: req.params.id, membership_id: parsed.data.membership_id, assigned_by_membership_id: membershipId(req) }, { onConflict: 'report_id,membership_id' });
    if (assignment.error) return res.status(500).json({ error: 'Não foi possível atribuir o responsável.' });
    const owner = await db.from('integrity_cases').update({ owner_membership_id: parsed.data.membership_id, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('tenant_id', tenantId(req));
    if (owner.error) return res.status(500).json({ error: 'A atribuição foi criada, mas o responsável principal não foi atualizado.' });
    const event = await db.from('integrity_case_events').insert({ report_id: found.data.report_id, case_id: req.params.id, event_type: 'assigned', actor_membership_id: membershipId(req), note: parsed.data.reason, metadata: { assigned_membership_id: parsed.data.membership_id } });
    if (event.error) return res.status(500).json({ error: 'Atribuição concluída, mas a auditoria falhou.' });
    return res.status(201).json({ assigned: true });
  }));

  router.post('/cases/:id/conflicts', requireAny('integrity.cases.assign', 'integrity.cases.manage'), asyncHandler(async (req, res) => {
    const parsed = conflictSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Conflito inválido.', issues: parsed.error.issues });
    const db = getSupabaseAdmin(); const found = await findCase(db, req, req.params.id);
    if (!found.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    const target = await db.from('memberships').select('id').eq('id', parsed.data.membership_id).eq('tenant_id', tenantId(req)).maybeSingle();
    if (!target.data) return res.status(400).json({ error: 'Membro não pertence a este tenant.' });
    const saved = await db.from('integrity_case_conflicts').upsert({ case_id: req.params.id, membership_id: parsed.data.membership_id, reason: parsed.data.reason, active: true, created_by_membership_id: membershipId(req) }, { onConflict: 'case_id,membership_id' });
    if (saved.error) return res.status(500).json({ error: 'Não foi possível registrar o conflito.' });
    await db.from('integrity_case_assignments').delete().eq('case_id', req.params.id).eq('membership_id', parsed.data.membership_id);
    if (found.data.owner_membership_id === parsed.data.membership_id) await db.from('integrity_cases').update({ owner_membership_id: null }).eq('id', req.params.id);
    const event = await db.from('integrity_case_events').insert({ report_id: found.data.report_id, case_id: req.params.id, event_type: 'conflict_registered', actor_membership_id: membershipId(req), note: parsed.data.reason, metadata: { blocked_membership_id: parsed.data.membership_id } });
    if (event.error) return res.status(500).json({ error: 'Conflito registrado, mas a auditoria falhou.' });
    return res.status(201).json({ conflict: true });
  }));

  router.get('/cases/:id/messages', requireAny('integrity.cases.read'), asyncHandler(async (req, res) => {
    const db = getSupabaseAdmin(); const found = await findCase(db, req, req.params.id);
    if (!found.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    const result = await db.from('integrity_report_messages').select('id,author_type,body,visible_to_reporter,created_at,author_membership_id').eq('report_id', found.data.report_id).order('created_at');
    if (result.error) return res.status(500).json({ error: 'Não foi possível carregar as mensagens.' });
    return res.json({ messages: result.data || [] });
  }));

  router.post('/cases/:id/messages', requireAny('integrity.messages.send', 'integrity.cases.manage'), asyncHandler(async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Mensagem inválida.', issues: parsed.error.issues });
    const db = getSupabaseAdmin(); const found = await findCase(db, req, req.params.id);
    if (!found.data) return res.status(404).json({ error: 'Caso não encontrado.' });
    const saved = await db.from('integrity_report_messages').insert({ report_id: found.data.report_id, body: parsed.data.body, visible_to_reporter: parsed.data.visible_to_reporter, author_type: 'case_manager', author_membership_id: membershipId(req) }).select('id').single();
    if (saved.error) return res.status(500).json({ error: 'Não foi possível registrar a mensagem.' });
    const event = await db.from('integrity_case_events').insert({ report_id: found.data.report_id, case_id: req.params.id, event_type: parsed.data.visible_to_reporter ? 'reporter_message_sent' : 'internal_note_added', actor_membership_id: membershipId(req), metadata: { message_id: saved.data.id, visible_to_reporter: parsed.data.visible_to_reporter } });
    if (event.error) return res.status(500).json({ error: 'Mensagem registrada, mas a auditoria falhou.' });
    return res.status(201).json({ id: saved.data.id });
  }));

  router.get('/settings', requireAny('integrity.settings.manage'), asyncHandler(async (req, res) => {
    const db = getSupabaseAdmin();
    const [settings, channels, categories, units, members] = await Promise.all([
      db.from('integrity_settings').select('*').eq('tenant_id', tenantId(req)).maybeSingle(),
      db.from('integrity_channels').select('*').eq('tenant_id', tenantId(req)).order('created_at'),
      db.from('integrity_categories').select('*').eq('tenant_id', tenantId(req)).order('name'),
      db.from('integrity_units').select('*').eq('tenant_id', tenantId(req)).order('name'),
      db.from('memberships').select('id,user_id,status').eq('tenant_id', tenantId(req)).eq('status', 'active'),
    ]);
    const failed = [settings, channels, categories, units, members].find((result: any) => result.error);
    if (failed) return res.status(500).json({ error: 'Não foi possível carregar as configurações.' });
    return res.json({ settings: settings.data, channels: channels.data || [], categories: categories.data || [], units: units.data || [], members: members.data || [] });
  }));

  router.put('/settings', requireAny('integrity.settings.manage'), asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Configuração inválida.', issues: parsed.error.issues });
    if (!parsed.data.allows_anonymous && !parsed.data.allows_identified) return res.status(400).json({ error: 'Habilite ao menos um modo de relato.' });
    const db = getSupabaseAdmin();
    const saved = await db.from('integrity_settings').upsert({ tenant_id: tenantId(req), ...parsed.data, updated_at: new Date().toISOString(), updated_by_membership_id: membershipId(req), configured_at: new Date().toISOString() }, { onConflict: 'tenant_id' }).select('*').single();
    if (saved.error) return res.status(500).json({ error: 'Não foi possível salvar as configurações.' });
    return res.json({ settings: saved.data });
  }));

  router.post('/settings/channels', requireAny('integrity.settings.manage'), asyncHandler(async (req, res) => {
    const parsed = channelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Canal inválido.', issues: parsed.error.issues });
    if (!parsed.data.allows_anonymous && !parsed.data.allows_identified) return res.status(400).json({ error: 'Habilite ao menos um modo de relato.' });
    const db = getSupabaseAdmin(); const { id, ...values } = parsed.data;
    const settings = await db.from('integrity_settings').upsert({ tenant_id: tenantId(req), updated_by_membership_id: membershipId(req) }, { onConflict: 'tenant_id' });
    if (settings.error) return res.status(500).json({ error: 'Não foi possível preparar as configurações do tenant.' });
    const query = id ? db.from('integrity_channels').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId(req)) : db.from('integrity_channels').insert({ ...values, tenant_id: tenantId(req) });
    const saved = await query.select('*').single();
    if (saved.error) return res.status(saved.error.code === '23505' ? 409 : 500).json({ error: saved.error.code === '23505' ? 'Este slug público já está em uso.' : 'Não foi possível salvar o canal.' });
    const categories = await db.from('integrity_categories').select('id').eq('tenant_id', tenantId(req)).eq('active', true);
    if (!categories.error && categories.data?.length) await db.from('integrity_channel_categories').upsert(categories.data.map((item: any, index: number) => ({ channel_id: saved.data.id, category_id: item.id, sort_order: index })), { onConflict: 'channel_id,category_id' });
    return res.status(id ? 200 : 201).json({ channel: saved.data });
  }));

  router.post('/settings/categories', requireAny('integrity.settings.manage'), asyncHandler(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Categoria inválida.', issues: parsed.error.issues });
    const db = getSupabaseAdmin(); const { id, ...values } = parsed.data;
    const query = id ? db.from('integrity_categories').update(values).eq('id', id).eq('tenant_id', tenantId(req)) : db.from('integrity_categories').insert({ ...values, tenant_id: tenantId(req) });
    const saved = await query.select('*').single();
    if (saved.error) return res.status(saved.error.code === '23505' ? 409 : 500).json({ error: saved.error.code === '23505' ? 'Já existe uma categoria com este slug.' : 'Não foi possível salvar a categoria.' });
    const channels = await db.from('integrity_channels').select('id').eq('tenant_id', tenantId(req));
    if (!channels.error && channels.data?.length) await db.from('integrity_channel_categories').upsert(channels.data.map((item: any, index: number) => ({ channel_id: item.id, category_id: saved.data.id, sort_order: index })), { onConflict: 'channel_id,category_id' });
    return res.status(id ? 200 : 201).json({ category: saved.data });
  }));

  router.post('/settings/units', requireAny('integrity.settings.manage'), asyncHandler(async (req, res) => {
    const parsed = unitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Unidade inválida.', issues: parsed.error.issues });
    const db = getSupabaseAdmin(); const { id, ...values } = parsed.data;
    const query = id ? db.from('integrity_units').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId(req)) : db.from('integrity_units').insert({ ...values, tenant_id: tenantId(req) });
    const saved = await query.select('*').single();
    if (saved.error) return res.status(saved.error.code === '23505' ? 409 : 500).json({ error: saved.error.code === '23505' ? 'Esta unidade já existe.' : 'Não foi possível salvar a unidade.' });
    return res.status(id ? 200 : 201).json({ unit: saved.data });
  }));

  return router;
}
