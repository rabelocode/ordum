export interface BillingConfig {
  enabled: boolean;
  provider: 'asaas';
  environment: 'sandbox';
  baseUrl: string;
  apiKey?: string;
  webhookToken?: string;
  webhookUrl?: string;
  userAgent: string;
}

const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

export function getBillingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig {
  const enabled = env.BILLING_ENABLED === 'true';
  const provider = env.BILLING_PROVIDER || 'asaas';
  const environment = env.ASAAS_ENV || 'sandbox';
  const baseUrl = (env.ASAAS_BASE_URL || SANDBOX_URL).replace(/\/$/, '');
  const apiKey = env.ASAAS_API_KEY?.trim();
  const webhookToken = env.ASAAS_WEBHOOK_TOKEN?.trim();

  if (provider !== 'asaas') throw new Error(`Provedor de cobrança não suportado: ${provider}`);
  if (environment !== 'sandbox') throw new Error('Cobrança em produção permanece bloqueada até homologação e autorização explícita.');
  if (baseUrl !== SANDBOX_URL) throw new Error('ASAAS_BASE_URL não corresponde ao ambiente Sandbox.');
  if (apiKey && !apiKey.startsWith('$aact_hmlg_')) throw new Error('A chave configurada não parece ser uma chave Asaas Sandbox.');
  if (enabled && (!apiKey || !webhookToken)) throw new Error('Billing habilitado sem ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.');

  return {
    enabled,
    provider: 'asaas',
    environment: 'sandbox',
    baseUrl,
    apiKey,
    webhookToken,
    webhookUrl: env.ASAAS_WEBHOOK_URL?.trim(),
    userAgent: env.ASAAS_USER_AGENT?.trim() || 'Ordum',
  };
}

export function publicBillingHealth(env: NodeJS.ProcessEnv = process.env) {
  try {
    const config = getBillingConfig(env);
    return {
      provider: config.provider,
      environment: config.environment,
      enabled: config.enabled,
      configured: Boolean(config.apiKey && config.webhookToken),
      webhookUrlConfigured: Boolean(config.webhookUrl),
    };
  } catch (error) {
    return {
      provider: 'asaas',
      environment: env.ASAAS_ENV || 'sandbox',
      enabled: env.BILLING_ENABLED === 'true',
      configured: false,
      webhookUrlConfigured: Boolean(env.ASAAS_WEBHOOK_URL),
      error: error instanceof Error ? error.message : 'Configuração inválida',
    };
  }
}
