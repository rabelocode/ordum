const apiKey = process.env.ASAAS_API_KEY?.trim() || '';
const webhookUrl = process.env.ASAAS_WEBHOOK_URL?.trim() || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/api/webhooks/asaas';
const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || '';

async function setupWebhook() {
  if (!apiKey) {
    console.error('ERRO: ASAAS_API_KEY Sandbox é necessária para configurar o webhook remoto.');
    process.exit(1);
  }

  console.log('=== CONFIGURANDO WEBHOOK REMOTO NO ASAAS SANDBOX ===');
  console.log(`URL do Webhook: ${webhookUrl}`);

  const baseUrl = 'https://api-sandbox.asaas.com/v3';

  // 1. Listar webhooks existentes
  const listRes = await fetch(`${baseUrl}/webhooks`, {
    headers: { 'access_token': apiKey }
  });

  const listData = await listRes.json().catch(() => ({}));
  if (!listRes.ok) {
    console.error('Falha ao listar webhooks no Asaas:', listData);
    process.exit(1);
  }

  console.log(`Webhooks remotos encontrados: ${(listData.data || []).length}`);

  const payload = {
    name: 'Ordum Production Webhook',
    url: webhookUrl,
    email: 'operacional@ordum.com.br',
    apiVersion: 3,
    enabled: true,
    interrupted: false,
    authToken: webhookToken || undefined,
    sendType: 'SEQUENTIALLY',
    events: [
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_RESTORED',
      'PAYMENT_REFUNDED',
      'PAYMENT_RECEIVED_IN_CASH_UNDONE',
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CHARGEBACK_DISPUTE',
      'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
    ]
  };

  let savedWebhook: any = null;
  const existing = (listData.data || []).find((w: any) => w.url === webhookUrl);

  if (existing) {
    console.log(`Atualizando webhook existente ID: ${existing.id}`);
    const updateRes = await fetch(`${baseUrl}/webhooks/${existing.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify(payload)
    });
    savedWebhook = await updateRes.json();
  } else {
    console.log('Criando novo webhook remoto no Asaas Sandbox...');
    const createRes = await fetch(`${baseUrl}/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify(payload)
    });
    savedWebhook = await createRes.json();
  }

  console.log('--- COMPROVAÇÃO DE CONFIGURAÇÃO DE WEBHOOK REMOTO ---');
  console.log(`ID do Webhook: ${savedWebhook.id}`);
  console.log(`URL do Webhook: ${savedWebhook.url}`);
  console.log(`Estado (Enabled): ${savedWebhook.enabled}`);
  console.log(`Interrompido: ${savedWebhook.interrupted}`);
  console.log(`Api Version: ${savedWebhook.apiVersion}`);
  console.log(`Eventos Inscritos: ${(savedWebhook.events || []).length}`);
}

setupWebhook().catch(err => {
  console.error('Erro na configuração do webhook remoto:', err);
  process.exit(1);
});
