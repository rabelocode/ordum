import crypto from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const base = (process.env.ADMIN_E2E_URL || '').replace(/\/$/, '');
const supabaseUrl = process.env.SUPABASE_URL || '';
const secret = process.env.SUPABASE_SECRET_KEY || '';
if (!base || !supabaseUrl || !secret) throw new Error('ADMIN_E2E_URL and Supabase server credentials are required');

const db = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `admin-nav-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
const password = `Qa!${crypto.randomBytes(18).toString('base64url')}`;
const artifacts = 'tmp/admin-navigation';
const users: string[] = [];
const members: string[] = [];
const roles: string[] = [];
const personas: Record<string, string> = {};

function value<T>(result: { data: T | null; error: any }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${label}: sem dados`);
  return result.data;
}

async function createCustomRole(key: string, name: string, permissions: string[]) {
  const role = value(await db.from('platform_roles').insert({ key: `${key}_${runId}`, name, description: 'Perfil descartável para QA da navegação', rank: 10, active: true }).select('id').single(), `role ${key}`);
  roles.push(role.id);
  const permissionRows = value(await db.from('platform_permissions').select('id,key').in('key', permissions), `permissions ${key}`);
  if (permissionRows.length !== permissions.length) throw new Error(`permissions ${key}: contrato incompleto`);
  value(await db.from('platform_role_permissions').insert(permissionRows.map(item => ({ role_id: role.id, permission_id: item.id }))).select(), `role permissions ${key}`);
  return role.id;
}

async function createPersona(key: string, name: string, roleId: string, relationshipType = 'employee') {
  const email = `${key}.${runId}@ordum-test.internal`;
  const auth = value(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, runId } }), `auth ${key}`).user;
  users.push(auth.id);
  const member = value(await db.from('platform_members').insert({ user_id: auth.id, role_id: roleId, status: 'active', relationship_type: relationshipType, created_by: auth.id }).select('id').single(), `member ${key}`);
  members.push(member.id);
  personas[key] = email;
}

async function setup() {
  const adminRole = value(await db.from('platform_roles').select('id').eq('key', 'admin').single(), 'admin role');
  const salesRole = await createCustomRole('sales_qa', 'Comercial', ['platform.access', 'platform.dashboard.read', 'platform.leads.read', 'platform.demos.manage', 'platform.commercial.read', 'platform.clients.read']);
  const financeRole = await createCustomRole('finance_qa', 'Financeiro', ['platform.access', 'platform.dashboard.read', 'platform.clients.read', 'platform.billing.read']);
  const csRole = await createCustomRole('cs_qa', 'Customer Success', ['platform.access', 'platform.dashboard.read', 'platform.clients.read', 'platform.onboarding.read', 'platform.success.read']);
  await createPersona('admin', 'Victor Almeida', adminRole.id, 'partner');
  await createPersona('sales', 'Rafael Comercial', salesRole);
  await createPersona('finance', 'Mariana Financeiro', financeRole);
  await createPersona('cs', 'Camila Sucesso', csRole);
}

function observe(page: Page, errors: string[]) {
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 180)}`); });
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
}

async function login(context: BrowserContext, persona: string, errors: string[]) {
  const page = await context.newPage();
  observe(page, errors);
  await page.goto(`${base}/#/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(personas[persona]);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/admin/, { timeout: 20_000 });
  await page.getByRole('navigation', { name: 'Navegação administrativa' }).waitFor();
  return page;
}

async function go(page: Page, hash: string) {
  await page.evaluate(value => { window.location.hash = value; }, hash);
  await page.reload({ waitUntil: 'networkidle' });
}

async function openGroup(page: Page, label: string) {
  const button = page.getByRole('button', { name: label, exact: true }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

async function labels(page: Page) {
  return page.getByRole('navigation', { name: 'Navegação administrativa' }).innerText();
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

async function waitForDashboard(page: Page) {
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Atualizar'));
    return button instanceof HTMLButtonElement && !button.disabled;
  });
}

async function runQa() {
  const errors: string[] = [];
  const browser = await chromium.launch({ headless: true });
  const contexts: BrowserContext[] = [];
  try {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(adminContext);
    const admin = await login(adminContext, 'admin', errors);
    await waitForDashboard(admin);
    const adminNav = await labels(admin);
    for (const label of ['Comercial', 'Clientes', 'Financeiro', 'Operação', 'Administração']) if (!adminNav.includes(label)) throw new Error(`admin sem grupo ${label}`);
    await screenshot(admin, '01-admin-full');
    const commercialButton = admin.getByRole('button', { name: 'Comercial', exact: true }).first();
    await commercialButton.focus(); await commercialButton.press('Space');
    if (await commercialButton.getAttribute('aria-expanded') !== 'true') throw new Error('Space não expandiu o menu');
    await commercialButton.press('Enter');
    if (await commercialButton.getAttribute('aria-expanded') !== 'false') throw new Error('Enter não recolheu o menu');
    await openGroup(admin, 'Administração');
    await admin.getByRole('link', { name: 'Acessos e permissões', exact: true }).waitFor();
    await screenshot(admin, '06-administration-open');

    const salesContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(salesContext);
    const sales = await login(salesContext, 'sales', errors);
    await waitForDashboard(sales);
    const salesNav = await labels(sales);
    if (!salesNav.includes('Comercial') || !salesNav.includes('Clientes') || /Financeiro|Operação|Administração/.test(salesNav)) throw new Error(`sidebar comercial incorreta: ${salesNav}`);
    await openGroup(sales, 'Comercial');
    await screenshot(sales, '02-sales-reduced');
    await go(sales, '#/admin/financeiro?view=payments');
    await sales.getByRole('heading', { name: 'Área restrita', exact: true }).waitFor();

    const financeContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(financeContext);
    const finance = await login(financeContext, 'finance', errors);
    const financeNav = await labels(finance);
    if (!financeNav.includes('Financeiro') || financeNav.includes('Administração') || financeNav.includes('Comercial')) throw new Error(`sidebar financeira incorreta: ${financeNav}`);
    await go(finance, '#/admin/financeiro?view=payments');
    try { await finance.getByRole('heading', { name: 'Cobranças', exact: true }).waitFor({ timeout: 10_000 }); }
    catch { throw new Error(`finance deep link ${finance.url()}: ${(await finance.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1000)}`); }
    await finance.getByRole('link', { name: 'Cobranças', exact: true }).first().getAttribute('aria-current').then(value => { if (value !== 'page') throw new Error('Cobranças sem active state'); });
    await screenshot(finance, '03-finance-reduced');
    await screenshot(finance, '05-finance-open');
    await finance.getByRole('link', { name: 'Assinaturas', exact: true }).first().click();
    await finance.getByRole('heading', { name: 'Assinaturas', exact: true }).waitFor();
    await finance.goBack();
    await finance.getByRole('heading', { name: 'Cobranças', exact: true }).waitFor();
    await finance.goForward();
    await finance.getByRole('heading', { name: 'Assinaturas', exact: true }).waitFor();

    const csContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(csContext);
    const cs = await login(csContext, 'cs', errors);
    await openGroup(cs, 'Clientes');
    const csNav = await labels(cs);
    if (!csNav.includes('Clientes') || !csNav.includes('Customer Success') || /Financeiro|Operação|Administração|Comercial/.test(csNav)) throw new Error(`sidebar CS incorreta: ${csNav}`);
    await go(cs, '#/admin/customer-success');
    await cs.getByRole('heading', { name: 'Customer Success', exact: true }).waitFor();
    await screenshot(cs, '04-cs-reduced');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await adminContext.storageState() }); contexts.push(mobileContext);
    const mobile = await mobileContext.newPage(); observe(mobile, errors);
    await mobile.goto(`${base}/#/admin`, { waitUntil: 'networkidle' });
    await mobile.getByRole('button', { name: 'Abrir menu' }).waitFor();
    await mobile.getByRole('button', { name: 'Abrir menu' }).click();
    await mobile.getByRole('complementary', { name: 'Menu administrativo' }).waitFor();
    await openGroup(mobile, 'Financeiro');
    await screenshot(mobile, '07-mobile-menu');
    await mobile.getByRole('link', { name: 'Cobranças', exact: true }).first().click();
    await mobile.getByRole('heading', { name: 'Cobranças', exact: true }).waitFor();
    const visibleMenus = await mobile.getByRole('complementary', { name: 'Menu administrativo' }).evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none').length);
    if (visibleMenus) throw new Error('drawer mobile permaneceu aberto');
    await mobile.getByRole('button', { name: 'Abrir menu' }).click();
    await mobile.keyboard.press('Escape');
    const menusAfterEscape = await mobile.getByRole('complementary', { name: 'Menu administrativo' }).evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none').length);
    if (menusAfterEscape) throw new Error('Escape não fechou o drawer mobile');
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error('overflow horizontal no menu mobile');

    if (errors.length) throw new Error(errors.join('; '));
    console.log(JSON.stringify({ status: 'PASS', runId, screenshots: 7, personas: Object.keys(personas), consoleErrors: 0, http5xx: 0 }));
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
}

async function cleanup() {
  const errors: string[] = [];
  const remove = async (query: PromiseLike<any>, label: string) => { const result = await query; if (result.error) errors.push(`${label}: ${result.error.message}`); };
  if (users.length) {
    await remove(db.from('platform_audit_logs').delete().in('actor_user_id', users), 'audit');
    await remove(db.from('platform_state_transitions').delete().in('actor_user_id', users), 'transitions');
    await remove(db.from('platform_members').delete().in('user_id', users), 'members');
    for (const user of users) { const result = await db.auth.admin.deleteUser(user); if (result.error) errors.push(`auth: ${result.error.message}`); }
  }
  if (roles.length) {
    await remove(db.from('platform_role_permissions').delete().in('role_id', roles), 'role permissions');
    await remove(db.from('platform_roles').delete().in('id', roles), 'roles');
  }
  const residual = await db.from('platform_roles').select('id', { count: 'exact', head: true }).in('id', roles.length ? roles : [crypto.randomUUID()]);
  if (residual.error) errors.push(`residual query: ${residual.error.message}`); else if (residual.count) errors.push(`residual roles: ${residual.count}`);
  if (errors.length) throw new Error(`cleanup failed: ${errors.join('; ')}`);
}

await mkdir(artifacts, { recursive: true });
let failure: unknown;
try { await setup(); await runQa(); }
catch (error) { failure = error; console.error(error instanceof Error ? error.stack || error.message : String(error)); }
finally { try { await cleanup(); } catch (error) { failure ||= error; console.error(error instanceof Error ? error.stack || error.message : String(error)); } }
if (failure) process.exitCode = 1;
