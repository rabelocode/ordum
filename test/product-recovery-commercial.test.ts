import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

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
