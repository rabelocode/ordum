import crypto from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const base = (process.env.ADMIN_E2E_URL || "https://ordum-dn9any6qt-ordum.vercel.app").replace(/\/$/, "");
const supabaseUrl = process.env.SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || "";
if (!supabaseUrl || !secret) throw new Error("Supabase server credentials are required");
const db = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `rc21-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const password = `Qa!${crypto.randomBytes(18).toString("base64url")}`;
const artifacts = "tmp/rc2-visual";

const ids = { users: [] as string[], members: [] as string[], team: "", plan: "", leads: [] as string[], proposals: [] as string[], contracts: [] as string[], tenants: [] as string[], customers: [] as string[], subscriptions: [] as string[], payments: [] as string[] };
const personas: Record<string, { email: string; memberId: string }> = {};

function value<T>(result: { data: T | null; error: any }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${label}: sem dados`);
  return result.data;
}

async function createPersona(key: string, roleKey: string, name: string) {
  const email = `${key}.${runId}@ordum-test.internal`;
  const role = value(await db.from("platform_roles").select("id").eq("key", roleKey).single(), `role ${roleKey}`);
  const auth = value(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, runId } }), `auth ${key}`).user;
  ids.users.push(auth.id);
  const member = value(await db.from("platform_members").insert({ user_id: auth.id, role_id: role.id, status: "active", relationship_type: roleKey === "admin" ? "partner" : "employee", created_by: auth.id }).select("id").single(), `platform member ${key}`);
  ids.members.push(member.id);
  personas[key] = { email, memberId: member.id };
  return { userId: auth.id, memberId: member.id };
}

async function setup() {
  const admin = await createPersona("admin", "admin", "Victor Almeida");
  const finance = await createPersona("financeiro", "manager", "Mariana Financeiro");
  const cs = await createPersona("cs", "manager", "Camila Sucesso");
  const sales = await createPersona("vendedor", "sales", "Rafael Comercial");
  const team = value(await db.from("platform_teams").insert({ name: `Equipe Centro-Oeste — ${runId}`, slug: `centro-oeste-${runId}`, description: "Equipe descartável da homologação visual RC2.1", team_type: "sales", status: "active", member_lead_visibility: "team", member_client_visibility: "team", created_by: admin.userId, settings: { e2e_run_id: runId } }).select("id").single(), "team");
  ids.team = team.id;
  value(await db.from("platform_team_members").insert([
    { team_id: team.id, platform_member_id: finance.memberId, team_role: "manager", status: "active", created_by: admin.userId },
    { team_id: team.id, platform_member_id: cs.memberId, team_role: "manager", status: "active", created_by: admin.userId },
    { team_id: team.id, platform_member_id: sales.memberId, team_role: "member", status: "active", created_by: admin.userId },
  ]).select(), "team members");
  const solution = value(await db.from("solutions").select("id").eq("key", "integridade").single(), "integrity solution");
  const plan = value(await db.from("billing_plans").insert({ code: `integridade-essencial-${runId}`, version: 1, name: "Integridade — Essencial", description: "Canal seguro, gestão de casos e indicadores para empresas em implantação.", trial_days: 14, grace_days: 5, limits: { users: 100, units: 5 }, active: true, created_by_user_id: admin.userId }).select("id").single(), "plan");
  ids.plan = plan.id;
  value(await db.from("billing_plan_prices").insert({ plan_id: plan.id, cycle: "monthly", billing_type: "BOLETO", amount_cents: 199000, active: true }).select(), "plan price");
  value(await db.from("billing_plan_solutions").insert({ plan_id: plan.id, solution_id: solution.id, limits: { users: 100, units: 5 } }).select(), "plan solution");

  const companies = [
    { name: "Grupo Horizonte", status: "active", lifecycle: "active", risk: "healthy", subscription: "active", payment: "received", access: "active", dueOffset: -2 },
    { name: "Horizonte Logística", status: "trial", lifecycle: "onboarding", risk: "attention", subscription: "pending", payment: "pending", access: "trial", dueOffset: 14 },
    { name: "Horizonte Serviços", status: "active", lifecycle: "delinquent", risk: "high", subscription: "past_due", payment: "overdue", access: "grace", dueOffset: -9 },
  ];
  for (let index = 0; index < companies.length; index++) {
    const item = companies[index];
    const lead = value(await db.from("marketing_leads").insert({ name: index === 0 ? "Fernanda Costa" : index === 1 ? "Paulo Mendes" : "Juliana Rocha", email: `contato${index}.${runId}@example.com`, company: item.name, interests: ["integridade"], consent: true, consent_at: new Date().toISOString(), source: "qa_rc21", status: "approved", priority: index === 2 ? "high" : "normal", qualification_state: "sales_qualified", first_contact_at: new Date().toISOString() }).select("id").single(), `lead ${index}`);
    ids.leads.push(lead.id);
    value(await db.from("platform_lead_assignments").insert({ lead_id: lead.id, team_id: team.id, owner_platform_member_id: sales.memberId, assigned_by_user_id: admin.userId }).select(), `lead assignment ${index}`);
    const tenant = value(await db.from("tenants").insert({ name: item.name, slug: `horizonte-${index}-${runId}`, status: item.status, lifecycle_status: item.lifecycle, risk_level: item.risk, onboarding_status: index === 0 ? "completed" : "in_progress", trial_ends_at: index === 1 ? new Date(Date.now() + 14 * 86400000).toISOString() : null, success_manager_platform_member_id: cs.memberId, settings: { e2e_run_id: runId } }).select("id").single(), `tenant ${index}`);
    ids.tenants.push(tenant.id);
    value(await db.from("platform_client_assignments").insert({ tenant_id: tenant.id, team_id: team.id, owner_platform_member_id: cs.memberId, assignment_type: "commercial", status: "active", assigned_by_user_id: admin.userId }).select(), `client assignment ${index}`);
    value(await db.from("tenant_solutions").insert({ tenant_id: tenant.id, solution_id: solution.id, status: "active" }).select(), `tenant solution ${index}`);
    const proposal = value(await db.from("commercial_proposals").insert({ lead_id: lead.id, plan_id: plan.id, team_id: team.id, owner_platform_member_id: sales.memberId, status: index === 0 ? "pending_approval" : "approved", amount_cents: 199000, currency: "BRL", cycle: "monthly", billing_type: "BOLETO", valid_until: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10), notes: "Condições comerciais revisadas para o cenário piloto.", created_by_user_id: sales.userId }).select("id").single(), `proposal ${index}`);
    ids.proposals.push(proposal.id);
    value(await db.from("commercial_proposal_items").insert({ proposal_id: proposal.id, solution_id: solution.id, description: "Ordum Integridade", quantity: 1, unit_amount_cents: 199000, limits: { users: 100 } }).select(), `proposal item ${index}`);
    const contract = value(await db.from("commercial_contracts").insert({ proposal_id: proposal.id, lead_id: lead.id, tenant_id: tenant.id, plan_id: plan.id, team_id: team.id, owner_platform_member_id: sales.memberId, customer_name: item.name, customer_email: `financeiro${index}.${runId}@example.com`, customer_tax_id: `00000000000${index}`, owner_name: "Fernanda Costa", owner_email: `owner${index}.${runId}@example.com`, status: index === 1 ? "approved" : "active", amount_cents: 199000, currency: "BRL", cycle: "monthly", billing_type: "BOLETO", grace_days: 5, starts_on: new Date().toISOString().slice(0, 10), external_signature_status: "signed", created_by_user_id: sales.userId, metadata: { e2e_run_id: runId } }).select("id").single(), `contract ${index}`);
    ids.contracts.push(contract.id);
    value(await db.from("commercial_contract_items").insert({ contract_id: contract.id, solution_id: solution.id, description: "Ordum Integridade", quantity: 1, unit_amount_cents: 199000, limits: { users: 100 } }).select(), `contract item ${index}`);
    const customer = value(await db.from("billing_customers").insert({ tenant_id: tenant.id, lead_id: lead.id, contract_id: contract.id, provider_customer_id: `cus_${runId}_${index}`, external_reference: crypto.randomUUID(), name: item.name, email: `financeiro${index}.${runId}@example.com`, tax_id_last4: `00${index}${index}`, status: "active", provider_status: "ACTIVE", metadata: { e2e_run_id: runId } }).select("id").single(), `customer ${index}`);
    ids.customers.push(customer.id);
    const due = new Date(Date.now() + item.dueOffset * 86400000).toISOString().slice(0, 10);
    const subscription = value(await db.from("billing_subscriptions").insert({ contract_id: contract.id, customer_id: customer.id, tenant_id: tenant.id, provider_subscription_id: `sub_${runId}_${index}`, external_reference: crypto.randomUUID(), status: item.subscription, provider_status: item.subscription.toUpperCase(), cycle: "monthly", billing_type: "BOLETO", amount_cents: 199000, next_due_date: due, metadata: { e2e_run_id: runId } }).select("id").single(), `subscription ${index}`);
    ids.subscriptions.push(subscription.id);
    const payment = value(await db.from("billing_payments").insert({ provider_payment_id: `pay_${runId}_${index}`, subscription_id: subscription.id, contract_id: contract.id, tenant_id: tenant.id, external_reference: crypto.randomUUID(), status: item.payment, provider_status: item.payment.toUpperCase(), amount_cents: 199000, net_amount_cents: item.payment === "received" ? 194000 : null, due_date: due, confirmed_at: item.payment === "received" ? new Date().toISOString() : null, received_at: item.payment === "received" ? new Date().toISOString() : null, metadata: { e2e_run_id: runId } }).select("id").single(), `payment ${index}`);
    ids.payments.push(payment.id);
    value(await db.from("tenant_billing_state").insert({ tenant_id: tenant.id, contract_id: contract.id, subscription_id: subscription.id, access_status: item.access, paid_through: item.payment === "received" ? due : null }).select(), `billing state ${index}`);
    value(await db.from("billing_status_history").insert({ tenant_id: tenant.id, contract_id: contract.id, payment_id: payment.id, from_status: "pending", to_status: item.payment, reason: item.payment === "received" ? "Pagamento confirmado pelo ambiente de homologação" : item.payment === "overdue" ? "Cobrança vencida aguardando regularização" : "Cobrança futura criada", actor_user_id: admin.userId, metadata: { e2e_run_id: runId } }).select(), `billing history ${index}`);
    value(await db.from("customer_success_accounts").insert({ tenant_id: tenant.id, manager_platform_member_id: cs.memberId, status: index === 0 ? "healthy" : index === 1 ? "onboarding" : "at_risk", health_score: index === 0 ? 88 : index === 2 ? 42 : null, health_factors: index === 0 ? { onboarding: 100, financial: 100 } : index === 2 ? { onboarding: 100, financial: 20 } : {}, health_weights: { onboarding: 50, financial: 50 }, next_review_at: new Date(Date.now() + 7 * 86400000).toISOString(), renewal_at: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), updated_by_user_id: admin.userId }).select(), `cs account ${index}`);
  }
}

async function login(page: Page, persona: string) {
  await page.goto(`${base}/#/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(personas[persona].email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/admin/, { timeout: 20000 });
}

async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) throw new Error(`${label}: overflow horizontal`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

async function gotoHash(page: Page, hash: string) {
  await page.evaluate(value => { window.location.hash = value; }, hash);
  await page.reload({ waitUntil: "networkidle" });
}

function observe(page: Page, errors: string[]) {
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 180)}`); });
  page.on("response", response => { const url = new URL(response.url()); if (url.origin === new URL(base).origin && response.status() >= 500) errors.push(`HTTP ${response.status()} ${url.pathname}`); });
}

async function runVisualQa(browser: Browser) {
  const errors: string[] = [];
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await desktop.newPage(); observe(admin, errors); await login(admin, "admin");
  await gotoHash(admin, "#/admin"); await admin.getByText("Precisa da sua atenção", { exact: true }).first().waitFor(); await shot(admin, "01-admin-dashboard");
  await gotoHash(admin, "#/admin/leads"); await admin.getByText("Grupo Horizonte", { exact: true }).filter({ visible: true }).first().waitFor(); await shot(admin, "02-lead");
  await gotoHash(admin, "#/admin/propostas"); await admin.getByRole("button").filter({ hasText: "Grupo Horizonte" }).first().click(); await admin.getByText("Preparação", { exact: true }).first().waitFor(); await shot(admin, "03-proposal");
  await gotoHash(admin, `#/admin/empresas/${ids.tenants[0]}`); await admin.getByRole("heading", { name: "Grupo Horizonte", exact: true }).waitFor(); await shot(admin, "04-company");

  const financeContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const finance = await financeContext.newPage(); observe(finance, errors); await login(finance, "financeiro");
  await gotoHash(finance, "#/admin/financeiro"); await finance.getByRole("heading", { name: "Visão geral financeira", exact: true }).waitFor();
  try { await finance.getByText("MRR ativo", { exact: true }).waitFor({ timeout: 15000 }); }
  catch { await shot(finance, "debug-finance-error"); throw new Error(`Financeiro não carregou: ${(await finance.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1200)}`); }
  await shot(finance, "05-finance-overview");
  await finance.getByRole("button", { name: "Assinaturas", exact: true }).click(); await finance.getByText("Grupo Horizonte", { exact: true }).filter({ visible: true }).first().waitFor(); await finance.getByText("Em período de teste", { exact: true }).filter({ visible: true }).waitFor(); await finance.getByText("Em atraso", { exact: true }).filter({ visible: true }).waitFor(); await shot(finance, "06-subscriptions");
  await finance.getByRole("button", { name: "Cobranças", exact: true }).click(); await finance.getByPlaceholder("Buscar cliente", { exact: true }).fill("Horizonte Serviços"); await finance.getByText("Horizonte Serviços", { exact: true }).first().click(); await finance.getByText(/dias? em atraso|Atraso/).first().waitFor(); await shot(finance, "07-charge");
  const csContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const cs = await csContext.newPage(); observe(cs, errors); await login(cs, "cs"); await gotoHash(cs, "#/admin/customer-success"); await cs.getByRole("heading", { name: "Customer Success", exact: true }).waitFor(); await cs.getByText("Horizonte Serviços", { exact: true }).waitFor(); await shot(cs, "08-customer-success");

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage(); observe(mobilePage, errors); await login(mobilePage, "admin");
  await gotoHash(mobilePage, "#/admin"); await assertNoOverflow(mobilePage, "dashboard mobile"); await shot(mobilePage, "15-admin-dashboard-mobile");
  await gotoHash(mobilePage, `#/admin/empresas/${ids.tenants[0]}`); await mobilePage.getByRole("heading", { name: "Grupo Horizonte", exact: true }).waitFor(); await assertNoOverflow(mobilePage, "company mobile"); await shot(mobilePage, "16-company-mobile");
  await gotoHash(mobilePage, "#/admin/financeiro"); await mobilePage.getByRole("heading", { name: "Visão geral financeira", exact: true }).waitFor(); await assertNoOverflow(mobilePage, "finance mobile"); await shot(mobilePage, "17-finance-mobile");
  await mobilePage.getByRole("button", { name: "Cobranças", exact: true }).click(); await mobilePage.getByPlaceholder("Buscar cliente", { exact: true }).fill("Horizonte Serviços"); await mobilePage.getByText("Horizonte Serviços", { exact: true }).first().click(); await assertNoOverflow(mobilePage, "charge mobile"); await shot(mobilePage, "18-charge-mobile");

  for (const context of [desktop, financeContext, csContext, mobile]) await context.close();
  if (errors.length) throw new Error(`browser QA: ${errors.join("; ")}`);
}

async function cleanup() {
  const errors: string[] = [];
  const remove = async (query: PromiseLike<any>, label: string) => { const result = await query; if (result.error) errors.push(`${label}: ${result.error.message}`); };
  if (ids.contracts.length) {
    await remove(db.from("billing_status_history").delete().in("contract_id", ids.contracts), "billing history");
    await remove(db.from("billing_payments").delete().in("contract_id", ids.contracts), "payments");
    await remove(db.from("tenant_billing_state").delete().in("contract_id", ids.contracts), "billing state");
    await remove(db.from("billing_subscriptions").delete().in("contract_id", ids.contracts), "subscriptions");
    await remove(db.from("billing_customers").delete().in("contract_id", ids.contracts), "customers");
  }
  if (ids.tenants.length) {
    await remove(db.from("customer_success_events").delete().in("tenant_id", ids.tenants), "cs events");
    await remove(db.from("customer_success_accounts").delete().in("tenant_id", ids.tenants), "cs accounts");
    const runs = await db.from("onboarding_runs").select("id").in("tenant_id", ids.tenants);
    if (runs.error) errors.push(`onboarding lookup: ${runs.error.message}`);
    else if (runs.data?.length) await remove(db.from("onboarding_items").delete().in("run_id", runs.data.map(item => item.id)), "onboarding items");
    await remove(db.from("onboarding_runs").delete().in("tenant_id", ids.tenants), "onboarding runs");
    await remove(db.from("tenant_solutions").delete().in("tenant_id", ids.tenants), "tenant solutions");
    await remove(db.from("platform_client_assignments").delete().in("tenant_id", ids.tenants), "client assignments");
  }
  if (ids.contracts.length) { await remove(db.from("commercial_contract_items").delete().in("contract_id", ids.contracts), "contract items"); await remove(db.from("commercial_contracts").delete().in("id", ids.contracts), "contracts"); }
  if (ids.proposals.length) { await remove(db.from("commercial_proposal_items").delete().in("proposal_id", ids.proposals), "proposal items"); await remove(db.from("commercial_proposals").delete().in("id", ids.proposals), "proposals"); }
  if (ids.leads.length) {
    await remove(db.from("commercial_activities").delete().in("lead_id", ids.leads), "activities");
    await remove(db.from("commercial_demos").delete().in("lead_id", ids.leads), "demos");
    await remove(db.from("commercial_lead_assignment_history").delete().in("lead_id", ids.leads), "lead history");
    await remove(db.from("platform_lead_assignments").delete().in("lead_id", ids.leads), "lead assignments");
    await remove(db.from("marketing_leads").delete().in("id", ids.leads), "leads");
  }
  if (ids.team) { await remove(db.from("platform_team_members").delete().eq("team_id", ids.team), "team members"); await remove(db.from("platform_state_transitions").delete().eq("team_id", ids.team), "team transitions"); await remove(db.from("platform_audit_logs").delete().eq("team_id", ids.team), "team audit"); await remove(db.from("platform_teams").delete().eq("id", ids.team), "team"); }
  if (ids.tenants.length) { await remove(db.from("platform_state_transitions").delete().in("tenant_id", ids.tenants), "tenant transitions"); await remove(db.from("tenants").delete().in("id", ids.tenants), "tenants"); }
  if (ids.plan) { await remove(db.from("billing_plan_solutions").delete().eq("plan_id", ids.plan), "plan solutions"); await remove(db.from("billing_plan_prices").delete().eq("plan_id", ids.plan), "plan prices"); await remove(db.from("billing_plans").delete().eq("id", ids.plan), "plan"); }
  if (ids.users.length) { await remove(db.from("platform_state_transitions").delete().in("actor_user_id", ids.users), "actor transitions"); await remove(db.from("platform_audit_logs").delete().in("actor_user_id", ids.users), "actor audit"); await remove(db.from("platform_members").delete().in("user_id", ids.users), "platform members"); for (const user of ids.users) { const result = await db.auth.admin.deleteUser(user); if (result.error) errors.push(`auth ${user}: ${result.error.message}`); } }
  const residual = await db.from("tenants").select("id", { count: "exact", head: true }).in("id", ids.tenants.length ? ids.tenants : [crypto.randomUUID()]);
  if (residual.error) errors.push(`residual query: ${residual.error.message}`); else if (residual.count) errors.push(`residual tenants: ${residual.count}`);
  if (errors.length) throw new Error(`cleanup failed: ${errors.join("; ")}`);
}

await mkdir(artifacts, { recursive: true });
let browser: Browser | undefined;
let failure: unknown;
try {
  await setup();
  browser = await chromium.launch({ headless: true });
  await runVisualQa(browser);
  console.log(JSON.stringify({ status: "PASS", runId, artifacts, personas: Object.keys(personas), screenshots: 12 }));
} catch (error) {
  failure = error;
  console.error(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  if (browser) await browser.close();
  try { await cleanup(); } catch (error) { failure = failure || error; console.error(error instanceof Error ? error.stack || error.message : String(error)); }
}
if (failure) process.exitCode = 1;
