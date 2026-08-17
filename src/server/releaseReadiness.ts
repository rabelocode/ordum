import { publicBillingHealth } from "./billing/config";

export type InfrastructureState = "operational" | "configuration_pending" | "unavailable";

const enabled = (value?: string) => value?.trim().toLowerCase() === "true";
const strongSecret = (value?: string) => Boolean(value && value.trim().length >= 32);

export const releaseEnvironmentContract = {
  requiredForCore: ["SUPABASE_URL", "SUPABASE_SECRET_KEY"],
  optionalExternalIntegration: [
    "AUTH_SMTP_CONFIGURED",
    "AUTH_SMTP_VALIDATED",
    "CRON_SECRET",
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
    "ASAAS_WEBHOOK_URL",
  ],
  productionOnly: ["APP_URL"],
} as const;

type OperationalEvidence = { lastIntegrityRunAt?: string | null; lastIntegrityRunStatus?: string | null };

export function getReleaseReadiness(env: NodeJS.ProcessEnv = process.env, evidence: OperationalEvidence = {}, now = new Date()) {
  const coreConfigured = releaseEnvironmentContract.requiredForCore.every((key) => Boolean(env[key]?.trim()));
  const smtpConfigured = enabled(env.AUTH_SMTP_CONFIGURED);
  const smtpValidated = enabled(env.AUTH_SMTP_VALIDATED);
  const cronConfigured = Boolean(env.CRON_SECRET?.trim());
  const cronSecretStrong = strongSecret(env.CRON_SECRET);
  const lastIntegrityRunAt = evidence.lastIntegrityRunAt || null;
  const integrityRunRecent = Boolean(lastIntegrityRunAt && now.getTime() - new Date(lastIntegrityRunAt).getTime() <= 36 * 60 * 60 * 1000);
  const integrityRunHealthy = evidence.lastIntegrityRunStatus === "completed" && integrityRunRecent;
  const billing = publicBillingHealth(env);
  const billingInvalid = Boolean("error" in billing && billing.error);

  return {
    core: {
      state: (coreConfigured ? "operational" : "unavailable") as InfrastructureState,
      configured: coreConfigured,
    },
    external: {
      transactionalEmail: {
        state: (smtpConfigured && smtpValidated ? "operational" : "configuration_pending") as InfrastructureState,
        configured: smtpConfigured,
        validated: smtpValidated,
      },
      alertAutomation: {
        state: (!cronConfigured ? "configuration_pending" : !cronSecretStrong ? "unavailable" : integrityRunHealthy ? "operational" : "configuration_pending") as InfrastructureState,
        configured: cronConfigured,
        schedule: "daily" as const,
        intraday: false,
        lastRunAt: lastIntegrityRunAt,
      },
      financialIntegration: {
        state: (billingInvalid ? "unavailable" : billing.configured && billing.enabled ? "operational" : "configuration_pending") as InfrastructureState,
        configured: billing.configured,
        enabled: billing.enabled,
        environment: billing.environment,
      },
    },
    production: {
      appUrlConfigured: /^https:\/\//.test(env.APP_URL?.trim() || ""),
      billingProductionAuthorized: false,
    },
  };
}
