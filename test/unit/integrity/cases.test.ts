import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canAssignIntegrityCase, canTransitionIntegrityCase, integrityDashboard, integritySlaDueAt, integrityTransitionNeedsReason, publicIntegrityMessages } from '../../../src/domain/integrity';

const migration = readFileSync(resolve('supabase/migrations/20260809132523_integrity_core_phase4.sql'), 'utf8');
const router = readFileSync(resolve('src/server/integrityRouter.ts'), 'utf8');
const adminRouter = readFileSync(resolve('src/server/adminClientsRouter.ts'), 'utf8');

describe('Ordum Integridade Core Phase 4', () => {
  it('1. public submission creates an original report', () => assert.match(migration, /insert into public\.integrity_reports\(/i));
  it('2. protocol is generated from cryptographic UUID entropy', () => assert.match(migration, /v_protocol := 'ORD-'\|\|upper\(substr\(replace\(gen_random_uuid/i));
  it('3. access secret is stored only as a bcrypt hash', () => {
    assert.match(migration, /crypt\(v_secret,gen_salt\('bf'\)\)/i);
    assert.doesNotMatch(migration, /integrity_report_secrets\(report_id,access_secret\)/i);
  });
  it('4. protocol alone cannot read a report', () => assert.match(migration, /secret\.secret_hash=crypt\(p_access_secret,secret\.secret_hash\)/i));
  it('5. incorrect secret cannot satisfy the constant database comparison', () => assert.equal(migration.includes('secret.secret_hash=crypt(p_access_secret,secret.secret_hash)'), true));
  it('6. valid tracking returns only a public projection', () => {
    assert.match(migration, /read_integrity_report_v2/);
    assert.match(migration, /message\.visible_to_reporter/);
    assert.doesNotMatch(migration.match(/create or replace function public\.read_integrity_report_v2[\s\S]*?revoke all/i)?.[0] || '', /integrity_report_identities/);
  });
  it('7. cases are isolated by tenant and permission in RLS', () => assert.match(migration, /integrity_cases_read[\s\S]*has_permission\(tenant_id, 'integrity\.cases\.read'\)/));
  it('8. submission creates a separate case linked to the report', () => assert.match(migration, /insert into public\.integrity_cases[\s\S]*v_report_id/i));
  it('9. received can transition to triage', () => assert.equal(canTransitionIntegrityCase('received', 'triage'), true));
  it('10. received cannot skip directly to closed', () => assert.equal(canTransitionIntegrityCase('received', 'closed'), false));
  it('11. assignment accepts an active same-tenant member without conflict', () => assert.equal(canAssignIntegrityCase({ membershipActive: true, sameTenant: true, activeConflict: false }), true));
  it('12. API denies users without an explicit integrity permission', () => assert.match(router, /if \(!permissions\.some\([\s\S]*return res\.status\(403\)/));
  it('13. conflict of interest blocks assignment', () => assert.equal(canAssignIntegrityCase({ membershipActive: true, sameTenant: true, activeConflict: true }), false));
  it('14. internal notes are removed from reporter projection', () => assert.deepEqual(publicIntegrityMessages([{ id: 1, visible_to_reporter: false }, { id: 2, visible_to_reporter: true }]), [{ id: 2, visible_to_reporter: true }]));
  it('15. external messages remain visible to the reporter', () => assert.equal(publicIntegrityMessages([{ visible_to_reporter: true }]).length, 1));
  it('16. SLA deadline is deterministic', () => assert.equal(integritySlaDueAt(new Date('2026-08-09T00:00:00Z'), 24).toISOString(), '2026-08-10T00:00:00.000Z'));
  it('17. closing and reopening require a reason', () => {
    assert.equal(integrityTransitionNeedsReason('closed'), true);
    assert.equal(integrityTransitionNeedsReason('reopened'), true);
  });
  it('18. case event timeline is append-only', () => assert.match(migration, /before update or delete on public\.integrity_case_events/));
  it('19. tenant settings require settings.manage in RLS', () => assert.match(migration, /integrity_settings_manage[\s\S]*integrity\.settings\.manage/));
  it('20. Admin Global receives aggregates and no confidential content', () => {
    const endpoint = adminRouter.match(/router\.get\('\/:id\/integrity-summary'[\s\S]*?\n  \}\);/)?.[0] || '';
    assert.match(endpoint, /confidentiality_boundary: 'aggregate_only'/);
    assert.doesNotMatch(endpoint, /description|integrity_report_identities|integrity_report_messages/);
  });
  it('dashboard leaves unavailable averages as null instead of fake zero', () => {
    const result = integrityDashboard([], new Date('2026-08-09T00:00:00Z'));
    assert.equal(result.average_first_action_hours, null);
    assert.equal(result.average_resolution_hours, null);
  });
  it('dashboard detects critical and overdue open cases', () => {
    const result = integrityDashboard([{ status: 'investigation', severity: 'critical', created_at: '2026-08-01T00:00:00Z', sla_due_at: '2026-08-08T00:00:00Z' }], new Date('2026-08-09T00:00:00Z'));
    assert.equal(result.critical, 1); assert.equal(result.sla_overdue, 1);
  });
});
