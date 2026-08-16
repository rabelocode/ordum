import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { navigationPreview, permissionGroups, permissionLabel, roleAreas, roleLabel, SYSTEM_ROLE_KEYS } from '../src/pages/admin/adminAccessPresentation';

test('access preview reuses the real navigation taxonomy for commercial, finance and CS', () => {
  assert.deepEqual(navigationPreview(['platform.commercial.read', 'platform.clients.read']).map(group => group.label), ['Comercial', 'Clientes']);
  assert.deepEqual(navigationPreview(['platform.clients.read', 'platform.billing.read']).map(group => group.label), ['Clientes', 'Financeiro']);
  assert.deepEqual(navigationPreview(['platform.clients.read', 'platform.onboarding.read', 'platform.success.read']).map(group => group.label), ['Clientes']);
});

test('permissions and roles are presented in business language', () => {
  assert.equal(permissionLabel('platform.billing.read'), 'Visualizar financeiro');
  assert.equal(permissionLabel('platform.staff.manage'), 'Administrar membros da Ordum');
  assert.equal(roleLabel({ key: 'sales', name: 'Sales' }), 'Comercial');
  assert.equal(roleLabel({ key: 'manager', name: 'Manager' }), 'Gerente');
  assert.equal(SYSTEM_ROLE_KEYS.has('admin'), true);
  assert.deepEqual(roleAreas(['platform.billing.read']), ['Financeiro']);
  assert.equal(permissionGroups(['platform.billing.read'])[0]?.items[0]?.label, 'Visualizar financeiro');
});

test('unknown custom roles keep the backend name without exposing a role key', () => {
  assert.equal(roleLabel({ key: 'finance_coordinator', name: 'Coordenação Financeira' }), 'Coordenação Financeira');
  assert.equal(roleLabel({ key: 'finance_coordinator' }), 'Função personalizada');
});

test('server contract keeps self-role and last-admin protections', () => {
  const source = readFileSync(new URL('../src/server/adminOtherRouter.ts', import.meta.url), 'utf8');
  assert.match(source, /targetMember\.user_id === req\.user\.id/);
  assert.match(source, /Ninguém pode alterar a própria função global/);
  assert.match(source, /Não é possível rebaixar a função do único Admin ativo/);
  assert.match(source, /Não é possível suspender o único Admin ativo/);
  assert.match(source, /requirePlatformPermission\('platform\.staff\.manage'\)/);
});
