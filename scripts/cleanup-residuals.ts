import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || '';

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SECRET_KEY não fornecida.');
    process.exit(1);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('=== REMOVENDO TODOS OS USUÁRIOS AUTH E PLATFORM MEMBERS RESIDUAIS DE TESTE ===');

  const { data: usersData } = await db.auth.admin.listUsers();
  const e2eUsers = (usersData?.users || []).filter(u =>
    u.email?.includes('e2e_') || u.email?.includes('@ordum-test.internal')
  );

  for (const u of e2eUsers) {
    console.log(`Deletando platform_member e auth user: ${u.email}`);
    await db.from('platform_members').delete().eq('user_id', u.id);
    await db.auth.admin.deleteUser(u.id);
  }

  const { data: members } = await db.from('platform_members').select('*');
  const residualMembers = (members || []).filter(m => m.status === 'suspended');
  for (const m of residualMembers) {
    console.log(`Deletando platform_member suspenso: ${m.id}`);
    await db.from('platform_members').delete().eq('id', m.id);
  }

  const { data: checkUsers } = await db.auth.admin.listUsers();
  const remUsers = (checkUsers?.users || []).filter(u => u.email?.includes('e2e_') || u.email?.includes('@ordum-test.internal'));
  const { data: checkMembers } = await db.from('platform_members').select('*');
  const remMembers = (checkMembers || []).filter(m => m.status === 'suspended');

  console.log('--- COMPROVAÇÃO DE RESIDUAIS ZERO ---');
  console.log(`Usuários Auth E2E residuais restantes: ${remUsers.length}`);
  console.log(`Platform members E2E residuais/suspensos restantes: ${remMembers.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Erro na limpeza:', err);
  process.exit(1);
});
