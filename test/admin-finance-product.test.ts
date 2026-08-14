import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('Financeiro separates business operation from provider infrastructure', () => {
  const page = read('src/pages/admin/BillingPage.tsx');
  assert.match(page, /Visão geral/);
  assert.match(page, /Assinaturas/);
  assert.match(page, /Cobranças/);
  assert.match(page, /Inadimplência/);
  assert.match(page, /MRR ativo/);
  assert.match(page, /Receita prevista/);
  assert.doesNotMatch(page, /Fila de webhooks|Último webhook|provider_subscription_id|external_reference/);
});

test('Financeiro keeps activation, subscription and payment states distinct', () => {
  const page = read('src/pages/admin/BillingPage.tsx');
  assert.match(page, /active: 'Ativa'/);
  assert.match(page, /trial: 'Em período de teste'/);
  assert.match(page, /pending_payment: 'Pagamento pendente'/);
  assert.match(page, /received: 'Pago'/);
  assert.match(page, /overdue: 'Vencido'/);
  assert.doesNotMatch(page, /Marcar como pago/);
  assert.match(page, /if \(selected\) return <>[\s\S]*ActionDialog/);
});

test('financial metrics are calculated from stored subscriptions and payments', () => {
  const router = read('src/server/billing/router.ts');
  assert.match(router, /activeMrrCents/);
  assert.match(router, /expectedCents/);
  assert.match(router, /receivedCents/);
  assert.match(router, /overdueCents/);
  assert.match(router, /hasFinancialData/);
  assert.match(router, /contractsAwaitingStart/);
});

test('Customer 360 exposes a contextual financial next action', () => {
  const company = read('src/pages/admin/CompanyDetailPage.tsx');
  assert.match(company, /CompanyFinancialSummary/);
  assert.match(company, /Próxima ação/);
  assert.match(company, /Ver cobrança vencida/);
  assert.match(company, /Nenhum pagamento confirmado foi registrado/);
});
