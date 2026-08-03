import type { Session, User } from '@supabase/supabase-js';

export type PilotFixtureRole = 'tenant_admin' | 'manager' | 'employee' | 'recruiter' | 'compliance';

const PERMISSIONS: Record<PilotFixtureRole, string[]> = {
  tenant_admin: [
    'global.workspace.access', 'integrity.cases.read', 'integrity.cases.manage', 'people.portal.read',
    'people.requests.create', 'people.requests.manage', 'talents.jobs.manage', 'talents.candidates.manage',
  ],
  manager: ['global.workspace.access', 'people.portal.read', 'people.requests.create', 'people.team.read'],
  employee: ['global.workspace.access', 'people.portal.read', 'people.requests.create'],
  recruiter: ['global.workspace.access', 'talents.jobs.manage', 'talents.candidates.manage', 'talents.interviews.manage'],
  compliance: ['global.workspace.access', 'integrity.cases.read', 'integrity.cases.manage'],
};

export function isPilotE2EFixtureMode() {
  if (typeof window === 'undefined') return false;
  return (import.meta as any).env.VITE_E2E_FIXTURES_ENABLED === 'true'
    && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
}

export function getPilotE2EFixture() {
  if (!isPilotE2EFixtureMode()) return null;
  const rawRole = window.localStorage.getItem('ordum_e2e_role') as PilotFixtureRole | null;
  if (!rawRole || !(rawRole in PERMISSIONS)) return null;
  const role: PilotFixtureRole = rawRole;
  const userId = `10000000-0000-4000-8000-${String(Object.keys(PERMISSIONS).indexOf(role) + 1).padStart(12, '0')}`;
  const user = { id: userId, email: `${role}@fixture.invalid`, role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-08-03T00:00:00.000Z' } as unknown as User;
  const session = { access_token: `fixture-${role}`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } as Session;
  return {
    role,
    user,
    session,
    profile: { id: userId, full_name: `Fixture ${role}`, avatar_path: null },
    membership: { id: `20000000-0000-4000-8000-${String(Object.keys(PERMISSIONS).indexOf(role) + 1).padStart(12, '0')}`, tenant_id: '30000000-0000-4000-8000-000000000001', user_id: userId, status: 'active' },
    tenant: { id: '30000000-0000-4000-8000-000000000001', name: 'Ordum Pilot Trial', slug: 'ordum-pilot-trial', status: 'trial', settings: {} },
    permissions: PERMISSIONS[role],
    solutions: ['integrity', 'people', 'talent'],
  };
}
