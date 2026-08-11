import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { chromium, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const base =
  process.env.ADMIN_E2E_URL ||
  "https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app";
const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
if (!url || !secret)
  throw new Error("Supabase server credentials are required");
const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = `ui-${Date.now().toString(36)}`;
const password = `Qa!${randomBytes(18).toString("base64url")}`;
const creatorEmail = `admin.${runId}@e2e.ordum.invalid`;
const approverEmail = `approver.${runId}@e2e.ordum.invalid`;
const company = `Empresa Piloto ${runId}`;
const teamName = `Comercial ${runId}`;
const planName = `Integridade Piloto ${runId}`;
const planCode = `integridade-${runId}`;
const artifacts = `tmp/qa-package3/${runId}`;
await mkdir(artifacts, { recursive: true });
const ids: {
  users: string[];
  members: string[];
  team?: string;
  lead?: string;
  demo?: string;
  proposal?: string;
  contract?: string;
  tenant?: string;
  plan?: string;
} = { users: [], members: [] };

async function createOperator(email: string, name: string) {
  const role = await db
    .from("platform_roles")
    .select("id")
    .eq("key", "admin")
    .single();
  if (role.error) throw role.error;
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (created.error) throw created.error;
  ids.users.push(created.data.user.id);
  const member = await db
    .from("platform_members")
    .insert({
      user_id: created.data.user.id,
      role_id: role.data.id,
      status: "active",
      relationship_type: "partner",
      created_by: created.data.user.id,
    })
    .select("id")
    .single();
  if (member.error) throw member.error;
  ids.members.push(member.data.id);
  return member.data.id;
}
async function login(page: Page, email: string) {
  await page.goto(`${base}/#/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("seu.email@empresa.com").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL(/#\/admin/, { timeout: 20000 });
  await page.reload({ waitUntil: "networkidle" });
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}
async function cleanup() {
  const errors: string[] = [];
  const remove = async (p: PromiseLike<any>, label: string) => {
    const result = await p;
    if (result.error) errors.push(`${label}: ${result.error.message}`);
  };
  try {
    if (ids.tenant) {
      const runs = await db
        .from("onboarding_runs")
        .select("id")
        .eq("tenant_id", ids.tenant);
      if (runs.data?.length)
        await remove(
          db
            .from("onboarding_items")
            .delete()
            .in(
              "run_id",
              runs.data.map((row) => row.id),
            ),
          "onboarding_items",
        );
      await remove(
        db.from("onboarding_runs").delete().eq("tenant_id", ids.tenant),
        "onboarding_runs",
      );
      const memberships = await db
        .from("memberships")
        .select("id")
        .eq("tenant_id", ids.tenant);
      if (memberships.data?.length)
        await remove(
          db
            .from("membership_roles")
            .delete()
            .in(
              "membership_id",
              memberships.data.map((row) => row.id),
            ),
          "membership_roles",
        );
      await remove(
        db.from("memberships").delete().eq("tenant_id", ids.tenant),
        "memberships",
      );
      await remove(
        db.from("tenant_solutions").delete().eq("tenant_id", ids.tenant),
        "tenant_solutions",
      );
      await remove(
        db
          .from("platform_client_assignments")
          .delete()
          .eq("tenant_id", ids.tenant),
        "platform_client_assignments",
      );
      await remove(
        db.from("tenant_billing_state").delete().eq("tenant_id", ids.tenant),
        "tenant_billing_state",
      );
    }
    if (ids.contract) {
      await remove(
        db
          .from("commercial_contract_items")
          .delete()
          .eq("contract_id", ids.contract),
        "contract_items",
      );
      await remove(
        db.from("commercial_contracts").delete().eq("id", ids.contract),
        "contract",
      );
    }
    if (ids.proposal) {
      await remove(
        db
          .from("commercial_proposal_items")
          .delete()
          .eq("proposal_id", ids.proposal),
        "proposal_items",
      );
      await remove(
        db.from("commercial_proposals").delete().eq("id", ids.proposal),
        "proposal",
      );
    }
    if (ids.demo)
      await remove(
        db.from("commercial_demos").delete().eq("id", ids.demo),
        "demo",
      );
    if (ids.lead) {
      await remove(
        db.from("commercial_activities").delete().eq("lead_id", ids.lead),
        "activities",
      );
      await remove(
        db
          .from("commercial_lead_assignment_history")
          .delete()
          .eq("lead_id", ids.lead),
        "assignment_history",
      );
      await remove(
        db.from("platform_lead_assignments").delete().eq("lead_id", ids.lead),
        "lead_assignment",
      );
      await remove(
        db.from("marketing_leads").delete().eq("id", ids.lead),
        "lead",
      );
    }
    if (ids.team) {
      await remove(
        db.from("platform_team_members").delete().eq("team_id", ids.team),
        "team_members",
      );
      await remove(
        db.from("platform_teams").delete().eq("id", ids.team),
        "team",
      );
    }
    if (ids.tenant) {
      await remove(
        db
          .from("platform_state_transitions")
          .delete()
          .eq("tenant_id", ids.tenant),
        "tenant_transitions",
      );
      await remove(db.from("tenants").delete().eq("id", ids.tenant), "tenant");
    }
    if (ids.plan) {
      await remove(
        db.from("billing_plan_prices").delete().eq("plan_id", ids.plan),
        "plan_prices",
      );
      await remove(
        db.from("billing_plan_solutions").delete().eq("plan_id", ids.plan),
        "plan_solutions",
      );
      await remove(
        db.from("billing_plans").delete().eq("id", ids.plan),
        "plan",
      );
    }
    if (ids.users.length) {
      await remove(
        db
          .from("platform_state_transitions")
          .delete()
          .in("actor_user_id", ids.users),
        "transitions",
      );
      await remove(
        db.from("platform_audit_logs").delete().in("actor_user_id", ids.users),
        "audit",
      );
      await remove(
        db.from("platform_members").delete().in("user_id", ids.users),
        "platform_members",
      );
      for (const id of ids.users) {
        const deleted = await db.auth.admin.deleteUser(id);
        if (deleted.error) errors.push(`auth: ${deleted.error.message}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length) throw new Error(`cleanup failed: ${errors.join("; ")}`);
}

let browser;
let failure: unknown;
try {
  const creatorMember = await createOperator(creatorEmail, "Admin QA");
  const approverMember = await createOperator(approverEmail, "Aprovador QA");
  browser = await chromium.launch({ headless: true });
  const creator = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await creator.newPage();
  page.on("console", (message) => { if (message.type() === "error") console.log(`BROWSER_CONSOLE=${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) console.log(`BROWSER_HTTP=${response.status()} ${response.url()}`); });
  await login(page, creatorEmail);
  await page.goto(`${base}/#/admin/equipes`, { waitUntil: "networkidle" });
  await shot(page, "00-teams-loaded");
  console.log(`TEAMS_PAGE=${page.url()} BODY=${(await page.locator("body").innerText()).slice(0, 1200)}`);
  await page.getByText("Prepare sua operação comercial").waitFor();
  await shot(page, "01-first-run");
  await page
    .getByRole("button", { name: "Configurar equipe comercial" })
    .click();
  await shot(page, "01b-create-team-dialog");
  console.log(`CREATE_DIALOG=${(await page.locator("body").innerText()).slice(-1000)}`);
  await page.getByLabel("Nome da Equipe").fill(teamName);
  await page.getByLabel("Descrição").fill("Equipe descartável de homologação");
  await page.getByRole("button", { name: "Criar Equipe" }).click();
  await page.getByText(teamName).first().waitFor();
  const team = await db
    .from("platform_teams")
    .select("id")
    .eq("name", teamName)
    .single();
  if (team.error) throw team.error;
  ids.team = team.data.id;
  await page.goto(`${base}/#/admin/equipes/${ids.team}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: /Membros/ }).click();
  for (const [email, role] of [
    [creatorEmail, "manager"],
    [approverEmail, "member"],
  ] as const) {
    await page.getByRole("button", { name: "Adicionar Membro" }).click();
    await page
      .getByLabel("Selecione o Membro")
      .selectOption({ label: new RegExp(email) });
    await page.getByLabel(/Função na Equipe/).selectOption(role);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.getByText(email).waitFor();
  }
  await shot(page, "02-team-ready");
  await page.goto(`${base}/#/admin/planos`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /Criar plano/ })
    .first()
    .click();
  await page.getByLabel("Nome do plano").fill(planName);
  await page.getByLabel(/Código comercial/).fill(planCode);
  await page.getByLabel(/Período de teste/).fill("14");
  await page.getByLabel("Mensalidade").fill("299,00");
  const integrityButton = page.getByRole("button", {
    name: /Ordum Integridade/,
  });
  await integrityButton.click();
  await page.getByRole("button", { name: /Publicar versão/ }).click();
  await page.getByText(planName).waitFor();
  const plan = await db
    .from("billing_plans")
    .select("id")
    .eq("code", planCode)
    .single();
  if (plan.error) throw plan.error;
  ids.plan = plan.data.id;
  await page.goto(`${base}/#/admin/leads`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByLabel("Contato").fill(`Contato ${runId}`);
  await page.getByLabel("Empresa").fill(company);
  await page.getByLabel("E-mail").fill(`contato.${runId}@example.com`);
  await page.getByLabel("Equipe responsável").selectOption({ label: teamName });
  await page.getByRole("button", { name: "Criar lead" }).click();
  await page.getByText(company).first().waitFor();
  const lead = await db
    .from("marketing_leads")
    .select("id")
    .eq("company", company)
    .single();
  if (lead.error) throw lead.error;
  ids.lead = lead.data.id;
  await shot(page, "03-lead-created");
  const leadRow = page.locator("tr").filter({ hasText: company });
  await leadRow.getByRole("button", { name: "Registrar contato" }).click();
  await page.getByLabel(/Assunto/).fill("Primeiro contato realizado");
  await page.getByRole("button", { name: "Salvar Atividade" }).click();
  await page.getByText("Atividade registrada com sucesso.").waitFor();
  await leadRow.getByRole("button", { name: "Agendar demo" }).click();
  await page.getByLabel(/Equipe responsável/).selectOption({ label: teamName });
  await page.getByLabel(/Observações/).fill("Demonstração de homologação");
  await page.getByRole("button", { name: /Agendar Demonstração/ }).click();
  await page.getByText(/Demonstração agendada com sucesso/).waitFor();
  const demo = await db
    .from("commercial_demos")
    .select("id")
    .eq("lead_id", ids.lead)
    .single();
  if (demo.error) throw demo.error;
  ids.demo = demo.data.id;
  await page.goto(`${base}/#/admin/demos`, { waitUntil: "networkidle" });
  const demoCard = page.locator("article").filter({ hasText: company });
  await demoCard.getByRole("button", { name: "Registrar resultado" }).click();
  await page.getByLabel("Resultado").selectOption("proposal_requested");
  await page.getByLabel(/Próxima ação/).fill("Preparar proposta");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByText(/Resultado registrado/).waitFor();
  await demoCard.getByRole("link", { name: "Criar proposta" }).click();
  await page.getByText("Etapa 1 de 4").waitFor();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("Plano").selectOption({ label: planName });
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: "Criar proposta" }).click();
  await page.getByText(/Proposta criada e enviada/).waitFor();
  const proposal = await db
    .from("commercial_proposals")
    .select("id")
    .eq("lead_id", ids.lead)
    .single();
  if (proposal.error) throw proposal.error;
  ids.proposal = proposal.data.id;
  await shot(page, "04-proposal-awaiting-approval");
  const approver = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const approvalPage = await approver.newPage();
  await login(approvalPage, approverEmail);
  await approvalPage.goto(`${base}/#/admin/propostas?view=my-approvals`, {
    waitUntil: "networkidle",
  });
  await approvalPage.getByText(company).first().click();
  await approvalPage.getByRole("button", { name: "Aprovar proposta" }).click();
  await approvalPage
    .getByLabel(/Justificativa/)
    .fill("Condições revisadas por segunda pessoa");
  await approvalPage.getByRole("button", { name: "Confirmar" }).click();
  await approvalPage.getByText("Proposta aprovada.").waitFor();
  await shot(approvalPage, "05-proposal-approved");
  await page.goto(`${base}/#/admin/propostas`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Prontas para enviar" }).click();
  await page.getByText(company).first().click();
  await page.getByRole("button", { name: "Registrar envio" }).click();
  await page
    .getByLabel(/Como a proposta foi enviada/)
    .fill("Enviada por e-mail ao contato principal");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByText(/Envio registrado/).waitFor();
  await page.getByRole("button", { name: "Enviadas" }).click();
  await page.getByText(company).first().click();
  await page.getByRole("button", { name: "Registrar aceite" }).click();
  await page
    .getByLabel(/Justificativa/)
    .fill("Aceite externo registrado para homologação");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByText(/Aceite registrado/).waitFor();
  await page.getByRole("button", { name: "Aceitas" }).click();
  await page.getByText(company).first().click();
  await page.getByRole("button", { name: "Gerar contrato" }).click();
  await page.getByLabel(/CPF\/CNPJ/).fill("11222333000181");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.waitForURL(/#\/admin\/contratos/);
  const contract = await db
    .from("commercial_contracts")
    .select("id")
    .eq("proposal_id", ids.proposal)
    .single();
  if (contract.error) throw contract.error;
  ids.contract = contract.data.id;
  await approvalPage.goto(`${base}/#/admin/contratos`, {
    waitUntil: "networkidle",
  });
  await approvalPage.getByText(company).first().click();
  await approvalPage.getByRole("button", { name: "Aprovar contrato" }).click();
  await approvalPage
    .getByLabel(/Motivo da aprovação/)
    .fill("Contrato revisado e liberado");
  await approvalPage.getByRole("button", { name: "Confirmar" }).click();
  await approvalPage.getByText(/Contrato aprovado/).waitFor();
  await page.goto(`${base}/#/admin/contratos`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Aguardando" }).click();
  await page.getByText(company).first().click();
  await page.getByRole("button", { name: "Registrar envio" }).click();
  await page.getByLabel("Observação").fill("Enviado para assinatura externa");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByText(/Envio para assinatura registrado/).waitFor();
  await page.getByRole("button", { name: "Registrar assinatura" }).click();
  await page.getByLabel("Observação").fill("Assinatura externa conferida");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByText(/Assinatura externa registrada/).waitFor();
  await page.getByRole("button", { name: "Ativar cliente" }).click();
  await page
    .getByRole("button", { name: /Ativar e iniciar implantação/ })
    .click();
  await page.waitForURL(/#\/admin\/empresas\//, { timeout: 30000 });
  ids.tenant = page.url().split("/").pop();
  await page.getByText(company).first().waitFor();
  await shot(page, "06-client-activated");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "07-client-mobile");
  await page.goto(`${base}/#/admin/onboarding?tenant=${ids.tenant}`, {
    waitUntil: "networkidle",
  });
  await shot(page, "08-onboarding-mobile");
  console.log(
    JSON.stringify({
      status: "PASS",
      runId,
      team: ids.team,
      proposal: ids.proposal,
      contract: ids.contract,
      tenant: ids.tenant,
      artifacts,
    }),
  );
  await creator.close();
  await approver.close();
} catch (error) {
  failure = error;
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : JSON.stringify(error),
  );
} finally {
  if (browser) await browser.close();
  try {
    await cleanup();
  } catch (error) {
    failure = failure || error;
    console.error(
      error instanceof Error
        ? error.stack || error.message
        : JSON.stringify(error),
    );
  }
}
if (failure) process.exitCode = 1;
