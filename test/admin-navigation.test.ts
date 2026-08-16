import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeAdminNavigation,
  adminBreadcrumb,
  buildAdminNavigation,
  isKnownAdminRouteAllowed,
} from '../src/pages/admin/adminNavigation';
import { billingViewFromHash } from '../src/pages/admin/billingNavigation';

const treeFor = (permissions: string[], roleKey?: string, hasTeams = false) => buildAdminNavigation({
  can: permission => permissions.includes(permission),
  roleKey,
  hasTeams,
});
const labels = (tree: ReturnType<typeof treeFor>) => Object.fromEntries(tree.map(group => [group.label, group.children.map(child => child.label)]));

test('Admin Global sees the complete authorized domain tree without empty parents', () => {
  const permissions = [
    'platform.leads.read', 'platform.demos.manage', 'platform.commercial.read',
    'platform.clients.read', 'platform.onboarding.read', 'platform.success.read',
    'platform.billing.read', 'platform.support.read', 'platform.audit.read', 'platform.system.read',
    'platform.staff.read', 'platform.teams.read', 'platform.access.simulate', 'platform.settings.read',
  ];
  const tree = treeFor(permissions, 'admin');
  assert.deepEqual(tree.map(group => group.label), ['Comercial', 'Clientes', 'Financeiro', 'Operação', 'Administração']);
  assert.ok(tree.every(group => group.children.length > 0));
  assert.deepEqual(labels(tree).Financeiro, ['Visão geral', 'Assinaturas', 'Cobranças', 'Inadimplência', 'Planos']);
});

test('Sales sees commercial work and companies without finance or administration', () => {
  const tree = treeFor(['platform.commercial.read'], 'sales');
  assert.deepEqual(tree.map(group => group.label), ['Comercial', 'Clientes']);
  assert.deepEqual(labels(tree).Comercial, ['Leads', 'Demonstrações', 'Propostas', 'Contratos']);
  assert.deepEqual(labels(tree).Clientes, ['Empresas']);
});

test('Finance sees finance and authorized companies only', () => {
  const tree = treeFor(['platform.clients.read', 'platform.billing.read']);
  assert.deepEqual(tree.map(group => group.label), ['Clientes', 'Financeiro']);
  assert.equal(labels(tree).Administração, undefined);
});

test('Customer Success sees only its authorized client work', () => {
  const tree = treeFor(['platform.clients.read', 'platform.onboarding.read', 'platform.success.read']);
  assert.deepEqual(tree.map(group => group.label), ['Clientes']);
  assert.deepEqual(labels(tree).Clientes, ['Empresas', 'Implantação', 'Customer Success']);
  assert.equal(labels(tree).Operação, undefined);
});

test('A user with only client read gets Inicio plus Clientes > Empresas', () => {
  const tree = treeFor(['platform.clients.read']);
  assert.deepEqual(labels(tree), { Clientes: ['Empresas'] });
});

test('Deep links select their parent, child and breadcrumb', () => {
  const finance = treeFor(['platform.billing.read']);
  assert.equal(activeAdminNavigation(finance, '#/admin/financeiro?view=payments')?.group.label, 'Financeiro');
  assert.equal(activeAdminNavigation(finance, '#/admin/financeiro?view=payments')?.child.label, 'Cobranças');
  assert.equal(adminBreadcrumb(finance, '#/admin/financeiro?view=payments'), 'Financeiro / Cobranças');
  const clients = treeFor(['platform.clients.read']);
  assert.equal(activeAdminNavigation(clients, '#/admin/empresas/00000000-0000-0000-0000-000000000000')?.child.label, 'Empresas');
  assert.equal(adminBreadcrumb(clients, '#/admin/empresas/00000000-0000-0000-0000-000000000000'), 'Clientes / Empresa');
  assert.equal(billingViewFromHash('#/admin/financeiro?view=payments'), 'payments');
  assert.equal(billingViewFromHash('#/admin/financeiro?view=invalid'), 'overview');
});

test('Direct domain routes are denied when their permission is absent', () => {
  const sales = treeFor(['platform.commercial.read'], 'sales');
  assert.equal(isKnownAdminRouteAllowed(sales, '#/admin/financeiro?view=payments'), false);
  assert.equal(isKnownAdminRouteAllowed(sales, '#/admin/sistema'), false);
  assert.equal(isKnownAdminRouteAllowed(sales, '#/admin/leads'), true);
});
