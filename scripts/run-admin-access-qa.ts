import crypto from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const base = (process.env.ADMIN_E2E_URL || '').replace(/\/$/, '');
const supabaseUrl = process.env.SUPABASE_URL || '';
const secret = process.env.SUPABASE_SECRET_KEY || '';
if (!base || !supabaseUrl || !secret) throw new Error('ADMIN_E2E_URL and Supabase server credentials are required');

const db = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `admin-access-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
const password = `Qa!${crypto.randomBytes(18).toString('base64url')}`;
const artifacts = 'tmp/admin-access';
const userIds: string[] = [];
const memberIds: string[] = [];
const roleIds: string[] = [];
const teamIds: string[] = [];
const emails: Record<string, string> = {};

function value<T>(result: { data: T | null; error: any }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${label}: sem dados`);
  return result.data;
}

async function createRole(key: string, name: string, permissions: string[]) {
  const role = value(await db.from('platform_roles').insert({ key: `${key}_${runId}`, name, description: `Perfil descartável ${name}`, rank: 10, active: true }).select('id,key').single(), `papel ${name}`);
  roleIds.push(role.id);
  const grants = value(await db.from('platform_permissions').select('id,key').in('key', permissions), `permissões ${name}`);
  if (grants.length !== permissions.length) throw new Error(`Contrato de permissões incompleto para ${name}`);
  value(await db.from('platform_role_permissions').insert(grants.map(item => ({ role_id: role.id, permission_id: item.id }))).select(), `vínculos ${name}`);
  return role;
}

async function createPerson(key: string, name: string, roleId: string, relationshipType = 'employee') {
  const email = `${key}.${runId}@ordum-test.internal`;
  const auth = value(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, runId } }), `auth ${key}`).user;
  userIds.push(auth.id); emails[key] = email;
  const member = value(await db.from('platform_members').insert({ user_id: auth.id, role_id: roleId, status: 'active', relationship_type: relationshipType, created_by: auth.id }).select('id').single(), `pessoa ${key}`);
  memberIds.push(member.id);
  return { userId: auth.id, memberId: member.id };
}

async function setup() {
  const adminRole = value(await db.from('platform_roles').select('id').eq('key', 'admin').single(), 'papel admin');
  const commercial = await createRole('commercial_access_qa', 'Comercial', ['platform.access', 'platform.dashboard.read', 'platform.leads.read', 'platform.demos.manage', 'platform.commercial.read', 'platform.clients.read']);
  const finance = await createRole('finance_access_qa', 'Financeiro', ['platform.access', 'platform.dashboard.read', 'platform.clients.read', 'platform.billing.read']);
  const cs = await createRole('cs_access_qa', 'Customer Success', ['platform.access', 'platform.dashboard.read', 'platform.clients.read', 'platform.onboarding.read', 'platform.success.read']);
  const minimal = await createRole('minimal_access_qa', 'Acesso básico', ['platform.access', 'platform.dashboard.read']);
  const admin = await createPerson('admin', 'Victor Administrador', adminRole.id, 'partner');
  const target = await createPerson('target', 'Mariana Souza', commercial.id);
  await createPerson('finance', 'Fernanda Financeiro', finance.id);
  await createPerson('cs', 'Camila Customer Success', cs.id);
  await createPerson('minimal', 'Paulo Acesso Básico', minimal.id);
  const team = value(await db.from('platform_teams').insert({ name: `Comercial Centro-Oeste — ${runId}`, slug: `comercial-${runId}`, team_type: 'sales', status: 'active', member_lead_visibility: 'team', member_client_visibility: 'team', created_by: admin.userId, settings: { e2e_run_id: runId } }).select('id').single(), 'equipe');
  teamIds.push(team.id);
  return { target, roleKeys: { commercial: commercial.key, finance: finance.key, cs: cs.key } };
}

function observe(page: Page, errors: string[]) {
  page.on('console', message => { if (message.type() === 'error') errors.push(`console em ${page.url()}: ${message.text().slice(0, 180)}`); });
  page.on('response', response => { if (response.url().startsWith(base) && response.status() === 401) errors.push(`HTTP 401 ${new URL(response.url()).pathname} em ${page.url()}`); });
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
}

async function login(context: BrowserContext, key: string, errors: string[]) {
  const page = await context.newPage(); observe(page, errors);
  await page.goto(`${base}/#/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(emails[key]);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/admin/, { timeout: 20_000 });
  await page.getByRole('navigation', { name: 'Navegação administrativa' }).waitFor();
  return page;
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /Sair/i }).first().click();
  await page.waitForURL(/#\/login/, { timeout: 15_000 });
}

async function accessPage(page: Page) {
  await page.evaluate(() => { window.location.hash = '#/admin/acessos'; });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Acessos e permissões' }).waitFor();
  try { await page.getByText('Mariana Souza', { exact: true }).waitFor({ timeout: 12_000 }); }
  catch { throw new Error(`lista de acessos não carregou em ${page.url()}: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1400)}`); }
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

async function assertNavigation(page: Page, expected: string[], absent: string[]) {
  const nav = await page.getByRole('navigation', { name: 'Navegação administrativa' }).innerText();
  for (const label of expected) if (!nav.includes(label)) throw new Error(`menu sem ${label}: ${nav}`);
  for (const label of absent) if (nav.includes(label)) throw new Error(`menu exibiu ${label}: ${nav}`);
}

async function openGroup(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

async function changeRole(page: Page, roleName: string) {
  await accessPage(page);
  await page.locator('article').filter({ hasText: 'Mariana Souza' }).getByRole('button', { name: /Gerenciar acesso/ }).click();
  const drawer = page.getByRole('dialog', { name: /Mariana Souza/ });
  await drawer.waitFor();
  await drawer.getByLabel('Função').selectOption({ label: roleName });
  return drawer;
}

async function runQa(fixture: Awaited<ReturnType<typeof setup>>) {
  const errors: string[] = [];
  const browser = await chromium.launch({ headless: true });
  const contexts: BrowserContext[] = [];
  try {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(adminContext);
    const admin = await login(adminContext, 'admin', errors);
    await accessPage(admin);
    await admin.getByPlaceholder('Buscar por nome ou e-mail').fill(runId);
    await screenshot(admin, '01-access-list');
    await admin.locator('article').filter({ hasText: 'Mariana Souza' }).getByRole('button', { name: /Gerenciar acesso/ }).click();
    const firstDrawer = admin.getByRole('dialog', { name: /Mariana Souza/ });
    await firstDrawer.waitFor();
    await screenshot(admin, '02-access-detail');
    await firstDrawer.getByLabel('Função').focus();
    await screenshot(admin, '03-role-selection');
    await firstDrawer.getByRole('button', { name: 'Fechar' }).click();

    const commercialContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(commercialContext);
    const commercial = await login(commercialContext, 'target', errors);
    await assertNavigation(commercial, ['Comercial', 'Clientes'], ['Financeiro', 'Administração', 'Operação']);
    await openGroup(commercial, 'Comercial');
    await screenshot(commercial, '05-commercial-menu');
    await logout(commercial);

    const financeDrawer = await changeRole(admin, 'Financeiro');
    await financeDrawer.getByText('Cobranças', { exact: true }).waitFor();
    await screenshot(admin, '04-access-preview');
    await financeDrawer.getByRole('button', { name: 'Salvar acesso' }).click();
    await admin.getByText('Função e equipes atualizadas.', { exact: true }).waitFor();

    const financeContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(financeContext);
    const finance = await login(financeContext, 'target', errors);
    await assertNavigation(finance, ['Clientes', 'Financeiro'], ['Comercial', 'Administração', 'Operação']);
    await openGroup(finance, 'Financeiro');
    await screenshot(finance, '06-finance-menu');
    await finance.goto(`${base}/#/admin/acessos`, { waitUntil: 'networkidle' });
    await finance.getByRole('heading', { name: 'Área restrita' }).waitFor();
    await logout(finance);

    const csDrawer = await changeRole(admin, 'Customer Success');
    await csDrawer.getByRole('button', { name: 'Salvar acesso' }).click();
    await admin.getByText('Função e equipes atualizadas.', { exact: true }).waitFor();
    const csContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(csContext);
    const cs = await login(csContext, 'target', errors);
    await openGroup(cs, 'Clientes');
    await assertNavigation(cs, ['Clientes', 'Customer Success'], ['Financeiro', 'Comercial', 'Administração', 'Operação']);
    await screenshot(cs, '07-cs-menu');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await adminContext.storageState() }); contexts.push(mobileContext);
    const mobile = await mobileContext.newPage(); observe(mobile, errors);
    await mobile.goto(`${base}/#/admin/acessos`, { waitUntil: 'networkidle' });
    await mobile.getByRole('heading', { name: 'Acessos e permissões' }).waitFor();
    await mobile.getByText('Mariana Souza', { exact: true }).waitFor();
    await mobile.getByPlaceholder('Buscar por nome ou e-mail').fill(runId);
    await screenshot(mobile, '08-access-mobile');
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error('overflow horizontal na gestão de acessos mobile');

    const member = value(await db.from('platform_members').select('platform_roles(key)').eq('id', fixture.target.memberId).single(), 'papel final');
    if ((member as any).platform_roles?.key !== fixture.roleKeys.cs) throw new Error('alteração de função não persistiu no backend');
    if (errors.length) throw new Error(errors.join('; '));
    console.log(JSON.stringify({ status: 'PASS', runId, screenshots: 8, roleChanges: 2, deepLinkDenied: true, mobileOverflow: false, consoleErrors: 0, http5xx: 0 }));
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
}

async function cleanup() {
  const errors: string[] = [];
  const remove = async (query: PromiseLike<any>, label: string) => { const result = await query; if (result.error) errors.push(`${label}: ${result.error.message}`); };
  if (memberIds.length) {
    await remove(db.from('platform_audit_logs').delete().in('entity_id', memberIds), 'auditoria de pessoas');
    await remove(db.from('platform_team_members').delete().in('platform_member_id', memberIds), 'vínculos de equipe');
  }
  if (userIds.length) {
    await remove(db.from('platform_audit_logs').delete().in('actor_user_id', userIds), 'auditoria de atores');
    await remove(db.from('platform_members').delete().in('user_id', userIds), 'pessoas');
    for (const userId of userIds) { const result = await db.auth.admin.deleteUser(userId); if (result.error) errors.push(`auth: ${result.error.message}`); }
  }
  if (teamIds.length) await remove(db.from('platform_teams').delete().in('id', teamIds), 'equipes');
  if (roleIds.length) {
    await remove(db.from('platform_role_permissions').delete().in('role_id', roleIds), 'permissões dos papéis');
    await remove(db.from('platform_roles').delete().in('id', roleIds), 'papéis');
  }
  const residual = await db.from('platform_members').select('id', { count: 'exact', head: true }).in('user_id', userIds.length ? userIds : [crypto.randomUUID()]);
  if (residual.error) errors.push(`consulta residual: ${residual.error.message}`); else if (residual.count) errors.push(`pessoas residuais: ${residual.count}`);
  if (errors.length) throw new Error(`cleanup failed: ${errors.join('; ')}`);
}

await mkdir(artifacts, { recursive: true });
let failure: unknown;
try { const fixture = await setup(); await runQa(fixture); }
catch (error) { failure = error; console.error(error instanceof Error ? error.stack || error.message : String(error)); }
finally { try { await cleanup(); } catch (error) { failure ||= error; console.error(error instanceof Error ? error.stack || error.message : String(error)); } }
if (failure) process.exitCode = 1;
