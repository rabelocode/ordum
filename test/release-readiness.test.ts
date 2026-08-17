import assert from "node:assert/strict";
import test from "node:test";
import { getReleaseReadiness, releaseEnvironmentContract } from "../src/server/releaseReadiness";

const core = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "server-secret" };

test("classifies core, optional external integrations and production-only configuration", () => {
  assert.deepEqual(releaseEnvironmentContract.requiredForCore, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  const status = getReleaseReadiness(core);
  assert.equal(status.core.state, "operational");
  assert.equal(status.external.transactionalEmail.state, "configuration_pending");
  assert.equal(status.external.alertAutomation.state, "configuration_pending");
  assert.equal(status.external.financialIntegration.state, "configuration_pending");
  assert.equal(status.production.billingProductionAuthorized, false);
});

test("reports SMTP operational only after configuration and real delivery validation", () => {
  assert.equal(getReleaseReadiness({ ...core, AUTH_SMTP_CONFIGURED: "true" }).external.transactionalEmail.state, "configuration_pending");
  assert.equal(getReleaseReadiness({ ...core, AUTH_SMTP_CONFIGURED: "true", AUTH_SMTP_VALIDATED: "true" }).external.transactionalEmail.state, "operational");
});

test("requires a strong server-only cron secret and preserves the daily infrastructure limit", () => {
  assert.equal(getReleaseReadiness({ ...core, CRON_SECRET: "short" }).external.alertAutomation.state, "unavailable");
  const status = getReleaseReadiness({ ...core, CRON_SECRET: "x".repeat(48) }).external.alertAutomation;
  assert.equal(status.state, "operational");
  assert.equal(status.schedule, "daily");
  assert.equal(status.intraday, false);
});

test("keeps Asaas fail-closed until a complete Sandbox configuration exists", () => {
  const pending = getReleaseReadiness({ ...core, ASAAS_ENV: "sandbox", BILLING_ENABLED: "false" });
  assert.equal(pending.external.financialIntegration.state, "configuration_pending");
  const operational = getReleaseReadiness({
    ...core,
    VERCEL_ENV: "preview",
    BILLING_ENABLED: "true",
    ASAAS_ENV: "sandbox",
    ASAAS_BASE_URL: "https://api-sandbox.asaas.com/v3",
    ASAAS_API_KEY: "$aact_hmlg_example",
    ASAAS_WEBHOOK_TOKEN: "x".repeat(48),
  });
  assert.equal(operational.external.financialIntegration.state, "operational");
  const blocked = getReleaseReadiness({ ...core, BILLING_ENABLED: "true", ASAAS_ENV: "production" });
  assert.equal(blocked.external.financialIntegration.state, "unavailable");
});

test("never returns configured secret values", () => {
  const cronSecret = "cron-secret-that-must-never-be-returned-123456";
  const status = JSON.stringify(getReleaseReadiness({ ...core, CRON_SECRET: cronSecret }));
  assert.equal(status.includes(cronSecret), false);
  assert.equal(status.includes(core.SUPABASE_SECRET_KEY), false);
});
