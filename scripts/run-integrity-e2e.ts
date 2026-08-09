import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.APP_URL || "https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app").replace(/\/$/, "");
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

type Evidence = Record<string, string | number | boolean>;
type FixtureUser = { id: string; email: string; password: string; token: string; membershipId: string };
type ApiResult = { status: number; body: any; headers: Headers };

function must(value: string, name: string) {
  if (!value) throw new Error(`${name} ausente.`);
}
function value<T>(result: { data: T | null; error: any }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${label}: sem dados`);
  return result.data;
}
function expect(result: ApiResult, status: number | number[], label: string) {
  const allowed = Array.isArray(status) ? status : [status];
  if (!allowed.includes(result.status)) throw new Error(`${label}: HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
  return result.body;
}

async function request(path: string, options: RequestInit = {}, token?: string, tenantId?: string): Promise<ApiResult> {
  const headers = new Headers(options.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (tenantId) headers.set("x-tenant-id", tenantId);
  if (!(options.body instanceof Uint8Array) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${APP_URL}${path}`, { ...options, headers });
  return { status: response.status, body: await response.json().catch(() => ({})), headers: response.headers };
}

async function createUser(db: SupabaseClient, runId: string, suffix: string, tenantId: string, roleId: string): Promise<FixtureUser> {
  const password = `Ordum#${crypto.randomBytes(18).toString("base64url")}`;
  const email = `${runId}_${suffix}@ordum-test.internal`;
  const auth = value(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { runId } }), `auth ${suffix}`).user;
  const membership = value(await db.from("memberships").insert({ tenant_id: tenantId, user_id: auth.id, status: "active" }).select("id").single(), `membership ${suffix}`);
  value(await db.from("membership_roles").insert({ membership_id: membership.id, role_id: roleId }).select().single(), `membership role ${suffix}`);
  const signed = value(await createClient(SUPABASE_URL, PUBLISHABLE).auth.signInWithPassword({ email, password }), `login ${suffix}`);
  if (!signed.session) throw new Error(`login ${suffix}: sem sessão`);
  return { id: auth.id, email, password, token: signed.session.access_token, membershipId: membership.id };
}

async function removeStorage(db: SupabaseClient, tenantIds: string[]) {
  for (const tenantId of tenantIds) {
    const cases = value(await db.from("integrity_cases").select("id").eq("tenant_id", tenantId), `listar cases ${tenantId}`);
    for (const item of cases) {
      const listed = await db.storage.from("ordum-integrity").list(`${tenantId}/${item.id}`, { limit: 1000 });
      if (listed.error) throw new Error(`listar storage: ${listed.error.message}`);
      const paths = (listed.data || []).map((file) => `${tenantId}/${item.id}/${file.name}`);
      if (paths.length) {
        const removed = await db.storage.from("ordum-integrity").remove(paths);
        if (removed.error) throw new Error(`remover storage: ${removed.error.message}`);
      }
    }
  }
}

async function cleanup(db: SupabaseClient, runId: string, tenantIds: string[], users: string[], platformUser?: string) {
  const errors: string[] = [];
  try { await removeStorage(db, tenantIds); } catch (error: any) { errors.push(error.message); }
  if (platformUser) {
    const removed = await db.from("platform_members").delete().eq("user_id", platformUser);
    if (removed.error) errors.push(`platform member: ${removed.error.message}`);
  }
  const clean = await db.rpc("cleanup_integrity_e2e_fixture", { p_run_id: runId });
  if (clean.error) errors.push(`cleanup rpc: ${clean.error.message}`);
  for (const userId of users) {
    const removed = await db.auth.admin.deleteUser(userId);
    if (removed.error) errors.push(`auth ${userId}: ${removed.error.message}`);
  }
  const tenants = await db.from("tenants").select("id", { count: "exact", head: true }).in("id", tenantIds);
  if (tenants.error) errors.push(`verify tenants: ${tenants.error.message}`);
  if (tenants.count) errors.push(`tenants residuais: ${tenants.count}`);
  for (const userId of users) {
    const auth = await db.auth.admin.getUserById(userId);
    if (!auth.error) errors.push(`auth residual: ${userId}`);
  }
  if (errors.length) throw new Error(errors.join("; "));
}

export async function runIntegrityE2E(): Promise<Evidence> {
  must(SUPABASE_URL, "SUPABASE_URL"); must(SECRET, "SUPABASE_SECRET_KEY"); must(PUBLISHABLE, "VITE_SUPABASE_PUBLISHABLE_KEY");
  const db = createClient(SUPABASE_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });
  const health = await request("/");
  if (health.status !== 200) throw new Error(`preflight Preview: HTTP ${health.status}`);

  const runId = `integrity_e2e_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const evidence: Evidence = { runId, previewHealth: health.status };
  const legacy = await createClient(SUPABASE_URL, PUBLISHABLE).rpc("get_integrity_channel", { p_channel_slug: "cutover-probe" });
  if (!legacy.error || !/permission denied/i.test(legacy.error.message)) throw new Error("RPC público legado continua acessível ao navegador");
  evidence.legacyRpcBlocked = true;
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let platformUser: string | undefined;
  let primaryError: unknown;
  try {
    const suffix = crypto.randomBytes(4).toString("hex");
    const tenantA = value(await db.from("tenants").insert({ name: `Integrity E2E A ${suffix}`, slug: `e2e-integrity-${suffix}-a`, status: "trial", settings: { e2e_run_id: runId } }).select("id").single(), "tenant A");
    const tenantB = value(await db.from("tenants").insert({ name: `Integrity E2E B ${suffix}`, slug: `e2e-integrity-${suffix}-b`, status: "trial", settings: { e2e_run_id: runId } }).select("id").single(), "tenant B");
    tenantIds.push(tenantA.id, tenantB.id);
    const solution = value(await db.from("solutions").select("id").eq("key", "integridade").single(), "solution integrity");
    value(await db.from("tenant_solutions").insert([{ tenant_id: tenantA.id, solution_id: solution.id, status: "active" }, { tenant_id: tenantB.id, solution_id: solution.id, status: "active" }]).select(), "tenant solutions");
    const roleA = value(await db.from("roles").insert({ tenant_id: tenantA.id, key: "tenant_admin", name: "Admin E2E", is_system: true }).select("id").single(), "role A");
    const roleB = value(await db.from("roles").insert({ tenant_id: tenantB.id, key: "tenant_admin", name: "Admin E2E", is_system: true }).select("id").single(), "role B");
    const investigatorRole = value(await db.from("roles").select("id").eq("tenant_id", tenantA.id).eq("key", "integrity_investigator").single(), "investigator role");
    const complianceRole = value(await db.from("roles").select("id").eq("tenant_id", tenantA.id).eq("key", "integrity_compliance").single(), "compliance role");
    const emptyRole = value(await db.from("roles").insert({ tenant_id: tenantA.id, key: "e2e_no_access", name: "Sem acesso" }).select("id").single(), "empty role");
    const adminA = await createUser(db, runId, "admin_a", tenantA.id, roleA.id);
    const adminB = await createUser(db, runId, "admin_b", tenantB.id, roleB.id);
    const blocked = await createUser(db, runId, "blocked", tenantA.id, emptyRole.id);
    const assignedInvestigator = await createUser(db, runId, "investigator_assigned", tenantA.id, investigatorRole.id);
    const unassignedInvestigator = await createUser(db, runId, "investigator_unassigned", tenantA.id, investigatorRole.id);
    const compliance = await createUser(db, runId, "compliance", tenantA.id, complianceRole.id);
    userIds.push(adminA.id, adminB.id, blocked.id, assignedInvestigator.id, unassignedInvestigator.id, compliance.id);
    const platformRole = value(await db.from("platform_roles").select("id").eq("key", "admin").single(), "platform admin role");
    value(await db.from("platform_members").insert({ user_id: adminA.id, role_id: platformRole.id, status: "active", relationship_type: "partner" }).select("id").single(), "platform fixture");
    platformUser = adminA.id;
    const workspace = (path: string, options?: RequestInit, user = adminA, tenant = tenantA.id) => request(`/api/workspace/integrity${path}`, options, user.token, tenant);
    const publicApi = (path: string, options?: RequestInit) => request(`/api/public/integrity${path}`, options);

    expect(await workspace("/settings", { method: "PUT", body: JSON.stringify({ introduction: "Canal seguro para o teste funcional descartável da Ordum.", instructions: "Descreva os fatos com clareza.", allows_anonymous: true, allows_identified: true, default_sla_hours: 12, treatment_sla_hours: 48, automatic_acknowledgement: "Seu relato foi recebido com segurança.", branding: { accent: "#3457D5" }, attachment_policy: { enabled: true, max_files: 3, max_size_mb: 2 }, communication_policy: { allow_reporter_messages: true, allow_case_messages: true }, routing_rules: [] }) }), 200, "settings");
    const category = expect(await workspace("/settings/categories", { method: "POST", body: JSON.stringify({ name: "Assédio", slug: `assedio-${suffix}`, default_risk_level: "high", sla_hours: 12, active: true }) }), 201, "category").category;
    const unit = expect(await workspace("/settings/units", { method: "POST", body: JSON.stringify({ name: "Unidade Piloto", code: `U-${suffix}`, active: true }) }), 201, "unit").unit;
    const committee = expect(await workspace("/settings/committees", { method: "POST", body: JSON.stringify({ name: "Comitê de Ética", member_ids: [assignedInvestigator.membershipId], active: true }) }), 201, "committee").committee;
    const routing = expect(await workspace("/settings/routing", { method: "POST", body: JSON.stringify({ name: "Rota piloto", category_id: category.id, unit_id: unit.id, assignee_membership_id: assignedInvestigator.membershipId, committee_id: committee.id, priority: 1, active: true, is_fallback: false }) }), 201, "routing").routing_rule;
    expect(await workspace("/settings/routing", { method: "POST", body: JSON.stringify({ name: "Rota conflitante", category_id: category.id, unit_id: unit.id, assignee_membership_id: adminA.membershipId, priority: 1, active: true, is_fallback: false }) }), 409, "routing conflict");
    const preview = expect(await workspace("/settings/routing/preview", { method: "POST", body: JSON.stringify({ category_id: category.id, unit_id: unit.id }) }), 200, "routing preview");
    if (preview.selected?.id !== routing.id || preview.deterministic !== true) throw new Error("preview de roteamento não determinístico");
    const channelSlug = `canal-${suffix}`;
    expect(await workspace("/settings/channels", { method: "POST", body: JSON.stringify({ name: "Canal E2E", public_title: "Canal de Integridade", public_slug: channelSlug, active: true, allows_anonymous: true, allows_identified: true }) }), 201, "channel");
    const channel = expect(await publicApi(`/channels/${channelSlug}`), 200, "public channel").channel;
    if (!channel.categories?.length || !channel.units?.length) throw new Error("canal sem categoria/unidade configurada");

    const reportBody = { channel_slug: channelSlug, category_slug: category.slug, reporter_mode: "anonymous", subject: "Relato funcional descartável", description: "Descrição detalhada suficiente para validar o fluxo operacional completo sem dados reais.", occurred_at: new Date().toISOString().slice(0, 10), unit_id: unit.id };
    const submitted = expect(await publicApi("/reports", { method: "POST", body: JSON.stringify(reportBody) }), 201, "anonymous report");
    if (!submitted.protocol || !submitted.access_secret || submitted.access_secret.length < 24) throw new Error("protocolo/segredo ausente");
    evidence.reportHttp = 201;
    const report = value(await db.from("integrity_reports").select("id,reporter_mode").eq("protocol", submitted.protocol).single(), "report stored");
    const secret = value(await db.from("integrity_report_secrets").select("secret_hash").eq("report_id", report.id).single(), "secret stored");
    if (!secret.secret_hash || secret.secret_hash === submitted.access_secret) throw new Error("segredo não foi armazenado como hash");
    const identified = expect(await publicApi("/reports", { method: "POST", body: JSON.stringify({ ...reportBody, subject: "Relato identificado descartável", reporter_mode: "identified", identity: { name: "Pessoa E2E", email: `${runId}@ordum-test.internal` } }) }), 201, "identified report");
    const identityCount = await db.from("integrity_report_identities").select("report_id").eq("report_id", value(await db.from("integrity_reports").select("id").eq("protocol", identified.protocol).single(), "identified stored").id);
    if (identityCount.error || identityCount.data?.length !== 1) throw new Error(`identidade separada não persistida: ${identityCount.error?.message || `count=${identityCount.data?.length}`}`);
    expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: "x".repeat(24) }) }), 404, "wrong secret");
    const tracked = expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "valid tracking").tracking;
    if (!tracked) throw new Error("tracking vazio");
    const caseRow = value(await db.from("integrity_cases").select("id,status,lock_version,owner_membership_id,committee_id,first_response_due_at,treatment_due_at").eq("report_id", report.id).single(), "case created");
    if (caseRow.owner_membership_id !== assignedInvestigator.membershipId || caseRow.committee_id !== committee.id) throw new Error("roteamento automático não aplicado");
    evidence.routing = true;
    expect(await workspace(`/cases/${caseRow.id}`, {}, adminB, tenantB.id), 404, "cross tenant case");
    expect(await workspace(`/cases/${caseRow.id}`, {}, blocked, tenantA.id), 403, "permission denied");
    expect(await workspace(`/cases/${caseRow.id}`, {}, unassignedInvestigator, tenantA.id), 404, "unassigned investigator denied");
    expect(await workspace(`/cases/${caseRow.id}`, {}, assignedInvestigator, tenantA.id), 200, "assigned investigator read");
    expect(await workspace(`/cases/${caseRow.id}`, {}, compliance, tenantA.id), 200, "compliance read");
    expect(await workspace(`/cases/${caseRow.id}/identity`, {}, assignedInvestigator, tenantA.id), 403, "investigator identity denied");
    const rlsClient = (user: FixtureUser) => createClient(SUPABASE_URL, PUBLISHABLE, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${user.token}` } },
    });
    const assignedRows = value(await rlsClient(assignedInvestigator).from("integrity_cases").select("id").eq("id", caseRow.id), "RLS assigned investigator");
    if (assignedRows.length !== 1) throw new Error("RLS não liberou caso atribuído ao investigador");
    const unassignedRows = value(await rlsClient(unassignedInvestigator).from("integrity_cases").select("id").eq("id", caseRow.id), "RLS unassigned investigator");
    if (unassignedRows.length !== 0) throw new Error("RLS liberou caso não atribuído ao investigador");
    const crossTenantRows = value(await rlsClient(adminB).from("integrity_cases").select("id").eq("id", caseRow.id), "RLS cross tenant");
    if (crossTenantRows.length !== 0) throw new Error("RLS liberou caso para outro tenant");
    const protectedIdentityRows = value(await rlsClient(assignedInvestigator).from("integrity_report_identities").select("report_id").eq("report_id", report.id), "RLS protected identity");
    if (protectedIdentityRows.length !== 0) throw new Error("RLS expôs identidade ao investigador");
    evidence.rlsAssigned = true;
    evidence.rlsUnassignedDenied = true;
    evidence.rlsCrossTenantDenied = true;
    evidence.rlsIdentityDenied = true;
    expect(await workspace(`/settings/committees/${committee.id}`, { method: "PATCH", body: JSON.stringify({ name: "Comitê de Ética", description: "Comitê do piloto", member_ids: [assignedInvestigator.membershipId], active: false, status: "inactive" }) }), 409, "committee orphan protection");
    expect(await workspace(`/settings/committees/${committee.id}`, { method: "PATCH", body: JSON.stringify({ name: "Comitê de Ética e Conduta", description: "Comitê do piloto", member_ids: [assignedInvestigator.membershipId, unassignedInvestigator.membershipId], active: true, status: "active" }) }), 200, "committee update");
    expect(await workspace(`/cases/${caseRow.id}`, {}, unassignedInvestigator, tenantA.id), 200, "committee investigator read");
    expect(await workspace(`/settings/routing/${routing.id}`, { method: "PATCH", body: JSON.stringify({ name: "Rota piloto atualizada", category_id: category.id, unit_id: unit.id, assignee_membership_id: assignedInvestigator.membershipId, committee_id: committee.id, priority: 2, active: true, is_fallback: false, status: "active" }) }), 200, "routing update");
    const channelTest = expect(await workspace("/settings/channel-test", { method: "POST", body: "{}" }), 200, "channel readiness test");
    if (channelTest.slug !== channelSlug || !channelTest.tested_at) throw new Error("teste do canal não persistido");
    const configured = expect(await workspace("/settings"), 200, "configuration checklist");
    if (configured.configuration_status?.operational !== true) throw new Error("checklist de configuração não operacional");
    expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "closed", reason: "inválida", lock_version: caseRow.lock_version }) }), 409, "invalid transition");
    let transition = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "triage", lock_version: caseRow.lock_version }) }, assignedInvestigator), 200, "triage by investigator");
    transition = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "investigation", lock_version: transition.lock_version }) }, assignedInvestigator), 200, "investigation by investigator");
    expect(await workspace(`/cases/${caseRow.id}/decision`, { method: "POST", body: JSON.stringify({ final_classification: "Teste", conclusion: "Conclusão bloqueada", measures_taken: "Nenhuma medida", internal_justification: "Sem permissão", lock_version: transition.lock_version }) }, assignedInvestigator), 403, "investigator close denied");
    expect(await workspace(`/cases/${caseRow.id}/recommendation`, { method: "POST", body: JSON.stringify({ recommendation: "Recomenda-se análise conclusiva pelo compliance.", justification: "Evidências revisadas pelo investigador atribuído." }) }, assignedInvestigator), 201, "investigator recommendation");
    expect(await workspace(`/cases/${caseRow.id}/conflicts`, { method: "POST", body: JSON.stringify({ membership_id: blocked.membershipId, reason: "Pessoa relacionada ao relato" }) }), 201, "conflict");
    expect(await workspace(`/cases/${caseRow.id}/assignments`, { method: "POST", body: JSON.stringify({ membership_id: blocked.membershipId, reason: "Tentativa bloqueada" }) }), 409, "conflicted assignment");
    expect(await workspace(`/cases/${caseRow.id}/assignments`, { method: "POST", body: JSON.stringify({ membership_id: adminA.membershipId, reason: "Responsável confirmado" }) }), 201, "assignment");
    const task = expect(await workspace(`/cases/${caseRow.id}/tasks`, { method: "POST", body: JSON.stringify({ title: "Validar evidências", assignee_membership_id: assignedInvestigator.membershipId, due_at: new Date(Date.now() - 3600000).toISOString(), priority: "high" }) }, assignedInvestigator), 201, "task").task;
    const overdue = expect(await workspace(`/cases/${caseRow.id}/tasks?overdue=true`, {}, assignedInvestigator), 200, "overdue tasks").tasks;
    if (!overdue.some((item: any) => item.id === task.id)) throw new Error("tarefa vencida ausente");
    expect(await workspace(`/cases/${caseRow.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: "done", reason: "Investigação concluída" }) }, assignedInvestigator), 200, "task done");
    expect(await workspace(`/cases/${caseRow.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: "open", reason: "Complementação necessária" }) }, assignedInvestigator), 200, "task reopen");
    expect(await workspace(`/cases/${caseRow.id}/messages`, { method: "POST", body: JSON.stringify({ body: "Nota interna confidencial E2E", visible_to_reporter: false }) }, assignedInvestigator), 201, "internal note");
    expect(await workspace(`/cases/${caseRow.id}/messages`, { method: "POST", body: JSON.stringify({ body: "Mensagem pública do comitê E2E", visible_to_reporter: true }) }, assignedInvestigator), 201, "public message");
    expect(await publicApi("/messages", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret, body: "Complemento do denunciante E2E" }) }), 201, "reporter message");
    const trackingMessages = expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "tracking messages").tracking;
    const serialized = JSON.stringify(trackingMessages);
    if (!serialized.includes("Mensagem pública do comitê E2E") || serialized.includes("Nota interna confidencial E2E")) throw new Error("fronteira mensagem pública/interna violada");

    const pdf = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"));
    const evidenceUpload = expect(await workspace(`/cases/${caseRow.id}/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-file-name": "evidencia.pdf", "x-visible-to-reporter": "true" }, body: pdf }, assignedInvestigator), 201, "workspace evidence");
    expect(await workspace(`/cases/${caseRow.id}/evidence`, { method: "POST", headers: { "content-type": "application/x-msdownload", "x-file-name": "malware.exe" }, body: new Uint8Array([1, 2, 3]) }, assignedInvestigator), 415, "invalid mime");
    const signed = expect(await workspace(`/cases/${caseRow.id}/evidence/${evidenceUpload.id}/url`, { method: "POST" }, assignedInvestigator), 200, "signed URL");
    if (signed.expires_in !== 120 || (await fetch(signed.url)).status !== 200) throw new Error("signed URL inválida");
    expect(await workspace(`/cases/${caseRow.id}/evidence/${evidenceUpload.id}/url`, { method: "POST" }, adminB, tenantB.id), 404, "cross tenant evidence");
    const publicUpload = expect(await publicApi("/attachments", { method: "POST", headers: { "content-type": "application/pdf", "x-file-name": "complemento.pdf", "x-integrity-protocol": submitted.protocol, "x-integrity-secret": submitted.access_secret }, body: pdf }), 201, "public evidence");
    const publicSigned = expect(await publicApi(`/attachments/${publicUpload.id}/url`, { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "public signed URL");
    if ((await fetch(publicSigned.url)).status !== 200) throw new Error("public signed URL inválida");

    const directList = await fetch(`${SUPABASE_URL}/storage/v1/object/list/ordum-integrity`, { method: "POST", headers: { apikey: PUBLISHABLE, authorization: `Bearer ${PUBLISHABLE}`, "content-type": "application/json" }, body: JSON.stringify({ prefix: tenantA.id, limit: 100 }) });
    const directObjects = await directList.json().catch(() => []);
    if (directList.ok && Array.isArray(directObjects) && directObjects.length > 0) throw new Error("enumeração pública do bucket permitida");
    transition = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "decision", lock_version: transition.lock_version }) }), 200, "decision transition");
    const closed = expect(await workspace(`/cases/${caseRow.id}/decision`, { method: "POST", body: JSON.stringify({ final_classification: "Procedente", conclusion: "Conclusão interna confidencial E2E", measures_taken: "Providências internas E2E", internal_justification: "Fundamentação interna confidencial E2E", reporter_outcome: "Tratamento concluído e providências adotadas.", lock_version: transition.lock_version }) }), 200, "decision close");
    const afterClose = expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "closed tracking").tracking;
    const closedJson = JSON.stringify(afterClose);
    if (!closedJson.includes("Tratamento concluído") || closedJson.includes("Conclusão interna confidencial") || closedJson.includes("Fundamentação interna")) throw new Error("decisão interna vazou no canal público");
    expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "reopened", reason: "Tentativa sem alçada", lock_version: closed.lock_version }) }, assignedInvestigator), 403, "investigator reopen denied");
    const reopened = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "reopened", reason: "Nova evidência recebida", lock_version: closed.lock_version }) }), 200, "reopen");
    if (reopened.status !== "reopened") throw new Error("reabertura não persistida");
    const timeline = expect(await workspace(`/cases/${caseRow.id}/timeline`), 200, "timeline").events;
    for (const event of ["report_received", "routed", "task_created", "task_completed", "task_reopened", "decision_recorded", "status_changed"]) {
      if (!timeline.some((item: any) => item.event_type === event)) throw new Error(`timeline sem ${event}`);
    }
    const summary = expect(await request(`/api/admin/clients/${tenantA.id}/integrity-summary`, {}, adminA.token), 200, "admin summary");
    const forbiddenKeys = ["description", "identity", "messages", "evidence", "conclusion", "notes"];
    if (summary.confidentiality_boundary !== "aggregate_only" || forbiddenKeys.some((key) => Object.hasOwn(summary, key))) throw new Error("control plane expôs data plane");
    const dashboard = expect(await workspace("/dashboard"), 200, "dashboard");
    if (!dashboard.updated_at || !Array.isArray(dashboard.by_category) || !Array.isArray(dashboard.evolution)) throw new Error("dashboard operacional incompleto");
    const filtered = expect(await workspace(`/cases?category_id=${category.id}&unit_id=${unit.id}&committee_id=${committee.id}&page=1&limit=1&order=created_at&direction=desc`), 200, "combined filters and pagination");
    if (filtered.total < 1 || filtered.cases.length !== 1 || filtered.total_pages < 1) throw new Error("filtros/paginação não retornaram o caso esperado");
    const exported = await workspace(`/cases/export.csv?category_id=${category.id}`);
    expect(exported, 200, "cases CSV export");
    if (!exported.headers.get("content-type")?.includes("text/csv")) throw new Error("exportação de listagem não retornou CSV");
    const reportExport = await workspace(`/cases/${caseRow.id}/report.csv`);
    expect(reportExport, 200, "case report CSV export");
    if (!reportExport.headers.get("content-disposition")?.includes("integrity-")) throw new Error("relatório individual sem nome de arquivo");
    const auditRows = value(await db.from("platform_audit_logs").select("action").eq("metadata->>tenant_id", tenantA.id).in("action", ["integrity.cases.exported", "integrity.case_report.exported", "integrity.channel.tested"]), "integrity audit");
    if (new Set(auditRows.map((row: any) => row.action)).size !== 3) throw new Error("auditoria de governança incompleta");

    let limited = false;
    const fakeProtocol = `BAD-${crypto.randomBytes(6).toString("hex")}`;
    for (let i = 0; i < 21; i += 1) {
      const attempt = await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: fakeProtocol, secret: "x".repeat(24) }) });
      if (attempt.status === 429) { limited = true; evidence.rateLimitAttempt = i + 1; break; }
      if (attempt.status !== 404) throw new Error(`rate limit tentativa ${i + 1}: HTTP ${attempt.status}`);
    }
    if (!limited) throw new Error("rate limit persistente não bloqueou");
    Object.assign(evidence, { anonymous: true, identified: true, tenantIsolation: true, rbac: true, assignedInvestigator: true, committeeScope: true, compliance: true, protectedIdentity: true, configurationLifecycle: true, routingPreview: true, orphanProtection: true, conflict: true, storagePrivate: true, signedUrls: true, tasks: true, messagesBoundary: true, recommendation: true, decision: true, reopen: true, adminAggregateOnly: true, dashboard: true, channelReadiness: true, filtersPagination: true, exportsAudited: true });
  } catch (error) {
    primaryError = error;
  } finally {
    try { await cleanup(db, runId, tenantIds, userIds, platformUser); evidence.cleanup = true; evidence.residualTenants = 0; evidence.residualAuth = 0; }
    catch (cleanupError: any) { if (primaryError) throw new AggregateError([primaryError, cleanupError], "E2E e cleanup falharam"); throw cleanupError; }
  }
  if (primaryError) throw primaryError;
  return evidence;
}

if (process.env.RUN_LIVE_E2E !== "1") {
  console.log("SKIP: defina RUN_LIVE_E2E=1 para executar o E2E real do Integridade.");
} else {
  runIntegrityE2E().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
