import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !publicKey) throw new Error('Credenciais do Supabase ausentes para smoke read-only.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });

const checks = [
  ['leads', db.from('marketing_leads').select('*, platform_lead_assignments(*, platform_teams(name,allow_self_claim), platform_members(user_id, platform_roles(key, name))), commercial_activities(id,activity_type,subject,status,scheduled_at,result,next_action,next_action_at,created_at), commercial_demos(id,status,starts_at,expires_at,result,next_action,next_action_at)', { count: 'exact' }).limit(1)],
  ['clients', db.from('tenants').select('*, tenant_solutions(*), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))), tenant_billing_state(*), tenant_domains(*), memberships(id,status,user_id,employment_level), departments(id,name,active)', { count: 'exact' }).limit(1)],
  ['billing-records', db.from('billing_subscriptions').select('*, billing_customers(name,email,tax_id_last4), commercial_contracts(contract_number,customer_name,team_id,owner_platform_member_id)', { count: 'exact' }).limit(1)],
  ['audit', db.from('platform_audit_logs').select('*', { count: 'exact' }).limit(1)],
  ['onboarding', db.from('onboarding_runs').select('*, onboarding_items(*)', { count: 'exact' }).limit(1)],
  ['customer-success', db.from('customer_success_accounts').select('*, tenants(id,name,lifecycle_status,risk_level)', { count: 'exact' }).limit(1)],
  ['support', db.from('support_tickets').select('*, tenants(id,name), solutions(id,key,name)', { count: 'exact' }).limit(1)],
  ['privacy', db.from('lgpd_requests').select('id,request_number,tenant_id,request_type,status,due_at,excludes_integrity_data', { count: 'exact' }).limit(1)],
  ['operations', db.from('platform_operational_events').select('id,source,event_type,status,correlation_id,attempts,last_error,payload_summary', { count: 'exact' }).limit(1)],
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
  const entitlements = await db.rpc('admin_effective_entitlements', { p_tenant_id: tenant.data.id });
  if (entitlements.error) throw new Error(`effective-entitlements: ${entitlements.error.message}`);
  process.stdout.write('effective-entitlements: ok\n');
}

const metrics = await db.rpc('admin_control_plane_metrics', {
  p_from: new Date(Date.now() - 30 * 86400000).toISOString(), p_to: new Date().toISOString(),
  p_team_ids: null, p_owner_ids: null, p_tenant_ids: null, p_plan_ids: null, p_is_admin: true,
});
if (metrics.error) throw new Error(`control-plane-metrics: ${metrics.error.message}`);
process.stdout.write('control-plane-metrics: ok\n');

const publicMetrics = await publicDb.rpc('admin_control_plane_metrics', {
  p_from: new Date(Date.now() - 86400000).toISOString(), p_to: new Date().toISOString(),
  p_team_ids: null, p_owner_ids: null, p_tenant_ids: null, p_plan_ids: null, p_is_admin: true,
});
if (!publicMetrics.error) throw new Error('control-plane-metrics: publishable role must not execute server-only RPC');
process.stdout.write('control-plane-metrics-public: blocked\n');

const publicListing = await publicDb.storage.from('ordum-public').list('', { limit: 1 });
if (publicListing.error) throw new Error(`public-storage-listing: ${publicListing.error.message}`);
if ((publicListing.data || []).length > 0) throw new Error('public-storage-listing: browser role can enumerate objects');
process.stdout.write('public-storage-listing: blocked\n');
