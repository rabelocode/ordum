import crypto from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const base = (process.env.ADMIN_E2E_URL || '').replace(/\/$/, '');
const supabaseUrl = process.env.SUPABASE_URL || '';
const secret = process.env.SUPABASE_SECRET_KEY || '';
if (!base || !supabaseUrl || !secret) throw new Error('ADMIN_E2E_URL and Supabase server credentials are required');

const db = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `custom-role-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
const password = `Qa!${crypto.randomBytes(18).toString('base64url')}`;
const artifacts = 'tmp/custom-roles';
const users: string[] = [];
const members: string[] = [];
const createdRoles: string[] = [];
const emails: Record<string, string> = {};

function value<T>(result: { data: T | null; error: any }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${label}: sem dados`);
  return result.data;
}

async function createPerson(key: string, name: string, roleId: string, relationshipType = 'employee') {
  const email = `${key}.${runId}@ordum-test.internal`;
  const auth = value(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, runId } }), `auth ${key}`).user;
  users.push(auth.id); emails[key] = email;
  const member = value(await db.from('platform_members').insert({ user_id: auth.id, role_id: roleId, status: 'active', relationship_type: relationshipType, created_by: auth.id }).select('id').single(), `membro ${key}`);
  members.push(member.id);
  return { userId: auth.id, memberId: member.id };
}

async function setup() {
  const roles = value(await db.from('platform_roles').select('id,key').in('key', ['admin', 'sales']), 'papéis de sistema');
  const adminRole = roles.find(role => role.key === 'admin');
  const salesRole = roles.find(role => role.key === 'sales');
  if (!adminRole || !salesRole) throw new Error('papéis de sistema incompletos');
  const admin = await createPerson('admin', 'Victor Administrador', adminRole.id, 'partner');
  const target = await createPerson('finance', 'Mariana Financeiro QA', salesRole.id);
  return { admin, target, adminRoleId: adminRole.id };
}

function observe(page: Page, errors: string[]) {
  page.on('console', message => { if (message.type() === 'error') errors.push(`console ${page.url()}: ${message.text().slice(0, 180)}`); });
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

async function openAccess(page: Page) {
  if (!page.url().startsWith(base)) await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.location.hash = '#/admin/acessos'; });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Acessos e permissões' }).waitFor();
  await page.getByRole('button', { name: 'Papéis', exact: true }).waitFor();
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

async function createRoleInUi(page: Page, name: string, permissions: string[], unassigned = false) {
  const rolesTab = page.getByRole('button', { name: 'Papéis', exact: true });
  if (await rolesTab.getAttribute('aria-current') !== 'page') await rolesTab.click();
  const newRole = page.getByRole('button', { name: 'Novo papel' });
  await newRole.waitFor();
  await newRole.click();
  const editor = page.getByRole('dialog', { name: /Crie uma função/ });
  await editor.getByLabel('Nome').fill(name);
  await editor.getByLabel('Descrição').fill(`${unassigned ? 'Papel sem pessoa' : 'Acesso operacional a clientes e financeiro.'} · ${runId}`);
  if (!unassigned) await screenshot(page, '02-new-role');
  for (const permission of permissions) await editor.getByText(permission, { exact: true }).click();
  if (!unassigned) {
    await screenshot(page, '03-permissions');
    await editor.getByText('Financeiro', { exact: true }).last().waitFor();
    await screenshot(page, '04-preview');
  }
  await editor.getByRole('button', { name: 'Criar papel' }).click();
  await page.getByText('Papel criado.', { exact: true }).waitFor();
  const role = value(await db.from('platform_roles').select('id,key').eq('name', name).eq('description', `${unassigned ? 'Papel sem pessoa' : 'Acesso operacional a clientes e financeiro.'} · ${runId}`).single(), `papel ${name}`);
  createdRoles.push(role.id);
  return role;
}

async function runQa(fixture: Awaited<ReturnType<typeof setup>>) {
  const errors: string[] = [];
  const browser = await chromium.launch({ headless: true });
  const contexts: BrowserContext[] = [];
  try {
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(adminContext);
    const admin = await login(adminContext, 'admin', errors);
    const catalogResponse = admin.waitForResponse(response => response.url().includes('/api/admin/access/roles') && response.request().method() === 'GET');
    await openAccess(admin);
    const catalogStatus = (await catalogResponse).status();
    if (catalogStatus !== 200) throw new Error(`catálogo de papéis retornou ${catalogStatus}`);
    await admin.getByRole('button', { name: 'Papéis', exact: true }).click();
    for (const systemRole of ['Administrador', 'Gerente', 'Vendas']) {
      const systemCard = admin.locator('article').filter({ hasText: systemRole });
      await systemCard.getByText('Papel do sistema', { exact: true }).waitFor();
      if (await systemCard.getByRole('button', { name: 'Editar papel' }).count()) throw new Error(`${systemRole} exibiu edição`);
    }
    await screenshot(admin, '01-roles');

    const financeRole = await createRoleInUi(admin, 'Financeiro Júnior', ['Visualizar empresas', 'Visualizar financeiro']);
    await admin.getByText('Financeiro Júnior', { exact: true }).waitFor();
    await admin.getByText('0 pessoas', { exact: true }).last().waitFor();
    await screenshot(admin, '05-role-created');

    await admin.getByRole('button', { name: 'Acessos', exact: true }).click();
    await admin.getByPlaceholder('Buscar por nome ou e-mail').fill(runId);
    await admin.locator('article').filter({ hasText: 'Mariana Financeiro QA' }).getByRole('button', { name: /Gerenciar acesso/ }).click();
    const access = admin.getByRole('dialog', { name: /Mariana Financeiro QA/ });
    await access.getByLabel('Função').selectOption({ label: 'Financeiro Júnior' });
    await screenshot(admin, '06-assign-role');
    await access.getByRole('button', { name: 'Salvar acesso' }).click();
    await admin.getByText('Função e equipes atualizadas.', { exact: true }).waitFor();

    const financeContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(financeContext);
    const finance = await login(financeContext, 'finance', errors);
    const nav = await finance.getByRole('navigation', { name: 'Navegação administrativa' }).innerText();
    for (const expected of ['Clientes', 'Financeiro']) if (!nav.includes(expected)) throw new Error(`menu do papel customizado sem ${expected}`);
    for (const absent of ['Comercial', 'Administração', 'Operação']) if (nav.includes(absent)) throw new Error(`menu do papel customizado exibiu ${absent}`);
    await finance.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await screenshot(finance, '07-custom-role-menu');
    await finance.goto(`${base}/#/admin/acessos`, { waitUntil: 'networkidle' });
    await finance.getByRole('heading', { name: 'Área restrita' }).waitFor();
    const financeToken = await finance.evaluate(() => {
      const sessionKey = Object.keys(localStorage).find(key => key.includes('auth-token'));
      const stored = sessionKey ? JSON.parse(localStorage.getItem(sessionKey) || '{}') : null;
      return stored?.access_token || stored?.currentSession?.access_token;
    });
    const unauthorizedBody = { name: 'Escalada', description: '', permission_keys: ['platform.staff.manage'] };
    const unauthorizedHeaders = { Authorization: `Bearer ${financeToken}` };
    const unauthorizedCreate = await finance.request.post(`${base}/api/admin/access/roles`, { headers: unauthorizedHeaders, data: unauthorizedBody });
    const unauthorizedUpdate = await finance.request.patch(`${base}/api/admin/access/roles/${financeRole.id}`, { headers: unauthorizedHeaders, data: unauthorizedBody });
    if (unauthorizedCreate.status() !== 403 || unauthorizedUpdate.status() !== 403) throw new Error(`gestão sem staff.manage retornou POST ${unauthorizedCreate.status()} / PATCH ${unauthorizedUpdate.status()}`);
    await finance.close();

    await openAccess(admin);
    await admin.getByRole('button', { name: 'Papéis', exact: true }).click();
    const card = admin.locator('article').filter({ hasText: 'Financeiro Júnior' });
    await card.getByRole('button', { name: 'Editar papel' }).click();
    const editor = admin.getByRole('dialog', { name: /Financeiro Júnior/ });
    await editor.getByText('Visualizar Customer Success', { exact: true }).click();
    await editor.getByRole('button', { name: 'Salvar alterações' }).click();
    const impact = admin.getByRole('dialog', { name: 'Confirmar alteração de permissões' });
    await impact.getByText(/afetará 1 pessoa/).waitFor();
    await screenshot(admin, '08-edit-impact');
    await impact.getByRole('button', { name: 'Salvar alterações' }).click();
    await admin.getByText('Papel atualizado.', { exact: true }).waitFor();

    const refreshedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(refreshedContext);
    const refreshed = await login(refreshedContext, 'finance', errors);
    const refreshedNav = refreshed.getByRole('navigation', { name: 'Navegação administrativa' });
    await refreshedNav.getByRole('button', { name: 'Clientes', exact: true }).click();
    await refreshedNav.getByText('Customer Success', { exact: true }).waitFor();
    await refreshed.close();

    await createRoleInUi(admin, 'Revisor Operacional', ['Visualizar suporte'], true);
    await admin.getByText('Revisor Operacional', { exact: true }).waitFor();
    await admin.getByText('0 pessoas', { exact: true }).last().waitFor();

    const adminSession = await adminContext.storageState();
    const token = await admin.evaluate(() => {
      const key = Object.keys(localStorage).find(item => item.includes('auth-token'));
      const stored = key ? JSON.parse(localStorage.getItem(key) || '{}') : null;
      return stored?.access_token || stored?.currentSession?.access_token;
    });
    const protectedResponse = await admin.request.patch(`${base}/api/admin/access/roles/${fixture.adminRoleId}`, { headers: { Authorization: `Bearer ${token}` }, data: { name: 'Administrador alterado', description: '', permission_keys: ['platform.staff.manage'] } });
    if (protectedResponse.status() !== 409) throw new Error(`papel do sistema retornou ${protectedResponse.status()}`);

    await admin.goto(`${base}/#/admin/auditoria`, { waitUntil: 'networkidle' });
    await admin.getByText(/criou um papel de acesso/).first().waitFor();
    await admin.getByText(/atualizou as permissões de um papel/).first().waitFor();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: adminSession }); contexts.push(mobileContext);
    const mobile = await mobileContext.newPage(); observe(mobile, errors);
    await openAccess(mobile);
    await mobile.getByRole('button', { name: 'Papéis', exact: true }).click();
    await mobile.locator('article').filter({ hasText: 'Financeiro Júnior' }).getByRole('button', { name: 'Editar papel' }).click();
    await screenshot(mobile, '09-mobile-role');
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error('overflow horizontal no editor mobile');

    const assigned = value(await db.from('platform_members').select('platform_roles(key)').eq('id', fixture.target.memberId).single(), 'atribuição final');
    if ((assigned as any).platform_roles?.key !== financeRole.key) throw new Error('papel customizado não permaneceu atribuído');
    if (errors.length) throw new Error(errors.join('; '));
    console.log(JSON.stringify({ status: 'PASS', runId, catalogStatus, rolesCreated: 2, unassignedVisible: true, systemRoleProtected: true, deepLinkDenied: true, auditHuman: true, screenshots: 9, mobileOverflow: false, consoleErrors: 0, http5xx: 0 }));
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
}

async function cleanup() {
  const errors: string[] = [];
  const remove = async (query: PromiseLike<any>, label: string) => { const result = await query; if (result.error) errors.push(`${label}: ${result.error.message}`); };
  if (createdRoles.length) {
    await remove(db.from('platform_audit_logs').delete().in('entity_id', createdRoles), 'auditoria de papéis');
  }
  if (users.length) await remove(db.from('platform_audit_logs').delete().in('actor_user_id', users), 'auditoria de atores');
  if (members.length) {
    await remove(db.from('platform_team_members').delete().in('platform_member_id', members), 'vínculos de equipes');
    await remove(db.from('platform_members').delete().in('id', members), 'membros');
  }
  if (createdRoles.length) {
    await remove(db.from('platform_role_permissions').delete().in('role_id', createdRoles), 'permissões dos papéis');
    await remove(db.from('platform_roles').delete().in('id', createdRoles), 'papéis');
  }
  for (const userId of users) { const result = await db.auth.admin.deleteUser(userId); if (result.error) errors.push(`auth ${userId}: ${result.error.message}`); }
  const roleResidual = await db.from('platform_roles').select('id', { count: 'exact', head: true }).ilike('description', `%${runId}%`);
  if (roleResidual.error) errors.push(`consulta residual de papéis: ${roleResidual.error.message}`); else if (roleResidual.count) errors.push(`papéis residuais: ${roleResidual.count}`);
  const memberResidual = await db.from('platform_members').select('id', { count: 'exact', head: true }).in('user_id', users.length ? users : [crypto.randomUUID()]);
  if (memberResidual.error) errors.push(`consulta residual de membros: ${memberResidual.error.message}`); else if (memberResidual.count) errors.push(`membros residuais: ${memberResidual.count}`);
  if (errors.length) throw new Error(`cleanup failed: ${errors.join('; ')}`);
}

await mkdir(artifacts, { recursive: true });
let failure: unknown;
try { const fixture = await setup(); await runQa(fixture); }
catch (error) { failure = error; console.error(error instanceof Error ? error.stack || error.message : String(error)); }
finally { try { await cleanup(); } catch (error) { failure ||= error; console.error(error instanceof Error ? error.stack || error.message : String(error)); } }
if (failure) process.exitCode = 1;
