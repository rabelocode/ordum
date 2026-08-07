import { createClient } from '@supabase/supabase-js';

const url = 'https://plnciaxcujnvaermxmby.supabase.co';
const key = process.env.SUPABASE_SECRET_KEY || '';

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function purgeE2EUsers() {
  console.log('Purging E2E users...');
  const { data, error } = await db.auth.admin.listUsers();
  if (error) {
    console.error('List error:', error);
    process.exit(1);
  }

  const e2e = data.users.filter(u => u.email?.includes('e2e_') || u.email?.includes('ordum-test.internal'));
  console.log(`Found ${e2e.length} E2E users.`);

  for (const u of e2e) {
    await db.from('platform_members').delete().eq('user_id', u.id);
    const d = await db.auth.admin.deleteUser(u.id);
    console.log(`Deleted ${u.email}:`, d.error ? d.error.message : 'OK');
  }

  // Purge suspended platform members
  await db.from('platform_members').delete().eq('status', 'suspended');
  console.log('✓ Cleanup completed successfully.');
  process.exit(0);
}

purgeE2EUsers();
