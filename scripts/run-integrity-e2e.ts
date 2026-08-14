import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.APP_URL || "https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app").replace(/\/$/, "");
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

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
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/pdf")
    ? Buffer.from(await response.arrayBuffer())
    : contentType.includes("text/csv")
      ? await response.text()
      : await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
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

async function cleanup(db: SupabaseClient, runId: string, tenantIds: string[], users: string[], platformUsers: string[] = []) {
  const errors: string[] = [];
  try { await removeStorage(db, tenantIds); } catch (error: any) { errors.push(error.message); }
  for (const platformUser of platformUsers) {
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

async function runBrowserQa(scenarios: Array<{ name: string; user: FixtureUser; expectedCase: boolean; mobile?: boolean; settings?: boolean }>, subject: string) {
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  await mkdir("tmp/product-recovery", { recursive: true });
  try {
    for (const scenario of scenarios) {
      const context = await browser.newContext({ viewport: scenario.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, acceptDownloads: true });
      const page = await context.newPage();
      page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) failures.push(`${scenario.name}: console ${message.text().slice(0, 120)}`); });
      page.on("response", (response) => { const url=new URL(response.url()); if (url.origin===new URL(APP_URL).origin&&response.status() >= 400) failures.push(`${scenario.name}: HTTP ${response.status()} ${url.pathname}`); });
      await page.goto(`${APP_URL}/#/login`, { waitUntil: "networkidle" });
      await page.locator('input[type="email"]').fill(scenario.user.email);
      await page.locator('input[type="password"]').fill(scenario.user.password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/#\/(workspace|admin)/, { timeout: 20000 });
      await page.evaluate(() => { window.location.hash = "#/workspace/integridade"; });
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Ordum Integridade", exact: true }).waitFor();
      const casesButton = page.locator('nav[aria-label] button').filter({ hasText: "Casos" });
      try { await casesButton.click({ timeout: 15000 }); } catch (error) { const visible=(await page.locator("body").innerText()).replace(/\s+/g," ").slice(0,600); throw new Error(`${scenario.name}: navegação de casos indisponível (${visible}); ${String(error)}`); }
      if (scenario.expectedCase) {
        try {
          await page.getByText(subject, { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 15000 });
        } catch {
          const visible = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
          throw new Error(`${scenario.name}: caso esperado ausente na interface (${visible})`);
        }
        if (!scenario.mobile && scenario.settings) {
          const exportButton = page.getByRole("button", { name: "Exportar", exact: true });
          await exportButton.click();
          await exportButton.waitFor({ state: "visible" });
        }
        await page.screenshot({ path: `tmp/product-recovery/${scenario.name}-cases.png`, fullPage: true });
        await page.getByText(subject, { exact: true }).filter({ visible: true }).first().click();
        await page.getByRole("heading", { name: subject, exact: true }).waitFor();
        for (const tabName of ["Visão geral", "Investigação", "Comunicação", "Evidências", "Histórico"]) {
          await page.getByRole("button", { name: tabName, exact: true }).waitFor();
        }
        await page.screenshot({ path: `tmp/product-recovery/${scenario.name}-case-detail.png`, fullPage: true });
      } else {
        await page.getByText(/Nenhum caso nesta visão/).waitFor();
      }
      if (scenario.settings) {
        await page.evaluate(() => { window.location.hash = "#/workspace/integridade"; });
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Configurações" }).click();
        await page.getByRole("heading", { name: "Prepare o canal para sua empresa" }).waitFor();
        await page.getByRole("button", { name: "Primeiros passos" }).click();
        await page.getByRole("heading", { name: /Seu canal está pronto|Prepare seu canal com segurança/ }).waitFor();
        await page.getByText(/etapas · 100%/).waitFor();
        await page.getByRole("button", { name: "Testar canal" }).click();
        await page.getByText(/Teste concluído/).waitFor();
        await page.screenshot({ path: `tmp/product-recovery/${scenario.name}-settings.png`, fullPage: true });
      } else if (await page.getByRole("button", { name: "Configurações" }).count()) {
        failures.push(`${scenario.name}: configurações expostas sem permissão`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  if (failures.length) throw new Error(`browser QA: ${failures.join("; ")}`);
}

async function runInternalUiFlow(user: FixtureUser, subject: string) {
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) failures.push(`console ${message.text().slice(0,120)}`); });
    page.on("response", (response) => { const url=new URL(response.url()); if(url.origin===new URL(APP_URL).origin&&response.status() >= 400) failures.push(`HTTP ${response.status()} ${url.pathname}`); });
    await page.goto(`${APP_URL}/#/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(user.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/#\/(workspace|admin)/, { timeout: 20000 });
    await page.evaluate(() => { window.location.hash = "#/workspace/integridade"; });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('nav[aria-label] button').filter({ hasText: "Casos" }).click();
    await page.getByText(subject, { exact: true }).first().click();
    await page.getByRole("heading", { name: subject, exact: true }).waitFor();
    const transition = async (label:string) => {
      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/transitions") && response.request().method() === "POST" && response.status() === 200),
        page.getByRole("button", { name: label, exact: true }).click(),
      ]);
      await page.getByText("Etapa do caso atualizada.", { exact: true }).waitFor();
    };
    await transition("Iniciar triagem");
    await transition("Iniciar investigação");
    await page.getByRole("button", { name: "Investigação", exact: true }).click();
    await page.getByPlaceholder("Título da nova tarefa").fill("Validar informações recebidas");
    await page.getByPlaceholder("Descrição e critério de conclusão").fill("Revisar o relato e registrar os pontos relevantes para a decisão.");
    await page.getByRole("button", { name: "Criar tarefa", exact: true }).click();
    await page.getByText("Tarefa criada.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Comunicação", exact: true }).click();
    await page.getByPlaceholder("Escreva uma mensagem clara para o denunciante acompanhar seu protocolo...").fill("Recebemos seu complemento e a apuração foi iniciada.");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar envio", exact: true }).click();
    await page.getByText("Mensagem enviada ao denunciante.", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Notas da equipe", exact: true }).click();
    await page.getByPlaceholder("Registre uma nota técnica ou observação interna confidencial para a equipe...").fill("Nota interna criada pela homologação de interface; não deve aparecer no portal público.");
    await page.getByRole("button", { name: "Salvar nota privada", exact: true }).click();
    await page.getByText("Nota privada registrada.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Evidências", exact: true }).click();
    await page.getByLabel("Selecionar evidência").setInputFiles({ name:"evidencia-qa.txt", mimeType:"text/plain", buffer:Buffer.from("Evidência descartável da homologação Ordum") });
    await page.getByPlaceholder("Descreva por que este arquivo é relevante (opcional)").fill("Arquivo descartável da homologação pelo navegador.");
    await page.getByRole("button", { name: "Adicionar evidência", exact: true }).click();
    await page.getByText("Evidência adicionada com segurança.", { exact: true }).waitFor();
    await transition("Registrar decisão");
    await page.getByRole("button", { name: "Visão geral", exact: true }).click();
    const decision = page.locator("section").filter({ hasText: "Decisão e encerramento" }).first();
    await decision.getByLabel("Resultado").selectOption("substantiated");
    await decision.getByLabel("Resumo da conclusão").fill("Os fatos relatados foram confirmados após a apuração.");
    await decision.getByLabel("Medidas adotadas").fill("Foram definidas medidas internas proporcionais e acompanhamento preventivo.");
    await decision.getByLabel("Fundamentação interna").fill("Fundamentação restrita registrada exclusivamente para a equipe autorizada.");
    await decision.getByLabel(/Mensagem final ao denunciante/).fill("A apuração foi concluída e as providências cabíveis foram avaliadas.");
    for (const checkbox of await decision.locator('input[type="checkbox"]').all()) await checkbox.check();
    await decision.getByRole("button", { name: "Encerrar caso", exact: true }).click();
    await page.getByText("Decisão registrada e caso encerrado.", { exact: true }).waitFor();
    await page.getByPlaceholder("Motivo, quando necessário").fill("Nova informação recebida após o encerramento.");
    await transition("Reabrir caso");
    await page.screenshot({ path:"tmp/product-recovery/integrity-complete-ui-flow.png", fullPage:true });
    await context.close();
  } finally { await browser.close(); }
  if (failures.length) throw new Error(`internal UI flow: ${failures.join("; ")}`);
}

async function runAdminProductQa(user:FixtureUser,tenantId:string,tenantName:string){
  const browser=await chromium.launch({headless:true});
  const failures:string[]=[];
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
    page.on("console",message=>{if(message.type()==="error"&&!message.text().includes("Failed to load resource"))failures.push(`admin console ${message.text().slice(0,120)}`);});
    page.on("response",response=>{const url=new URL(response.url());if(url.origin===new URL(APP_URL).origin&&response.status()>=400)failures.push(`admin HTTP ${response.status()} ${url.pathname}`);});
    await page.goto(`${APP_URL}/#/login`,{waitUntil:"networkidle"});await page.locator('input[type="email"]').fill(user.email);await page.locator('input[type="password"]').fill(user.password);await page.locator('button[type="submit"]').click();await page.waitForURL(/#\/(workspace|admin)/,{timeout:20000});
    await page.evaluate(()=>{window.location.hash="#/admin";});await page.reload({waitUntil:"networkidle"});await page.getByRole("heading",{name:"Veja o que precisa da sua atenção."}).waitFor();
    for(const label of ["Comercial","Clientes","Financeiro","Operação","Administração"])await page.getByText(new RegExp(`^${label}$`,"i")).first().waitFor();
    await page.screenshot({path:"tmp/product-recovery/admin-dashboard.png",fullPage:true});
    await page.evaluate(id=>{window.location.hash=`#/admin/empresas/${id}`;},tenantId);await page.reload({waitUntil:"networkidle"});await page.getByRole("heading",{name:tenantName,exact:true}).waitFor();await page.getByRole("button",{name:"Resumo",exact:true}).waitFor();await page.getByRole("button",{name:"Produtos",exact:true}).click();await page.getByRole("heading",{name:"Produtos contratados"}).waitFor();
    const visible=(await page.locator("body").innerText()).toLowerCase();for(const forbidden of ["tenant_id","membership","entitlement","control plane","aggregate_only","correlation id","uuid","service_role"])if(visible.includes(forbidden))failures.push(`empresa expôs termo técnico: ${forbidden}`);
    await page.screenshot({path:"tmp/product-recovery/admin-company-products.png",fullPage:true});await context.close();
  }finally{await browser.close();}
  if(failures.length)throw new Error(`admin product QA: ${failures.join("; ")}`);
}

async function runPublicMobileQa(channelSlug: string, protocol: string, secret: string) {
  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") failures.push(`console ${message.text().slice(0, 120)}`); });
    page.on("response", (response) => { const url=new URL(response.url()); if(url.origin===new URL(APP_URL).origin&&response.status() >= 500) failures.push(`HTTP ${response.status()} ${url.pathname}`); });
    await page.goto(`${APP_URL}/#/canal/${channelSlug}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Canal de Integridade/ }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) failures.push("overflow horizontal no canal mobile");
    await page.getByRole("button", { name: "Fazer um relato", exact: true }).click();
    await page.getByLabel("Categoria").selectOption({ index: 1 });
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('[aria-label^="Etapa 2:"]').waitFor();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('[aria-label^="Etapa 3:"]').waitFor();
    await page.getByLabel("Assunto").fill("Relato enviado integralmente pela interface");
    await page.getByLabel("Descrição detalhada").fill("Descrição suficiente para comprovar, pelo navegador, o envio seguro de um relato anônimo descartável.");
    await page.getByLabel("Local detalhado").fill("Área comum da unidade");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('[aria-label^="Etapa 4:"]').waitFor();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('[aria-label^="Etapa 5:"]').waitFor();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator('[aria-label^="Etapa 6:"]').waitFor();
    const submitReport = page.locator('form button[type="submit"]', { hasText: "Enviar relato" });
    if (await submitReport.count() !== 1) throw new Error(`CTA final do relato ausente: ${(await page.locator("body").innerText()).replace(/\s+/g," ").slice(0,900)}`);
    await submitReport.click();
    await page.getByRole("heading", { name: "Relato recebido", exact: true }).waitFor();
    await page.getByRole("button", { name: "Copiar dados", exact: true }).waitFor();
    await page.getByRole("button", { name: "Baixar comprovante", exact: true }).waitFor();
    await page.screenshot({ path: "tmp/product-recovery/public-report-receipt-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Acompanhar agora", exact: true }).click();
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await page.getByRole("heading", { name: "Seu relato", exact: true }).waitFor();
    await page.getByLabel("Complementar informações").fill("Complemento enviado pela interface pública descartável.");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.getByText("Complemento enviado pela interface pública descartável.", { exact: true }).waitFor();
    await page.screenshot({ path: "tmp/product-recovery/public-tracking-mobile.png", fullPage: true });
    await page.goto(`${APP_URL}/#/canal/${channelSlug}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Acompanhar relato", exact: true }).click();
    await page.getByLabel("Protocolo").fill(protocol);
    await page.getByLabel("Chave de acompanhamento").fill(secret);
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await page.getByText(protocol, { exact: true }).waitFor();
    await page.getByText("Recebido", { exact: true }).waitFor();
    await context.close();
  } finally {
    await browser.close();
  }
  if (failures.length) throw new Error(`public mobile QA: ${failures.join("; ")}`);
}

export async function runIntegrityE2E(): Promise<Evidence> {
  must(SUPABASE_URL, "SUPABASE_URL"); must(SECRET, "SUPABASE_SECRET_KEY"); must(PUBLISHABLE, "VITE_SUPABASE_PUBLISHABLE_KEY"); if(process.env.SKIP_INTEGRITY_SCHEDULER!=="1")must(CRON_SECRET,"CRON_SECRET");
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
  const platformUsers: string[] = [];
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
    value(await db.from("platform_members").insert({ user_id: adminB.id, role_id: platformRole.id, status: "active", relationship_type: "partner" }).select("id").single(), "platform cross-tenant fixture");
    platformUsers.push(adminA.id,adminB.id);
    const workspace = (path: string, options?: RequestInit, user = adminA, tenant = tenantA.id) => request(`/api/workspace/integrity${path}`, options, user.token, tenant);
    const publicApi = (path: string, options?: RequestInit) => request(`/api/public/integrity${path}`, options);

    expect(await workspace("/settings", { method: "PUT", body: JSON.stringify({ introduction: "Canal seguro para o teste funcional descartável da Ordum.", instructions: "Descreva os fatos com clareza.", allows_anonymous: true, allows_identified: true, default_sla_hours: 12, treatment_sla_hours: 48, alert_lead_hours: 6, stale_case_hours: 72, automatic_acknowledgement: "Seu relato foi recebido com segurança.", branding: { accent: "#3457D5" }, attachment_policy: { enabled: true, max_files: 3, max_size_mb: 2 }, communication_policy: { allow_reporter_messages: true, allow_case_messages: true }, routing_rules: [], retention_days: 365, evidence_retention_days: 730, message_retention_days: 365, post_closure_action: "archive", anonymization_enabled: false }) }), 200, "settings");
    const template = expect(await workspace("/settings/templates", { method: "POST", body: JSON.stringify({ template_type: "task", name: "Validar evidência", title: "Validar evidência recebida", body: "Conferir autenticidade, origem e integridade do arquivo antes da conclusão.", active: true }) }), 201, "task template").template;
    expect(await workspace("/settings/templates", { method: "POST", body: JSON.stringify({ template_type: "reporter_message", name: "Atualização segura", body: "Seu relato recebeu uma atualização. Acesse o canal com protocolo e chave.", active: true }) }), 201, "reporter template");
    expect(await workspace("/settings/templates", { method: "POST", body: JSON.stringify({ template_type: "information_request", name: "Solicitar complemento", body: "Precisamos de informações adicionais. Responda pelo acompanhamento seguro.", active: true }) }), 201, "information request template");
    const investigatorTemplates = expect(await workspace("/settings/templates", {}, assignedInvestigator), 200, "investigator templates").templates;
    if (!investigatorTemplates.some((item: any) => item.id === template.id)) throw new Error("template tenant-scoped não disponível ao investigador");
    const category = expect(await workspace("/settings/categories", { method: "POST", body: JSON.stringify({ name: "Assédio", slug: `assedio-${suffix}`, default_risk_level: "high", sla_hours: 12, active: true }) }), 201, "category").category;
    const unit = expect(await workspace("/settings/units", { method: "POST", body: JSON.stringify({ name: "Matriz Piloto", code: `U-${suffix}`, is_headquarters:true, responsible_membership_id:adminA.membershipId, active: true }) }), 201, "unit").unit;
    const branch = expect(await workspace("/settings/units", { method: "POST", body: JSON.stringify({ name: "Filial Sul", code: `F-${suffix}`, active: true }) }), 201, "branch").unit;
    const department = expect(await workspace("/settings/departments", { method: "POST", body: JSON.stringify({ unit_id: unit.id, name: "Operações", code: `OP-${suffix}`, responsible_membership_id: assignedInvestigator.membershipId, active: true }) }), 201, "department").department;
    expect(await workspace("/settings/departments", { method: "POST", body: JSON.stringify({ unit_id: branch.id, name: "Administrativo", code: `ADM-${suffix}`, active: true }) }), 201, "branch department");
    const committee = expect(await workspace("/settings/committees", { method: "POST", body: JSON.stringify({ name: "Comitê de Ética", member_ids: [assignedInvestigator.membershipId], active: true }) }), 201, "committee").committee;
    const routing = expect(await workspace("/settings/routing", { method: "POST", body: JSON.stringify({ name: "Rota piloto", category_id: category.id, unit_id: unit.id, department_id: department.id, severity: "high", reporter_mode: "anonymous", requires_conflict:false, assignee_membership_id: assignedInvestigator.membershipId, committee_id: committee.id, collaborator_ids: [compliance.membershipId], target_sla_hours: 36, target_priority: "urgent", escalation_committee_id:committee.id, priority: 1, active: true, is_fallback: false }) }), 201, "routing").routing_rule;
    expect(await workspace("/settings/routing", { method: "POST", body: JSON.stringify({ name: "Rota conflitante", category_id: category.id, unit_id: unit.id, department_id:department.id, severity:"high", reporter_mode:"anonymous", requires_conflict:false, assignee_membership_id: adminA.membershipId, priority: 1, active: true, is_fallback: false }) }), 409, "routing conflict");
    expect(await workspace("/settings/routing", { method: "POST", body: JSON.stringify({ name: "Escalonamento por conflito", category_id: category.id, unit_id: unit.id, committee_id:committee.id, requires_conflict:true, escalation_membership_id:adminA.membershipId, escalation_committee_id:committee.id, priority:2, active:true, is_fallback:false }) }),201,"conflict escalation rule");
    const preview = expect(await workspace("/settings/routing/preview", { method: "POST", body: JSON.stringify({ category_id: category.id, unit_id: unit.id, department_id: department.id, severity:"high", reporter_mode:"anonymous", has_conflict:false }) }), 200, "routing preview");
    if (preview.selected?.id !== routing.id || preview.deterministic !== true) throw new Error("preview de roteamento não determinístico");
    const channelSlug = `canal-${suffix}`;
    expect(await workspace("/settings/channels", { method: "POST", body: JSON.stringify({ name: "Canal E2E", public_title: "Canal de Integridade", public_slug: channelSlug, active: false, allows_anonymous: true, allows_identified: true, privacy_notice:"Os dados são tratados conforme a política interna do tenant.", confirmation_message:"Relato registrado com segurança." }) }), 201, "channel");
    expect(await workspace("/settings/custom-fields", { method: "POST", body: JSON.stringify({ field_key:"local_detalhado",label:"Local detalhado",field_type:"short_text",required:true,options:[],active:true,sort_order:1 }) }), 201, "custom field");
    expect(await publicApi(`/channels/${channelSlug}`), 404, "unpublished channel denied");
    const channelTest = expect(await workspace("/settings/channel-test", { method: "POST", body: "{}" }), 200, "channel readiness test");
    expect(await workspace("/settings/channel-publish", { method:"POST", body:"{}" }),200,"channel publish");
    const deployment=expect(await workspace("/deployment"),200,"deployment wizard");
    if(deployment.state!=="published"||deployment.total<14||!deployment.steps.some((item:any)=>item.key==="integrity_departments"&&item.complete))throw new Error("wizard did not synchronize deployment structure");
    if ((channelTest.slug || channelTest.public_slug) !== channelSlug || !channelTest.tested_at) throw new Error("teste do canal não persistido");
    const channel = expect(await publicApi(`/channels/${channelSlug}`), 200, "public channel").channel;
    if (!channel.categories?.length || !channel.units?.length || !channel.departments?.length || !channel.custom_fields?.length || !channel.privacy_notice || !channel.confirmation_message) throw new Error("canal sem estrutura/campos/textos configurados");

    const reportBody = { channel_slug: channelSlug, category_slug: category.slug, reporter_mode: "anonymous", subject: "Relato funcional descartável", description: "Descrição detalhada suficiente para validar o fluxo operacional completo sem dados reais.", occurred_at: new Date().toISOString().slice(0, 10), unit_id: unit.id, department_id: department.id, custom_fields: { local_detalhado: "Sala de reunião E2E" } };
    const submitted = expect(await publicApi("/reports", { method: "POST", body: JSON.stringify(reportBody) }), 201, "anonymous report");
    if (!submitted.protocol || !submitted.access_secret || submitted.access_secret.length < 24) throw new Error("protocolo/segredo ausente");
    evidence.reportHttp = 201;
    const report = value(await db.from("integrity_reports").select("id,reporter_mode").eq("protocol", submitted.protocol).single(), "report stored");
    const customStored=value(await db.from("integrity_report_custom_values").select("text_value").eq("report_id",report.id).single(),"custom value");
    if(customStored.text_value!=="Sala de reunião E2E")throw new Error("campo tipado não persistido");
    const secret = value(await db.from("integrity_report_secrets").select("secret_hash").eq("report_id", report.id).single(), "secret stored");
    if (!secret.secret_hash || secret.secret_hash === submitted.access_secret) throw new Error("segredo não foi armazenado como hash");
    const identified = expect(await publicApi("/reports", { method: "POST", body: JSON.stringify({ ...reportBody, subject: "Relato identificado descartável", reporter_mode: "identified", identity: { name: "Pessoa E2E", email: `${runId}@ordum-test.internal` } }) }), 201, "identified report");
    const identifiedReport = value(await db.from("integrity_reports").select("id").eq("protocol", identified.protocol).single(), "identified stored");
    const identityCount = await db.from("integrity_report_identities").select("report_id").eq("report_id", identifiedReport.id);
    if (identityCount.error || identityCount.data?.length !== 1) throw new Error(`identidade separada não persistida: ${identityCount.error?.message || `count=${identityCount.data?.length}`}`);
    expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: "x".repeat(24) }) }), 404, "wrong secret");
    const tracked = expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "valid tracking").tracking;
    if (!tracked) throw new Error("tracking vazio");
    await runPublicMobileQa(channelSlug, submitted.protocol, submitted.access_secret);
    evidence.publicMobileQa = true;
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
    const collaborator = expect(await workspace(`/cases/${caseRow.id}/collaborators`, { method: "POST", body: JSON.stringify({ membership_id: unassignedInvestigator.membershipId, role: "investigator", reason: "Apoio temporário à apuração" }) }), 201, "add collaborator").collaborator;
    expect(await workspace(`/cases/${caseRow.id}`, {}, unassignedInvestigator, tenantA.id), 200, "collaborator case access");
    const collaboratorRls = value(await rlsClient(unassignedInvestigator).from("integrity_cases").select("id").eq("id", caseRow.id), "RLS collaborator");
    if (collaboratorRls.length !== 1) throw new Error("RLS não liberou investigador adicional ativo");
    expect(await workspace(`/cases/${caseRow.id}/collaborators/${collaborator.id}`, { method: "DELETE", body: JSON.stringify({ reason: "Participação temporária encerrada" }) }), 200, "remove collaborator");
    expect(await workspace(`/cases/${caseRow.id}`, {}, unassignedInvestigator, tenantA.id), 404, "removed collaborator denied");
    evidence.collaboratorScope = true;
    await runBrowserQa([
      { name: "tenant_admin_desktop", user: adminA, expectedCase: true, settings: true },
      { name: "compliance_desktop", user: compliance, expectedCase: true, settings: true },
      { name: "investigator_assigned_mobile", user: assignedInvestigator, expectedCase: true, mobile: true },
      { name: "investigator_unassigned_desktop", user: unassignedInvestigator, expectedCase: false },
    ], reportBody.subject);
    await runInternalUiFlow(compliance,"Relato enviado integralmente pela interface");
    await runAdminProductQa(adminA,tenantA.id,`Integrity E2E A ${suffix}`);
    evidence.browserQa = true;
    evidence.internalUiFlow = true;
    evidence.adminProductQa = true;
    expect(await workspace(`/settings/committees/${committee.id}`, { method: "PATCH", body: JSON.stringify({ name: "Comitê de Ética", description: "Comitê do piloto", member_ids: [assignedInvestigator.membershipId], active: false, status: "inactive" }) }), 409, "committee orphan protection");
    expect(await workspace(`/settings/committees/${committee.id}`, { method: "PATCH", body: JSON.stringify({ name: "Comitê de Ética e Conduta", description: "Comitê do piloto", member_ids: [assignedInvestigator.membershipId, unassignedInvestigator.membershipId], active: true, status: "active" }) }), 200, "committee update");
    expect(await workspace(`/cases/${caseRow.id}`, {}, unassignedInvestigator, tenantA.id), 200, "committee investigator read");
    expect(await workspace(`/settings/routing/${routing.id}`, { method: "PATCH", body: JSON.stringify({ name: "Rota piloto atualizada", category_id: category.id, unit_id: unit.id, assignee_membership_id: assignedInvestigator.membershipId, committee_id: committee.id, priority: 2, active: true, is_fallback: false, status: "active" }) }), 200, "routing update");
    const configured = expect(await workspace("/settings"), 200, "configuration checklist");
    if (configured.configuration_status?.operational !== true) throw new Error("checklist de configuração não operacional");
    const accessGovernance = expect(await workspace("/settings/access"), 200, "access governance").access;
    if (!accessGovernance.some((item: any) => item.membership_id === assignedInvestigator.membershipId && item.roles.some((role: string) => /Investigador/i.test(role)))) throw new Error("governança de acesso não identificou o investigador");
    expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "closed", reason: "inválida", lock_version: caseRow.lock_version }) }), 409, "invalid transition");
    let transition = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "triage", lock_version: caseRow.lock_version }) }, assignedInvestigator), 200, "triage by investigator");
    transition = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "investigation", lock_version: transition.lock_version }) }, assignedInvestigator), 200, "investigation by investigator");
    expect(await workspace(`/cases/${caseRow.id}/decision`, { method: "POST", body: JSON.stringify({ final_classification: "Teste", conclusion: "Conclusão bloqueada", measures_taken: "Nenhuma medida", internal_justification: "Sem permissão", lock_version: transition.lock_version }) }, assignedInvestigator), 403, "investigator close denied");
    expect(await workspace(`/cases/${caseRow.id}/recommendation`, { method: "POST", body: JSON.stringify({ recommendation: "Recomenda-se análise conclusiva pelo compliance.", justification: "Evidências revisadas pelo investigador atribuído." }) }, assignedInvestigator), 201, "investigator recommendation");
    expect(await workspace(`/cases/${caseRow.id}/conflicts`, { method: "POST", body: JSON.stringify({ membership_id: blocked.membershipId, reason: "Pessoa relacionada ao relato" }) }), 201, "conflict");
    const escalatedCase=expect(await workspace(`/cases/${caseRow.id}`),200,"conflict escalation case").case;
    if(escalatedCase.owner_membership_id!==adminA.membershipId)throw new Error("conflito não aplicou escalonamento configurado");
    expect(await workspace(`/cases/${caseRow.id}/assignments`, { method: "POST", body: JSON.stringify({ membership_id: blocked.membershipId, reason: "Tentativa bloqueada" }) }), 409, "conflicted assignment");
    expect(await workspace(`/cases/${caseRow.id}/assignments`, { method: "POST", body: JSON.stringify({ membership_id: adminA.membershipId, reason: "Responsável confirmado" }) }), 201, "assignment");
    const task = expect(await workspace(`/cases/${caseRow.id}/tasks`, { method: "POST", body: JSON.stringify({ title: "Validar evidências", assignee_membership_id: assignedInvestigator.membershipId, due_at: new Date(Date.now() - 3600000).toISOString(), priority: "high" }) }, assignedInvestigator), 201, "task").task;
    const editedTask = expect(await workspace(`/cases/${caseRow.id}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ title: "Validar cadeia de custódia", description: "Conferir checksum e origem.", priority: "urgent", assignee_membership_id: assignedInvestigator.membershipId, reason: "Escopo profissional detalhado" }) }, assignedInvestigator), 200, "task edit").task;
    if (editedTask.title !== "Validar cadeia de custódia" || editedTask.priority !== "urgent") throw new Error("edição completa de tarefa não persistida");
    const subtask = expect(await workspace(`/cases/${caseRow.id}/tasks`, { method: "POST", body: JSON.stringify({ title: "Conferir checksum", parent_task_id: task.id, assignee_membership_id: assignedInvestigator.membershipId, priority: "normal" }) }, assignedInvestigator), 201, "subtask").task;
    if (subtask.parent_task_id !== task.id) throw new Error("subtarefa sem vínculo ao caso/tarefa principal");
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
    const notifications = expect(await workspace("/notifications", {}, assignedInvestigator), 200, "notification center");
    if (!notifications.notifications.some((item: any) => ["new_task","external_message"].includes(item.notification_type))) throw new Error("eventos operacionais ausentes da central de notificações");
    const unreadNotification = notifications.notifications.find((item: any) => !item.read_at);
    if (!unreadNotification) throw new Error("notificação não lida esperada");
    const readNotification = expect(await workspace(`/notifications/${unreadNotification.id}/read`, { method: "PATCH" }, assignedInvestigator), 200, "mark notification read").notification;
    if (!readNotification.read_at) throw new Error("notificação não foi marcada como lida");
    evidence.notifications = true;

    const pdf = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"));
    const evidenceUpload = expect(await workspace(`/cases/${caseRow.id}/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-file-name": "evidencia.pdf", "x-visible-to-reporter": "true" }, body: pdf }, assignedInvestigator), 201, "workspace evidence");
    const expectedChecksum = crypto.createHash("sha256").update(pdf).digest("hex");
    if (evidenceUpload.checksum_sha256 !== expectedChecksum) throw new Error("checksum SHA-256 não retornado no upload interno");
    const storedEvidence = value(await db.from("integrity_attachments").select("files!inner(checksum_sha256)").eq("id", evidenceUpload.id).single(), "stored evidence checksum");
    if ((storedEvidence as any).files?.checksum_sha256 !== expectedChecksum) throw new Error("checksum SHA-256 não persistido");
    expect(await workspace(`/cases/${caseRow.id}/evidence`, { method: "POST", headers: { "content-type": "application/x-msdownload", "x-file-name": "malware.exe" }, body: new Uint8Array([1, 2, 3]) }, assignedInvestigator), 415, "invalid mime");
    const signed = expect(await workspace(`/cases/${caseRow.id}/evidence/${evidenceUpload.id}/url`, { method: "POST" }, assignedInvestigator), 200, "signed URL");
    if (signed.expires_in !== 120 || (await fetch(signed.url)).status !== 200) throw new Error("signed URL inválida");
    expect(await workspace(`/cases/${caseRow.id}/evidence/${evidenceUpload.id}/url`, { method: "POST" }, adminB, tenantB.id), 404, "cross tenant evidence");
    const publicUpload = expect(await publicApi("/attachments", { method: "POST", headers: { "content-type": "application/pdf", "x-file-name": "complemento.pdf", "x-integrity-protocol": submitted.protocol, "x-integrity-secret": submitted.access_secret }, body: pdf }), 201, "public evidence");
    if (publicUpload.checksum_sha256 !== expectedChecksum) throw new Error("checksum SHA-256 não retornado no upload público");
    const publicSigned = expect(await publicApi(`/attachments/${publicUpload.id}/url`, { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "public signed URL");
    if ((await fetch(publicSigned.url)).status !== 200) throw new Error("public signed URL inválida");

    const directList = await fetch(`${SUPABASE_URL}/storage/v1/object/list/ordum-integrity`, { method: "POST", headers: { apikey: PUBLISHABLE, authorization: `Bearer ${PUBLISHABLE}`, "content-type": "application/json" }, body: JSON.stringify({ prefix: tenantA.id, limit: 100 }) });
    const directObjects = await directList.json().catch(() => []);
    if (directList.ok && Array.isArray(directObjects) && directObjects.length > 0) throw new Error("enumeração pública do bucket permitida");
    transition = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "decision", lock_version: transition.lock_version }) }), 200, "decision transition");
    const closed = expect(await workspace(`/cases/${caseRow.id}/decision`, { method: "POST", body: JSON.stringify({ final_classification: "Procedente", conclusion: "Conclusão interna confidencial E2E", measures_taken: "Providências internas E2E", internal_justification: "Fundamentação interna confidencial E2E", reporter_outcome: "Tratamento concluído e providências adotadas.", lock_version: transition.lock_version }) }), 200, "decision close");
    const retentionState = value(await db.from("integrity_cases").select("retention_state,retention_due_at").eq("id", caseRow.id).single(), "retention lifecycle");
    if (retentionState.retention_state !== "active" || !retentionState.retention_due_at) throw new Error("lifecycle de retenção não foi iniciado no encerramento");
    const retentionEvaluation = expect(await workspace("/settings/retention/evaluate", { method: "POST" }), 200, "retention evaluation");
    if (retentionEvaluation.physical_purge !== false) throw new Error("avaliação de retenção permitiu purge físico");
    const afterClose = expect(await publicApi("/track", { method: "POST", body: JSON.stringify({ protocol: submitted.protocol, secret: submitted.access_secret }) }), 200, "closed tracking").tracking;
    const closedJson = JSON.stringify(afterClose);
    if (!closedJson.includes("Tratamento concluído") || closedJson.includes("Conclusão interna confidencial") || closedJson.includes("Fundamentação interna")) throw new Error("decisão interna vazou no canal público");
    expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "reopened", reason: "Tentativa sem alçada", lock_version: closed.lock_version }) }, assignedInvestigator), 403, "investigator reopen denied");
    const reopened = expect(await workspace(`/cases/${caseRow.id}/transitions`, { method: "POST", body: JSON.stringify({ to_status: "reopened", reason: "Nova evidência recebida", lock_version: closed.lock_version }) }), 200, "reopen");
    if (reopened.status !== "reopened") throw new Error("reabertura não persistida");
    const operationalDossier = await workspace(`/cases/${caseRow.id}/dossier.pdf`);
    expect(operationalDossier, 200, "operational dossier");
    const operationalPdfText = Buffer.isBuffer(operationalDossier.body) ? operationalDossier.body.toString("latin1") : "";
    for (const expected of ["Validar cadeia de custódia", "Conclusão interna confidencial E2E", expectedChecksum]) {
      if (!operationalPdfText.includes(expected)) throw new Error(`dossiê operacional sem ${expected}`);
    }
    const timeline = expect(await workspace(`/cases/${caseRow.id}/timeline`), 200, "timeline").events;
    for (const event of ["report_received", "routed", "task_created", "task_completed", "task_reopened", "decision_recorded", "status_changed"]) {
      if (!timeline.some((item: any) => item.event_type === event)) throw new Error(`timeline sem ${event}`);
    }
    const summary = expect(await request(`/api/admin/clients/${tenantA.id}/integrity-summary`, {}, adminA.token), 200, "admin summary");
    const forbiddenKeys = ["description", "identity", "messages", "evidence", "conclusion", "notes"];
    if (summary.confidentiality_boundary !== "aggregate_only" || forbiddenKeys.some((key) => Object.hasOwn(summary, key))) throw new Error("control plane expôs data plane");
    const dashboard = expect(await workspace("/dashboard"), 200, "dashboard");
    if (!dashboard.updated_at || !Array.isArray(dashboard.by_category) || !Array.isArray(dashboard.by_department) || !Array.isArray(dashboard.by_reporter_mode) || !Array.isArray(dashboard.evolution)) throw new Error("dashboard operacional incompleto");
    const pending=expect(await workspace("/pending"),200,"pending queue"); if(!Array.isArray(pending.items))throw new Error("pending queue invalid");
    if(process.env.SKIP_INTEGRITY_SCHEDULER!=="1"){
      const scheduler=expect(await request("/api/internal/integrity/run",{},CRON_SECRET),200,"integrity scheduler"); const schedulerAgain=expect(await request("/api/internal/integrity/run",{},CRON_SECRET),200,"integrity scheduler idempotent"); if(!schedulerAgain.idempotent||schedulerAgain.run_key!==scheduler.run_key)throw new Error("scheduler is not idempotent");
    }else evidence.schedulerSkipped="credential unavailable to local QA";
    const filtered = expect(await workspace(`/cases?category_id=${category.id}&unit_id=${unit.id}&department_id=${department.id}&committee_id=${committee.id}&page=1&limit=1&order=created_at&direction=desc`), 200, "combined filters and pagination");
    if (filtered.total < 1 || filtered.cases.length !== 1 || filtered.total_pages < 1) throw new Error("filtros/paginação não retornaram o caso esperado");
    const exported = await workspace(`/cases/export.csv?category_id=${category.id}`);
    expect(exported, 200, "cases CSV export");
    if (!exported.headers.get("content-type")?.includes("text/csv")) throw new Error("exportação de listagem não retornou CSV");
    const reportExport = await workspace(`/cases/${caseRow.id}/report.csv`);
    expect(reportExport, 200, "case report CSV export");
    const executivePdf=await workspace(`/reports/executive.pdf?department_id=${department.id}`); expect(executivePdf,200,"executive PDF"); if(!Buffer.isBuffer(executivePdf.body)||!executivePdf.body.toString("latin1").startsWith("%PDF-1.4"))throw new Error("executive PDF invalid");
    const executiveCsv=await workspace(`/reports/executive.csv?department_id=${department.id}`); expect(executiveCsv,200,"executive CSV"); if(/Pessoa E2E|Nota interna confidencial|Mensagem pública do comitê/.test(String(executiveCsv.body)))throw new Error("executive report leaked case data");
    if (!reportExport.headers.get("content-disposition")?.includes("integrity-")) throw new Error("relatório individual sem nome de arquivo");
    const identifiedCase = value(await db.from("integrity_cases").select("id").eq("report_id", identifiedReport.id).single(), "identified case");
    const dossierOmitted = await workspace(`/cases/${identifiedCase.id}/dossier.pdf`);
    expect(dossierOmitted, 200, "dossier identity omitted");
    if (!Buffer.isBuffer(dossierOmitted.body) || !dossierOmitted.body.subarray(0,8).toString().startsWith("%PDF-1.4")) throw new Error("dossiê não retornou PDF válido");
    if (dossierOmitted.body.toString("latin1").includes("Pessoa E2E")) throw new Error("identidade incluída no dossiê padrão");
    const dossierWithIdentity = await workspace(`/cases/${identifiedCase.id}/dossier.pdf?include_identity=true`);
    expect(dossierWithIdentity, 200, "dossier identity authorized");
    if (!Buffer.isBuffer(dossierWithIdentity.body) || !dossierWithIdentity.body.toString("latin1").includes("Pessoa E2E")) throw new Error("identidade autorizada ausente do dossiê");
    const forbiddenPdfText = dossierWithIdentity.body.toString("latin1");
    if (/secret_hash|signedUrl|token=|access_secret/i.test(forbiddenPdfText)) throw new Error("dossiê contém material proibido");
    expect(await workspace(`/cases/${identifiedCase.id}/dossier.pdf`, {}, assignedInvestigator), 403, "investigator dossier denied");
    expect(await workspace(`/cases/${identifiedCase.id}/dossier.pdf`, {}, adminB, tenantA.id), 403, "platform admin dossier denied");
    if (process.env.SAVE_PDF_QA === "1") {
      await mkdir("tmp/pdfs", { recursive: true });
      await writeFile("tmp/pdfs/integrity-phase4f-dossier.pdf", operationalDossier.body);
      await writeFile("tmp/pdfs/integrity-phase4f-identity-authorized.pdf", dossierWithIdentity.body);
    }
    evidence.dossierPdf = true;
    evidence.dossierIdentityDefaultOmitted = true;
    evidence.platformAdminDossierDenied = true;
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
    Object.assign(evidence, { phase4g:true,deploymentWizard:true,organizationHierarchy:true,customFields:true,advancedRouting:true,schedulerIdempotent:process.env.SKIP_INTEGRITY_SCHEDULER!=="1",pendingQueue:true,publicStatusMapping:true,executiveReport:true,anonymous: true, identified: true, tenantIsolation: true, rbac: true, assignedInvestigator: true, committeeScope: true, compliance: true, protectedIdentity: true, configurationLifecycle: true, routingPreview: true, orphanProtection: true, conflict: true, storagePrivate: true, signedUrls: true, evidenceChecksum: true, tasks: true, subtasks: true, taskEditing: true, messagesBoundary: true, recommendation: true, decision: true, reopen: true, retentionLifecycle: true, templates: true, accessGovernance: true, adminAggregateOnly: true, dashboard: true, channelReadiness: true, filtersPagination: true, exportsAudited: true });
  } catch (error) {
    primaryError = error;
  } finally {
    try { await cleanup(db, runId, tenantIds, userIds, platformUsers); evidence.cleanup = true; evidence.residualTenants = 0; evidence.residualAuth = 0; }
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
