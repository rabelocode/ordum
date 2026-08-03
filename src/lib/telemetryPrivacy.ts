const SENSITIVE_KEY = /(?:authorization|cookie|password|passcode|secret|token|document|description|message|content|body|resume|curriculum|cover_letter|denuncia|report_text|candidate|tax_id|cpf|cnpj|email|phone|full_name|name|ip_address|user_agent)/i;

const ALLOWED_ANALYTICS_PROPERTIES = new Set([
  'environment',
  'is_first_action',
  'module',
  'plan_ref',
  'role',
  'source',
  'status',
  'step_key',
  'tenant_ref',
  'version',
]);

function primitive(value: unknown): string | number | boolean | null | undefined {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value as string | number | boolean | null;
  return undefined;
}

function redactString(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
    .replace(/((?:token|secret|password|authorization|access_secret)=)[^\s&]+/gi, '$1[REDACTED]')
    .slice(0, 500);
}

export function redactTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  const simple = primitive(value);
  if (simple !== undefined) return typeof simple === 'string' ? redactString(simple) : simple;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => redactTelemetryValue(item, depth + 1));
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactTelemetryValue(item, depth + 1)]),
  );
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => ALLOWED_ANALYTICS_PROPERTIES.has(key))
      .map(([key, value]) => [key, primitive(value)])
      .filter((entry) => entry[1] !== undefined),
  );
}

export function sanitizeSentryEvent(event: Record<string, any>) {
  const sanitized = redactTelemetryValue(event) as Record<string, any>;
  if (event.user?.id) sanitized.user = { id: String(event.user.id).slice(0, 128) };
  else delete sanitized.user;
  if (sanitized.request) {
    delete sanitized.request.data;
    delete sanitized.request.cookies;
    delete sanitized.request.headers;
    delete sanitized.request.query_string;
  }
  delete sanitized.contexts?.response;
  delete sanitized.extra?.response;
  return sanitized;
}

export function buildAnalyticsEventProperties(properties: Record<string, unknown> = {}) {
  return {
    ...sanitizeAnalyticsProperties(properties),
    // Event-level defense in depth. Project-level IP discard remains mandatory.
    $geoip_disable: true,
  };
}
