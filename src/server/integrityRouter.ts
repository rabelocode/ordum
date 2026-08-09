import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  authenticateRequest,
  resolveTenantContext,
  requireTenantSolution,
} from "./tenantAuth";
import {
  canTransitionIntegrityCase,
  integrityDashboard,
  integrityTransitionNeedsReason,
} from "../domain/integrity";
import { validateIntegrityEvidence } from "../domain/integrity-files";

const listSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.string().max(40).optional(),
  severity: z.string().max(20).optional(),
  category_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  sla: z.enum(["due_soon", "overdue"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  order: z
    .enum([
      "created_at",
      "first_response_due_at",
      "treatment_due_at",
      "severity",
    ])
    .default("created_at"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
const transitionSchema = z.object({
  to_status: z.string(),
  reason: z.string().trim().max(1000).optional(),
  lock_version: z.number().int().positive(),
});
const assignmentSchema = z.object({
  membership_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
const messageSchema = z.object({
  body: z.string().trim().min(2).max(5000),
  visible_to_reporter: z.boolean().default(false),
});
const settingsSchema = z.object({
  introduction: z.string().trim().min(10).max(2000),
  instructions: z.string().trim().max(4000).nullable().optional(),
  allows_anonymous: z.boolean(),
  allows_identified: z.boolean(),
  default_sla_hours: z.number().int().min(1).max(8760),
  automatic_acknowledgement: z.string().trim().min(5).max(2000),
  branding: z.record(z.string(), z.unknown()).default({}),
  attachment_policy: z.record(z.string(), z.unknown()).default({}),
  communication_policy: z.record(z.string(), z.unknown()).default({
    allow_reporter_messages: true,
    allow_case_messages: true,
  }),
  routing_rules: z.array(z.unknown()).default([]),
  treatment_sla_hours: z.number().int().min(1).max(17520).default(720),
  default_assignee_membership_id: z.string().uuid().nullable().optional(),
  default_committee_id: z.string().uuid().nullable().optional(),
});
const conflictSchema = z.object({
  membership_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
const channelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  public_title: z.string().trim().min(2).max(160),
  public_slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  active: z.boolean().default(true),
  allows_anonymous: z.boolean(),
  allows_identified: z.boolean(),
});
const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  description: z.string().trim().max(1000).nullable().optional(),
  default_risk_level: z.enum(["low", "medium", "high", "critical"]),
  sla_hours: z.number().int().min(1).max(8760).nullable().optional(),
  active: z.boolean().default(true),
});
const unitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().default(true),
});
const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  assignee_membership_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});
const taskStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
  reason: z.string().trim().min(3).max(500),
});
const decisionSchema = z.object({
  final_classification: z.string().trim().min(3).max(200),
  conclusion: z.string().trim().min(3).max(10000),
  measures_taken: z.string().trim().min(3).max(10000),
  internal_justification: z.string().trim().min(3).max(5000),
  reporter_outcome: z.string().trim().max(3000).nullable().optional(),
  lock_version: z.number().int().positive(),
});
const recommendationSchema = z.object({
  recommendation: z.string().trim().min(10).max(10000),
  justification: z.string().trim().min(10).max(5000),
});
const committeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  member_ids: z.array(z.string().uuid()).max(50).default([]),
  active: z.boolean().default(true),
});
const committeeUpdateSchema = committeeSchema.extend({
  status: z.enum(["active", "inactive", "archived"]),
});
const routingSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    category_id: z.string().uuid().nullable().optional(),
    unit_id: z.string().uuid().nullable().optional(),
    assignee_membership_id: z.string().uuid().nullable().optional(),
    committee_id: z.string().uuid().nullable().optional(),
    priority: z.number().int().min(0).max(10000).default(100),
    active: z.boolean().default(true),
    is_fallback: z.boolean().default(false),
  })
  .refine((value) => value.assignee_membership_id || value.committee_id, {
    message: "Defina um responsável ou comitê.",
  })
  .refine((value) => !value.is_fallback || (!value.category_id && !value.unit_id), {
    message: "A regra fallback não pode restringir categoria ou unidade.",
  });
const routingUpdateSchema = routingSchema.extend({
  status: z.enum(["active", "inactive", "archived"]),
});
const routingPreviewSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  unit_id: z.string().uuid().nullable().optional(),
});

export function createIntegrityRouter(
  getSupabaseAdmin: () => any,
  authOverrides?: any,
) {
  const router = express.Router();
  const auth = authOverrides || {
    authenticateRequest,
    resolveTenantContext,
    requireTenantSolution,
  };
  router.use(
    auth.authenticateRequest,
    auth.resolveTenantContext,
    auth.requireTenantSolution("integridade"),
  );
  const asyncHandler =
    (fn: express.RequestHandler): express.RequestHandler =>
    (req, res, next) =>
      Promise.resolve(fn(req, res, next)).catch(next);
  const requireAny =
    (...permissions: string[]): express.RequestHandler =>
    (req, res, next) => {
      const granted = (req as any).tenantContext?.permissions || [];
      if (!permissions.some((permission) => granted.includes(permission)))
        return res
          .status(403)
          .json({ error: "Você não possui permissão para esta operação." });
      next();
    };
  const tenantId = (req: express.Request) =>
    (req as any).tenantContext.tenant.id as string;
  const membershipId = (req: express.Request) =>
    (req as any).tenantContext.membership.id as string;
  const permissions = (req: express.Request) =>
    ((req as any).tenantContext.permissions || []) as string[];
  const hasPermission = (req: express.Request, permission: string) =>
    permissions(req).includes(permission);

  async function scopedCommitteeIds(db: any, req: express.Request) {
    const result = await db
      .from("integrity_committee_members")
      .select("committee_id,integrity_committees!inner(tenant_id,status)")
      .eq("membership_id", membershipId(req))
      .eq("active", true)
      .eq("integrity_committees.tenant_id", tenantId(req))
      .eq("integrity_committees.status", "active");
    if (result.error) throw result.error;
    return (result.data || []).map((item: any) => item.committee_id);
  }

  async function scopeCaseQuery(query: any, db: any, req: express.Request) {
    if (hasPermission(req, "integrity.cases.read")) return query;
    if (!hasPermission(req, "integrity.cases.read_assigned"))
      return query.eq("id", "00000000-0000-0000-0000-000000000000");
    const committees = await scopedCommitteeIds(db, req);
    const filters = [`owner_membership_id.eq.${membershipId(req)}`];
    if (committees.length) filters.push(`committee_id.in.(${committees.join(",")})`);
    return query.or(filters.join(","));
  }

  async function findCase(
    db: any,
    req: express.Request,
    id: string,
    select = "id,tenant_id,report_id,status,lock_version,owner_membership_id,first_action_at",
  ) {
    let query = db
      .from("integrity_cases")
      .select(select)
      .eq("id", id)
      .eq("tenant_id", tenantId(req));
    query = await scopeCaseQuery(query, db, req);
    return query.maybeSingle();
  }

  router.get(
    "/dashboard",
    requireAny("integrity.analytics.read", "integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      let caseQuery = db
          .from("integrity_cases")
          .select(
            "id,status,severity,sla_due_at,first_response_due_at,treatment_due_at,first_action_at,closed_at,created_at,category_id,unit_id",
          )
          .eq("tenant_id", tenantId(req));
      caseQuery = await scopeCaseQuery(caseQuery, db, req);
      const caseResult = await caseQuery;
      const accessibleIds = (caseResult.data || []).map((item: any) => item.id).filter(Boolean);
      let taskQuery = db
          .from("integrity_case_tasks")
          .select("id", {
            count: "exact",
            head: true,
          })
          .in("status", ["open", "in_progress"])
          .lt("due_at", new Date().toISOString());
      taskQuery = accessibleIds.length ? taskQuery.in("case_id", accessibleIds) : taskQuery.eq("case_id", "00000000-0000-0000-0000-000000000000");
      const overdueTasks = await taskQuery;
      if (caseResult.error || overdueTasks.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar os indicadores." });
      const rows = caseResult.data || [];
      return res.json({
        ...integrityDashboard(rows),
        tasks_overdue: overdueTasks.count || 0,
        updated_at: new Date().toISOString(),
      });
    }),
  );

  router.get(
    "/members",
    requireAny("integrity.cases.assign", "integrity.cases.manage", "integrity.cases.investigate"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const memberships = await db
        .from("memberships")
        .select("id,user_id")
        .eq("tenant_id", tenantId(req))
        .eq("status", "active")
        .order("created_at");
      if (memberships.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar os responsáveis." });
      const userIds = (memberships.data || []).map((item: any) => item.user_id);
      const profiles = userIds.length
        ? await db.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [], error: null };
      if (profiles.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar os responsáveis." });
      const names = new Map(
        (profiles.data || []).map((profile: any) => [
          profile.id,
          profile.full_name,
        ]),
      );
      return res.json({
        members: (memberships.data || []).map((item: any) => ({
          id: item.id,
          name: names.get(item.user_id) || "Membro do tenant",
        })),
      });
    }),
  );

  router.get(
    "/cases",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Filtros inválidos.", issues: parsed.error.issues });
      const q = parsed.data;
      const from = (q.page - 1) * q.limit;
      const db = getSupabaseAdmin();
      let query = db
        .from("integrity_cases")
        .select(
          "id,protocol,status,severity,priority,sla_due_at,first_response_due_at,treatment_due_at,first_action_at,created_at,updated_at,owner_membership_id,lock_version,integrity_categories(name),integrity_units(name),integrity_reports!inner(subject)",
          { count: "exact" },
        )
        .eq("tenant_id", tenantId(req));
      query = await scopeCaseQuery(query, db, req);
      if (q.search)
        query = query.ilike("protocol", `%${q.search.replace(/[%_,]/g, "")}%`);
      if (q.status) query = query.eq("status", q.status);
      if (q.severity) query = query.eq("severity", q.severity);
      if (q.category_id) query = query.eq("category_id", q.category_id);
      if (q.unit_id) query = query.eq("unit_id", q.unit_id);
      if (q.owner_id) query = query.eq("owner_membership_id", q.owner_id);
      const now = new Date().toISOString();
      const soon = new Date(Date.now() + 864e5).toISOString();
      if (q.sla === "overdue")
        query = query
          .or(
            `and(first_action_at.is.null,first_response_due_at.lt.${now}),treatment_due_at.lt.${now}`,
          )
          .not("status", "in", "(closed,archived)");
      if (q.sla === "due_soon")
        query = query
          .or(
            `and(first_action_at.is.null,first_response_due_at.gte.${now},first_response_due_at.lte.${soon}),and(treatment_due_at.gte.${now},treatment_due_at.lte.${soon})`,
          )
          .not("status", "in", "(closed,archived)");
      const result = await query
        .order(q.order, { ascending: q.direction === "asc" })
        .range(from, from + q.limit - 1);
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar os casos." });
      return res.json({
        cases: result.data || [],
        page: q.page,
        limit: q.limit,
        total: result.count || 0,
        total_pages: Math.ceil((result.count || 0) / q.limit),
      });
    }),
  );

  router.get(
    "/cases/:id",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const result = await findCase(
        db,
        req,
        req.params.id,
        "*,integrity_reports!inner(id,subject,description,occurred_at,reporter_mode,created_at),integrity_categories(name),integrity_units(name),integrity_case_assignments(membership_id,created_at),integrity_case_tasks(*),integrity_case_conflicts(membership_id,reason,active)",
      );
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar o caso." });
      if (!result.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      return res.json({ case: result.data });
    }),
  );

  router.get(
    "/cases/:id/timeline",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const result = await db
        .from("integrity_case_events")
        .select("*")
        .eq("case_id", req.params.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar a timeline." });
      return res.json({ events: result.data || [] });
    }),
  );

  router.post(
    "/cases/:id/transitions",
    requireAny("integrity.cases.manage", "integrity.cases.investigate", "integrity.cases.reopen"),
    asyncHandler(async (req, res) => {
      const parsed = transitionSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Transição inválida.", issues: parsed.error.issues });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (found.error || !found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const { to_status, reason, lock_version } = parsed.data;
      const allowed = to_status === "reopened"
        ? hasPermission(req, "integrity.cases.reopen") || hasPermission(req, "integrity.cases.manage")
        : hasPermission(req, "integrity.cases.investigate") || hasPermission(req, "integrity.cases.manage");
      if (!allowed) return res.status(403).json({ error: "Você não possui permissão para esta transição." });
      if (!canTransitionIntegrityCase(found.data.status, to_status))
        return res.status(409).json({
          error: `Transição ${found.data.status} → ${to_status} não permitida.`,
        });
      if (
        integrityTransitionNeedsReason(to_status) &&
        (!reason || reason.length < 3)
      )
        return res
          .status(400)
          .json({ error: "Informe o motivo desta transição." });
      const saved = await db.rpc("transition_integrity_case", {
        p_case_id: req.params.id,
        p_tenant_id: tenantId(req),
        p_actor_membership_id: membershipId(req),
        p_to_status: to_status,
        p_reason: reason || null,
        p_expected_lock_version: lock_version,
      });
      if (saved.error) {
        const conflict =
          saved.error.code === "40001" ||
          saved.error.message?.includes("case_version_conflict");
        return res.status(conflict ? 409 : 500).json({
          error: conflict
            ? "O caso foi alterado por outra pessoa. Atualize a página."
            : "Não foi possível alterar o status com auditoria.",
        });
      }
      const result = Array.isArray(saved.data) ? saved.data[0] : saved.data;
      return res.json({
        status: result.status,
        lock_version: result.lock_version,
      });
    }),
  );

  router.post(
    "/cases/:id/assignments",
    requireAny("integrity.cases.assign", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const parsed = assignmentSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Atribuição inválida.", issues: parsed.error.issues });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const target = await db
        .from("memberships")
        .select("id,status")
        .eq("id", parsed.data.membership_id)
        .eq("tenant_id", tenantId(req))
        .maybeSingle();
      if (!target.data || target.data.status !== "active")
        return res
          .status(400)
          .json({ error: "Responsável não está ativo neste tenant." });
      const conflict = await db
        .from("integrity_case_conflicts")
        .select("id,reason")
        .eq("case_id", req.params.id)
        .eq("membership_id", parsed.data.membership_id)
        .eq("active", true)
        .maybeSingle();
      if (conflict.data)
        return res.status(409).json({
          error: "Atribuição bloqueada por conflito de interesse registrado.",
        });
      const assignment = await db.from("integrity_case_assignments").upsert(
        {
          report_id: found.data.report_id,
          case_id: req.params.id,
          membership_id: parsed.data.membership_id,
          assigned_by_membership_id: membershipId(req),
        },
        { onConflict: "report_id,membership_id" },
      );
      if (assignment.error)
        return res
          .status(500)
          .json({ error: "Não foi possível atribuir o responsável." });
      const owner = await db
        .from("integrity_cases")
        .update({
          owner_membership_id: parsed.data.membership_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("tenant_id", tenantId(req));
      if (owner.error)
        return res.status(500).json({
          error:
            "A atribuição foi criada, mas o responsável principal não foi atualizado.",
        });
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "assigned",
        actor_membership_id: membershipId(req),
        note: parsed.data.reason,
        metadata: { assigned_membership_id: parsed.data.membership_id },
      });
      if (event.error)
        return res
          .status(500)
          .json({ error: "Atribuição concluída, mas a auditoria falhou." });
      return res.status(201).json({ assigned: true });
    }),
  );

  router.post(
    "/cases/:id/conflicts",
    requireAny("integrity.cases.assign", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const parsed = conflictSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Conflito inválido.", issues: parsed.error.issues });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const target = await db
        .from("memberships")
        .select("id")
        .eq("id", parsed.data.membership_id)
        .eq("tenant_id", tenantId(req))
        .maybeSingle();
      if (!target.data)
        return res
          .status(400)
          .json({ error: "Membro não pertence a este tenant." });
      const saved = await db.from("integrity_case_conflicts").upsert(
        {
          case_id: req.params.id,
          membership_id: parsed.data.membership_id,
          reason: parsed.data.reason,
          active: true,
          created_by_membership_id: membershipId(req),
        },
        { onConflict: "case_id,membership_id" },
      );
      if (saved.error)
        return res
          .status(500)
          .json({ error: "Não foi possível registrar o conflito." });
      await db
        .from("integrity_case_assignments")
        .delete()
        .eq("case_id", req.params.id)
        .eq("membership_id", parsed.data.membership_id);
      if (found.data.owner_membership_id === parsed.data.membership_id)
        await db
          .from("integrity_cases")
          .update({ owner_membership_id: null })
          .eq("id", req.params.id);
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "conflict_registered",
        actor_membership_id: membershipId(req),
        note: parsed.data.reason,
        metadata: { blocked_membership_id: parsed.data.membership_id },
      });
      if (event.error)
        return res
          .status(500)
          .json({ error: "Conflito registrado, mas a auditoria falhou." });
      return res.status(201).json({ conflict: true });
    }),
  );

  router.get(
    "/cases/:id/messages",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const result = await db
        .from("integrity_report_messages")
        .select(
          "id,author_type,body,visible_to_reporter,created_at,author_membership_id",
        )
        .eq("report_id", found.data.report_id)
        .order("created_at");
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar as mensagens." });
      return res.json({ messages: result.data || [] });
    }),
  );

  router.post(
    "/cases/:id/messages",
    requireAny("integrity.messages.send", "integrity.notes.create", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const parsed = messageSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Mensagem inválida.", issues: parsed.error.issues });
      const messagePermission = parsed.data.visible_to_reporter ? "integrity.messages.send" : "integrity.notes.create";
      if (!hasPermission(req, messagePermission) && !hasPermission(req, "integrity.cases.manage"))
        return res.status(403).json({ error: "Você não possui permissão para este tipo de comunicação." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      if (parsed.data.visible_to_reporter) {
        const settings = await db
          .from("integrity_settings")
          .select("communication_policy")
          .eq("tenant_id", tenantId(req))
          .maybeSingle();
        if (settings.error)
          return res.status(500).json({
            error: "Não foi possível validar a política de comunicação.",
          });
        if (settings.data?.communication_policy?.allow_case_messages === false)
          return res.status(403).json({
            error: "Mensagens ao denunciante estão desativadas neste canal.",
          });
      }
      const saved = await db
        .from("integrity_report_messages")
        .insert({
          report_id: found.data.report_id,
          body: parsed.data.body,
          visible_to_reporter: parsed.data.visible_to_reporter,
          author_type: "case_manager",
          author_membership_id: membershipId(req),
        })
        .select("id")
        .single();
      if (saved.error)
        return res
          .status(500)
          .json({ error: "Não foi possível registrar a mensagem." });
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: parsed.data.visible_to_reporter
          ? "reporter_message_sent"
          : "internal_note_added",
        actor_membership_id: membershipId(req),
        metadata: {
          message_id: saved.data.id,
          visible_to_reporter: parsed.data.visible_to_reporter,
        },
      });
      if (event.error)
        return res
          .status(500)
          .json({ error: "Mensagem registrada, mas a auditoria falhou." });
      return res.status(201).json({ id: saved.data.id });
    }),
  );

  router.get(
    "/cases/:id/evidence",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const result = await db
        .from("integrity_attachments")
        .select(
          "id,evidence_kind,description,visible_to_reporter,uploaded_by_type,created_at,files!inner(id,original_name,mime_type,size_bytes,validation_status)",
        )
        .eq("case_id", req.params.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar as evidências." });
      return res.json({ evidence: result.data || [] });
    }),
  );

  router.post(
    "/cases/:id/evidence",
    requireAny("integrity.evidence.manage"),
    express.raw({ type: () => true, limit: "10mb" }),
    asyncHandler(async (req, res) => {
      if (!Buffer.isBuffer(req.body))
        return res.status(400).json({ error: "Arquivo inválido." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const mime = String(req.header("content-type") || "")
        .split(";")[0]
        .toLowerCase();
      const checked = validateIntegrityEvidence(
        req.body,
        mime,
        req.header("x-file-name") || "",
        10485760,
      );
      if (checked.valid === false)
        return res.status(415).json({ error: checked.error });
      const visible = req.header("x-visible-to-reporter") === "true";
      const objectPath = `${tenantId(req)}/${req.params.id}/${randomUUID()}`;
      const uploaded = await db.storage
        .from("ordum-integrity")
        .upload(objectPath, req.body, { contentType: mime, upsert: false });
      if (uploaded.error)
        return res
          .status(500)
          .json({ error: "Não foi possível armazenar a evidência." });
      const file = await db
        .from("files")
        .insert({
          tenant_id: tenantId(req),
          case_id: req.params.id,
          bucket: "ordum-integrity",
          object_path: objectPath,
          original_name: checked.safeName,
          mime_type: mime,
          size_bytes: req.body.length,
          sensitivity: "restricted",
          validation_status: "validated",
          uploaded_by_membership_id: membershipId(req),
        })
        .select("id")
        .single();
      if (file.error) {
        await db.storage.from("ordum-integrity").remove([objectPath]);
        return res
          .status(500)
          .json({ error: "Não foi possível registrar a evidência." });
      }
      const attachment = await db
        .from("integrity_attachments")
        .insert({
          report_id: found.data.report_id,
          case_id: req.params.id,
          file_id: file.data.id,
          uploaded_by_type: "case_manager",
          visible_to_reporter: visible,
          evidence_kind: checked.kind,
          description: req.header("x-file-description")?.slice(0, 1000) || null,
        })
        .select("id")
        .single();
      if (attachment.error) {
        await db.storage.from("ordum-integrity").remove([objectPath]);
        await db.from("files").delete().eq("id", file.data.id);
        return res
          .status(500)
          .json({ error: "Não foi possível vincular a evidência." });
      }
      await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "evidence_added",
        actor_membership_id: membershipId(req),
        metadata: {
          attachment_id: attachment.data.id,
          visible_to_reporter: visible,
        },
      });
      return res.status(201).json({ id: attachment.data.id });
    }),
  );

  router.post(
    "/cases/:id/evidence/:evidenceId/url",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const evidence = await db
        .from("integrity_attachments")
        .select("files!inner(bucket,object_path)")
        .eq("id", req.params.evidenceId)
        .eq("case_id", req.params.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!evidence.data)
        return res.status(404).json({ error: "Evidência não encontrada." });
      const file = (evidence.data as any).files;
      const signed = await db.storage
        .from(file.bucket)
        .createSignedUrl(file.object_path, 120);
      if (signed.error)
        return res
          .status(500)
          .json({ error: "Não foi possível liberar a evidência." });
      return res.json({ url: signed.data.signedUrl, expires_in: 120 });
    }),
  );

  router.delete(
    "/cases/:id/evidence/:evidenceId",
    requireAny("integrity.evidence.manage"),
    asyncHandler(async (req, res) => {
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3)
        return res.status(400).json({ error: "Informe o motivo da exclusão." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const evidence = await db
        .from("integrity_attachments")
        .select("file_id,files!inner(bucket,object_path)")
        .eq("id", req.params.evidenceId)
        .eq("case_id", req.params.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!evidence.data)
        return res.status(404).json({ error: "Evidência não encontrada." });
      const now = new Date().toISOString();
      const marked = await db
        .from("integrity_attachments")
        .update({
          deleted_at: now,
          deleted_by_membership_id: membershipId(req),
          delete_reason: reason,
        })
        .eq("id", req.params.evidenceId)
        .eq("case_id", req.params.id);
      if (marked.error)
        return res
          .status(500)
          .json({ error: "Não foi possível excluir a evidência." });
      await db
        .from("files")
        .update({
          deleted_at: now,
          deleted_by_membership_id: membershipId(req),
          delete_reason: reason,
        })
        .eq("id", evidence.data.file_id)
        .eq("tenant_id", tenantId(req));
      const file = (evidence.data as any).files;
      const removed = await db.storage
        .from(file.bucket)
        .remove([file.object_path]);
      if (removed.error)
        return res.status(500).json({
          error: "Metadados excluídos, mas a remoção segura do objeto falhou.",
        });
      await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "evidence_deleted",
        actor_membership_id: membershipId(req),
        note: reason,
        metadata: { attachment_id: req.params.evidenceId },
      });
      return res.json({ deleted: true });
    }),
  );

  router.get(
    "/cases/:id/tasks",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      let query = db
        .from("integrity_case_tasks")
        .select("*")
        .eq("case_id", req.params.id);
      if (req.query.status)
        query = query.eq("status", String(req.query.status));
      if (req.query.overdue === "true")
        query = query
          .lt("due_at", new Date().toISOString())
          .in("status", ["open", "in_progress"]);
      const result = await query.order("due_at", {
        ascending: true,
        nullsFirst: false,
      });
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar as tarefas." });
      return res.json({ tasks: result.data || [] });
    }),
  );

  router.post(
    "/cases/:id/tasks",
    requireAny("integrity.cases.manage", "integrity.cases.investigate"),
    asyncHandler(async (req, res) => {
      const parsed = taskSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Tarefa inválida." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      if (parsed.data.assignee_membership_id) {
        const member = await db
          .from("memberships")
          .select("id,status")
          .eq("id", parsed.data.assignee_membership_id)
          .eq("tenant_id", tenantId(req))
          .maybeSingle();
        if (!member.data || member.data.status !== "active")
          return res.status(400).json({ error: "Responsável inválido." });
        const conflict = await db
          .from("integrity_case_conflicts")
          .select("id")
          .eq("case_id", req.params.id)
          .eq("membership_id", parsed.data.assignee_membership_id)
          .eq("active", true)
          .maybeSingle();
        if (conflict.data)
          return res.status(409).json({
            error: "Responsável bloqueado por conflito de interesse.",
          });
      }
      const task = await db
        .from("integrity_case_tasks")
        .insert({
          case_id: req.params.id,
          ...parsed.data,
          created_by_membership_id: membershipId(req),
        })
        .select("*")
        .single();
      if (task.error)
        return res
          .status(500)
          .json({ error: "Não foi possível criar a tarefa." });
      await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "task_created",
        actor_membership_id: membershipId(req),
        metadata: { task_id: task.data.id, priority: task.data.priority },
      });
      return res.status(201).json({ task: task.data });
    }),
  );

  router.patch(
    "/cases/:id/tasks/:taskId",
    requireAny("integrity.cases.manage", "integrity.cases.investigate"),
    asyncHandler(async (req, res) => {
      const parsed = taskStatusSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Atualização de tarefa inválida." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data)
        return res.status(404).json({ error: "Caso não encontrado." });
      const current = await db
        .from("integrity_case_tasks")
        .select("id,status")
        .eq("id", req.params.taskId)
        .eq("case_id", req.params.id)
        .maybeSingle();
      if (!current.data)
        return res.status(404).json({ error: "Tarefa não encontrada." });
      const now = new Date().toISOString();
      const update: any = { status: parsed.data.status, updated_at: now };
      if (parsed.data.status === "done") {
        update.completed_at = now;
        update.completed_by_membership_id = membershipId(req);
      }
      if (current.data.status === "done" && parsed.data.status === "open") {
        update.completed_at = null;
        update.completed_by_membership_id = null;
        update.reopened_at = now;
      }
      const saved = await db
        .from("integrity_case_tasks")
        .update(update)
        .eq("id", req.params.taskId)
        .eq("case_id", req.params.id)
        .select("*")
        .single();
      if (saved.error)
        return res
          .status(500)
          .json({ error: "Não foi possível atualizar a tarefa." });
      await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type:
          parsed.data.status === "done"
            ? "task_completed"
            : current.data.status === "done"
              ? "task_reopened"
              : "task_status_changed",
        actor_membership_id: membershipId(req),
        note: parsed.data.reason,
        metadata: {
          task_id: req.params.taskId,
          from_status: current.data.status,
          to_status: parsed.data.status,
        },
      });
      return res.json({ task: saved.data });
    }),
  );

  router.post(
    "/cases/:id/decision",
    requireAny("integrity.cases.close", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Preencha todos os campos internos da decisão." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const saved = await db.rpc("decide_and_close_integrity_case", {
        p_case_id: req.params.id,
        p_tenant_id: tenantId(req),
        p_actor_membership_id: membershipId(req),
        p_final_classification: parsed.data.final_classification,
        p_conclusion: parsed.data.conclusion,
        p_measures_taken: parsed.data.measures_taken,
        p_internal_justification: parsed.data.internal_justification,
        p_reporter_outcome: parsed.data.reporter_outcome || null,
        p_expected_lock_version: parsed.data.lock_version,
      });
      if (saved.error) {
        const conflict = saved.error.code === "40001";
        return res.status(conflict ? 409 : 400).json({
          error: conflict
            ? "O caso foi alterado por outra pessoa."
            : "O caso precisa estar em decisão e possuir dados completos.",
        });
      }
      const result = Array.isArray(saved.data) ? saved.data[0] : saved.data;
      return res.json(result);
    }),
  );

  router.post(
    "/cases/:id/recommendation",
    requireAny("integrity.cases.recommend", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const parsed = recommendationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Informe recomendação e fundamentação." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const saved = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "decision_recommended",
        actor_membership_id: membershipId(req),
        note: parsed.data.recommendation,
        metadata: { justification: parsed.data.justification },
      }).select("id,created_at").single();
      if (saved.error) return res.status(500).json({ error: "Não foi possível registrar a recomendação." });
      return res.status(201).json({ recommendation: saved.data });
    }),
  );

  router.get(
    "/cases/:id/identity",
    requireAny("integrity.identity.read"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const identity = await db.from("integrity_report_identities")
        .select("name,email,phone,consented_at")
        .eq("report_id", found.data.report_id)
        .maybeSingle();
      if (identity.error) return res.status(500).json({ error: "Não foi possível consultar a identidade protegida." });
      return res.json({ identity: identity.data });
    }),
  );

  router.get(
    "/settings",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const [
        settings,
        channels,
        categories,
        units,
        members,
        committees,
        committeeMembers,
        routingRules,
      ] = await Promise.all([
        db
          .from("integrity_settings")
          .select("*")
          .eq("tenant_id", tenantId(req))
          .maybeSingle(),
        db
          .from("integrity_channels")
          .select("*")
          .eq("tenant_id", tenantId(req))
          .order("created_at"),
        db
          .from("integrity_categories")
          .select("*")
          .eq("tenant_id", tenantId(req))
          .order("name"),
        db
          .from("integrity_units")
          .select("*")
          .eq("tenant_id", tenantId(req))
          .order("name"),
        db
          .from("memberships")
          .select("id,user_id,status")
          .eq("tenant_id", tenantId(req))
          .eq("status", "active"),
        db
          .from("integrity_committees")
          .select("*")
          .eq("tenant_id", tenantId(req))
          .order("name"),
        db
          .from("integrity_committee_members")
          .select(
            "committee_id,membership_id,role,active,integrity_committees!inner(tenant_id)",
          )
          .eq("integrity_committees.tenant_id", tenantId(req)),
        db
          .from("integrity_routing_rules")
          .select("*")
          .eq("tenant_id", tenantId(req))
          .order("priority"),
      ]);
      const failed = [
        settings,
        channels,
        categories,
        units,
        members,
        committees,
        committeeMembers,
        routingRules,
      ].find((result: any) => result.error);
      if (failed)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar as configurações." });
      const userIds = (members.data || []).map((item: any) => item.user_id);
      const profiles = userIds.length
        ? await db.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [], error: null };
      if (profiles.error) return res.status(500).json({ error: "Não foi possível carregar os nomes dos responsáveis." });
      const profileNames = new Map((profiles.data || []).map((profile: any) => [profile.id, profile.full_name]));
      const namedMembers = (members.data || []).map((member: any) => ({ ...member, name: profileNames.get(member.user_id) || "Membro do tenant" }));
      const checks = [
        { key: "texts", label: "Textos e instruções", complete: Boolean(settings.data?.configured_at && settings.data?.introduction) },
        { key: "channel", label: "Canal ativo", complete: (channels.data || []).some((item: any) => item.active) },
        { key: "mode", label: "Modo de identificação", complete: Boolean(settings.data?.allows_anonymous || settings.data?.allows_identified) },
        { key: "categories", label: "Categorias ativas", complete: (categories.data || []).some((item: any) => item.active) },
        { key: "committee", label: "Comitê ativo com membros", complete: (committees.data || []).some((item: any) => item.status === "active" && (committeeMembers.data || []).some((member: any) => member.committee_id === item.id && member.active)) },
        { key: "routing", label: "Roteamento ou fallback ativo", complete: (routingRules.data || []).some((item: any) => item.status === "active" && item.active) || Boolean(settings.data?.default_assignee_membership_id || settings.data?.default_committee_id) },
        { key: "sla", label: "SLAs definidos", complete: Boolean(settings.data?.default_sla_hours && settings.data?.treatment_sla_hours) },
      ];
      return res.json({
        settings: settings.data,
        channels: channels.data || [],
        categories: categories.data || [],
        units: units.data || [],
        members: namedMembers,
        committees: committees.data || [],
        committee_members: committeeMembers.data || [],
        routing_rules: routingRules.data || [],
        configuration_status: {
          operational: checks.every((item) => item.complete),
          completed: checks.filter((item) => item.complete).length,
          total: checks.length,
          items: checks,
        },
      });
    }),
  );

  router.put(
    "/settings",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error: "Configuração inválida.",
          issues: parsed.error.issues,
        });
      if (!parsed.data.allows_anonymous && !parsed.data.allows_identified)
        return res
          .status(400)
          .json({ error: "Habilite ao menos um modo de relato." });
      const db = getSupabaseAdmin();
      const saved = await db
        .from("integrity_settings")
        .upsert(
          {
            tenant_id: tenantId(req),
            ...parsed.data,
            updated_at: new Date().toISOString(),
            updated_by_membership_id: membershipId(req),
            configured_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" },
        )
        .select("*")
        .single();
      if (saved.error)
        return res
          .status(500)
          .json({ error: "Não foi possível salvar as configurações." });
      return res.json({ settings: saved.data });
    }),
  );

  router.post(
    "/settings/channels",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = channelSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Canal inválido.", issues: parsed.error.issues });
      if (!parsed.data.allows_anonymous && !parsed.data.allows_identified)
        return res
          .status(400)
          .json({ error: "Habilite ao menos um modo de relato." });
      const db = getSupabaseAdmin();
      const { id, ...values } = parsed.data;
      const settings = await db.from("integrity_settings").upsert(
        {
          tenant_id: tenantId(req),
          updated_by_membership_id: membershipId(req),
        },
        { onConflict: "tenant_id" },
      );
      if (settings.error)
        return res.status(500).json({
          error: "Não foi possível preparar as configurações do tenant.",
        });
      const query = id
        ? db
            .from("integrity_channels")
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("tenant_id", tenantId(req))
        : db
            .from("integrity_channels")
            .insert({ ...values, tenant_id: tenantId(req) });
      const saved = await query.select("*").single();
      if (saved.error)
        return res.status(saved.error.code === "23505" ? 409 : 500).json({
          error:
            saved.error.code === "23505"
              ? "Este slug público já está em uso."
              : "Não foi possível salvar o canal.",
        });
      const categories = await db
        .from("integrity_categories")
        .select("id")
        .eq("tenant_id", tenantId(req))
        .eq("active", true);
      if (!categories.error && categories.data?.length)
        await db.from("integrity_channel_categories").upsert(
          categories.data.map((item: any, index: number) => ({
            channel_id: saved.data.id,
            category_id: item.id,
            sort_order: index,
          })),
          { onConflict: "channel_id,category_id" },
        );
      return res.status(id ? 200 : 201).json({ channel: saved.data });
    }),
  );

  router.post(
    "/settings/categories",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Categoria inválida.", issues: parsed.error.issues });
      const db = getSupabaseAdmin();
      const { id, ...values } = parsed.data;
      const query = id
        ? db
            .from("integrity_categories")
            .update(values)
            .eq("id", id)
            .eq("tenant_id", tenantId(req))
        : db
            .from("integrity_categories")
            .insert({ ...values, tenant_id: tenantId(req) });
      const saved = await query.select("*").single();
      if (saved.error)
        return res.status(saved.error.code === "23505" ? 409 : 500).json({
          error:
            saved.error.code === "23505"
              ? "Já existe uma categoria com este slug."
              : "Não foi possível salvar a categoria.",
        });
      const channels = await db
        .from("integrity_channels")
        .select("id")
        .eq("tenant_id", tenantId(req));
      if (!channels.error && channels.data?.length)
        await db.from("integrity_channel_categories").upsert(
          channels.data.map((item: any, index: number) => ({
            channel_id: item.id,
            category_id: saved.data.id,
            sort_order: index,
          })),
          { onConflict: "channel_id,category_id" },
        );
      return res.status(id ? 200 : 201).json({ category: saved.data });
    }),
  );

  router.post(
    "/settings/units",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = unitSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Unidade inválida.", issues: parsed.error.issues });
      const db = getSupabaseAdmin();
      const { id, ...values } = parsed.data;
      const query = id
        ? db
            .from("integrity_units")
            .update({ ...values, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("tenant_id", tenantId(req))
        : db
            .from("integrity_units")
            .insert({ ...values, tenant_id: tenantId(req) });
      const saved = await query.select("*").single();
      if (saved.error)
        return res.status(saved.error.code === "23505" ? 409 : 500).json({
          error:
            saved.error.code === "23505"
              ? "Esta unidade já existe."
              : "Não foi possível salvar a unidade.",
        });
      return res.status(id ? 200 : 201).json({ unit: saved.data });
    }),
  );

  router.post(
    "/settings/committees",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = committeeSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Comitê inválido." });
      const db = getSupabaseAdmin();
      if (parsed.data.member_ids.length) {
        const members = await db
          .from("memberships")
          .select("id")
          .eq("tenant_id", tenantId(req))
          .eq("status", "active")
          .in("id", parsed.data.member_ids);
        if (
          members.error ||
          (members.data || []).length !== parsed.data.member_ids.length
        )
          return res.status(400).json({
            error: "Todos os membros devem estar ativos neste tenant.",
          });
      }
      const committee = await db
        .from("integrity_committees")
        .insert({
          tenant_id: tenantId(req),
          name: parsed.data.name,
          description: parsed.data.description || null,
          active: parsed.data.active,
        })
        .select("*")
        .single();
      if (committee.error)
        return res
          .status(committee.error.code === "23505" ? 409 : 500)
          .json({ error: "Não foi possível criar o comitê." });
      if (parsed.data.member_ids.length) {
        const added = await db.from("integrity_committee_members").insert(
          parsed.data.member_ids.map((id, index) => ({
            committee_id: committee.data.id,
            membership_id: id,
            role: index === 0 ? "chair" : "member",
          })),
        );
        if (added.error) {
          await db
            .from("integrity_committees")
            .delete()
            .eq("id", committee.data.id);
          return res
            .status(500)
            .json({ error: "Não foi possível vincular os membros." });
        }
      }
      return res.status(201).json({ committee: committee.data });
    }),
  );

  router.post(
    "/settings/routing",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = routingSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Regra de roteamento inválida." });
      const db = getSupabaseAdmin();
      const value = parsed.data;
      let conflictQuery = db.from("integrity_routing_rules").select("id,name")
        .eq("tenant_id", tenantId(req)).eq("status", "active").eq("priority", value.priority)
        .eq("is_fallback", value.is_fallback);
      conflictQuery = value.category_id ? conflictQuery.eq("category_id", value.category_id) : conflictQuery.is("category_id", null);
      conflictQuery = value.unit_id ? conflictQuery.eq("unit_id", value.unit_id) : conflictQuery.is("unit_id", null);
      const conflicting = await conflictQuery.limit(1);
      if (conflicting.error) return res.status(500).json({ error: "Não foi possível validar conflitos de roteamento." });
      if (conflicting.data?.length) return res.status(409).json({ error: `Conflito com a regra ${conflicting.data[0].name}. Ajuste escopo ou prioridade.` });
      if (value.assignee_membership_id) {
        const member = await db
          .from("memberships")
          .select("id")
          .eq("id", value.assignee_membership_id)
          .eq("tenant_id", tenantId(req))
          .eq("status", "active")
          .maybeSingle();
        if (!member.data)
          return res.status(400).json({ error: "Responsável inválido." });
      }
      if (value.committee_id) {
        const committee = await db
          .from("integrity_committees")
          .select("id")
          .eq("id", value.committee_id)
          .eq("tenant_id", tenantId(req))
          .eq("active", true)
          .maybeSingle();
        if (!committee.data)
          return res.status(400).json({ error: "Comitê inválido." });
      }
      const rule = await db
        .from("integrity_routing_rules")
        .insert({ tenant_id: tenantId(req), ...value, status: value.active ? "active" : "inactive" })
        .select("*")
        .single();
      if (rule.error)
        return res
          .status(500)
          .json({ error: "Não foi possível criar a regra." });
      return res.status(201).json({ routing_rule: rule.data });
    }),
  );

  router.patch(
    "/settings/committees/:id",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = committeeUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Comitê inválido." });
      const db = getSupabaseAdmin();
      const current = await db.from("integrity_committees").select("id,status")
        .eq("id", req.params.id).eq("tenant_id", tenantId(req)).maybeSingle();
      if (!current.data) return res.status(404).json({ error: "Comitê não encontrado." });
      if (parsed.data.member_ids.length) {
        const members = await db.from("memberships").select("id").eq("tenant_id", tenantId(req))
          .eq("status", "active").in("id", parsed.data.member_ids);
        if (members.error || members.data?.length !== parsed.data.member_ids.length)
          return res.status(400).json({ error: "Todos os membros devem estar ativos neste tenant." });
      }
      if (parsed.data.status !== "active") {
        const activeCases = await db.from("integrity_cases").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId(req)).eq("committee_id", req.params.id)
          .not("status", "in", "(closed,archived)");
        if (activeCases.error) return res.status(500).json({ error: "Não foi possível validar casos do comitê." });
        if (activeCases.count) return res.status(409).json({ error: `Este comitê possui ${activeCases.count} caso(s) ativo(s). Reatribua antes de desativar.` });
      }
      const saved = await db.from("integrity_committees").update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        status: parsed.data.status,
        active: parsed.data.status === "active",
        archived_at: parsed.data.status === "archived" ? new Date().toISOString() : null,
        archived_by_membership_id: parsed.data.status === "archived" ? membershipId(req) : null,
        updated_at: new Date().toISOString(),
      }).eq("id", req.params.id).eq("tenant_id", tenantId(req)).select("*").single();
      if (saved.error) return res.status(saved.error.code === "23505" ? 409 : 500).json({ error: "Não foi possível atualizar o comitê." });
      const disabled = await db.from("integrity_committee_members").update({ active: false }).eq("committee_id", req.params.id);
      if (disabled.error) return res.status(500).json({ error: "Comitê atualizado, mas os membros não foram sincronizados." });
      if (parsed.data.member_ids.length) {
        const linked = await db.from("integrity_committee_members").upsert(parsed.data.member_ids.map((id, index) => ({
          committee_id: req.params.id, membership_id: id, role: index === 0 ? "chair" : "member", active: true,
        })), { onConflict: "committee_id,membership_id" });
        if (linked.error) return res.status(500).json({ error: "Comitê atualizado, mas os membros não foram sincronizados." });
      }
      return res.json({ committee: saved.data });
    }),
  );

  router.post(
    "/settings/routing/preview",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = routingPreviewSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Cenário de teste inválido." });
      const db = getSupabaseAdmin();
      const rules = await db.from("integrity_routing_rules").select("*")
        .eq("tenant_id", tenantId(req)).eq("status", "active").eq("active", true)
        .order("priority").order("created_at");
      if (rules.error) return res.status(500).json({ error: "Não foi possível simular o roteamento." });
      const candidates = (rules.data || []).filter((rule: any) =>
        (!rule.category_id || rule.category_id === parsed.data.category_id) &&
        (!rule.unit_id || rule.unit_id === parsed.data.unit_id),
      ).sort((a: any, b: any) => {
        if (a.is_fallback !== b.is_fallback) return a.is_fallback ? 1 : -1;
        const specificity = (rule: any) => Number(Boolean(rule.category_id)) + Number(Boolean(rule.unit_id));
        return specificity(b) - specificity(a) || a.priority - b.priority || a.created_at.localeCompare(b.created_at);
      });
      const selected = candidates[0] || null;
      const selectedSpecificity = selected ? Number(Boolean(selected.category_id)) + Number(Boolean(selected.unit_id)) : -1;
      const conflicts = selected ? candidates.filter((rule: any) => rule.id !== selected.id && rule.is_fallback === selected.is_fallback && rule.priority === selected.priority && Number(Boolean(rule.category_id)) + Number(Boolean(rule.unit_id)) === selectedSpecificity) : [];
      return res.json({ selected, conflicts, matched: candidates.length, deterministic: conflicts.length === 0 });
    }),
  );

  router.patch(
    "/settings/routing/:id",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const parsed = routingUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Regra de roteamento inválida." });
      const db = getSupabaseAdmin();
      const current = await db.from("integrity_routing_rules").select("id").eq("id", req.params.id)
        .eq("tenant_id", tenantId(req)).maybeSingle();
      if (!current.data) return res.status(404).json({ error: "Regra não encontrada." });
      const value = parsed.data;
      let conflictQuery = db.from("integrity_routing_rules").select("id,name").eq("tenant_id", tenantId(req))
        .neq("id", req.params.id).eq("status", "active").eq("priority", value.priority).eq("is_fallback", value.is_fallback);
      conflictQuery = value.category_id ? conflictQuery.eq("category_id", value.category_id) : conflictQuery.is("category_id", null);
      conflictQuery = value.unit_id ? conflictQuery.eq("unit_id", value.unit_id) : conflictQuery.is("unit_id", null);
      const conflicting = await conflictQuery.limit(1);
      if (conflicting.error) return res.status(500).json({ error: "Não foi possível validar conflitos." });
      if (value.status === "active" && conflicting.data?.length)
        return res.status(409).json({ error: `Conflito com a regra ${conflicting.data[0].name}.` });
      const saved = await db.from("integrity_routing_rules").update({
        ...value,
        active: value.status === "active",
        archived_at: value.status === "archived" ? new Date().toISOString() : null,
        archived_by_membership_id: value.status === "archived" ? membershipId(req) : null,
        updated_at: new Date().toISOString(),
      }).eq("id", req.params.id).eq("tenant_id", tenantId(req)).select("*").single();
      if (saved.error) return res.status(saved.error.code === "23505" ? 409 : 500).json({ error: "Não foi possível atualizar a regra." });
      return res.json({ routing_rule: saved.data });
    }),
  );

  return router;
}
