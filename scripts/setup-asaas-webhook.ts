const apiKey = process.env.ASAAS_API_KEY?.trim() || '';
const webhookUrl = process.env.ASAAS_WEBHOOK_URL?.trim() || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/api/webhooks/asaas';
const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || '';
const baseUrl = 'https://api-sandbox.asaas.com/v3';
const webhookName = 'Ordum Preview Sandbox';
const targetEvents = [
  'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_RESTORED', 'PAYMENT_REFUNDED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE', 'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
];

function fail(message: string): never {
  throw new Error(message);
}

async function jsonResponse(response: Response, operation: string) {
  if (!response.ok) fail(`${operation}: HTTP ${response.status}`);
  return response.json();
}

async function setupWebhook() {
  if (!apiKey) fail('ASAAS_API_KEY Sandbox ausente.');
  if (!webhookToken || webhookToken.length < 32 || webhookToken.length > 255 || /[\s\x00-\x1f\x7f]/.test(webhookToken)) {
    fail('ASAAS_WEBHOOK_TOKEN deve ter 32 a 255 caracteres sem espaços ou controles.');
  }

  const parsedUrl = new URL(webhookUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.pathname !== '/api/webhooks/asaas') {
    fail('ASAAS_WEBHOOK_URL deve ser HTTPS e terminar em /api/webhooks/asaas.');
  }
  if (!parsedUrl.hostname.includes('fix-admin-functional-recovery') || !parsedUrl.hostname.endsWith('.vercel.app')) {
    fail('ASAAS_WEBHOOK_URL deve apontar para o Preview atual da branch, nunca Production.');
  }

  const headers = { 'access_token': apiKey };
  const listData = await jsonResponse(await fetch(`${baseUrl}/webhooks`, { headers }), 'Listar webhooks Sandbox');
  const payload = {
    name: webhookName,
    url: webhookUrl,
    email: 'operacional@ordum.com.br',
    apiVersion: 3,
    enabled: true,
    interrupted: false,
    authToken: webhookToken,
    sendType: 'SEQUENTIALLY',
    events: targetEvents,
  };

  const existing = (listData.data || []).find((webhook: any) => webhook.url === webhookUrl || webhook.name === webhookName);
  const saveUrl = existing ? `${baseUrl}/webhooks/${existing.id}` : `${baseUrl}/webhooks`;
  const saveMethod = existing ? 'PUT' : 'POST';
  const saved = await jsonResponse(await fetch(saveUrl, {
    method: saveMethod,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }), `${existing ? 'Atualizar' : 'Criar'} webhook Sandbox`);
  const webhookId = saved.id || existing?.id;
  if (!webhookId) fail('Asaas não retornou o ID do webhook salvo.');

  const fetched = await jsonResponse(await fetch(`${baseUrl}/webhooks/${webhookId}`, { headers }), 'Confirmar webhook Sandbox');
  const fetchedEvents = Array.isArray(fetched.events) ? [...fetched.events].sort() : [];
  const eventsMatch = JSON.stringify(fetchedEvents) === JSON.stringify([...targetEvents].sort());
  if (fetched.url !== webhookUrl || fetched.enabled !== true || fetched.interrupted !== false || fetched.apiVersion !== 3 || !eventsMatch) {
    fail(`Webhook Sandbox divergente: ${JSON.stringify({ enabled: fetched.enabled, interrupted: fetched.interrupted, apiVersion: fetched.apiVersion, eventsMatch })}`);
  }

  console.log(`ASAAS_WEBHOOK_ID=${fetched.id}`);
  console.log(`ASAAS_WEBHOOK_HTTP=${existing ? 200 : 201}`);
  console.log(`ASAAS_WEBHOOK_EVENTS=${fetchedEvents.length}`);
  console.log('ASAAS_WEBHOOK_VALID=true');
}

setupWebhook().catch((error) => {
  console.error('Webhook Sandbox setup failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
