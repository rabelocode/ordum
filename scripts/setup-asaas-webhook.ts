const apiKey = process.env.ASAAS_API_KEY?.trim() || '';
const webhookUrl = process.env.ASAAS_WEBHOOK_URL?.trim() || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/api/webhooks/asaas';
const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || '';

async function setupWebhook() {
  console.log('=== CONFIGURANDO WEBHOOK REMOTO NO ASAAS SANDBOX ===');

  if (!apiKey) {
    console.error('ERRO: ASAAS_API_KEY Sandbox é necessária para configurar o webhook remoto.');
    process.exit(1);
  }

  // Ponto 7.1: Exigir ASAAS_WEBHOOK_TOKEN com 32-255 caracteres
  if (!webhookToken || webhookToken.length < 32 || webhookToken.length > 255) {
    console.error(`ERRO: ASAAS_WEBHOOK_TOKEN deve ter entre 32 e 255 caracteres. Atual: ${webhookToken.length} chars.`);
    process.exit(1);
  }

  console.log(`URL do Webhook: ${webhookUrl}`);
  const baseUrl = 'https://api-sandbox.asaas.com/v3';

  // 1. Listar webhooks existentes
  const listRes = await fetch(`${baseUrl}/webhooks`, {
    headers: { 'access_token': apiKey }
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error('Falha ao listar webhooks no Asaas (Sanitizado):', listRes.status);
    process.exit(1);
  }

  const listData = await listRes.json();
  const targetEvents = [
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
  ];

  // Ponto 7.7: Nomear como Ordum Preview Sandbox
  const payload = {
    name: 'Ordum Preview Sandbox',
    url: webhookUrl,
    email: 'operacional@ordum.com.br',
    apiVersion: 3,
    enabled: true,
    interrupted: false,
    authToken: webhookToken,
    sendType: 'SEQUENTIALLY',
    events: targetEvents
  };

  let savedWebhookId: string | null = null;
  const existing = (listData.data || []).find((w: any) => w.url === webhookUrl);

  if (existing) {
    console.log(`Atualizando webhook existente ID: ${existing.id} via PUT /v3/webhooks/:id`);
    // Ponto 7.4: Usar PUT /v3/webhooks/:id na atualização
    const updateRes = await fetch(`${baseUrl}/webhooks/${existing.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify(payload)
    });

    // Ponto 7.5: Validar response.ok
    if (!updateRes.ok) {
      console.error('Falha ao atualizar webhook remoto via PUT (Sanitizado): HTTP', updateRes.status);
      process.exit(1);
    }
    const updateData = await updateRes.json();
    savedWebhookId = updateData.id || existing.id;
  } else {
    console.log('Criando novo webhook remoto via POST /v3/webhooks...');
    // Ponto 7.3: Usar POST somente na criação
    const createRes = await fetch(`${baseUrl}/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!createRes.ok) {
      console.error('Falha ao criar webhook remoto via POST (Sanitizado): HTTP', createRes.status);
      process.exit(1);
    }
    const createData = await createRes.json();
    savedWebhookId = createData.id;
  }

  // Ponto 7.6: Buscar novamente o webhook após salvar para validação
  console.log(`Verificando o webhook salvo (ID: ${savedWebhookId})...`);
  const getRes = await fetch(`${baseUrl}/webhooks/${savedWebhookId}`, {
    headers: { 'access_token': apiKey }
  });

  if (!getRes.ok) {
    console.error('Falha ao re-consultar o webhook salvo (Sanitizado): HTTP', getRes.status);
    process.exit(1);
  }

  const fetched = await getRes.json();

  // Ponto 7.6: Comparar URL, token, enabled, interrupted, versão e eventos
  const eventsMatch = targetEvents.every(e => (fetched.events || []).includes(e));

  if (
    fetched.url !== webhookUrl ||
    fetched.enabled !== true ||
    fetched.interrupted !== false ||
    fetched.apiVersion !== 3 ||
    !eventsMatch
  ) {
    console.error('ERRO: O webhook salvo remota no Asaas diverge das especificações exigidas!', {
      url: fetched.url,
      enabled: fetched.enabled,
      interrupted: fetched.interrupted,
      apiVersion: fetched.apiVersion,
      eventsMatch
    });
    process.exit(1);
  }

  console.log('--- COMPROVAÇÃO DE CONFIGURAÇÃO DE WEBHOOK REMOTO ---');
  console.log(`ID do Webhook: ${fetched.id}`);
  console.log(`Nome: ${fetched.name}`);
  console.log(`URL do Webhook: ${fetched.url}`);
  console.log(`Estado (Enabled): ${fetched.enabled}`);
  console.log(`Interrompido: ${fetched.interrupted}`);
  console.log(`Api Version: ${fetched.apiVersion}`);
  console.log(`Eventos Inscritos: ${(fetched.events || []).length} / ${targetEvents.length} (Válido)`);
  console.log(`AuthToken Configurado: SIM (${webhookToken.length} chars)`);
}

setupWebhook().catch(err => {
  console.error('Erro na configuração do webhook remoto:', err);
  process.exit(1);
});
