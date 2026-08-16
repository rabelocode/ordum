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

test('custom role API derives the actor from the authenticated request and keeps mutations server-side', () => {
  const source = readFileSync(new URL('../src/server/adminControlPlaneRouter.ts', import.meta.url), 'utf8');
  assert.match(source, /router\.get\('\/access\/roles'/);
  assert.match(source, /router\.post\('\/access\/roles'.*requirePlatformPermission\('platform\.staff\.manage'\)/s);
  assert.match(source, /router\.patch\('\/access\/roles\/:id'.*requirePlatformPermission\('platform\.staff\.manage'\)/s);
  assert.match(source, /p_actor_user_id: req\.user\.id/);
  assert.doesNotMatch(source, /p_actor_user_id:\s*req\.body/);
  assert.match(source, /\.strict\(\)/);
  assert.match(source, /platform_system_role_protected/);
});

test('access UI uses the complete role catalog and exposes human custom-role actions', () => {
  const source = readFileSync(new URL('../src/pages/admin/AccessControlPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /fetch\('\/api\/admin\/access\/roles'/);
  assert.match(source, />Novo papel</);
  assert.match(source, />Editar papel</);
  assert.match(source, /Papel do sistema/);
  assert.match(source, /Esta alteração afetará/);
  assert.doesNotMatch(source, />Excluir papel</);
  assert.doesNotMatch(source, /platform_role_permissions/);
});

test('custom role migrations reproduce protected catalog and invoker-only wrappers', () => {
  const management = readFileSync(new URL('../supabase/migrations/20260816162954_platform_custom_roles_management.sql', import.meta.url), 'utf8');
  const wrappers = readFileSync(new URL('../supabase/migrations/20260816163157_platform_custom_roles_api_wrappers.sql', import.meta.url), 'utf8');
  assert.match(management, /system_managed boolean not null default false/);
  assert.match(management, /where key in \('admin', 'manager', 'sales'\)/);
  assert.match(management, /security definer/);
  assert.match(management, /platform\.role\.created/);
  assert.match(management, /platform\.role\.updated/);
  assert.match(wrappers, /create or replace function public\.platform_role_catalog/);
  assert.match(wrappers, /create or replace function public\.manage_platform_custom_role/);
  assert.doesNotMatch(wrappers, /security definer/);
  assert.match(wrappers, /revoke all .* from public, anon, authenticated/);
  assert.match(wrappers, /grant execute .* to service_role/);
});
