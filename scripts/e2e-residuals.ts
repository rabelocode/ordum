import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const TEST_DOMAIN = '@ordum-test.internal';
const RUN_ID = /^e2e_run_\d+_[0-9a-f]{8}$/;

export type ResidualCounts = {
  authE2E: number;
  platformMembersE2E: number;
  activePlatformMembersE2E: number;
};

function fixtureRunId(user: User): string | null {
  const email = user.email?.toLowerCase() || '';
  if (!email.endsWith(TEST_DOMAIN)) return null;
  const local = email.slice(0, -TEST_DOMAIN.length);
  const match = local.match(/^(e2e_run_\d+_[0-9a-f]{8})_(admin|approver)$/);
  if (!match || !RUN_ID.test(match[1])) return null;
  return user.user_metadata?.runId === match[1] ? match[1] : null;
}

async function listProvenUsers(db: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.users list: ${error.message}`);
    users.push(...data.users.filter((user) => fixtureRunId(user)));
    if (data.users.length < 1000) return users;
    page += 1;
  }
}

async function memberCounts(db: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) return { total: 0, active: 0 };
  const { data, error } = await db.from('platform_members').select('user_id,status').in('user_id', userIds);
  if (error) throw new Error(`platform_members list: ${error.message}`);
  return { total: data.length, active: data.filter((row) => row.status === 'active').length };
}

export async function inspectE2EResiduals(db: SupabaseClient): Promise<ResidualCounts> {
  const users = await listProvenUsers(db);
  const members = await memberCounts(db, users.map((user) => user.id));
  return { authE2E: users.length, platformMembersE2E: members.total, activePlatformMembersE2E: members.active };
}

export async function purgeE2EResiduals(db: SupabaseClient): Promise<ResidualCounts> {
  const users = await listProvenUsers(db);
  for (const user of users) {
    const { error: memberError } = await db.from('platform_members').delete().eq('user_id', user.id);
    if (memberError) throw new Error(`platform_members delete ${user.id}: ${memberError.message}`);
    const { error: authError } = await db.auth.admin.deleteUser(user.id);
    if (authError) throw new Error(`auth.users delete ${user.id}: ${authError.message}`);
  }
  const counts = await inspectE2EResiduals(db);
  if (counts.authE2E || counts.platformMembersE2E || counts.activePlatformMembersE2E) {
    throw new Error(`E2E residues remain: ${JSON.stringify(counts)}`);
  }
  return counts;
}

export function createE2EAdminClient() {
  const url = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
  const key = process.env.SUPABASE_SECRET_KEY || '';
  if (!key) throw new Error('SUPABASE_SECRET_KEY is required.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
