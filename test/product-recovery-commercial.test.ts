import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { commercialApprovalAction } from '../src/server/billing/router';

const read=(path:string)=>fs.readFileSync(path,'utf8');

test('commercial product recovery exposes the complete human workflow',()=>{
  const leads=read('src/pages/admin/LeadsPage.tsx');
  const demos=read('src/pages/admin/DemosPage.tsx');
  const proposals=read('src/pages/admin/ProposalsPage.tsx');
  const contracts=read('src/pages/admin/ContractsPage.tsx');
  assert.match(leads,/Novo lead/);
  assert.match(demos,/Registrar resultado/);
  assert.match(proposals,/Registrar envio/);
  assert.match(proposals,/Registrar aceite/);
  assert.match(contracts,/Assinatura externa/);
  assert.match(contracts,/Ativar cliente/);
});

test('operational UI contains no native browser dialogs',()=>{
  const files=['src/pages/admin/LeadsPage.tsx','src/pages/admin/DemosPage.tsx','src/pages/admin/ProposalsPage.tsx','src/pages/admin/ContractsPage.tsx','src/pages/admin/BillingPage.tsx','src/pages/admin/ConsultantsPage.tsx','src/pages/admin/TeamDetailPage.tsx','src/pages/admin/AuditPage.tsx'];
  for(const file of files)assert.doesNotMatch(read(file),/(?:window\.)?(?:alert|confirm|prompt)\s*\(/,file);
});

test('billing-independent activation remains explicitly trial-gated',()=>{
  const server=read('src/server/billing/router.ts');
  assert.match(server,/external_signature_status !== 'signed'/);
  assert.match(server,/trialDays <= 0/);
  assert.match(server,/source: 'commercial_trial'/);
  assert.doesNotMatch(server,/prepare-client[\s\S]{0,6000}provision_paid_contract/);
});

test('workspace resolves contracted catalog keys into product routes',()=>{
  const workspace=read('src/pages/workspace/WorkspaceApp.tsx');
  assert.match(workspace,/hasSolution\('integridade'\).*modules\.push\('integrity'\)/);
  assert.match(workspace,/hasSolution\('pessoas'\).*modules\.push\('people'\)/);
  assert.match(workspace,/hasSolution\('talentos'\).*modules\.push\('talent'\)/);
});

test('commercial approval conflicts use a human message and proposals have a default validity',()=>{
  assert.match(read('src/lib/userFacingError.ts'),/self_approval_forbidden[\s\S]*outra pessoa autorizada/);
  assert.match(read('src/pages/admin/ProposalsPage.tsx'),/valid_until:defaultValidity\(\)/);
});

test('commercial actions prevent predictable approval and demo errors before the request',()=>{
  assert.equal(commercialApprovalAction({status:'pending_approval',created_by_user_id:'user-1'},'user-1',new Set(['user-1','user-2']),true),'requires_another_approver');
  assert.equal(commercialApprovalAction({status:'pending_approval',created_by_user_id:'user-1'},'user-2',new Set(['user-1','user-2']),true),'available');
  assert.equal(commercialApprovalAction({status:'pending_approval',created_by_user_id:'user-1'},'user-1',new Set(['user-1']),true),'available');
  const leads=read('src/pages/admin/LeadsPage.tsx');
  assert.match(leads,/Equipe responsável \*/);
  assert.match(leads,/team_id: demoForm\.team_id/);
  assert.match(leads,/Atribuir antes da proposta/);
  assert.match(leads,/Nenhuma equipe comercial ativa/);
  const assignmentModal=read('src/components/admin/AssignLeadModal.tsx');
  assert.match(assignmentModal,/Crie uma equipe comercial para continuar/);
  assert.doesNotMatch(assignmentModal,/console\.error/);
  const proposals=read('src/pages/admin/ProposalsPage.tsx');
  assert.match(proposals,/Aguardando outra pessoa aprovadora/);
  assert.match(proposals,/Prontas para enviar/);
  assert.match(proposals,/approval_action==='requires_another_approver'/);
  assert.match(proposals,/Atribua o lead a uma equipe antes de criar a proposta/);
  assert.match(read('src/server/billing/router.ts'),/lead_assignment_required/);
});

test('client onboarding exposes a tenant owner invitation without granting access before acceptance',()=>{
  const server=read('src/server/adminClientsRouter.ts');
  const acceptance=read('server.ts');
  const company=read('src/components/admin/TenantAccessPanel.tsx');
  const migration=read('supabase/migrations/20260811170241_tenant_owner_invitation.sql');
  assert.match(server,/invite-owner/);
  assert.match(server,/accessAlreadyVerified \? "active" : "invited"/);
  assert.match(server,/admin_prepare_tenant_owner_invitation/);
  assert.match(migration,/on conflict \(tenant_id,user_id\) do update/);
  assert.match(migration,/on conflict \(membership_id,role_id\) do nothing/);
  assert.match(migration,/grant execute on function public\.admin_prepare_tenant_owner_invitation[\s\S]*to service_role/);
  assert.match(acceptance,/\/api\/auth\/accept-invite/);
  assert.match(acceptance,/\.eq\("status", "invited"\)/);
  assert.match(company,/Convidar responsável/);
});

test('support separates customer communication from internal notes',()=>{
  const api=read('src/server/adminControlPlaneRouter.ts');
  const ui=read('src/components/admin/SupportWorkspace.tsx');
  assert.match(api,/z\.enum\(\['external_reply','internal_note'\]\)/);
  assert.match(api,/isPrivate \? 'internal_comment' : 'external_communication'/);
  assert.match(ui,/Mensagem ao cliente/);
  assert.match(ui,/Nota interna/);
  assert.match(ui,/Esta mensagem será visível ao cliente/);
});

test('catalog editor keeps prices user-defined and hides raw configuration',()=>{
  const plans=read('src/pages/admin/PlansPage.tsx');
  assert.match(plans,/Planos e preços/);
  assert.match(plans,/Editar condições/);
  assert.match(plans,/Definir na contratação/);
  assert.match(plans,/Limites por produto/);
  assert.doesNotMatch(plans,/Limites globais \(JSON\)|JSON por ID/);
});

test('admin first-run is actionable without a pre-existing commercial team',()=>{
  const teams=read('src/pages/admin/TeamsPage.tsx');
  const createTeam=read('src/components/admin/CreateTeamModal.tsx');
  assert.match(teams,/Prepare sua operação comercial/);
  assert.match(teams,/Configurar equipe comercial/);
  assert.match(teams,/Adicionar responsáveis/);
  assert.match(teams,/Definir gerente/);
  assert.match(teams,/Ir para Leads/);
  assert.doesNotMatch(createTeam,/Self Claim/);
});

test('legacy unassigned leads can be distributed in a bounded audited batch',()=>{
  const leads=read('src/pages/admin/LeadsPage.tsx');
  const modal=read('src/components/admin/BulkAssignLeadsModal.tsx');
  const api=read('src/server/adminLeadsRouter.ts');
  assert.match(leads,/Sem responsável/);
  assert.match(leads,/Distribuir leads/);
  assert.match(modal,/leadIds\.length/);
  assert.match(api,/lead_ids: z\.array\(z\.string\(\)\.uuid\(\)\)\.min\(1\)\.max\(100\)/);
  assert.match(api,/lead\.bulk_assigned/);
});

test('lead API normalizes singular and array assignment relations before proposal creation',()=>{
  const api=read('src/server/adminLeadsRouter.ts');
  assert.match(api,/Array\.isArray\(assignmentRelation\) \? assignmentRelation\[0\] : assignmentRelation/);
});

test('team deactivation transfers active work atomically and stays service-only',()=>{
  const migration=read('supabase/migrations/20260811195021_safe_commercial_team_deactivation.sql');
  assert.match(migration,/create or replace function public\.admin_deactivate_commercial_team/);
  assert.match(migration,/team_transfer_required/);
  assert.match(migration,/update public\.platform_lead_assignments set team_id = p_destination_team_id/);
  assert.match(migration,/revoke all on function public\.admin_deactivate_commercial_team\(uuid, uuid\) from public, anon, authenticated/);
  assert.match(migration,/grant execute on function public\.admin_deactivate_commercial_team\(uuid, uuid\) to service_role/);
});

test('admin dashboard provides direct queues for setup, unassigned leads and approvals',()=>{
  const dashboard=read('src/pages/admin/AdminDashboard.tsx');
  const api=read('src/server/adminControlPlaneRouter.ts');
  assert.match(dashboard,/Operação comercial ainda não configurada/);
  assert.match(dashboard,/Aguardando minha aprovação|para sua aprovação/);
  assert.match(api,/control-plane\/attention/);
  assert.match(api,/commercial_setup_required/);
  assert.match(api,/my_pending_proposals/);
});
