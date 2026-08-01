import assert from 'node:assert/strict';
import test from 'node:test';
import { canChangePlatformRole, canManageTeam, canReadAssignedResource, relationshipGrantsPrivilege } from '../src/server/authorization';

const member = (role: string, options: any = {}) => ({
  role: { key: role }, platformMember: { id: options.id || role, status: options.status || 'active' },
  teams: options.teams || [], managedTeams: options.managedTeams || [], permissions: options.permissions || [],
});

test('admin has global scope while manager is restricted to managed teams', () => {
  assert.equal(canManageTeam(member('admin'), 'outside'), true);
  assert.equal(canManageTeam(member('manager', { managedTeams: [{ id: 'team-a' }] }), 'team-a'), true);
  assert.equal(canManageTeam(member('manager', { managedTeams: [{ id: 'team-a' }] }), 'team-b'), false);
});

test('sales only reads own or team-visible assigned resources', () => {
  const sales = member('sales', { id: 'seller', teams: [{ id: 'team-a', member_lead_visibility: 'own' }] });
  assert.equal(canReadAssignedResource(sales, { team_id: 'team-a', owner_platform_member_id: 'seller' }, 'member_lead_visibility'), true);
  assert.equal(canReadAssignedResource(sales, { team_id: 'team-a', owner_platform_member_id: 'other' }, 'member_lead_visibility'), false);
  assert.equal(canReadAssignedResource(sales, { team_id: 'team-b', owner_platform_member_id: 'other' }, 'member_lead_visibility'), false);
});

test('external relationship never grants privilege and suspended users lose access', () => {
  assert.equal(relationshipGrantsPrivilege(), false);
  assert.equal(canManageTeam(member('admin', { status: 'suspended' }), 'any'), false);
});

test('tenant roles are not global roles and self-promotion is blocked', () => {
  assert.equal(canManageTeam(member('tenant_admin'), 'team-a'), false);
  assert.equal(canChangePlatformRole(member('manager'), 'same-user', 'same-user', 'manager', 'admin'), false);
  assert.equal(canChangePlatformRole(member('manager'), 'seller', 'manager-user', 'sales', 'admin'), false);
});
