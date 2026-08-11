import express from "express";
import { createHash, randomUUID } from "node:crypto";
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
import { createIntegrityDossierPdf } from "./integrityDossierPdf";
import { createIntegrityExecutivePdf } from "./integrityExecutivePdf";
import { integrityDeploymentState, routingExplanation } from "../domain/integrity-phase4g";

const listSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.string().max(40).optional(),
  severity: z.string().max(20).optional(),
  category_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  committee_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sla: z.enum(["due_soon", "overdue"]).optional(),
  view: z.enum(["all", "unassigned", "mine", "awaiting_reply", "closed"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  order: z
    .enum([
      "created_at",
      "first_response_due_at",
      "treatment_due_at",
      "updated_at",
      "severity",
    ])
    .default("created_at"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
const dashboardSchema = z.object({
  status: z.string().max(40).optional(),
  severity: z.string().max(20).optional(),
  category_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  committee_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
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
  retention_days: z.number().int().min(30).max(7300).default(1825),
  evidence_retention_days: z.number().int().min(30).max(7300).default(1825),
  message_retention_days: z.number().int().min(30).max(7300).default(1825),
  post_closure_action: z.enum(["archive", "anonymize"]).default("archive"),
  anonymization_enabled: z.boolean().default(false),
  alert_lead_hours: z.number().int().min(1).max(720).default(24),
  stale_case_hours: z.number().int().min(24).max(8760).default(168),
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
  privacy_notice: z.string().trim().max(4000).nullable().optional(),
  confirmation_message: z.string().trim().max(2000).nullable().optional(),
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
  is_headquarters: z.boolean().default(false),
  responsible_membership_id: z.string().uuid().nullable().optional(),
});
const departmentSchema = z.object({ id:z.string().uuid().optional(),unit_id:z.string().uuid(),name:z.string().trim().min(2).max(120),code:z.string().trim().max(40).nullable().optional(),responsible_membership_id:z.string().uuid().nullable().optional(),active:z.boolean().default(true) });
const customFieldSchema = z.object({ id:z.string().uuid().optional(),channel_id:z.string().uuid().nullable().optional(),field_key:z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),label:z.string().trim().min(2).max(120),help_text:z.string().trim().max(500).nullable().optional(),field_type:z.enum(["short_text","long_text","single_select","multi_select","date","boolean"]),required:z.boolean().default(false),options:z.array(z.string().trim().min(1).max(120)).max(50).default([]),active:z.boolean().default(true),sort_order:z.number().int().min(0).max(1000).default(0) }).refine(value=>!["single_select","multi_select"].includes(value.field_type)||value.options.length>0,{message:"Campos de seleção exigem opções."});
const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  assignee_membership_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  parent_task_id: z.string().uuid().nullable().optional(),
});
const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assignee_membership_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  reason: z.string().trim().min(3).max(500),
}).refine((value) => Object.keys(value).some((key) => key !== "reason"), { message: "Informe uma alteração." });
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
    department_id: z.string().uuid().nullable().optional(),
    severity: z.enum(["low","medium","high","critical"]).nullable().optional(),
    reporter_mode: z.enum(["anonymous","identified"]).nullable().optional(),
    requires_conflict: z.boolean().nullable().optional(),
    assignee_membership_id: z.string().uuid().nullable().optional(),
    committee_id: z.string().uuid().nullable().optional(),
    priority: z.number().int().min(0).max(10000).default(100),
    active: z.boolean().default(true),
    is_fallback: z.boolean().default(false),
    target_sla_hours: z.number().int().min(1).max(17520).nullable().optional(),
    target_priority: z.enum(["low","normal","high","urgent"]).nullable().optional(),
    escalation_committee_id: z.string().uuid().nullable().optional(),
    escalation_membership_id: z.string().uuid().nullable().optional(),
    collaborator_ids: z.array(z.string().uuid()).max(50).default([]),
  })
  .refine((value) => value.assignee_membership_id || value.committee_id, {
    message: "Defina um responsável ou comitê.",
  })
  .refine((value) => !value.is_fallback || (!value.category_id && !value.unit_id && !value.department_id && !value.severity && !value.reporter_mode && value.requires_conflict == null), {
    message: "A regra fallback não pode restringir categoria ou unidade.",
  });
const routingUpdateSchema = routingSchema.extend({
  status: z.enum(["active", "inactive", "archived"]),
});
const routingPreviewSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  unit_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  severity: z.enum(["low","medium","high","critical"]).nullable().optional(),
  reporter_mode: z.enum(["anonymous","identified"]).nullable().optional(),
  has_conflict: z.boolean().default(false),
});
const collaboratorSchema = z.object({
  membership_id: z.string().uuid(),
  role: z.enum(["investigator", "participant"]).default("investigator"),
  reason: z.string().trim().min(3).max(500),
});
const templateSchema = z.object({
  id: z.string().uuid().optional(),
  template_type: z.enum(["task", "reporter_message", "information_request", "recommendation", "decision"]),
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(2).max(10000),
  active: z.boolean().default(true),
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
  const csvCell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
  };
  async function auditIntegrity(
    db: any,
    req: express.Request,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown>,
  ) {
    const result = await db.from("platform_audit_logs").insert({
      actor_user_id: (req as any).user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      severity: "info",
      request_id: randomUUID(),
      metadata: { tenant_id: tenantId(req), result: "success", ...metadata },
    });
    if (result.error) throw result.error;
  }

  async function validateRoutingReferences(db: any, tenant: string, value: z.infer<typeof routingSchema>) {
    const membershipIds = [...new Set([
      value.assignee_membership_id,
      value.escalation_membership_id,
      ...value.collaborator_ids,
    ].filter(Boolean))] as string[];
    const committeeIds = [...new Set([value.committee_id, value.escalation_committee_id].filter(Boolean))] as string[];
    const [members, committees, categories, units, departments] = await Promise.all([
      membershipIds.length ? db.from("memberships").select("id").eq("tenant_id", tenant).eq("status", "active").in("id", membershipIds) : Promise.resolve({ data: [], error: null }),
      committeeIds.length ? db.from("integrity_committees").select("id").eq("tenant_id", tenant).eq("status", "active").in("id", committeeIds) : Promise.resolve({ data: [], error: null }),
      value.category_id ? db.from("integrity_categories").select("id").eq("tenant_id", tenant).eq("id", value.category_id).eq("active", true) : Promise.resolve({ data: [], error: null }),
      value.unit_id ? db.from("integrity_units").select("id").eq("tenant_id", tenant).eq("id", value.unit_id).eq("active", true) : Promise.resolve({ data: [], error: null }),
      value.department_id ? db.from("integrity_departments").select("id,unit_id").eq("tenant_id", tenant).eq("id", value.department_id).eq("active", true) : Promise.resolve({ data: [], error: null }),
    ]);
    if ([members, committees, categories, units, departments].some((result: any) => result.error)) return "Não foi possível validar as referências da regra.";
    if (members.data.length !== membershipIds.length) return "Todos os responsáveis e colaboradores devem estar ativos neste tenant.";
    if (committees.data.length !== committeeIds.length) return "Todos os comitês devem estar ativos neste tenant.";
    if (value.category_id && categories.data.length !== 1) return "Categoria inválida para este tenant.";
    if (value.unit_id && units.data.length !== 1) return "Unidade inválida para este tenant.";
    if (value.department_id && (departments.data.length !== 1 || (value.unit_id && departments.data[0].unit_id !== value.unit_id))) return "Departamento inválido para a unidade selecionada.";
    return null;
  }
  const routingConditionKeys = ["category_id","unit_id","department_id","severity","reporter_mode","requires_conflict"] as const;
  const routingSpecificity = (rule: Record<string, unknown>) => routingConditionKeys.filter((key) => rule[key] != null).length;
  const routingConflict = (left: Record<string, unknown>, right: Record<string, unknown>) =>
    routingSpecificity(left) === routingSpecificity(right) &&
    routingConditionKeys.every((key) => left[key] == null || right[key] == null || left[key] === right[key]);

  async function matchingReportIds(db: any, tenant: string, search?: string) {
    if (!search) return [] as string[];
    const text = search.replace(/[%_,]/g, "").trim();
    if (!text) return [] as string[];
    const result = await db.from("integrity_reports").select("id").eq("tenant_id", tenant).ilike("subject", `%${text}%`).limit(200);
    if (result.error) throw result.error;
    return (result.data || []).map((item: any) => item.id);
  }

  async function membershipNames(db: any, tenant: string, ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (!unique.length) return new Map<string,string>();
    const memberships = await db.from("memberships").select("id,user_id").in("id", unique).eq("tenant_id", tenant);
    if (memberships.error) throw memberships.error;
    const userIds = (memberships.data || []).map((item: any) => item.user_id);
    const profiles = userIds.length ? await db.from("profiles").select("id,full_name").in("id", userIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const profileNames = new Map<string,string>((profiles.data || []).map((item: any) => [item.id,String(item.full_name || "")]));
    return new Map<string,string>((memberships.data || []).map((item: any) => [item.id,profileNames.get(item.user_id) || "Pessoa da equipe"]));
  }

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
    if (hasPermission(req, "integrity.cases.read")) return { query };
    if (!hasPermission(req, "integrity.cases.read_assigned"))
      return { query: query.eq("id", "00000000-0000-0000-0000-000000000000") };
    const committees = await scopedCommitteeIds(db, req);
    const collaborators = await db.from("integrity_case_collaborators").select("case_id")
      .eq("tenant_id", tenantId(req)).eq("membership_id", membershipId(req)).eq("active", true);
    if (collaborators.error) throw collaborators.error;
    const filters = [`owner_membership_id.eq.${membershipId(req)}`];
    if (committees.length) filters.push(`committee_id.in.(${committees.join(",")})`);
    const collaboratorCaseIds = (collaborators.data || []).map((item: any) => item.case_id);
    if (collaboratorCaseIds.length) filters.push(`id.in.(${collaboratorCaseIds.join(",")})`);
    return { query: query.or(filters.join(",")) };
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
    query = (await scopeCaseQuery(query, db, req)).query;
    return query.maybeSingle();
  }

  router.get(
    "/dashboard",
    requireAny("integrity.analytics.read", "integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const parsed = dashboardSchema.safeParse(req.query);
      if (!parsed.success)
        return res.status(400).json({ error: "Filtros inválidos." });
      const filters = parsed.data;
      const db = getSupabaseAdmin();
      let caseQuery = db
          .from("integrity_cases")
          .select(
            "id,status,severity,sla_due_at,first_response_due_at,treatment_due_at,first_action_at,closed_at,created_at,category_id,unit_id,department_id,owner_membership_id,committee_id,integrity_reports(reporter_mode),integrity_categories(name),integrity_units(name),integrity_departments(name)",
          )
          .eq("tenant_id", tenantId(req));
      caseQuery = (await scopeCaseQuery(caseQuery, db, req)).query;
      if (filters.status) caseQuery = caseQuery.eq("status", filters.status);
      if (filters.severity) caseQuery = caseQuery.eq("severity", filters.severity);
      if (filters.category_id) caseQuery = caseQuery.eq("category_id", filters.category_id);
      if (filters.unit_id) caseQuery = caseQuery.eq("unit_id", filters.unit_id);
      if (filters.department_id) caseQuery = caseQuery.eq("department_id", filters.department_id);
      if (filters.owner_id) caseQuery = caseQuery.eq("owner_membership_id", filters.owner_id);
      if (filters.committee_id) caseQuery = caseQuery.eq("committee_id", filters.committee_id);
      if (filters.from) caseQuery = caseQuery.gte("created_at", filters.from);
      if (filters.to) caseQuery = caseQuery.lte("created_at", filters.to);
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
      const [overdueTasks, conflicts, reopened] = await Promise.all([
        taskQuery,
        accessibleIds.length
          ? db.from("integrity_case_conflicts").select("id", { count: "exact", head: true }).in("case_id", accessibleIds).eq("active", true)
          : Promise.resolve({ count: 0, error: null }),
        accessibleIds.length
          ? db.from("integrity_case_events").select("case_id").in("case_id", accessibleIds).eq("event_type", "status_changed").eq("to_status", "reopened")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (caseResult.error || overdueTasks.error || conflicts.error || reopened.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar os indicadores." });
      const rows = caseResult.data || [];
      const reopenedCases = new Set((reopened.data || []).map((item: any) => item.case_id)).size;
      const completedCases = rows.filter((item: any) => item.closed_at).length;
      return res.json({
        ...integrityDashboard(rows.map((item:any)=>({...item,reporter_mode:item.integrity_reports?.reporter_mode}))),
        tasks_overdue: overdueTasks.count || 0,
        conflicts_pending: conflicts.count || 0,
        reopened_cases: reopenedCases,
        reopen_rate: completedCases ? Math.round((reopenedCases / completedCases) * 1000) / 10 : null,
        applied_filters: filters,
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
          name: names.get(item.user_id) || "Pessoa da equipe",
        })),
      });
    }),
  );

  router.get(
    "/filters",
    requireAny("integrity.analytics.read", "integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const tenant = tenantId(req);
      const [categories, units, departments, committees, memberships] = await Promise.all([
        db.from("integrity_categories").select("id,name").eq("tenant_id", tenant).eq("active", true).order("name"),
        db.from("integrity_units").select("id,name").eq("tenant_id", tenant).eq("active", true).order("name"),
        db.from("integrity_departments").select("id,name,unit_id").eq("tenant_id", tenant).eq("active", true).order("name"),
        db.from("integrity_committees").select("id,name").eq("tenant_id", tenant).eq("status", "active").order("name"),
        db.from("memberships").select("id,user_id").eq("tenant_id", tenant).eq("status", "active"),
      ]);
      if (categories.error || units.error || departments.error || committees.error || memberships.error)
        return res.status(500).json({ error: "Não foi possível carregar os filtros." });
      const userIds = (memberships.data || []).map((item: any) => item.user_id);
      const profiles = userIds.length
        ? await db.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [], error: null };
      if (profiles.error) return res.status(500).json({ error: "Não foi possível carregar os responsáveis." });
      const names = new Map((profiles.data || []).map((profile: any) => [profile.id, profile.full_name]));
      return res.json({
        categories: categories.data || [],
        units: units.data || [],
        departments: departments.data || [],
        committees: committees.data || [],
        owners: (memberships.data || []).map((item: any) => ({ id: item.id, name: names.get(item.user_id) || "Pessoa da equipe" })),
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
          "id,report_id,protocol,status,severity,priority,sla_due_at,first_response_due_at,treatment_due_at,first_action_at,created_at,updated_at,owner_membership_id,committee_id,department_id,lock_version,integrity_categories(name),integrity_units(name),integrity_departments(name),integrity_committees(name),integrity_reports!inner(subject)",
          { count: "exact" },
        )
        .eq("tenant_id", tenantId(req));
      query = (await scopeCaseQuery(query, db, req)).query;
      if (q.view === "unassigned") query = query.is("owner_membership_id", null).is("committee_id", null).not("status", "in", "(closed,archived)");
      if (q.view === "mine") query = query.eq("owner_membership_id", membershipId(req)).not("status", "in", "(closed,archived)");
      if (q.view === "closed") query = query.in("status", ["closed", "archived"]);
      if (q.view === "awaiting_reply") {
        const tenantReports = await db.from("integrity_reports").select("id").eq("tenant_id", tenantId(req)).limit(5000);
        if (tenantReports.error) return res.status(500).json({ error: "Não foi possível carregar as conversas pendentes." });
        const reportIds = (tenantReports.data || []).map((item: any) => item.id);
        const communication = reportIds.length
          ? await db.from("integrity_report_messages").select("report_id,author_type,created_at").in("report_id", reportIds).order("created_at", { ascending: false }).limit(10000)
          : { data: [], error: null };
        if (communication.error) return res.status(500).json({ error: "Não foi possível carregar as conversas pendentes." });
        const seen = new Set<string>();
        const waiting = (communication.data || []).filter((message: any) => {
          if (seen.has(message.report_id)) return false;
          seen.add(message.report_id);
          return message.author_type === "reporter";
        }).map((message: any) => message.report_id);
        if (!waiting.length) return res.json({ cases: [], page: q.page, limit: q.limit, total: 0, total_pages: 0 });
        query = query.in("report_id", waiting).not("status", "in", "(closed,archived)");
      }
      if (q.search) {
        const text = q.search.replace(/[%_,]/g, "");
        const reportIds = await matchingReportIds(db, tenantId(req), q.search);
        query = reportIds.length
          ? query.or(`protocol.ilike.%${text}%,report_id.in.(${reportIds.join(",")})`)
          : query.ilike("protocol", `%${text}%`);
      }
      if (q.status) query = query.eq("status", q.status);
      if (q.severity) query = query.eq("severity", q.severity);
      if (q.category_id) query = query.eq("category_id", q.category_id);
      if (q.unit_id) query = query.eq("unit_id", q.unit_id);
      if (q.department_id) query = query.eq("department_id", q.department_id);
      if (q.owner_id) query = query.eq("owner_membership_id", q.owner_id);
      if (q.committee_id) query = query.eq("committee_id", q.committee_id);
      if (q.from) query = query.gte("created_at", q.from);
      if (q.to) query = query.lte("created_at", q.to);
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
      const ownerIds = [...new Set((result.data || []).map((item: any) => item.owner_membership_id).filter(Boolean))];
      const owners = ownerIds.length
        ? await db.from("memberships").select("id,user_id").in("id", ownerIds).eq("tenant_id", tenantId(req))
        : { data: [], error: null };
      if (owners.error) return res.status(500).json({ error: "Não foi possível carregar os responsáveis." });
      const userIds = (owners.data || []).map((item: any) => item.user_id);
      const profiles = userIds.length
        ? await db.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [], error: null };
      if (profiles.error) return res.status(500).json({ error: "Não foi possível carregar os responsáveis." });
      const profileNames = new Map((profiles.data || []).map((profile: any) => [profile.id, profile.full_name]));
      const ownerNames = new Map((owners.data || []).map((owner: any) => [owner.id, profileNames.get(owner.user_id) || "Pessoa da equipe"]));
      const pageReportIds = (result.data || []).map((item: any) => item.report_id);
      const messages = pageReportIds.length
        ? await db.from("integrity_report_messages").select("report_id,author_type,created_at").in("report_id", pageReportIds).order("created_at", { ascending: false })
        : { data: [], error: null };
      if (messages.error) return res.status(500).json({ error: "Não foi possível carregar a última atividade." });
      const latestByReport = new Map<string, any>();
      for (const message of messages.data || []) if (!latestByReport.has(message.report_id)) latestByReport.set(message.report_id, message);
      return res.json({
        cases: (result.data || []).map((item: any) => ({
          ...item,
          owner_name: item.owner_membership_id ? ownerNames.get(item.owner_membership_id) || "Membro indisponível" : null,
          last_activity_at: latestByReport.get(item.report_id)?.created_at || item.updated_at,
          has_unanswered_message: latestByReport.get(item.report_id)?.author_type === "reporter",
        })),
        page: q.page,
        limit: q.limit,
        total: result.count || 0,
        total_pages: Math.ceil((result.count || 0) / q.limit),
      });
    }),
  );

  router.get(
    "/cases/export.csv",
    requireAny("integrity.exports.execute"),
    asyncHandler(async (req, res) => {
      const parsed = listSchema.safeParse({ ...req.query, page: 1, limit: 100 });
      if (!parsed.success) return res.status(400).json({ error: "Filtros inválidos." });
      const q = parsed.data;
      const db = getSupabaseAdmin();
      let query = db.from("integrity_cases").select(
        "id,protocol,status,severity,priority,created_at,first_response_due_at,treatment_due_at,closed_at,owner_membership_id,committee_id,category_id,unit_id,integrity_categories(name),integrity_units(name),integrity_committees(name)",
      ).eq("tenant_id", tenantId(req));
      query = (await scopeCaseQuery(query, db, req)).query;
      if (q.search) {
        const text = q.search.replace(/[%_,]/g, "");
        const reportIds = await matchingReportIds(db, tenantId(req), q.search);
        query = reportIds.length
          ? query.or(`protocol.ilike.%${text}%,report_id.in.(${reportIds.join(",")})`)
          : query.ilike("protocol", `%${text}%`);
      }
      if (q.status) query = query.eq("status", q.status);
      if (q.severity) query = query.eq("severity", q.severity);
      if (q.category_id) query = query.eq("category_id", q.category_id);
      if (q.unit_id) query = query.eq("unit_id", q.unit_id);
      if (q.owner_id) query = query.eq("owner_membership_id", q.owner_id);
      if (q.committee_id) query = query.eq("committee_id", q.committee_id);
      if (q.from) query = query.gte("created_at", q.from);
      if (q.to) query = query.lte("created_at", q.to);
      const result = await query.order(q.order, { ascending: q.direction === "asc" }).limit(1000);
      if (result.error) return res.status(500).json({ error: "Não foi possível exportar os casos." });
      const headers = ["protocolo","status","severidade","prioridade","categoria","unidade","comite","criado_em","primeira_resposta_ate","tratamento_ate","encerrado_em"];
      const rows = (result.data || []).map((item: any) => [
        item.protocol,item.status,item.severity,item.priority,item.integrity_categories?.name,
        item.integrity_units?.name,item.integrity_committees?.name,item.created_at,
        item.first_response_due_at,item.treatment_due_at,item.closed_at,
      ]);
      await auditIntegrity(db, req, "integrity.cases.exported", "integrity_cases", null, {
        row_count: rows.length,
        filters: { status: q.status || null, severity: q.severity || null, category_id: q.category_id || null, unit_id: q.unit_id || null },
        excludes_identity: true,
        excludes_content: true,
      });
      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="integrity-cases-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.send(`\ufeff${csv}`);
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
        "*,integrity_reports!inner(id,subject,description,occurred_at,reporter_mode,created_at),integrity_categories(name),integrity_units(name),integrity_committees(name),integrity_case_assignments(membership_id,created_at),integrity_case_tasks(*),integrity_case_conflicts(membership_id,reason,active)",
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
    "/cases/:id/report.csv",
    requireAny("integrity.case_report.export"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(
        db,
        req,
        req.params.id,
        "*,integrity_reports!inner(subject,description,occurred_at,reporter_mode,created_at),integrity_categories(name),integrity_units(name),integrity_committees(name)",
      );
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      let identity: any = null;
      if (hasPermission(req, "integrity.identity.read")) {
        const identityResult = await db.from("integrity_report_identities")
          .select("name,email,phone").eq("report_id", found.data.report_id).maybeSingle();
        if (identityResult.error) return res.status(500).json({ error: "Não foi possível preparar o relatório." });
        identity = identityResult.data;
      }
      const report = found.data.integrity_reports;
      const fields: Array<[string, unknown]> = [
        ["protocolo", found.data.protocol], ["status", found.data.status], ["severidade", found.data.severity],
        ["prioridade", found.data.priority], ["categoria", found.data.integrity_categories?.name],
        ["unidade", found.data.integrity_units?.name], ["comite", found.data.integrity_committees?.name],
        ["assunto", report.subject], ["descricao_original", report.description], ["ocorrido_em", report.occurred_at],
        ["criado_em", found.data.created_at], ["classificacao_final", found.data.final_classification],
        ["conclusao", found.data.conclusion], ["providencias", found.data.measures_taken], ["encerrado_em", found.data.closed_at],
      ];
      if (identity) fields.push(["identidade_nome", identity.name], ["identidade_email", identity.email], ["identidade_telefone", identity.phone]);
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "case_report_exported",
        actor_membership_id: membershipId(req),
        metadata: { included_identity: Boolean(identity), format: "csv" },
      });
      if (event.error) return res.status(500).json({ error: "A exportação não pôde ser auditada." });
      await auditIntegrity(db, req, "integrity.case_report.exported", "integrity_cases", req.params.id, { included_identity: Boolean(identity), format: "csv" });
      const csv = [["campo","valor"], ...fields].map((row) => row.map(csvCell).join(",")).join("\r\n");
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="integrity-${found.data.protocol}.csv"`);
      return res.send(`\ufeff${csv}`);
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
      const actorIds = [...new Set((result.data || []).map((event: any) => event.actor_membership_id).filter(Boolean))];
      const actors = actorIds.length
        ? await db.from("memberships").select("id,user_id").in("id", actorIds).eq("tenant_id", tenantId(req))
        : { data: [], error: null };
      if (actors.error) return res.status(500).json({ error: "Não foi possível identificar os atores da timeline." });
      const userIds = (actors.data || []).map((actor: any) => actor.user_id);
      const profiles = userIds.length
        ? await db.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [], error: null };
      if (profiles.error) return res.status(500).json({ error: "Não foi possível identificar os atores da timeline." });
      const namesByUser = new Map((profiles.data || []).map((profile: any) => [profile.id, profile.full_name]));
      const namesByMembership = new Map((actors.data || []).map((actor: any) => [actor.id, namesByUser.get(actor.user_id) || "Pessoa da equipe"]));
      return res.json({
        events: (result.data || []).map((event: any) => ({
          ...event,
          actor_name: event.actor_membership_id ? namesByMembership.get(event.actor_membership_id) || "Membro indisponível" : "Sistema Ordum",
          before_status: event.from_status || event.metadata?.from_status || null,
          after_status: event.to_status || event.metadata?.to_status || null,
        })),
      });
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
      const [caseContext, reportContext, conflictRules] = await Promise.all([
        db.from("integrity_cases").select("category_id,unit_id,department_id,severity").eq("id", req.params.id).eq("tenant_id", tenantId(req)).single(),
        db.from("integrity_reports").select("reporter_mode").eq("id", found.data.report_id).eq("tenant_id", tenantId(req)).single(),
        db.from("integrity_routing_rules").select("*").eq("tenant_id", tenantId(req)).eq("status", "active").eq("active", true).eq("requires_conflict", true).order("priority").order("created_at"),
      ]);
      if ([caseContext, reportContext, conflictRules].some((result: any) => result.error))
        return res.status(500).json({ error: "Conflito registrado, mas o escalonamento não pôde ser avaliado." });
      const escalationRule = (conflictRules.data || []).find((rule: any) =>
        (!rule.category_id || rule.category_id === caseContext.data.category_id) &&
        (!rule.unit_id || rule.unit_id === caseContext.data.unit_id) &&
        (!rule.department_id || rule.department_id === caseContext.data.department_id) &&
        (!rule.severity || rule.severity === caseContext.data.severity) &&
        (!rule.reporter_mode || rule.reporter_mode === reportContext.data.reporter_mode),
      );
      if (escalationRule?.escalation_membership_id || escalationRule?.escalation_committee_id) {
        const escalationUpdate: Record<string, string> = {};
        if (escalationRule.escalation_membership_id !== parsed.data.membership_id) escalationUpdate.owner_membership_id = escalationRule.escalation_membership_id;
        if (escalationRule.escalation_committee_id) escalationUpdate.committee_id = escalationRule.escalation_committee_id;
        if (Object.keys(escalationUpdate).length) {
          const escalated = await db.from("integrity_cases").update(escalationUpdate).eq("id", req.params.id).eq("tenant_id", tenantId(req));
          if (escalated.error) return res.status(500).json({ error: "Conflito registrado, mas o escalonamento falhou." });
          await db.from("integrity_case_events").insert({ report_id: found.data.report_id, case_id: req.params.id, event_type: "routing_escalated", actor_membership_id: membershipId(req), metadata: { rule_id: escalationRule.id, reason: "conflict_registered", assigned_committee: Boolean(escalationUpdate.committee_id), assigned_owner: Boolean(escalationUpdate.owner_membership_id) } });
        }
      }
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
          "id,evidence_kind,description,visible_to_reporter,uploaded_by_type,created_at,files!inner(id,original_name,mime_type,size_bytes,validation_status,checksum_sha256,uploaded_by_membership_id)",
        )
        .eq("case_id", req.params.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (result.error)
        return res
          .status(500)
          .json({ error: "Não foi possível carregar as evidências." });
      const names = await membershipNames(db, tenantId(req), (result.data || []).map((item: any) => item.files?.uploaded_by_membership_id));
      return res.json({ evidence: (result.data || []).map((item: any) => ({
        ...item,
        uploader_name: item.uploaded_by_type === "reporter" ? "Denunciante" : names.get(item.files?.uploaded_by_membership_id) || "Sistema Ordum",
      })) });
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
      const checksum = createHash("sha256").update(req.body).digest("hex");
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
          checksum_sha256: checksum,
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
          checksum_sha256: checksum,
          size_bytes: req.body.length,
        },
      });
      return res.status(201).json({ id: attachment.data.id, checksum_sha256: checksum });
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
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id,
        case_id: req.params.id,
        event_type: "evidence_downloaded",
        actor_membership_id: membershipId(req),
        metadata: { attachment_id: req.params.evidenceId, expires_in: 120 },
      });
      if (event.error)
        return res.status(500).json({ error: "O download não pôde ser auditado." });
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
      const names = await membershipNames(db, tenantId(req), (result.data || []).flatMap((item: any) => [item.assignee_membership_id,item.created_by_membership_id,item.completed_by_membership_id]));
      return res.json({ tasks: (result.data || []).map((item: any) => ({
        ...item,
        assignee_name: names.get(item.assignee_membership_id) || null,
        creator_name: names.get(item.created_by_membership_id) || "Pessoa da equipe",
        completed_by_name: names.get(item.completed_by_membership_id) || null,
      })) });
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
      if (parsed.data.parent_task_id) {
        const parent = await db.from("integrity_case_tasks").select("id")
          .eq("id", parsed.data.parent_task_id).eq("case_id", req.params.id).maybeSingle();
        if (!parent.data) return res.status(400).json({ error: "Tarefa principal inválida." });
      }
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
      const parsed = taskUpdateSchema.safeParse(req.body);
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
        .select("*")
        .eq("id", req.params.taskId)
        .eq("case_id", req.params.id)
        .maybeSingle();
      if (!current.data)
        return res.status(404).json({ error: "Tarefa não encontrada." });
      const now = new Date().toISOString();
      if (parsed.data.assignee_membership_id) {
        const member = await db.from("memberships").select("id,status")
          .eq("id", parsed.data.assignee_membership_id).eq("tenant_id", tenantId(req)).maybeSingle();
        if (!member.data || member.data.status !== "active")
          return res.status(400).json({ error: "Responsável inválido." });
        const conflict = await db.from("integrity_case_conflicts").select("id")
          .eq("case_id", req.params.id).eq("membership_id", parsed.data.assignee_membership_id)
          .eq("active", true).maybeSingle();
        if (conflict.data)
          return res.status(409).json({ error: "Responsável bloqueado por conflito de interesse." });
      }
      const { reason, ...changes } = parsed.data;
      const update: any = { ...changes, updated_at: now };
      if (parsed.data.status === "done") {
        update.completed_at = now;
        update.completed_by_membership_id = membershipId(req);
      }
      if (current.data.status === "done" && parsed.data.status && parsed.data.status !== "done") {
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
            : current.data.status === "done" && parsed.data.status
              ? "task_reopened"
              : "task_updated",
        actor_membership_id: membershipId(req),
        note: reason,
        metadata: {
          task_id: req.params.taskId,
          from_status: current.data.status,
          to_status: parsed.data.status || current.data.status,
          changed_fields: Object.keys(changes),
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
        departments,
        customFields,
        members,
        committees,
        committeeMembers,
        routingRules,
        routingCollaborators,
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
        db.from("integrity_departments").select("*").eq("tenant_id",tenantId(req)).order("name"),
        db.from("integrity_custom_fields").select("*").eq("tenant_id",tenantId(req)).order("sort_order"),
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
        db.from("integrity_routing_rule_collaborators").select("rule_id,membership_id").eq("tenant_id",tenantId(req)),
      ]);
      const failed = [
        settings,
        channels,
        categories,
        units,
        departments,
        customFields,
        members,
        committees,
        committeeMembers,
        routingRules,
        routingCollaborators,
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
      const namedMembers = (members.data || []).map((member: any) => ({ ...member, name: profileNames.get(member.user_id) || "Pessoa da equipe" }));
      const checks = [
        { key: "organization", label: "Dados da organização", complete: Boolean((req as any).tenantContext?.tenant?.name) },
        { key: "texts", label: "Textos e instruções", complete: Boolean(settings.data?.configured_at && settings.data?.introduction) },
        { key: "channel", label: "Canal ativo", complete: (channels.data || []).some((item: any) => item.active) },
        { key: "mode", label: "Modo de identificação", complete: Boolean(settings.data?.allows_anonymous || settings.data?.allows_identified) },
        { key: "categories", label: "Categorias ativas", complete: (categories.data || []).some((item: any) => item.active) },
        { key: "units", label: "Unidades ou setores", complete: (units.data || []).some((item: any) => item.active) },
        { key: "responsibles", label: "Responsáveis ativos", complete: namedMembers.length > 0 },
        { key: "committee", label: "Comitê ativo com membros", complete: (committees.data || []).some((item: any) => item.status === "active" && (committeeMembers.data || []).some((member: any) => member.committee_id === item.id && member.active)) },
        { key: "investigators", label: "Investigadores definidos", complete: (committeeMembers.data || []).some((member: any) => member.active) },
        { key: "routing", label: "Encaminhamento automático definido", complete: (routingRules.data || []).some((item: any) => item.status === "active" && item.active) || Boolean(settings.data?.default_assignee_membership_id || settings.data?.default_committee_id) },
        { key: "sla", label: "Prazos definidos", complete: Boolean(settings.data?.default_sla_hours && settings.data?.treatment_sla_hours) },
        { key: "communication", label: "Política de comunicação", complete: Boolean(settings.data?.communication_policy) },
        { key: "channel_test", label: "Canal testado", complete: Boolean(settings.data?.channel_tested_at) },
        { key: "published", label: "Canal publicado", complete: Boolean(settings.data?.channel_published_at && (channels.data || []).some((item: any) => item.active)) },
      ];
      return res.json({
        settings: settings.data,
        channels: channels.data || [],
        categories: categories.data || [],
        units: units.data || [],
        departments: departments.data || [],
        custom_fields: customFields.data || [],
        members: namedMembers,
        committees: committees.data || [],
        committee_members: committeeMembers.data || [],
        routing_rules: (routingRules.data || []).map((rule:any)=>({...rule,collaborator_ids:(routingCollaborators.data||[]).filter((item:any)=>item.rule_id===rule.id).map((item:any)=>item.membership_id),explanation:routingExplanation(rule)})),
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
      await auditIntegrity(db, req, "integrity.settings.updated", "integrity_settings", tenantId(req), {
        after: {
          allows_anonymous: saved.data.allows_anonymous,
          allows_identified: saved.data.allows_identified,
          default_sla_hours: saved.data.default_sla_hours,
          treatment_sla_hours: saved.data.treatment_sla_hours,
          attachment_enabled: saved.data.attachment_policy?.enabled === true,
          communication_policy: saved.data.communication_policy,
        },
      });
      return res.json({ settings: saved.data });
    }),
  );

  router.post(
    "/settings/channel-test",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const [settings, channel, categories, committees, routing] = await Promise.all([
        db.from("integrity_settings").select("allows_anonymous,allows_identified,default_sla_hours,treatment_sla_hours,communication_policy").eq("tenant_id", tenantId(req)).maybeSingle(),
        db.from("integrity_channels").select("id,public_slug,active").eq("tenant_id", tenantId(req)).order("created_at").limit(1).maybeSingle(),
        db.from("integrity_categories").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId(req)).eq("active", true),
        db.from("integrity_committees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId(req)).eq("status", "active"),
        db.from("integrity_routing_rules").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId(req)).eq("status", "active").eq("active", true),
      ]);
      const failed = [settings, channel, categories, committees, routing].find((result: any) => result.error);
      if (failed) return res.status(500).json({ error: "Não foi possível testar a configuração." });
      const missing: string[] = [];
      if (!settings.data || (!settings.data.allows_anonymous && !settings.data.allows_identified)) missing.push("modo de identificação");
      if (!channel.data) missing.push("canal configurado");
      if (!categories.count) missing.push("categoria ativa");
      if (!committees.count) missing.push("comitê ativo");
      if (!routing.count) missing.push("regra de roteamento");
      if (missing.length) return res.status(409).json({ error: `Configuração incompleta: ${missing.join(", ")}.`, missing });
      const testedAt = new Date().toISOString();
      const updated = await db.from("integrity_settings").update({ channel_tested_at: testedAt }).eq("tenant_id", tenantId(req));
      if (updated.error) return res.status(500).json({ error: "O teste passou, mas não foi possível registrar o resultado." });
      await auditIntegrity(db, req, "integrity.channel.tested", "integrity_channels", channel.data.id, { public_slug: channel.data.public_slug, tested_at: testedAt });
      return res.json({ passed: true, tested_at: testedAt, slug: channel.data.public_slug, public_slug: channel.data.public_slug });
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
      await auditIntegrity(db, req, id ? "integrity.channel.updated" : "integrity.channel.created", "integrity_channels", saved.data.id, {
        after: { public_slug: saved.data.public_slug, active: saved.data.active, allows_anonymous: saved.data.allows_anonymous, allows_identified: saved.data.allows_identified },
      });
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
      await auditIntegrity(db, req, id ? "integrity.category.updated" : "integrity.category.created", "integrity_categories", saved.data.id, {
        after: { name: saved.data.name, active: saved.data.active, default_risk_level: saved.data.default_risk_level, sla_hours: saved.data.sla_hours },
      });
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
      if (values.responsible_membership_id) {
        const responsible = await db.from("memberships").select("id").eq("id", values.responsible_membership_id).eq("tenant_id", tenantId(req)).eq("status", "active").maybeSingle();
        if (!responsible.data) return res.status(400).json({ error: "Responsável deve estar ativo neste tenant." });
      }
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
      if (values.is_headquarters) {
        const cleared = await db.from("integrity_units").update({ is_headquarters: false }).eq("tenant_id", tenantId(req)).eq("is_headquarters", true).neq("id", saved.data.id);
        if (cleared.error) return res.status(500).json({ error: "Unidade salva, mas a matriz anterior não pôde ser atualizada." });
      }
      await auditIntegrity(db, req, id ? "integrity.unit.updated" : "integrity.unit.created", "integrity_units", saved.data.id, {
        after: { name: saved.data.name, code: saved.data.code, active: saved.data.active },
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
      await auditIntegrity(db, req, "integrity.committee.created", "integrity_committees", committee.data.id, {
        after: { name: committee.data.name, status: committee.data.status || "active", member_count: parsed.data.member_ids.length },
      });
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
      const { collaborator_ids, ...ruleValues } = value;
      const conflictQuery = db.from("integrity_routing_rules").select("*")
        .eq("tenant_id", tenantId(req)).eq("status", "active").eq("priority", value.priority)
        .eq("is_fallback", value.is_fallback);
      const conflicting = await conflictQuery;
      if (conflicting.error) return res.status(500).json({ error: "Não foi possível validar conflitos de roteamento." });
      const conflictingRule = (conflicting.data || []).find((candidate: any) => routingConflict(value, candidate));
      if (conflictingRule) return res.status(409).json({ error: `Conflito com a regra ${conflictingRule.name}. Ajuste escopo ou prioridade.` });
      const referenceError = await validateRoutingReferences(db, tenantId(req), value);
      if (referenceError) return res.status(400).json({ error: referenceError });
      const rule = await db
        .from("integrity_routing_rules")
        .insert({ tenant_id: tenantId(req), ...ruleValues, status: value.active ? "active" : "inactive" })
        .select("*")
        .single();
      if (rule.error)
        return res
          .status(500)
          .json({ error: "Não foi possível criar a regra." });
      if (collaborator_ids.length) {
        const linked = await db.from("integrity_routing_rule_collaborators").insert(collaborator_ids.map((id) => ({ rule_id: rule.data.id, membership_id: id, tenant_id: tenantId(req) })));
        if (linked.error) return res.status(500).json({ error: "Regra criada, mas colaboradores não puderam ser vinculados." });
      }
      await auditIntegrity(db, req, "integrity.routing.created", "integrity_routing_rules", rule.data.id, {
        after: { name: rule.data.name, category_id: rule.data.category_id, unit_id: rule.data.unit_id, committee_id: rule.data.committee_id, assignee_membership_id: rule.data.assignee_membership_id, priority: rule.data.priority, is_fallback: rule.data.is_fallback },
      });
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
      await auditIntegrity(db, req, "integrity.committee.updated", "integrity_committees", req.params.id, {
        before: { status: current.data.status },
        after: { name: saved.data.name, status: saved.data.status, member_count: parsed.data.member_ids.length },
      });
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
        (!rule.unit_id || rule.unit_id === parsed.data.unit_id) &&
        (!rule.department_id || rule.department_id === parsed.data.department_id) &&
        (!rule.severity || rule.severity === parsed.data.severity) &&
        (!rule.reporter_mode || rule.reporter_mode === parsed.data.reporter_mode) &&
        (rule.requires_conflict == null || rule.requires_conflict === parsed.data.has_conflict),
      ).sort((a: any, b: any) => {
        if (a.is_fallback !== b.is_fallback) return a.is_fallback ? 1 : -1;
        const specificity = (rule: any) => ["category_id","unit_id","department_id","severity","reporter_mode","requires_conflict"].filter((key) => rule[key] != null).length;
        return specificity(b) - specificity(a) || a.priority - b.priority || a.created_at.localeCompare(b.created_at);
      });
      const selected = candidates[0] || null;
      const selectedSpecificity = selected ? ["category_id","unit_id","department_id","severity","reporter_mode","requires_conflict"].filter((key) => selected[key] != null).length : -1;
      const conflicts = selected ? candidates.filter((rule: any) => rule.id !== selected.id && rule.is_fallback === selected.is_fallback && rule.priority === selected.priority && ["category_id","unit_id","department_id","severity","reporter_mode","requires_conflict"].filter((key) => rule[key] != null).length === selectedSpecificity) : [];
      return res.json({ selected: selected ? { ...selected, explanation: routingExplanation(selected) } : null, conflicts, matched: candidates.length, deterministic: conflicts.length === 0 });
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
      const { collaborator_ids, ...ruleValues } = value;
      const referenceError = await validateRoutingReferences(db, tenantId(req), value);
      if (referenceError) return res.status(400).json({ error: referenceError });
      const conflictQuery = db.from("integrity_routing_rules").select("*").eq("tenant_id", tenantId(req))
        .neq("id", req.params.id).eq("status", "active").eq("priority", value.priority).eq("is_fallback", value.is_fallback);
      const conflicting = await conflictQuery;
      if (conflicting.error) return res.status(500).json({ error: "Não foi possível validar conflitos." });
      const conflictingRule = (conflicting.data || []).find((candidate: any) => routingConflict(value, candidate));
      if (value.status === "active" && conflictingRule)
        return res.status(409).json({ error: `Conflito com a regra ${conflictingRule.name}.` });
      const saved = await db.from("integrity_routing_rules").update({
        ...ruleValues,
        active: value.status === "active",
        archived_at: value.status === "archived" ? new Date().toISOString() : null,
        archived_by_membership_id: value.status === "archived" ? membershipId(req) : null,
        updated_at: new Date().toISOString(),
      }).eq("id", req.params.id).eq("tenant_id", tenantId(req)).select("*").single();
      if (saved.error) return res.status(saved.error.code === "23505" ? 409 : 500).json({ error: "Não foi possível atualizar a regra." });
      const removed = await db.from("integrity_routing_rule_collaborators").delete().eq("rule_id", req.params.id);
      if (removed.error) return res.status(500).json({ error: "Regra atualizada, mas colaboradores não puderam ser sincronizados." });
      if (collaborator_ids.length) {
        const linked = await db.from("integrity_routing_rule_collaborators").insert(collaborator_ids.map((id) => ({ rule_id: req.params.id, membership_id: id, tenant_id: tenantId(req) })));
        if (linked.error) return res.status(500).json({ error: "Regra atualizada, mas colaboradores não puderam ser sincronizados." });
      }
      await auditIntegrity(db, req, "integrity.routing.updated", "integrity_routing_rules", req.params.id, {
        after: { name: saved.data.name, status: saved.data.status, priority: saved.data.priority, category_id: saved.data.category_id, unit_id: saved.data.unit_id, committee_id: saved.data.committee_id, assignee_membership_id: saved.data.assignee_membership_id, is_fallback: saved.data.is_fallback },
      });
      return res.json({ routing_rule: saved.data });
    }),
  );

  router.get(
    "/cases/:id/collaborators",
    requireAny("integrity.cases.read", "integrity.cases.read_assigned"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const rows = await db.from("integrity_case_collaborators").select("id,membership_id,role,active,created_at,removed_at")
        .eq("case_id", req.params.id).eq("tenant_id", tenantId(req)).order("created_at");
      if (rows.error) return res.status(500).json({ error: "Não foi possível carregar os investigadores." });
      const ids = (rows.data || []).map((item: any) => item.membership_id);
      const memberships = ids.length ? await db.from("memberships").select("id,user_id").in("id", ids).eq("tenant_id", tenantId(req)) : { data: [], error: null };
      const userIds = (memberships.data || []).map((item: any) => item.user_id);
      const profiles = userIds.length ? await db.from("profiles").select("id,full_name").in("id", userIds) : { data: [], error: null };
      if (memberships.error || profiles.error) return res.status(500).json({ error: "Não foi possível identificar os investigadores." });
      const profileNames = new Map((profiles.data || []).map((item: any) => [item.id, item.full_name]));
      const names = new Map((memberships.data || []).map((item: any) => [item.id, profileNames.get(item.user_id) || "Pessoa da equipe"]));
      return res.json({ collaborators: (rows.data || []).map((item: any) => ({ ...item, name: names.get(item.membership_id) || "Membro indisponível" })) });
    }),
  );

  router.post(
    "/cases/:id/collaborators",
    requireAny("integrity.investigators.manage", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const parsed = collaboratorSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Investigador inválido." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const member = await db.from("memberships").select("id,status").eq("id", parsed.data.membership_id)
        .eq("tenant_id", tenantId(req)).maybeSingle();
      if (!member.data || member.data.status !== "active") return res.status(400).json({ error: "Membro não está ativo neste tenant." });
      const conflict = await db.from("integrity_case_conflicts").select("id").eq("case_id", req.params.id)
        .eq("membership_id", parsed.data.membership_id).eq("active", true).maybeSingle();
      if (conflict.data) return res.status(409).json({ error: "Participação bloqueada por conflito de interesse." });
      const saved = await db.from("integrity_case_collaborators").upsert({
        tenant_id: tenantId(req), case_id: req.params.id, membership_id: parsed.data.membership_id,
        role: parsed.data.role, active: true, removed_at: null, removed_by_membership_id: null,
        added_by_membership_id: membershipId(req),
      }, { onConflict: "case_id,membership_id" }).select("*").single();
      if (saved.error) return res.status(500).json({ error: "Não foi possível vincular o investigador." });
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id, case_id: req.params.id, event_type: "collaborator_added",
        actor_membership_id: membershipId(req), note: parsed.data.reason,
        metadata: { membership_id: parsed.data.membership_id, role: parsed.data.role },
      });
      if (event.error) return res.status(500).json({ error: "Investigador vinculado, mas a auditoria falhou." });
      return res.status(201).json({ collaborator: saved.data });
    }),
  );

  router.delete(
    "/cases/:id/collaborators/:collaboratorId",
    requireAny("integrity.investigators.manage", "integrity.cases.manage"),
    asyncHandler(async (req, res) => {
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3) return res.status(400).json({ error: "Informe o motivo da remoção." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id);
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const saved = await db.from("integrity_case_collaborators").update({
        active: false, removed_at: new Date().toISOString(), removed_by_membership_id: membershipId(req),
      }).eq("id", req.params.collaboratorId).eq("case_id", req.params.id).eq("tenant_id", tenantId(req)).eq("active", true).select("membership_id").maybeSingle();
      if (saved.error || !saved.data) return res.status(404).json({ error: "Investigador não encontrado." });
      await db.from("integrity_case_events").insert({
        report_id: found.data.report_id, case_id: req.params.id, event_type: "collaborator_removed",
        actor_membership_id: membershipId(req), note: reason, metadata: { membership_id: saved.data.membership_id },
      });
      return res.json({ removed: true });
    }),
  );

  router.get(
    "/notifications",
    requireAny("integrity.notifications.read"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const now = new Date();
      const soon = new Date(now.getTime() + 864e5).toISOString();
      let casesQuery = db.from("integrity_cases").select("id,first_action_at,first_response_due_at,treatment_due_at,status")
        .eq("tenant_id", tenantId(req)).not("status", "in", "(closed,archived)");
      casesQuery = (await scopeCaseQuery(casesQuery, db, req)).query;
      const cases = await casesQuery;
      if (cases.error) return res.status(500).json({ error: "Não foi possível atualizar os alertas." });
      const generated: any[] = [];
      for (const item of cases.data || []) {
        const due = !item.first_action_at && item.first_response_due_at ? item.first_response_due_at : item.treatment_due_at;
        if (!due) continue;
        const overdue = new Date(due) < now;
        if (overdue || due <= soon) generated.push({
          tenant_id: tenantId(req), recipient_membership_id: membershipId(req), case_id: item.id,
          notification_type: overdue ? "sla_overdue" : "sla_due_soon",
          title: overdue ? "SLA de caso vencido" : "SLA de caso próximo do vencimento",
          dedupe_key: `${membershipId(req)}:${item.id}:${overdue ? "sla_overdue" : "sla_due_soon"}:${String(due).slice(0,10)}`,
        });
      }
      const caseIds = (cases.data || []).map((item: any) => item.id);
      if (caseIds.length) {
        const overdueTasks = await db.from("integrity_case_tasks").select("id,case_id,title,due_at")
          .in("case_id", caseIds).in("status", ["open", "in_progress"]).lt("due_at", now.toISOString());
        if (overdueTasks.error) return res.status(500).json({ error: "Não foi possível atualizar os alertas de tarefa." });
        for (const task of overdueTasks.data || []) generated.push({
          tenant_id: tenantId(req), recipient_membership_id: membershipId(req), case_id: task.case_id,
          notification_type: "task_overdue", title: "Tarefa de investigação vencida",
          dedupe_key: `${membershipId(req)}:${task.id}:task_overdue`,
        });
      }
      if (generated.length) {
        const created = await db.from("integrity_notifications").upsert(generated, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (created.error) return res.status(500).json({ error: "Não foi possível registrar os alertas." });
      }
      const notifications = await db.from("integrity_notifications").select("id,case_id,notification_type,title,read_at,created_at")
        .eq("tenant_id", tenantId(req)).eq("recipient_membership_id", membershipId(req)).order("created_at", { ascending: false }).limit(100);
      if (notifications.error) return res.status(500).json({ error: "Não foi possível carregar as notificações." });
      return res.json({ notifications: notifications.data || [], unread: (notifications.data || []).filter((item: any) => !item.read_at).length });
    }),
  );

  router.patch(
    "/notifications/:id/read",
    requireAny("integrity.notifications.read"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const saved = await db.from("integrity_notifications").update({ read_at: new Date().toISOString() })
        .eq("id", req.params.id).eq("tenant_id", tenantId(req)).eq("recipient_membership_id", membershipId(req)).select("id,read_at").maybeSingle();
      if (saved.error || !saved.data) return res.status(404).json({ error: "Notificação não encontrada." });
      return res.json({ notification: saved.data });
    }),
  );

  router.get(
    "/settings/templates",
    requireAny("integrity.templates.read", "integrity.templates.manage"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const result = await db.from("integrity_templates").select("id,template_type,name,title,body,active,created_at,updated_at")
        .eq("tenant_id", tenantId(req)).order("template_type").order("name");
      if (result.error) return res.status(500).json({ error: "Não foi possível carregar os templates." });
      return res.json({ templates: result.data || [] });
    }),
  );

  router.post(
    "/settings/retention/evaluate",
    requireAny("integrity.retention.manage", "integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const due = await db.from("integrity_cases").select("id,report_id")
        .eq("tenant_id", tenantId(req)).eq("status", "closed").eq("retention_state", "active")
        .lte("retention_due_at", new Date().toISOString()).limit(500);
      if (due.error) return res.status(500).json({ error: "Não foi possível avaliar a retenção." });
      for (const item of due.data || []) {
        const updated = await db.from("integrity_cases").update({ retention_state: "retention_due",updated_at:new Date().toISOString() })
          .eq("id", item.id).eq("tenant_id", tenantId(req)).eq("retention_state", "active");
        if (updated.error) return res.status(500).json({ error: "A avaliação de retenção não foi concluída." });
        await db.from("integrity_case_events").insert({ report_id:item.report_id,case_id:item.id,event_type:"retention_due",actor_membership_id:membershipId(req),metadata:{} });
      }
      await auditIntegrity(db, req, "integrity.retention.evaluated", "integrity_cases", null, { due_cases: (due.data || []).length, physical_purge: false });
      return res.json({ evaluated:true,retention_due:(due.data || []).length,physical_purge:false });
    }),
  );

  router.post(
    "/settings/templates",
    requireAny("integrity.templates.manage"),
    asyncHandler(async (req, res) => {
      const parsed = templateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Template inválido." });
      const db = getSupabaseAdmin();
      const { id, ...values } = parsed.data;
      const query = id
        ? db.from("integrity_templates").update({ ...values, updated_by_membership_id: membershipId(req), updated_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", tenantId(req))
        : db.from("integrity_templates").insert({ ...values, tenant_id: tenantId(req), created_by_membership_id: membershipId(req), updated_by_membership_id: membershipId(req) });
      const saved = await query.select("*").single();
      if (saved.error) return res.status(saved.error.code === "23505" ? 409 : 500).json({ error: "Não foi possível salvar o template." });
      await auditIntegrity(db, req, id ? "integrity.template.updated" : "integrity.template.created", "integrity_templates", saved.data.id, { template_type: saved.data.template_type, active: saved.data.active });
      return res.status(id ? 200 : 201).json({ template: saved.data });
    }),
  );

  router.get(
    "/settings/access",
    requireAny("integrity.settings.manage"),
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const memberships = await db.from("memberships").select("id,user_id,status,created_at").eq("tenant_id", tenantId(req)).order("created_at");
      if (memberships.error) return res.status(500).json({ error: "Não foi possível carregar os acessos." });
      const memberIds = (memberships.data || []).map((item: any) => item.id);
      const userIds = (memberships.data || []).map((item: any) => item.user_id);
      const [profiles, membershipRoles, committees, assignments, collaborators, conflicts, activity] = await Promise.all([
        userIds.length ? db.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? db.from("membership_roles").select("membership_id,role_id,roles!inner(key,name,tenant_id)").in("membership_id", memberIds).eq("roles.tenant_id", tenantId(req)) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? db.from("integrity_committee_members").select("membership_id,committee_id,active,integrity_committees!inner(name,tenant_id)").in("membership_id", memberIds).eq("integrity_committees.tenant_id", tenantId(req)) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? db.from("integrity_cases").select("owner_membership_id").eq("tenant_id", tenantId(req)).in("owner_membership_id", memberIds).not("status", "in", "(closed,archived)") : Promise.resolve({ data: [], error: null }),
        memberIds.length ? db.from("integrity_case_collaborators").select("membership_id").eq("tenant_id", tenantId(req)).in("membership_id", memberIds).eq("active", true) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? db.from("integrity_case_conflicts").select("membership_id,integrity_cases!inner(tenant_id)").in("membership_id", memberIds).eq("active", true).eq("integrity_cases.tenant_id", tenantId(req)) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? db.from("integrity_case_events").select("actor_membership_id,created_at,integrity_cases!inner(tenant_id)").in("actor_membership_id", memberIds).eq("integrity_cases.tenant_id", tenantId(req)).order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [], error: null }),
      ]);
      if ([profiles,membershipRoles,committees,assignments,collaborators,conflicts,activity].some((result: any) => result.error))
        return res.status(500).json({ error: "Não foi possível consolidar a governança de acesso." });
      const roleIds = [...new Set((membershipRoles.data || []).map((item: any) => item.role_id))];
      const rolePermissions = roleIds.length ? await db.from("role_permissions").select("role_id,permissions!inner(key)").in("role_id", roleIds).like("permissions.key", "integrity.%") : { data: [], error: null };
      if (rolePermissions.error) return res.status(500).json({ error: "Não foi possível carregar as permissões." });
      const names = new Map((profiles.data || []).map((item: any) => [item.id,item.full_name]));
      const lastActivity = new Map<string,string>();
      for (const item of activity.data || []) if (item.actor_membership_id && !lastActivity.has(item.actor_membership_id)) lastActivity.set(item.actor_membership_id,item.created_at);
      return res.json({ access: (memberships.data || []).map((member: any) => {
        const roles = (membershipRoles.data || []).filter((item: any) => item.membership_id === member.id);
        const permissionKeys = [...new Set(roles.flatMap((role: any) => (rolePermissions.data || []).filter((item: any) => item.role_id === role.role_id).map((item: any) => item.permissions?.key)).filter(Boolean))];
        return {
          membership_id: member.id, name: names.get(member.user_id) || "Pessoa da equipe", status: member.status,
          roles: roles.map((item: any) => item.roles?.name || item.roles?.key).filter(Boolean), permissions: permissionKeys,
          committees: (committees.data || []).filter((item: any) => item.membership_id === member.id && item.active).map((item: any) => item.integrity_committees?.name).filter(Boolean),
          active_cases: (assignments.data || []).filter((item: any) => item.owner_membership_id === member.id).length + (collaborators.data || []).filter((item: any) => item.membership_id === member.id).length,
          active_conflicts: (conflicts.data || []).filter((item: any) => item.membership_id === member.id).length,
          last_operational_activity_at: lastActivity.get(member.id) || null,
        };
      }) });
    }),
  );

  router.get(
    "/cases/:id/dossier.pdf",
    requireAny("integrity.dossier.export", "integrity.case_report.export"),
    asyncHandler(async (req, res) => {
      const includeIdentity = req.query.include_identity === "true";
      if (includeIdentity && !hasPermission(req, "integrity.identity.read"))
        return res.status(403).json({ error: "A identidade exige permissão específica." });
      const db = getSupabaseAdmin();
      const found = await findCase(db, req, req.params.id,
        "*,integrity_reports!inner(subject,description,occurred_at,reporter_mode,created_at),integrity_categories(name),integrity_units(name),integrity_committees(name)");
      if (!found.data) return res.status(404).json({ error: "Caso não encontrado." });
      const [tasks,evidence,timeline,collaborators] = await Promise.all([
        db.from("integrity_case_tasks").select("title,status,priority,due_at").eq("case_id", req.params.id).order("created_at"),
        db.from("integrity_attachments").select("created_at,files!inner(original_name,mime_type,size_bytes,checksum_sha256)").eq("case_id", req.params.id).is("deleted_at", null).order("created_at"),
        db.from("integrity_case_events").select("id,event_type,note,created_at,actor_membership_id").eq("case_id", req.params.id).order("created_at"),
        db.from("integrity_case_collaborators").select("membership_id").eq("case_id", req.params.id).eq("tenant_id", tenantId(req)).eq("active", true),
      ]);
      if ([tasks,evidence,timeline,collaborators].some((result: any) => result.error))
        return res.status(500).json({ error: "Não foi possível preparar o dossiê." });
      const membershipIds = [...new Set([
        found.data.owner_membership_id, found.data.decided_by_membership_id,
        ...(timeline.data || []).map((item: any) => item.actor_membership_id),
        ...(collaborators.data || []).map((item: any) => item.membership_id),
      ].filter(Boolean))];
      const memberships = membershipIds.length ? await db.from("memberships").select("id,user_id").in("id", membershipIds).eq("tenant_id", tenantId(req)) : { data: [], error: null };
      const userIds = (memberships.data || []).map((item: any) => item.user_id);
      const profiles = userIds.length ? await db.from("profiles").select("id,full_name").in("id", userIds) : { data: [], error: null };
      if (memberships.error || profiles.error) return res.status(500).json({ error: "Não foi possível identificar os responsáveis." });
      const profileNames = new Map<string,string>((profiles.data || []).map((item: any) => [item.id,String(item.full_name || "")]));
      const memberNames = new Map<string,string>((memberships.data || []).map((item: any) => [item.id,profileNames.get(item.user_id) || "Pessoa da equipe"]));
      let identity: any = null;
      if (includeIdentity && found.data.integrity_reports.reporter_mode === "identified") {
        const identityResult = await db.from("integrity_report_identities").select("name,email,phone").eq("report_id", found.data.report_id).maybeSingle();
        if (identityResult.error) return res.status(500).json({ error: "Não foi possível validar a identidade." });
        identity = identityResult.data;
      }
      const recommendation = [...(timeline.data || [])].reverse().find((item: any) => item.event_type === "decision_recommended")?.note || null;
      const pdf = createIntegrityDossierPdf({
        organization: (req as any).tenantContext?.tenant?.name || "Organização",
        protocol: found.data.protocol, status: found.data.status, category: found.data.integrity_categories?.name,
        severity: found.data.severity, priority: found.data.priority, unit: found.data.integrity_units?.name,
        committee: found.data.integrity_committees?.name, owner: memberNames.get(found.data.owner_membership_id) || null,
        collaborators: (collaborators.data || []).map((item: any) => memberNames.get(item.membership_id) || "Pessoa da equipe"),
        createdAt: found.data.created_at, firstActionAt: found.data.first_action_at,
        firstResponseDueAt: found.data.first_response_due_at, treatmentDueAt: found.data.treatment_due_at, closedAt: found.data.closed_at,
        subject: found.data.integrity_reports.subject, description: found.data.integrity_reports.description,
        tasks: tasks.data || [], evidence: (evidence.data || []).map((item: any) => ({
          name: item.files?.original_name, mime: item.files?.mime_type, size: item.files?.size_bytes,
          checksum: item.files?.checksum_sha256, created_at: item.created_at,
        })), timeline: (timeline.data || []).map((item: any) => ({ ...item, actor_name: memberNames.get(item.actor_membership_id) || "Sistema Ordum" })),
        recommendation, conclusion: found.data.conclusion, measuresTaken: found.data.measures_taken,
        finalClassification: found.data.final_classification, closureReason: found.data.closure_reason, reporterIdentity: identity,
      });
      const event = await db.from("integrity_case_events").insert({
        report_id: found.data.report_id, case_id: req.params.id, event_type: "case_dossier_exported",
        actor_membership_id: membershipId(req), metadata: { included_identity: Boolean(identity), format: "pdf", bytes: pdf.length },
      });
      if (event.error) return res.status(500).json({ error: "A exportação não pôde ser auditada." });
      await auditIntegrity(db, req, "integrity.case_dossier.exported", "integrity_cases", req.params.id, { included_identity: Boolean(identity), format: "pdf", bytes: pdf.length });
      res.setHeader("content-type", "application/pdf");
      res.setHeader("content-disposition", `attachment; filename="integrity-${found.data.protocol}.pdf"`);
      res.setHeader("cache-control", "private, no-store, max-age=0");
      return res.send(pdf);
    }),
  );

  router.get(
    "/deployment",
    requireAny("integrity.settings.manage", "integrity.deployment.manage"),
    asyncHandler(async (req, res) => {
      const db=getSupabaseAdmin(); const tenant=tenantId(req);
      const [settings,channels,categories,units,departments,committees,committeeMembers,rules,templates,members,onboarding]=await Promise.all([
        db.from("integrity_settings").select("*").eq("tenant_id",tenant).maybeSingle(),db.from("integrity_channels").select("id,active,public_slug").eq("tenant_id",tenant),db.from("integrity_categories").select("id").eq("tenant_id",tenant).eq("active",true),db.from("integrity_units").select("id").eq("tenant_id",tenant).eq("active",true),db.from("integrity_departments").select("id").eq("tenant_id",tenant).eq("active",true),db.from("integrity_committees").select("id,status").eq("tenant_id",tenant),db.from("integrity_committee_members").select("committee_id").eq("active",true),db.from("integrity_routing_rules").select("id,requires_conflict,escalation_committee_id,escalation_membership_id").eq("tenant_id",tenant).eq("active",true).eq("status","active"),db.from("integrity_templates").select("template_type").eq("tenant_id",tenant).eq("active",true),db.from("memberships").select("id").eq("tenant_id",tenant).eq("status","active"),db.from("onboarding_runs").select("id,status,onboarding_items(id,step_key,status)").eq("tenant_id",tenant).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      ]);
      if([settings,channels,categories,units,departments,committees,committeeMembers,rules,templates,members,onboarding].some((item:any)=>item.error))return res.status(500).json({error:"Não foi possível consolidar a implantação."});
      const activeCommittees=(committees.data||[]).filter((item:any)=>item.status==="active");
      const checks=[
        {key:"organization_data",label:"Dados e identidade do canal",complete:Boolean((req as any).tenantContext?.tenant?.name&&settings.data?.introduction)},
        {key:"integrity_units",label:"Unidades e filiais",complete:Boolean(units.data?.length)},
        {key:"integrity_departments",label:"Departamentos e setores",complete:Boolean(departments.data?.length)},
        {key:"integrity_categories",label:"Categorias de denúncia",complete:Boolean(categories.data?.length)},
        {key:"integrity_severity",label:"Severidades e prioridades",complete:Boolean(categories.data?.length)},
        {key:"integrity_committee",label:"Comitês responsáveis",complete:activeCommittees.some((committee:any)=>(committeeMembers.data||[]).some((member:any)=>member.committee_id===committee.id))},
        {key:"integrity_investigators",label:"Usuários e responsabilidades",complete:Boolean(members.data?.length)},
        {key:"integrity_routing",label:"Regras de roteamento",complete:Boolean(rules.data?.length)},
        {key:"integrity_sla",label:"SLA e alertas",complete:Boolean(settings.data?.default_sla_hours&&settings.data?.treatment_sla_hours&&settings.data?.alert_lead_hours)},
        {key:"integrity_conflicts",label:"Conflitos e escalonamento",complete:(rules.data||[]).some((item:any)=>item.requires_conflict!=null||item.escalation_committee_id||item.escalation_membership_id)},
        {key:"integrity_communication",label:"Templates de comunicação",complete:["reporter_message","information_request"].every(type=>(templates.data||[]).some((item:any)=>item.template_type===type))},
        {key:"integrity_anonymity",label:"Política de anonimato",complete:Boolean(settings.data?.allows_anonymous||settings.data?.allows_identified)},
        {key:"integrity_retention",label:"Política de retenção",complete:Boolean(settings.data?.retention_days)},
        {key:"integrity_channel",label:"Canal configurado",complete:Boolean((channels.data||[]).length)},
        {key:"integrity_channel_test",label:"Teste do canal",complete:Boolean(settings.data?.channel_tested_at)},
        {key:"integrity_publish",label:"Publicação",complete:Boolean(settings.data?.channel_published_at&&(channels.data||[]).some((item:any)=>item.active))},
      ];
      const state=integrityDeploymentState(checks.map(({key,complete})=>({key:key==="integrity_publish"?"published":key==="integrity_channel_test"?"channel_test":key.replace("integrity_","") ,complete})));
      if(settings.data?.deployment_state!==state)await db.from("integrity_settings").update({deployment_state:state,deployment_updated_at:new Date().toISOString()}).eq("tenant_id",tenant);
      const items=onboarding.data?.onboarding_items||[];
      for(const check of checks){const item=items.find((candidate:any)=>candidate.step_key===check.key);if(item&&item.status!=="completed"&&check.complete)await db.from("onboarding_items").update({status:"completed",completed_at:new Date().toISOString(),observation:"Sincronizado pelo wizard do Integridade."}).eq("id",item.id);}
      return res.json({state,completed:checks.filter(item=>item.complete).length,total:checks.length,steps:checks,onboarding_run_id:onboarding.data?.id||null,channel_url:(channels.data||[]).find((item:any)=>item.active)?.public_slug?`/#/canal/${(channels.data||[]).find((item:any)=>item.active).public_slug}`:null});
    }),
  );

  router.post("/settings/channel-publish",requireAny("integrity.settings.manage","integrity.deployment.manage"),asyncHandler(async(req,res)=>{const db=getSupabaseAdmin();const [settings,channel,categories,routing,committee]=await Promise.all([db.from("integrity_settings").select("channel_tested_at").eq("tenant_id",tenantId(req)).maybeSingle(),db.from("integrity_channels").select("id,public_slug").eq("tenant_id",tenantId(req)).order("created_at").limit(1).maybeSingle(),db.from("integrity_categories").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId(req)).eq("active",true),db.from("integrity_routing_rules").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId(req)).eq("active",true).eq("status","active"),db.from("integrity_committees").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId(req)).eq("status","active")]);if([settings,channel,categories,routing,committee].some((item:any)=>item.error))return res.status(500).json({error:"Não foi possível validar a publicação."});if(!settings.data?.channel_tested_at||!channel.data||!categories.count||!routing.count||!committee.count)return res.status(409).json({error:"Conclua e teste a configuração antes de publicar."});const publishedAt=new Date().toISOString();const [enabled,updated]=await Promise.all([db.from("integrity_channels").update({active:true,updated_at:publishedAt}).eq("id",channel.data.id).eq("tenant_id",tenantId(req)),db.from("integrity_settings").update({channel_published_at:publishedAt,deployment_state:"published",deployment_updated_at:publishedAt}).eq("tenant_id",tenantId(req))]);if(enabled.error||updated.error)return res.status(500).json({error:"Não foi possível publicar o canal."});await auditIntegrity(db,req,"integrity.channel.published","integrity_channels",channel.data.id,{public_slug:channel.data.public_slug,published_at:publishedAt});return res.json({published:true,public_slug:channel.data.public_slug,published_at:publishedAt});}));

  router.get(
    "/pending",
    requireAny("integrity.pending.read","integrity.cases.read","integrity.cases.read_assigned"),
    asyncHandler(async(req,res)=>{const db=getSupabaseAdmin();const now=new Date();let cases=db.from("integrity_cases").select("id,report_id,protocol,status,owner_membership_id,committee_id,updated_at,first_response_due_at,treatment_due_at,retention_state").eq("tenant_id",tenantId(req)).not("status","in","(closed,archived)");cases=(await scopeCaseQuery(cases,db,req)).query;const result=await cases; if(result.error)return res.status(500).json({error:"Não foi possível carregar as pendências."});const ids=(result.data||[]).map((item:any)=>item.id);const reportIds=(result.data||[]).map((item:any)=>item.report_id);const [tasks,conflicts,messages,recommendations]=await Promise.all([ids.length?db.from("integrity_case_tasks").select("id,case_id,title,due_at,status").in("case_id",ids).in("status",["open","in_progress"]):Promise.resolve({data:[],error:null}),ids.length?db.from("integrity_case_conflicts").select("id,case_id").in("case_id",ids).eq("active",true):Promise.resolve({data:[],error:null}),reportIds.length?db.from("integrity_report_messages").select("id,report_id,author_type,created_at").in("report_id",reportIds).order("created_at",{ascending:false}):Promise.resolve({data:[],error:null}),ids.length?db.from("integrity_case_events").select("case_id,event_type").in("case_id",ids).eq("event_type","decision_recommended"):Promise.resolve({data:[],error:null})]);if([tasks,conflicts,messages,recommendations].some((item:any)=>item.error))return res.status(500).json({error:"Não foi possível consolidar a fila."});const items:any[]=[];for(const item of result.data||[]){const due=item.first_response_due_at||item.treatment_due_at;if(!item.owner_membership_id&&!item.committee_id)items.push({kind:"unassigned",label:"Caso sem responsável",case_id:item.id,protocol:item.protocol,priority:"high"});if(due&&new Date(due)<now)items.push({kind:"sla_overdue",label:"SLA vencido",case_id:item.id,protocol:item.protocol,priority:"urgent",due_at:due});else if(due&&new Date(due).getTime()-now.getTime()<86400000)items.push({kind:"sla_due_soon",label:"SLA próximo",case_id:item.id,protocol:item.protocol,priority:"high",due_at:due});if(now.getTime()-new Date(item.updated_at).getTime()>7*86400000)items.push({kind:"stale",label:"Caso sem movimentação",case_id:item.id,protocol:item.protocol,priority:"normal"});if(item.status==="decision"&&(recommendations.data||[]).some((event:any)=>event.case_id===item.id))items.push({kind:"decision",label:"Recomendação aguardando decisão",case_id:item.id,protocol:item.protocol,priority:"high"});const caseMessages=(messages.data||[]).filter((message:any)=>message.report_id===item.report_id);if(caseMessages[0]?.author_type==="reporter")items.push({kind:"external_message",label:"Mensagem externa sem resposta",case_id:item.id,protocol:item.protocol,priority:"high"});}for(const task of tasks.data||[])if(task.due_at&&new Date(task.due_at)<now){const item=(result.data||[]).find((candidate:any)=>candidate.id===task.case_id);items.push({kind:"task_overdue",label:`Tarefa vencida: ${task.title}`,case_id:task.case_id,protocol:item?.protocol,priority:"high",due_at:task.due_at});}for(const conflict of conflicts.data||[]){const item=(result.data||[]).find((candidate:any)=>candidate.id===conflict.case_id);items.push({kind:"conflict",label:"Conflito de interesse pendente",case_id:conflict.case_id,protocol:item?.protocol,priority:"urgent"});}return res.json({items,counts:items.reduce((acc:any,item:any)=>(acc[item.kind]=(acc[item.kind]||0)+1,acc),{}),updated_at:now.toISOString()});}),
  );

  router.post("/settings/departments",requireAny("integrity.settings.manage"),asyncHandler(async(req,res)=>{const parsed=departmentSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Setor inválido.",issues:parsed.error.issues});const db=getSupabaseAdmin();const{id,...values}=parsed.data;const unit=await db.from("integrity_units").select("id").eq("id",values.unit_id).eq("tenant_id",tenantId(req)).maybeSingle();if(!unit.data)return res.status(400).json({error:"Unidade inválida."});if(values.responsible_membership_id){const responsible=await db.from("memberships").select("id").eq("id",values.responsible_membership_id).eq("tenant_id",tenantId(req)).eq("status","active").maybeSingle();if(!responsible.data)return res.status(400).json({error:"Responsável deve estar ativo neste tenant."});}const query=id?db.from("integrity_departments").update({...values,updated_at:new Date().toISOString()}).eq("id",id).eq("tenant_id",tenantId(req)):db.from("integrity_departments").insert({...values,tenant_id:tenantId(req)});const saved=await query.select("*").single();if(saved.error)return res.status(saved.error.code==="23505"?409:500).json({error:"Não foi possível salvar o setor."});await auditIntegrity(db,req,id?"integrity.department.updated":"integrity.department.created","integrity_departments",saved.data.id,{unit_id:saved.data.unit_id,name:saved.data.name,active:saved.data.active});return res.status(id?200:201).json({department:saved.data});}));
  router.post("/settings/custom-fields",requireAny("integrity.settings.manage"),asyncHandler(async(req,res)=>{const parsed=customFieldSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Campo adicional inválido.",issues:parsed.error.issues});const db=getSupabaseAdmin();const{id,...values}=parsed.data;if(values.channel_id){const channel=await db.from("integrity_channels").select("id").eq("id",values.channel_id).eq("tenant_id",tenantId(req)).maybeSingle();if(!channel.data)return res.status(400).json({error:"Canal inválido."});}const query=id?db.from("integrity_custom_fields").update({...values,updated_at:new Date().toISOString()}).eq("id",id).eq("tenant_id",tenantId(req)):db.from("integrity_custom_fields").insert({...values,tenant_id:tenantId(req)});const saved=await query.select("*").single();if(saved.error)return res.status(saved.error.code==="23505"?409:500).json({error:"Não foi possível salvar o campo adicional."});await auditIntegrity(db,req,id?"integrity.custom_field.updated":"integrity.custom_field.created","integrity_custom_fields",saved.data.id,{field_key:saved.data.field_key,field_type:saved.data.field_type,required:saved.data.required});return res.status(id?200:201).json({custom_field:saved.data});}));

  router.get("/reports/executive.:format",requireAny("integrity.executive.export","integrity.exports.execute"),asyncHandler(async(req,res)=>{const format=req.params.format;if(!["csv","pdf"].includes(format))return res.status(404).end();const parsed=dashboardSchema.safeParse(req.query);if(!parsed.success)return res.status(400).json({error:"Filtros inválidos."});const db=getSupabaseAdmin();let query=db.from("integrity_cases").select("id,status,severity,created_at,first_action_at,closed_at,owner_membership_id,category_id,unit_id,department_id,integrity_reports(reporter_mode),integrity_categories(name),integrity_units(name),integrity_departments(name)").eq("tenant_id",tenantId(req));const f=parsed.data;if(f.status)query=query.eq("status",f.status);if(f.severity)query=query.eq("severity",f.severity);if(f.category_id)query=query.eq("category_id",f.category_id);if(f.unit_id)query=query.eq("unit_id",f.unit_id);if(f.department_id)query=query.eq("department_id",f.department_id);if(f.from)query=query.gte("created_at",f.from);if(f.to)query=query.lte("created_at",f.to);const result=await query.limit(5000);if(result.error)return res.status(500).json({error:"Não foi possível gerar o relatório executivo."});const aggregate=integrityDashboard((result.data||[]).map((item:any)=>({...item,reporter_mode:item.integrity_reports?.reporter_mode})));await auditIntegrity(db,req,"integrity.executive_report.exported","integrity_settings",tenantId(req),{format,filters:f,rows:(result.data||[]).length,aggregate_only:true});const metrics=[["Recebidas",aggregate.total],["Abertas",aggregate.open],["Encerradas",aggregate.closed],["Sem responsável",aggregate.unassigned],["Tempo médio até primeira ação",aggregate.average_first_action_hours==null?"—":`${aggregate.average_first_action_hours}h`],["Tempo médio até conclusão",aggregate.average_resolution_hours==null?"—":`${aggregate.average_resolution_hours}h`]] as Array<[string,string|number]>;if(format==="csv"){const rows=[["indicador","valor"],...metrics,["",""],["distribuição","item","quantidade"],...[["categoria",aggregate.by_category],["unidade",aggregate.by_unit],["setor",aggregate.by_department],["severidade",aggregate.by_severity],["identificação",aggregate.by_reporter_mode]].flatMap(([name,data]:any)=>(data||[]).map((row:any)=>[name,row.label,row.count]))];const csv=rows.map(row=>row.map(csvCell).join(",")).join("\r\n");res.setHeader("content-type","text/csv; charset=utf-8");res.setHeader("content-disposition",'attachment; filename="integridade-executivo.csv"');return res.send(`\ufeff${csv}`);}const pdf=createIntegrityExecutivePdf({organization:(req as any).tenantContext?.tenant?.name||"Organização",period:`${f.from||"início"} a ${f.to||"agora"}`,generatedAt:new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}),filters:Object.entries(f).filter(([,value])=>value).map(([key,value])=>`${key}: ${value}`),metrics:metrics.map(([label,value])=>({label,value})),distributions:[{title:"Por categoria",rows:aggregate.by_category},{title:"Por unidade",rows:aggregate.by_unit},{title:"Por setor",rows:aggregate.by_department},{title:"Por severidade",rows:aggregate.by_severity}]});res.setHeader("content-type","application/pdf");res.setHeader("content-disposition",'attachment; filename="integridade-executivo.pdf"');res.setHeader("cache-control","private, no-store");return res.send(pdf);}));

  router.post("/retention/:id/review",requireAny("integrity.retention.manage"),asyncHandler(async(req,res)=>{const parsed=z.object({decision:z.enum(["archive","keep_active","defer"]),reason:z.string().trim().min(3).max(1000),defer_until:z.string().datetime().nullable().optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Revisão de retenção inválida."});const db=getSupabaseAdmin();const found=await findCase(db,req,req.params.id,"id,tenant_id,report_id,retention_state");if(!found.data)return res.status(404).json({error:"Caso não encontrado."});if(parsed.data.decision==="defer"&&!parsed.data.defer_until)return res.status(400).json({error:"Informe a nova data de revisão."});const review=await db.from("integrity_retention_reviews").insert({tenant_id:tenantId(req),case_id:req.params.id,reviewed_by_membership_id:membershipId(req),...parsed.data}).select("id").single();if(review.error)return res.status(500).json({error:"Não foi possível registrar a revisão."});const updates=parsed.data.decision==="archive"?{retention_state:"archived",archived_at:new Date().toISOString()}:{retention_state:"active",retention_due_at:parsed.data.decision==="defer"?parsed.data.defer_until:null};const updated=await db.from("integrity_cases").update(updates).eq("id",req.params.id);if(updated.error)return res.status(500).json({error:"A revisão foi registrada, mas o lifecycle não pôde ser atualizado."});await db.from("integrity_case_events").insert({report_id:found.data.report_id,case_id:req.params.id,event_type:"retention_reviewed",actor_membership_id:membershipId(req),note:parsed.data.reason,metadata:{decision:parsed.data.decision,defer_until:parsed.data.defer_until||null}});return res.json({reviewed:true,decision:parsed.data.decision});}));

  return router;
}
