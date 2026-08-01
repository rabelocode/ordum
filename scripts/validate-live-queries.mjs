import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Credenciais server-side ausentes para smoke read-only.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const checks = [
  ['leads', db.from('marketing_leads').select('*, platform_lead_assignments(*, platform_teams(name,allow_self_claim), platform_members(user_id, platform_roles(key, name))), commercial_activities(id,activity_type,subject,status,scheduled_at,result,next_action,next_action_at,created_at), commercial_demos(id,status,starts_at,expires_at,result,next_action,next_action_at)', { count: 'exact' }).limit(1)],
  ['clients', db.from('tenants').select('*, tenant_solutions(*), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))), tenant_billing_state(*), tenant_domains(*), memberships(id,status,user_id,employment_level), departments(id,name,active)', { count: 'exact' }).limit(1)],
  ['billing-records', db.from('billing_subscriptions').select('*, billing_customers(name,email,tax_id_last4), commercial_contracts(contract_number,customer_name,team_id,owner_platform_member_id)', { count: 'exact' }).limit(1)],
  ['audit', db.from('platform_audit_logs').select('*', { count: 'exact' }).limit(1)],
];

for (const [name, query] of checks) {
  const result = await query;
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  process.stdout.write(`${name}: ok\n`);
}

const tenant = await db.from('tenants').select('id').limit(1).maybeSingle();
if (tenant.error) throw tenant.error;
if (tenant.data) {
  const detail = await db.from('tenants').select('*, tenant_solutions(solution_id,status,solutions(key,name)), platform_client_assignments(*,platform_teams(name),platform_members(user_id,platform_roles(key,name))), tenant_domains(*), departments(*), memberships(id,user_id,status,employment_level,joined_at), tenant_billing_state(*), commercial_contracts(*,billing_subscriptions(*),billing_payments(*))').eq('id', tenant.data.id).single();
  if (detail.error) throw new Error(`client-detail: ${detail.error.message}`);
  process.stdout.write('client-detail: ok\n');
}
