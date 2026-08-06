var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/authorization.ts
function isGlobalAdmin(context) {
  return context.platformMember?.status !== "suspended" && context.role?.key === "admin";
}
function canReadAssignedResource(context, assignment, visibilityField) {
  if (context.platformMember?.status === "suspended") return false;
  if (isGlobalAdmin(context)) return true;
  if (!assignment?.team_id) return false;
  if (assignment.owner_platform_member_id === context.platformMember.id) return true;
  if (context.managedTeams.some((team2) => team2.id === assignment.team_id)) return true;
  const team = context.teams.find((candidate) => candidate.id === assignment.team_id);
  return team?.[visibilityField] === "team" || team?.[visibilityField] === "all";
}
var init_authorization = __esm({
  "src/server/authorization.ts"() {
  }
});

// src/server/operational.ts
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
function parsePagination(query, defaultSize = 25) {
  const page = Math.max(1, Number.parseInt(String(query.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(query.pageSize || defaultSize), 10) || defaultSize));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}
function pageResult(items, count, page, pageSize) {
  const total = count || 0;
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
function withinManagerApprovalLimit(team, amountCents, kind) {
  const key = kind === "proposal" ? "proposal_approval_limit_cents" : "contract_approval_limit_cents";
  const value = team?.settings?.[key];
  return Number.isInteger(value) && value >= 0 && amountCents <= value;
}
function safeIp(req) {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = (forwarded || req.socket.remoteAddress || "").replace(/^::ffff:/, "").slice(0, 64);
  return isIP(candidate) ? candidate : null;
}
function auditContext(req, metadata = {}) {
  const requestId = String(req.requestId || randomUUID());
  return {
    request_id: requestId,
    ip_address: safeIp(req),
    user_agent: req.header("user-agent")?.slice(0, 500) || null,
    metadata
  };
}
var init_operational = __esm({
  "src/server/operational.ts"() {
    init_authorization();
  }
});

// src/server/tenantAuth.ts
import { createClient } from "@supabase/supabase-js";
var getSupabaseAdmin, authenticateRequest, resolveTenantContext, requireTenantPermission, resolvePlatformContext, requirePlatformPermission;
var init_tenantAuth = __esm({
  "src/server/tenantAuth.ts"() {
    getSupabaseAdmin = () => {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!url || !key) throw new Error("Missing server-side Supabase credentials");
      return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    };
    authenticateRequest = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
      const token = authHeader.replace("Bearer ", "");
      try {
        const db = req.supabaseAdmin || getSupabaseAdmin();
        const { data: { user }, error: authErr } = await db.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: "Invalid or expired session" });
        req.user = user;
        next();
      } catch (e) {
        return res.status(500).json({ error: "Authentication system error" });
      }
    };
    resolveTenantContext = async (req, res, next) => {
      const tenantId = req.headers["x-tenant-id"] || req.body.tenant_id;
      if (!tenantId) {
        return res.status(400).json({ error: "Missing tenant identification" });
      }
      try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: "Authentication required before tenant resolution" });
        const db = req.supabaseAdmin || getSupabaseAdmin();
        const { data: membership } = await db.from("memberships").select("*, tenants(*)").eq("user_id", user.id).eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
        if (!membership) {
          return res.status(403).json({ error: "Forbidden: No active membership in this tenant" });
        }
        if (membership.tenants?.status !== "active" && membership.tenants?.status !== "trial") {
          return res.status(403).json({ error: "Forbidden: Tenant is not active" });
        }
        const { data: roleRefs } = await db.from("membership_roles").select("role_id").eq("membership_id", membership.id);
        let roles = [];
        let permissions = [];
        if (roleRefs && roleRefs.length > 0) {
          const roleIds = roleRefs.map((r) => r.role_id);
          const { data: rolesData } = await db.from("roles").select("id, key").in("id", roleIds);
          if (rolesData) roles = rolesData;
          const { data: pRefs } = await db.from("role_permissions").select("permission_id").in("role_id", roleIds);
          if (pRefs && pRefs.length > 0) {
            const { data: pData } = await db.from("permissions").select("key").in("id", pRefs.map((p) => p.permission_id));
            if (pData) permissions = pData.map((p) => p.key);
          }
        }
        const { data: sRefs } = await db.from("tenant_solutions").select("solution_id").eq("tenant_id", tenantId).eq("status", "active");
        let solutions = [];
        if (sRefs && sRefs.length > 0) {
          const sIds = sRefs.map((s) => s.solution_id);
          const { data: sData } = await db.from("solutions").select("key").in("id", sIds);
          if (sData) solutions = sData.map((s) => s.key);
        }
        req.tenantContext = {
          membership,
          tenant: membership.tenants,
          roles,
          permissions,
          solutions
        };
        next();
      } catch (e) {
        return res.status(500).json({ error: "Tenant resolution error" });
      }
    };
    requireTenantPermission = (requiredPermission) => {
      return (req, res, next) => {
        const context = req.tenantContext;
        if (!context) return res.status(500).json({ error: "Missing tenant context" });
        if (!context.permissions.includes(requiredPermission)) {
          return res.status(403).json({ error: `Forbidden: requires permission ${requiredPermission}` });
        }
        next();
      };
    };
    resolvePlatformContext = async (req, res, next) => {
      try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: "Authentication required" });
        const db = req.supabaseAdmin || getSupabaseAdmin();
        const { data: platformMember } = await db.from("platform_members").select("*, platform_roles(*)").eq("user_id", user.id).maybeSingle();
        if (!platformMember) {
          return res.status(403).json({ error: "Forbidden: Not a platform member" });
        }
        if (platformMember.status === "suspended") {
          return res.status(403).json({ error: "Forbidden: Platform member suspended" });
        }
        const role = platformMember.platform_roles;
        let permissions = [];
        if (role) {
          const { data: rolePerms } = await db.from("platform_role_permissions").select("platform_permissions(key)").eq("role_id", role.id);
          if (rolePerms) {
            permissions = rolePerms.map((rp) => rp.platform_permissions?.key).filter(Boolean);
          }
        }
        req.platformContext = {
          platformMember,
          role,
          permissions
        };
        next();
      } catch (e) {
        return res.status(500).json({ error: "Platform resolution error" });
      }
    };
    requirePlatformPermission = (required) => {
      const requiredPermissions = typeof required === "string" ? [required] : [...required];
      if (requiredPermissions.length === 0) {
        throw new Error("requirePlatformPermission requires at least one permission");
      }
      return (req, res, next) => {
        const context = req.platformContext;
        if (!context) {
          return res.status(500).json({ error: "Platform authorization context is unavailable" });
        }
        const allowed = requiredPermissions.some(
          (permission) => context.permissions.includes(permission)
        );
        if (!allowed) {
          return res.status(403).json({ error: "Forbidden: insufficient platform permission" });
        }
        return next();
      };
    };
  }
});

// src/server/billing/config.ts
function getBillingConfig(env = process.env) {
  const enabled = env.BILLING_ENABLED === "true";
  const provider = env.BILLING_PROVIDER || "asaas";
  const environment = env.ASAAS_ENV || "sandbox";
  const baseUrl = (env.ASAAS_BASE_URL || SANDBOX_URL).replace(/\/$/, "");
  const apiKey = env.ASAAS_API_KEY?.trim();
  const webhookToken = env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (provider !== "asaas") throw new Error(`Provedor de cobran\xE7a n\xE3o suportado: ${provider}`);
  if (environment !== "sandbox") throw new Error("Cobran\xE7a em produ\xE7\xE3o permanece bloqueada at\xE9 homologa\xE7\xE3o e autoriza\xE7\xE3o expl\xEDcita.");
  if (baseUrl !== SANDBOX_URL) throw new Error("ASAAS_BASE_URL n\xE3o corresponde ao ambiente Sandbox.");
  if (apiKey && !apiKey.startsWith("$aact_hmlg_")) throw new Error("A chave configurada n\xE3o parece ser uma chave Asaas Sandbox.");
  if (enabled && (!apiKey || !webhookToken)) throw new Error("Billing habilitado sem ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.");
  return {
    enabled,
    provider: "asaas",
    environment: "sandbox",
    baseUrl,
    apiKey,
    webhookToken,
    webhookUrl: env.ASAAS_WEBHOOK_URL?.trim(),
    userAgent: env.ASAAS_USER_AGENT?.trim() || "Ordum"
  };
}
function publicBillingHealth(env = process.env) {
  try {
    const config = getBillingConfig(env);
    return {
      provider: config.provider,
      environment: config.environment,
      enabled: config.enabled,
      configured: Boolean(config.apiKey && config.webhookToken),
      webhookUrlConfigured: Boolean(config.webhookUrl)
    };
  } catch (error) {
    return {
      provider: "asaas",
      environment: env.ASAAS_ENV || "sandbox",
      enabled: env.BILLING_ENABLED === "true",
      configured: false,
      webhookUrlConfigured: Boolean(env.ASAAS_WEBHOOK_URL),
      error: error instanceof Error ? error.message : "Configura\xE7\xE3o inv\xE1lida"
    };
  }
}
var SANDBOX_URL;
var init_config = __esm({
  "src/server/billing/config.ts"() {
    SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
  }
});

// src/lib/telemetryPrivacy.ts
function primitive(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  return void 0;
}
function redactString(value) {
  return value.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]").replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]").replace(/((?:token|secret|password|authorization|access_secret)=)[^\s&]+/gi, "$1[REDACTED]").slice(0, 500);
}
function redactTelemetryValue(value, depth = 0) {
  if (depth > 5) return "[TRUNCATED]";
  const simple = primitive(value);
  if (simple !== void 0) return typeof simple === "string" ? redactString(simple) : simple;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => redactTelemetryValue(item, depth + 1));
  if (!value || typeof value !== "object") return void 0;
  return Object.fromEntries(
    Object.entries(value).slice(0, 50).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactTelemetryValue(item, depth + 1)])
  );
}
function sanitizeAnalyticsProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => ALLOWED_ANALYTICS_PROPERTIES.has(key)).map(([key, value]) => [key, primitive(value)]).filter((entry) => entry[1] !== void 0)
  );
}
function sanitizeSentryEvent(event) {
  const sanitized = redactTelemetryValue(event);
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
function buildAnalyticsEventProperties(properties = {}) {
  return {
    ...sanitizeAnalyticsProperties(properties),
    // Event-level defense in depth. Project-level IP discard remains mandatory.
    $geoip_disable: true
  };
}
var SENSITIVE_KEY, ALLOWED_ANALYTICS_PROPERTIES;
var init_telemetryPrivacy = __esm({
  "src/lib/telemetryPrivacy.ts"() {
    SENSITIVE_KEY = /(?:authorization|cookie|password|passcode|secret|token|document|description|message|content|body|resume|curriculum|cover_letter|denuncia|report_text|candidate|tax_id|cpf|cnpj|email|phone|full_name|name|ip_address|user_agent)/i;
    ALLOWED_ANALYTICS_PROPERTIES = /* @__PURE__ */ new Set([
      "environment",
      "is_first_action",
      "module",
      "plan_ref",
      "role",
      "source",
      "status",
      "step_key",
      "tenant_ref",
      "version"
    ]);
  }
});

// src/server/analytics.ts
async function captureServerAnalytics(event, distinctId, properties = {}) {
  const apiKey = process.env.POSTHOG_PROJECT_KEY;
  if (process.env.ANALYTICS_SERVER_ENABLED !== "true" || !apiKey || !distinctId) return false;
  const host = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        properties: { distinct_id: distinctId.slice(0, 128), ...buildAnalyticsEventProperties(properties) }
      }),
      signal: AbortSignal.timeout(2500)
    });
    return response.ok;
  } catch {
    return false;
  }
}
var init_analytics = __esm({
  "src/server/analytics.ts"() {
    init_telemetryPrivacy();
  }
});

// src/server/billing/asaas.ts
var CYCLE_MAP, AsaasBillingProvider;
var init_asaas = __esm({
  "src/server/billing/asaas.ts"() {
    CYCLE_MAP = {
      weekly: "WEEKLY",
      biweekly: "BIWEEKLY",
      monthly: "MONTHLY",
      quarterly: "QUARTERLY",
      semiannual: "SEMIANNUALLY",
      yearly: "YEARLY"
    };
    AsaasBillingProvider = class {
      constructor(config) {
        this.config = config;
        if (!config.enabled || !config.apiKey) throw new Error("Integra\xE7\xE3o Asaas Sandbox n\xE3o est\xE1 habilitada.");
      }
      async request(path2, init2) {
        const response = await fetch(`${this.config.baseUrl}${path2}`, {
          ...init2,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": this.config.userAgent,
            access_token: this.config.apiKey,
            ...init2?.headers
          }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const description = Array.isArray(body?.errors) ? body.errors.map((item) => item.description).filter(Boolean).join("; ") : "";
          throw new Error(`Asaas respondeu ${response.status}${description ? `: ${description}` : ""}`);
        }
        return body;
      }
      createCustomer(input) {
        return this.request("/customers", {
          method: "POST",
          body: JSON.stringify({
            name: input.name,
            email: input.email,
            cpfCnpj: input.cpfCnpj,
            mobilePhone: input.mobilePhone,
            externalReference: input.externalReference,
            notificationDisabled: false
          })
        });
      }
      async findCustomerByExternalReference(externalReference) {
        const result = await this.request(`/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
        return Array.isArray(result.data) ? result.data[0] || null : null;
      }
      createSubscription(input) {
        return this.request("/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            customer: input.customerId,
            billingType: input.billingType,
            cycle: CYCLE_MAP[input.cycle],
            value: input.amountCents / 100,
            nextDueDate: input.nextDueDate,
            externalReference: input.externalReference,
            description: input.description
          })
        });
      }
      async findSubscriptionByExternalReference(externalReference) {
        const result = await this.request(`/subscriptions?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
        return Array.isArray(result.data) ? result.data[0] || null : null;
      }
      getPayment(id) {
        return this.request(`/payments/${encodeURIComponent(id)}`);
      }
      getSubscription(id) {
        return this.request(`/subscriptions/${encodeURIComponent(id)}`);
      }
      cancelSubscription(id) {
        return this.request(`/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      listSubscriptions(offset = 0, limit = 100) {
        return this.request(`/subscriptions?includeDeleted=true&limit=${Math.min(100, limit)}&offset=${Math.max(0, offset)}`);
      }
      listPayments(filters = {}) {
        const params = new URLSearchParams({
          limit: String(Math.min(100, filters.limit || 100)),
          offset: String(Math.max(0, filters.offset || 0))
        });
        if (filters.subscriptionId) params.set("subscription", filters.subscriptionId);
        if (filters.dateCreatedFrom) params.set("dateCreated[ge]", filters.dateCreatedFrom);
        return this.request(`/payments?${params.toString()}`);
      }
    };
  }
});

// src/server/billing/domain.ts
function normalizePaymentStatus(eventType, providerStatus) {
  return PAYMENT_STATUS[eventType] ?? normalizeProviderPaymentStatus(providerStatus);
}
function normalizeProviderPaymentStatus(providerStatus) {
  const status = providerStatus?.toUpperCase();
  if (status === "CONFIRMED") return "confirmed";
  if (status === "RECEIVED" || status === "RECEIVED_IN_CASH") return "received";
  if (status === "OVERDUE" || status === "DUNNING_REQUESTED") return "overdue";
  if (status === "REFUNDED") return "refunded";
  if (status === "REFUND_REQUESTED") return "pending";
  if (status === "PARTIALLY_REFUNDED") return "partially_refunded";
  if (status === "CHARGEBACK_REQUESTED" || status === "CHARGEBACK_DISPUTE") return "chargeback";
  if (status === "DELETED") return "deleted";
  return "pending";
}
function preserveSettledPaymentStatus(existingStatus, incomingStatus) {
  if (existingStatus && ["confirmed", "received"].includes(existingStatus) && ["pending", "overdue", "refused", "restored"].includes(incomingStatus)) return existingStatus;
  return incomingStatus;
}
function accessTransitionForPaymentStatus(status) {
  if (status === "confirmed" || status === "received") return "active";
  if (status === "overdue") return "grace";
  if (status === "chargeback" || status === "refunded") return "review";
  return null;
}
function asUtcDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function isoDate(value) {
  return value.toISOString().slice(0, 10);
}
function addCycle(start, cycle) {
  const result = new Date(start);
  if (cycle === "weekly") result.setUTCDate(result.getUTCDate() + 7);
  if (cycle === "biweekly") result.setUTCDate(result.getUTCDate() + 14);
  if (cycle === "monthly") result.setUTCMonth(result.getUTCMonth() + 1);
  if (cycle === "quarterly") result.setUTCMonth(result.getUTCMonth() + 3);
  if (cycle === "semiannual") result.setUTCMonth(result.getUTCMonth() + 6);
  if (cycle === "yearly") result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
}
function paidPeriod(dueDate, cycle, currentPaidThrough) {
  const due = asUtcDate(dueDate);
  const existingEnd = currentPaidThrough ? asUtcDate(currentPaidThrough) : null;
  const start = existingEnd && existingEnd >= due ? new Date(existingEnd.getTime() + 864e5) : due;
  const exclusiveEnd = addCycle(start, cycle);
  const end = new Date(exclusiveEnd.getTime() - 864e5);
  return { startsOn: isoDate(start), endsOn: isoDate(end) };
}
function addGracePeriod(dueDate, graceDays) {
  const value = asUtcDate(dueDate);
  value.setUTCDate(value.getUTCDate() + Math.max(0, graceDays));
  return value.toISOString();
}
function centsFromProvider(value) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}
function safeProviderMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value;
  const allowed = ["description", "billingType", "cycle", "installmentCount", "deleted", "anticipated"];
  return Object.fromEntries(allowed.filter((key) => key in source).map((key) => [key, source[key]]));
}
var SUPPORTED_ASAAS_EVENTS, PAYMENT_STATUS;
var init_domain = __esm({
  "src/server/billing/domain.ts"() {
    SUPPORTED_ASAAS_EVENTS = /* @__PURE__ */ new Set([
      "PAYMENT_CREATED",
      "PAYMENT_UPDATED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_OVERDUE",
      "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
      "PAYMENT_DELETED",
      "PAYMENT_RESTORED",
      "PAYMENT_REFUNDED",
      "PAYMENT_PARTIALLY_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
      "PAYMENT_DUNNING_RECEIVED",
      "PAYMENT_DUNNING_REQUESTED",
      "SUBSCRIPTION_CREATED",
      "SUBSCRIPTION_UPDATED",
      "SUBSCRIPTION_INACTIVATED",
      "SUBSCRIPTION_DELETED"
    ]);
    PAYMENT_STATUS = {
      PAYMENT_CREATED: "pending",
      PAYMENT_UPDATED: "pending",
      PAYMENT_CONFIRMED: "confirmed",
      PAYMENT_RECEIVED: "received",
      PAYMENT_OVERDUE: "overdue",
      PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "refused",
      PAYMENT_DELETED: "deleted",
      PAYMENT_RESTORED: "restored",
      PAYMENT_REFUNDED: "refunded",
      PAYMENT_PARTIALLY_REFUNDED: "partially_refunded",
      PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
      PAYMENT_CHARGEBACK_DISPUTE: "chargeback",
      PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "chargeback",
      PAYMENT_DUNNING_RECEIVED: "received",
      PAYMENT_DUNNING_REQUESTED: "overdue"
    };
  }
});

// src/server/billing/router.ts
var router_exports = {};
__export(router_exports, {
  createBillingRouters: () => createBillingRouters,
  processPendingWebhookEvents: () => processPendingWebhookEvents,
  processStoredEvent: () => processStoredEvent,
  runBillingReconciliation: () => runBillingReconciliation,
  webhookTokenMatches: () => webhookTokenMatches
});
import { createHash, timingSafeEqual } from "node:crypto";
import { Router as Router6 } from "express";
import { waitUntil } from "@vercel/functions";
function webhookTokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
function cleanError(error) {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  return message.replace(/\$aact_[A-Za-z0-9_\-]+/g, "[REDACTED]").slice(0, 500);
}
function slugDate(value) {
  return value?.slice(0, 10) || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function ensureOwnerUser(db, contract) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1e3 });
  if (error) throw error;
  const existing = data.users.find((user) => user.email?.toLowerCase() === contract.owner_email.toLowerCase());
  if (existing) return existing;
  const baseUrl = process.env.APP_URL || "https://ordum-ordum.vercel.app";
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(contract.owner_email, {
    redirectTo: `${baseUrl.replace(/\/$/, "")}/#/auth/accept-invite`,
    data: { full_name: contract.owner_name || contract.customer_name }
  });
  if (inviteError) throw inviteError;
  return invited.user;
}
async function resolveContract(db, payment, subscriptionId) {
  if (subscriptionId) {
    const { data: subscription } = await db.from("billing_subscriptions").select("*, commercial_contracts(*)").eq("provider_subscription_id", subscriptionId).maybeSingle();
    if (subscription?.commercial_contracts) return { contract: subscription.commercial_contracts, subscription };
  }
  const externalReference = payment?.externalReference;
  if (externalReference) {
    const { data: contract } = await db.from("commercial_contracts").select("*").eq("external_reference", externalReference).maybeSingle();
    if (contract) return { contract, subscription: null };
  }
  return { contract: null, subscription: null };
}
function needsProviderVerification(eventType) {
  return ["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"].includes(eventType);
}
async function processPaymentEvent(db, eventRow, payload, provider) {
  let payment = payload.payment;
  if (!payment?.id) return "ignored";
  if (needsProviderVerification(payload.event)) {
    if (!provider) throw new Error("Consulta ao provedor \xE9 obrigat\xF3ria para esta transi\xE7\xE3o.");
    payment = await provider.getPayment(payment.id);
  }
  const { contract, subscription } = await resolveContract(db, payment, payment.subscription);
  const providerStatus = payment.status ? String(payment.status) : void 0;
  let normalizedStatus = needsProviderVerification(payload.event) ? normalizeProviderPaymentStatus(providerStatus) : normalizePaymentStatus(payload.event, providerStatus);
  const { data: existingPayment } = await db.from("billing_payments").select("*").eq("provider_payment_id", payment.id).maybeSingle();
  const wasSettled = ["confirmed", "received"].includes(existingPayment?.status);
  normalizedStatus = preserveSettledPaymentStatus(existingPayment?.status, normalizedStatus);
  const dueDate = slugDate(payment.dueDate);
  let startsOn = existingPayment?.paid_period_starts_on ?? null;
  let endsOn = existingPayment?.paid_period_ends_on ?? null;
  if (contract && ["confirmed", "received"].includes(normalizedStatus) && !existingPayment?.paid_period_ends_on) {
    const currentState = contract.tenant_id ? (await db.from("tenant_billing_state").select("paid_through").eq("tenant_id", contract.tenant_id).maybeSingle()).data : null;
    const period = paidPeriod(dueDate, contract.cycle, currentState?.paid_through);
    startsOn = period.startsOn;
    endsOn = period.endsOn;
  }
  const paymentValues = {
    provider: "asaas",
    provider_payment_id: payment.id,
    subscription_id: subscription?.id ?? existingPayment?.subscription_id ?? null,
    contract_id: contract?.id ?? existingPayment?.contract_id ?? null,
    tenant_id: contract?.tenant_id ?? existingPayment?.tenant_id ?? null,
    external_reference: payment.externalReference || existingPayment?.external_reference || null,
    status: normalizedStatus,
    provider_status: providerStatus || null,
    amount_cents: centsFromProvider(payment.value),
    net_amount_cents: payment.netValue == null ? null : centsFromProvider(payment.netValue),
    due_date: dueDate,
    confirmed_at: normalizedStatus === "confirmed" ? payment.confirmedDate || payment.clientPaymentDate || (/* @__PURE__ */ new Date()).toISOString() : existingPayment?.confirmed_at ?? null,
    received_at: normalizedStatus === "received" ? payment.paymentDate || payment.clientPaymentDate || (/* @__PURE__ */ new Date()).toISOString() : existingPayment?.received_at ?? null,
    paid_period_starts_on: startsOn,
    paid_period_ends_on: endsOn,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    metadata: safeProviderMetadata(payment)
  };
  const { data: savedPayment, error: paymentError } = await db.from("billing_payments").upsert(paymentValues, { onConflict: "provider,provider_payment_id" }).select().single();
  if (paymentError) throw paymentError;
  if (!contract) return "ignored";
  const accessStatus = accessTransitionForPaymentStatus(normalizedStatus);
  if (accessStatus === "active") {
    const owner = await ensureOwnerUser(db, contract);
    const { data: tenantId, error: provisionError } = await db.rpc("provision_paid_contract", {
      p_contract_id: contract.id,
      p_payment_id: savedPayment.id,
      p_owner_user_id: owner.id,
      p_actor_user_id: null
    });
    if (provisionError) throw provisionError;
    await db.from("billing_payments").update({ tenant_id: tenantId }).eq("id", savedPayment.id);
    if (!wasSettled) {
      void captureServerAnalytics("payment_confirmed", tenantId, { tenant_ref: tenantId, status: normalizedStatus, source: "asaas_sandbox" });
      if (contract.status !== "active") void captureServerAnalytics("contract_activated", tenantId, { tenant_ref: tenantId, status: "active", source: "billing_provisioning" });
    }
    const { data: templates } = await db.from("onboarding_templates").select("id, plan_id, solution_id, version, created_at").eq("active", true).order("version", { ascending: false }).order("created_at", { ascending: false });
    if (templates && templates.length > 0) {
      const { data: cItems } = await db.from("commercial_contract_items").select("solution_id").eq("contract_id", contract.id);
      const sIds = cItems?.map((c) => c.solution_id) || [];
      let selectedTemplate = templates.find((t) => t.plan_id === contract.plan_id && t.solution_id && sIds.includes(t.solution_id));
      if (!selectedTemplate) selectedTemplate = templates.find((t) => t.plan_id === contract.plan_id && !t.solution_id);
      if (!selectedTemplate) selectedTemplate = templates.find((t) => !t.plan_id && t.solution_id && sIds.includes(t.solution_id));
      if (!selectedTemplate) selectedTemplate = templates.find((t) => !t.plan_id && !t.solution_id);
      if (selectedTemplate) {
        const { data: existingRun } = await db.from("onboarding_runs").select("id").eq("tenant_id", tenantId).eq("template_id", selectedTemplate.id).maybeSingle();
        if (existingRun) {
          await db.from("platform_audit_logs").insert({ actor_user_id: owner.id, action: "onboarding.run.ignored", entity_type: "tenants", entity_id: tenantId, severity: "info", metadata: { reason: "Idempotency: run already exists for this tenant and template" } });
        } else {
          const { error: runErr } = await db.rpc("admin_start_onboarding", {
            p_tenant_id: tenantId,
            p_template_id: selectedTemplate.id,
            p_owner_platform_member_id: contract.owner_platform_member_id,
            p_actor_user_id: owner.id
          });
          if (runErr) {
            await db.from("platform_audit_logs").insert({ actor_user_id: owner.id, action: "onboarding.run.failed", entity_type: "tenants", entity_id: tenantId, severity: "error", metadata: { error: runErr.message, template_id: selectedTemplate.id } });
            throw new Error("Falha cr\xEDtica ao iniciar o onboarding autom\xE1tio ap\xF3s pagamento: " + runErr.message);
          }
        }
      }
    }
  } else if (accessStatus === "grace" && contract.tenant_id) {
    const graceEndsAt = addGracePeriod(dueDate, contract.grace_days);
    await db.from("tenant_billing_state").upsert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      subscription_id: subscription?.id ?? null,
      access_status: "grace",
      grace_ends_at: graceEndsAt,
      last_payment_id: savedPayment.id
    }, { onConflict: "tenant_id" });
    await db.from("commercial_contracts").update({ status: "past_due" }).eq("id", contract.id);
    await db.from("billing_status_history").insert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      payment_id: savedPayment.id,
      webhook_event_id: eventRow.id,
      from_status: contract.status,
      to_status: "grace",
      reason: "payment_overdue"
    });
  } else if (accessStatus === "review" && contract.tenant_id) {
    await db.from("tenant_billing_state").upsert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      access_status: "review",
      suspended_at: (/* @__PURE__ */ new Date()).toISOString(),
      suspension_reason: normalizedStatus,
      last_payment_id: savedPayment.id
    }, { onConflict: "tenant_id" });
    await db.from("tenants").update({ status: "suspended" }).eq("id", contract.tenant_id);
    await db.from("commercial_contracts").update({ status: "suspended" }).eq("id", contract.id);
  }
  return "processed";
}
async function processSubscriptionEvent(db, payload) {
  const subscription = payload.subscription;
  if (!subscription?.id) return "ignored";
  const { data: local } = await db.from("billing_subscriptions").select("*").eq("provider_subscription_id", subscription.id).maybeSingle();
  if (!local) return "ignored";
  const status = payload.event === "SUBSCRIPTION_DELETED" ? "deleted" : payload.event === "SUBSCRIPTION_INACTIVATED" ? "inactive" : String(subscription.status || "").toUpperCase() === "ACTIVE" ? "active" : local.status;
  const { error } = await db.from("billing_subscriptions").update({
    status,
    provider_status: subscription.status || null,
    next_due_date: subscription.nextDueDate || local.next_due_date,
    metadata: safeProviderMetadata(subscription)
  }).eq("id", local.id);
  if (error) throw error;
  return "processed";
}
async function processStoredEvent(db, eventRow, provider) {
  const payload = eventRow.payload;
  if (!SUPPORTED_ASAAS_EVENTS.has(eventRow.event_type)) return "ignored";
  if (eventRow.event_type.startsWith("PAYMENT_")) {
    return processPaymentEvent(db, eventRow, payload, provider);
  }
  if (eventRow.event_type.startsWith("SUBSCRIPTION_")) return processSubscriptionEvent(db, payload);
  return "ignored";
}
async function processPendingWebhookEvents(db, provider, limit = 10) {
  const claim = await db.rpc("claim_billing_webhook_events", { p_limit: limit });
  if (claim.error) throw claim.error;
  const results = [];
  for (const eventRow of claim.data || []) {
    try {
      const status = await processStoredEvent(db, eventRow, provider);
      await db.from("billing_webhook_events").update({
        status,
        processed_at: (/* @__PURE__ */ new Date()).toISOString(),
        locked_at: null,
        last_error: null
      }).eq("id", eventRow.id);
      results.push({ id: eventRow.id, status });
    } catch (error) {
      const delaySeconds = Math.min(3600, 2 ** Math.min(eventRow.attempts || 1, 10));
      await db.from("billing_webhook_events").update({
        status: "failed",
        locked_at: null,
        last_error: cleanError(error),
        next_attempt_at: new Date(Date.now() + delaySeconds * 1e3).toISOString()
      }).eq("id", eventRow.id);
      results.push({ id: eventRow.id, status: "failed" });
    }
  }
  return results;
}
function scheduleBackgroundWork(work) {
  try {
    waitUntil(work);
  } catch {
    void work;
  }
}
async function scopedContractIds(db, context) {
  if (context.role?.key === "admin") return null;
  const result = await db.from("commercial_contracts").select("id,team_id,owner_platform_member_id");
  if (result.error) throw result.error;
  return (result.data || []).filter((contract) => canReadAssignedResource(context, contract, "member_client_visibility")).map((contract) => contract.id);
}
function eventForRemotePayment(payment) {
  const status = String(payment?.status || "").toUpperCase();
  if (status === "RECEIVED" || status === "RECEIVED_IN_CASH") return "PAYMENT_RECEIVED";
  if (status === "CONFIRMED") return "PAYMENT_CONFIRMED";
  if (status === "OVERDUE" || status === "DUNNING_REQUESTED") return "PAYMENT_OVERDUE";
  if (status === "REFUNDED") return "PAYMENT_REFUNDED";
  if (status === "PARTIALLY_REFUNDED") return "PAYMENT_PARTIALLY_REFUNDED";
  if (status === "CHARGEBACK_REQUESTED") return "PAYMENT_CHARGEBACK_REQUESTED";
  if (status === "CHARGEBACK_DISPUTE") return "PAYMENT_CHARGEBACK_DISPUTE";
  if (status === "DELETED") return "PAYMENT_DELETED";
  return "PAYMENT_UPDATED";
}
async function runBillingReconciliation(db, triggeredByUserId) {
  const run = await db.from("billing_reconciliation_runs").insert({
    provider: "asaas",
    status: "running",
    triggered_by_user_id: triggeredByUserId || null
  }).select().single();
  if (run.error) throw new Error("N\xE3o foi poss\xEDvel iniciar a concilia\xE7\xE3o.");
  const runId = run.data.id;
  try {
    const config = getBillingConfig();
    if (!config.enabled) {
      const summary2 = { skipped: "billing_disabled", queueProcessed: 0 };
      await db.from("billing_reconciliation_runs").update({ status: "completed", completed_at: (/* @__PURE__ */ new Date()).toISOString(), summary: summary2 }).eq("id", runId);
      return { skipped: true, reason: "billing_disabled" };
    }
    const provider = new AsaasBillingProvider(config);
    const queue = await processPendingWebhookEvents(db, provider, 50);
    const localResult = await db.from("billing_subscriptions").select("*");
    if (localResult.error) throw localResult.error;
    const localSubscriptions = localResult.data || [];
    let checked = 0;
    let divergences = 0;
    let corrected = 0;
    let errors = 0;
    let recoveredPayments = 0;
    let critical = 0;
    for (const subscription of localSubscriptions) {
      try {
        const remote = await provider.getSubscription(subscription.provider_subscription_id);
        checked += 1;
        if (remote.externalReference && String(remote.externalReference) !== String(subscription.external_reference)) {
          divergences += 1;
          critical += 1;
          await db.from("billing_reconciliation_items").insert({ reconciliation_run_id: runId, resource_type: "subscription", provider_resource_id: subscription.provider_subscription_id, local_resource_id: subscription.id, severity: "critical", kind: "external_reference_mismatch", safe_summary: { local: subscription.external_reference, remote: remote.externalReference } });
          continue;
        }
        if (remote.status && remote.status !== subscription.provider_status) {
          divergences += 1;
          corrected += 1;
          const normalized = String(remote.status).toUpperCase() === "ACTIVE" ? "active" : String(remote.status).toUpperCase() === "INACTIVE" ? "inactive" : subscription.status;
          await db.from("billing_subscriptions").update({ provider_status: remote.status, status: normalized, next_due_date: remote.nextDueDate || subscription.next_due_date }).eq("id", subscription.id);
          await db.from("billing_reconciliation_items").insert({ reconciliation_run_id: runId, resource_type: "subscription", provider_resource_id: subscription.provider_subscription_id, local_resource_id: subscription.id, severity: "warning", status: "auto_corrected", kind: "provider_status_drift", safe_summary: { from: subscription.provider_status, to: remote.status } });
        }
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const page = await provider.listPayments({ subscriptionId: subscription.provider_subscription_id, offset, limit: 100 });
          const payments = Array.isArray(page.data) ? page.data : [];
          for (const payment of payments) {
            checked += 1;
            const eventType = eventForRemotePayment(payment);
            const providerEventId = `reconcile:${payment.id}:${String(payment.status || "unknown")}`;
            const inserted = await db.from("billing_webhook_events").insert({ provider: "asaas", provider_event_id: providerEventId, event_type: eventType, occurred_at: payment.dateCreated || null, payload: { id: providerEventId, event: eventType, dateCreated: (/* @__PURE__ */ new Date()).toISOString(), payment }, status: "processing", attempts: 1, locked_at: (/* @__PURE__ */ new Date()).toISOString() }).select().single();
            if (inserted.error?.code === "23505") continue;
            if (inserted.error) throw inserted.error;
            const result = await processStoredEvent(db, inserted.data, provider);
            await db.from("billing_webhook_events").update({ status: result, processed_at: (/* @__PURE__ */ new Date()).toISOString(), locked_at: null }).eq("id", inserted.data.id);
            recoveredPayments += 1;
            corrected += 1;
            divergences += 1;
            await db.from("billing_reconciliation_items").insert({ reconciliation_run_id: runId, resource_type: "payment", provider_resource_id: payment.id, local_resource_id: inserted.data.id, severity: "warning", status: "auto_corrected", kind: "missing_or_changed_payment", safe_summary: { provider_status: payment.status } });
          }
          hasMore = Boolean(page.hasMore);
          offset += payments.length;
          if (!payments.length) hasMore = false;
        }
      } catch (error) {
        errors += 1;
        await db.from("billing_reconciliation_items").insert({ reconciliation_run_id: runId, resource_type: "subscription", provider_resource_id: subscription.provider_subscription_id, local_resource_id: subscription.id, severity: "critical", kind: "provider_query_failed", safe_summary: { error: cleanError(error) } });
      }
    }
    let remoteOffset = 0;
    let remoteHasMore = true;
    const localProviderIds = new Set(localSubscriptions.map((item) => item.provider_subscription_id));
    while (remoteHasMore) {
      const page = await provider.listSubscriptions(remoteOffset, 100);
      const rows = Array.isArray(page.data) ? page.data : [];
      for (const remote of rows) {
        if (!localProviderIds.has(remote.id) && remote.externalReference) {
          divergences += 1;
          critical += 1;
          await db.from("billing_reconciliation_items").insert({ reconciliation_run_id: runId, resource_type: "subscription", provider_resource_id: remote.id, severity: "critical", kind: "remote_subscription_missing_locally", safe_summary: { external_reference: remote.externalReference, provider_status: remote.status } });
        }
      }
      remoteHasMore = Boolean(page.hasMore);
      remoteOffset += rows.length;
      if (!rows.length) remoteHasMore = false;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const today = now.slice(0, 10);
    const expiredGrace = await db.from("tenant_billing_state").select("tenant_id,contract_id").eq("access_status", "grace").lt("grace_ends_at", now);
    for (const state of expiredGrace.data || []) {
      await db.from("tenant_billing_state").update({ access_status: "suspended", suspended_at: now, suspension_reason: "grace_expired" }).eq("tenant_id", state.tenant_id);
      await db.from("tenants").update({ status: "suspended" }).eq("id", state.tenant_id);
      await db.from("commercial_contracts").update({ status: "suspended" }).eq("id", state.contract_id);
      corrected += 1;
    }
    const cancelledContracts = await db.from("commercial_contracts").select("id,tenant_id").eq("status", "cancelled").not("tenant_id", "is", null);
    for (const contract of cancelledContracts.data || []) {
      const state = await db.from("tenant_billing_state").select("paid_through,access_status").eq("tenant_id", contract.tenant_id).maybeSingle();
      if (state.data?.paid_through && state.data.paid_through < today && state.data.access_status !== "cancelled") {
        await db.from("tenant_billing_state").update({ access_status: "cancelled", suspended_at: now, suspension_reason: "cancelled_period_ended" }).eq("tenant_id", contract.tenant_id);
        await db.from("tenants").update({ status: "suspended" }).eq("id", contract.tenant_id);
        corrected += 1;
      }
    }
    const status = errors || critical ? "completed_with_errors" : "completed";
    const summary = { queueProcessed: queue.length, recoveredPayments, graceSuspensions: expiredGrace.data?.length || 0, criticalReview: critical };
    await db.from("billing_reconciliation_runs").update({ status, completed_at: now, checked_count: checked, divergence_count: divergences, corrected_count: corrected, error_count: errors, summary }).eq("id", runId);
    return { status, checked, divergences, corrected, errors, ...summary };
  } catch (error) {
    await db.from("billing_reconciliation_runs").update({ status: "failed", completed_at: (/* @__PURE__ */ new Date()).toISOString(), error_count: 1, summary: { error: cleanError(error) } }).eq("id", runId);
    throw error;
  }
}
function createBillingRouters(getSupabaseAdmin2) {
  const publicRouter = Router6();
  const adminRouter = Router6();
  const internalRouter = Router6();
  publicRouter.post("/asaas", async (req, res) => {
    const db = getSupabaseAdmin2();
    let config;
    try {
      config = getBillingConfig();
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
    if (!config.enabled) return res.status(503).json({ error: "Cobran\xE7a desabilitada." });
    if (!webhookTokenMatches(req.header("asaas-access-token"), config.webhookToken)) {
      return res.status(401).json({ error: "Webhook n\xE3o autorizado." });
    }
    const rateKey = createHash("sha256").update(`${req.header("x-forwarded-for")?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown"}:asaas`).digest("hex");
    const rate = await db.rpc("check_billing_webhook_rate_limit", {
      p_key_hash: rateKey,
      p_limit: 120,
      p_window_seconds: 60
    });
    if (rate.error) return res.status(500).json({ error: "Falha ao validar limite do webhook." });
    if (!rate.data) return res.status(429).json({ error: "Limite de webhook excedido." });
    const payload = req.body;
    if (!payload || typeof payload !== "object" || !payload.id || !payload.event) {
      return res.status(400).json({ error: "Evento inv\xE1lido." });
    }
    const insert = await db.from("billing_webhook_events").insert({
      provider: "asaas",
      provider_event_id: String(payload.id),
      event_type: String(payload.event),
      occurred_at: payload.dateCreated || null,
      payload,
      status: "received"
    }).select().single();
    let eventRow = insert.data;
    if (insert.error?.code === "23505") {
      const existing = await db.from("billing_webhook_events").select("*").eq("provider", "asaas").eq("provider_event_id", String(payload.id)).single();
      if (existing.error) return res.status(500).json({ error: "Falha ao recuperar evento persistido." });
      if (["processed", "ignored", "processing", "received"].includes(existing.data.status)) {
        return res.status(200).json({ received: true, duplicate: true, status: existing.data.status });
      }
      eventRow = existing.data;
      await db.from("billing_webhook_events").update({
        status: "received",
        next_attempt_at: (/* @__PURE__ */ new Date()).toISOString(),
        locked_at: null
      }).eq("id", eventRow.id);
    } else if (insert.error) {
      return res.status(500).json({ error: "Falha ao persistir evento." });
    }
    const provider = new AsaasBillingProvider(config);
    scheduleBackgroundWork(processPendingWebhookEvents(db, provider, 10));
    return res.status(200).json({ received: true, status: "received", correlationId: eventRow.correlation_id });
  });
  adminRouter.get("/billing/overview", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.read"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const contractIds = await scopedContractIds(db, req.platformContext);
    if (contractIds && !contractIds.length) return res.json({
      configuration: publicBillingHealth(),
      counts: { plans: 0, activeSubscriptions: 0, overduePayments: 0, failedWebhooks: 0 },
      lastWebhook: null,
      lastReconciliation: null
    });
    let subscriptionQuery = db.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active");
    let overdueQuery = db.from("billing_payments").select("*", { count: "exact", head: true }).eq("status", "overdue");
    if (contractIds) {
      subscriptionQuery = subscriptionQuery.in("contract_id", contractIds);
      overdueQuery = overdueQuery.in("contract_id", contractIds);
    }
    const isAdmin = req.platformContext.role?.key === "admin";
    const [plans, subscriptions, overdue, failures, lastWebhook, lastReconciliation] = await Promise.all([
      db.from("billing_plans").select("*", { count: "exact", head: true }).eq("active", true),
      subscriptionQuery,
      overdueQuery,
      isAdmin ? db.from("billing_webhook_events").select("*", { count: "exact", head: true }).eq("status", "failed") : Promise.resolve({ count: 0 }),
      isAdmin ? db.from("billing_webhook_events").select("event_type,status,received_at").order("received_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      isAdmin ? db.from("billing_reconciliation_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null })
    ]);
    return res.json({
      configuration: publicBillingHealth(),
      counts: { plans: plans.count || 0, activeSubscriptions: subscriptions.count || 0, overduePayments: overdue.count || 0, failedWebhooks: failures.count || 0 },
      lastWebhook: lastWebhook.data || null,
      lastReconciliation: lastReconciliation.data || null
    });
  });
  adminRouter.get("/billing/records", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.read"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const contractIds = await scopedContractIds(db, req.platformContext);
    const { page, pageSize, from, to } = parsePagination(req.query);
    if (contractIds && !contractIds.length) return res.json({ subscriptions: pageResult([], 0, page, pageSize), payments: pageResult([], 0, page, pageSize) });
    let subscriptions = db.from("billing_subscriptions").select("*, billing_customers(name,email,tax_id_last4), commercial_contracts(contract_number,customer_name,team_id,owner_platform_member_id)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    let payments = db.from("billing_payments").select("*, commercial_contracts(contract_number,customer_name,team_id,owner_platform_member_id)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (contractIds) {
      subscriptions = subscriptions.in("contract_id", contractIds);
      payments = payments.in("contract_id", contractIds);
    }
    if (typeof req.query.status === "string" && req.query.status) {
      subscriptions = subscriptions.eq("status", req.query.status);
      payments = payments.eq("status", req.query.status);
    }
    const [subscriptionResult, paymentResult] = await Promise.all([subscriptions, payments]);
    if (subscriptionResult.error || paymentResult.error) return res.status(500).json({ error: subscriptionResult.error?.message || paymentResult.error?.message });
    return res.json({
      subscriptions: pageResult(subscriptionResult.data || [], subscriptionResult.count, page, pageSize),
      payments: pageResult(paymentResult.data || [], paymentResult.count, page, pageSize)
    });
  });
  adminRouter.get("/billing/plans", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.read"), async (req, res) => {
    const { data, error } = await getSupabaseAdmin2().from("billing_plans").select("*, billing_plan_prices(*), billing_plan_solutions(*, solutions(id,key,name))").order("code").order("version", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });
  adminRouter.post("/billing/plans", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.manage"), async (req, res) => {
    const { code, name, description, trial_days, grace_days, limits, amount_cents, cycle, billing_type, solution_ids, solution_limits } = req.body;
    if (!code || !name) return res.status(400).json({ error: "C\xF3digo e nome s\xE3o obrigat\xF3rios." });
    const db = getSupabaseAdmin2();
    const created = await db.rpc("admin_create_billing_plan_version", {
      p_code: code,
      p_name: name,
      p_description: description || "",
      p_trial_days: Number(trial_days || 0),
      p_grace_days: Number(grace_days ?? 5),
      p_limits: limits || {},
      p_amount_cents: amount_cents === void 0 ? null : Number(amount_cents),
      p_cycle: cycle || "monthly",
      p_billing_type: billing_type || "UNDEFINED",
      p_solution_ids: Array.isArray(solution_ids) ? solution_ids : [],
      p_solution_limits: solution_limits || {},
      p_actor_user_id: req.user.id
    });
    if (created.error) return res.status(400).json({ error: created.error.message });
    const saved = await db.from("billing_plans").select("*,billing_plan_prices(*),billing_plan_solutions(*)").eq("id", created.data).single();
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.plan.created", entity_type: "billing_plans", entity_id: created.data, severity: "info", ...auditContext(req, { result: "success", after: { code, version: saved.data?.version } }) });
    return res.status(201).json(saved.data);
  });
  adminRouter.get("/commercial/catalog", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.read"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const [solutions, teams] = await Promise.all([
      db.from("solutions").select("id,key,name").order("name"),
      db.from("platform_teams").select("id,name,status").eq("status", "active").order("name")
    ]);
    if (solutions.error || teams.error) return res.status(500).json({ error: solutions.error?.message || teams.error?.message });
    const scopedTeams = req.platformContext.role.key === "admin" ? teams.data : teams.data.filter((team) => req.platformContext.teams.some((own) => own.id === team.id));
    return res.json({ solutions: solutions.data, teams: scopedTeams });
  });
  adminRouter.get("/commercial/demos", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.read"), async (req, res) => {
    let query = getSupabaseAdmin2().from("commercial_demos").select("*, marketing_leads(id,name,email,company,status), platform_teams(id,name)").order("created_at", { ascending: false });
    if (req.platformContext.role.key !== "admin") {
      const teamIds = req.platformContext.teams.map((team) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const scoped = req.platformContext.role.key === "admin" ? data : (data || []).filter((item) => canReadAssignedResource(req.platformContext, item, "member_lead_visibility"));
    const { page, pageSize, from, to } = parsePagination(req.query);
    return res.json(req.query.page !== void 0 ? pageResult(scoped.slice(from, to + 1), scoped.length, page, pageSize) : scoped);
  });
  adminRouter.patch("/commercial/demos/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const existing = await db.from("commercial_demos").select("*").eq("id", req.params.id).single();
    if (existing.error) return res.status(404).json({ error: "Demonstra\xE7\xE3o n\xE3o encontrada." });
    if (!canReadAssignedResource(req.platformContext, existing.data, "member_lead_visibility")) return res.status(403).json({ error: "Demonstra\xE7\xE3o fora do seu escopo." });
    const allowed = ["status", "starts_at", "expires_at", "notes", "result", "next_action", "next_action_at"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const saved = await db.from("commercial_demos").update(updates).eq("id", existing.data.id).select().single();
    if (saved.error) return res.status(400).json({ error: saved.error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.demo.updated", entity_type: "commercial_demos", entity_id: existing.data.id, team_id: existing.data.team_id, severity: "info", ...auditContext(req, { result: "success", before: existing.data, after: saved.data }) });
    return res.json(saved.data);
  });
  adminRouter.post("/commercial/leads/:leadId/activities", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const { activity_type, subject, description, scheduled_at, status, result, next_action, next_action_at } = req.body;
    if (!activity_type || !subject) return res.status(400).json({ error: "Tipo e assunto s\xE3o obrigat\xF3rios." });
    const db = getSupabaseAdmin2();
    const { data: assignment } = await db.from("platform_lead_assignments").select("*").eq("lead_id", req.params.leadId).maybeSingle();
    if (req.platformContext.role.key !== "admin" && !canReadAssignedResource(req.platformContext, assignment, "member_lead_visibility")) {
      return res.status(403).json({ error: "Lead fora do seu escopo." });
    }
    const { data, error } = await db.from("commercial_activities").insert({
      lead_id: req.params.leadId,
      team_id: assignment?.team_id || null,
      owner_platform_member_id: assignment?.owner_platform_member_id || req.platformContext.platformMember.id,
      activity_type,
      subject,
      description: description || null,
      scheduled_at: scheduled_at || null,
      status: status || "planned",
      result: result || null,
      next_action: next_action || null,
      next_action_at: next_action_at || null,
      completed_at: status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null,
      created_by_user_id: req.user.id
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.activity.created", entity_type: "commercial_activities", entity_id: data.id, team_id: data.team_id, severity: "info", ...auditContext(req, { result: "success", after: { activity_type, subject, status: status || "planned" } }) });
    return res.status(201).json(data);
  });
  adminRouter.get("/commercial/proposals", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.read"), async (req, res) => {
    let query = getSupabaseAdmin2().from("commercial_proposals").select("*, marketing_leads(id,name,email,company), billing_plans(id,name,code,version)").order("created_at", { ascending: false });
    if (req.platformContext.role.key !== "admin") {
      const teamIds = req.platformContext.teams.map((team) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const scoped = req.platformContext.role.key === "admin" ? data : (data || []).filter((item) => canReadAssignedResource(req.platformContext, item, "member_lead_visibility"));
    const { page, pageSize, from, to } = parsePagination(req.query);
    return res.json(req.query.page !== void 0 ? pageResult(scoped.slice(from, to + 1), scoped.length, page, pageSize) : scoped);
  });
  adminRouter.post("/commercial/proposals", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const input = req.body;
    if (!input.lead_id || !input.plan_id || !input.cycle || !input.billing_type) return res.status(400).json({ error: "Lead, plano, ciclo e tipo de cobran\xE7a s\xE3o obrigat\xF3rios." });
    if (!Array.isArray(input.solution_ids)) return res.status(400).json({ error: "solution_ids deve ser um array." });
    const db = getSupabaseAdmin2();
    const assignmentResult = await db.from("platform_lead_assignments").select("*").eq("lead_id", input.lead_id).maybeSingle();
    const assignment = assignmentResult.data;
    if (req.platformContext.role.key !== "admin" && (!assignment || !canReadAssignedResource(req.platformContext, assignment, "member_lead_visibility"))) {
      return res.status(403).json({ error: "Lead fora do seu escopo." });
    }
    if (req.platformContext.role.key !== "admin" && input.team_id && input.team_id !== assignment.team_id) {
      return res.status(403).json({ error: "A proposta deve permanecer na equipe atribu\xEDda ao lead." });
    }
    const ownerId = req.platformContext.role.key === "sales" ? req.platformContext.platformMember.id : input.owner_platform_member_id || assignment?.owner_platform_member_id || req.platformContext.platformMember.id;
    if (input.team_id && ownerId) {
      const target = await db.from("platform_team_members").select("platform_member_id").eq("team_id", input.team_id).eq("platform_member_id", ownerId).eq("status", "active").maybeSingle();
      if (!target.data) return res.status(400).json({ error: "O respons\xE1vel precisa ser membro ativo da equipe." });
    }
    const { data: plan, error: planError } = await db.from("billing_plans").select("*, billing_plan_prices(*), billing_plan_solutions(solution_id, limits, solutions(*))").eq("id", input.plan_id).single();
    if (planError || !plan) return res.status(404).json({ error: "Plano n\xE3o encontrado." });
    const activePrice = plan.billing_plan_prices?.find((p) => p.active && p.cycle === input.cycle && p.billing_type === input.billing_type);
    if (!activePrice) return res.status(400).json({ error: "Pre\xE7o base n\xE3o encontrado ou inativo para as configura\xE7\xF5es escolhidas." });
    const planSolutionIds = plan.billing_plan_solutions.map((item) => item.solution_id);
    for (const sol of input.solution_ids) {
      if (!planSolutionIds.includes(sol)) {
        return res.status(400).json({ error: "solution_not_in_plan", message: `A solu\xE7\xE3o ${sol} n\xE3o est\xE1 inclu\xEDda no plano base.` });
      }
    }
    const requestedSolutions = plan.billing_plan_solutions.filter((item) => input.solution_ids.includes(item.solution_id));
    let subtotal = activePrice.amount_cents;
    const discount = Number(input.discount_cents) || 0;
    if (discount < 0) return res.status(400).json({ error: "Desconto n\xE3o pode ser negativo" });
    const amountCents = Math.max(0, subtotal - discount);
    if (req.platformContext.role.key !== "admin") {
      const team = req.platformContext.managedTeams.find((t) => t.id === input.team_id || t.id === assignment?.team_id);
      const maxDiscount = team?.max_discount_allowed_cents || 0;
      if (discount > maxDiscount) {
        return res.status(403).json({ error: "Desconto acima da al\xE7ada permitida." });
      }
    }
    const { data, error } = await db.from("commercial_proposals").insert({
      lead_id: input.lead_id,
      plan_id: input.plan_id,
      team_id: input.team_id || assignment?.team_id || null,
      owner_platform_member_id: ownerId,
      status: "pending_approval",
      amount_cents: amountCents,
      cycle: input.cycle,
      billing_type: input.billing_type,
      valid_until: input.valid_until || null,
      discount_cents: discount,
      notes: input.notes || null,
      created_by_user_id: req.user.id
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    if (requestedSolutions.length > 0) {
      const itemsToInsert = requestedSolutions.map((item) => ({
        proposal_id: data.id,
        solution_id: item.solution_id,
        quantity: 1,
        unit_amount_cents: 0,
        limits: item.limits,
        description: item.solutions?.name || "M\xF3dulo do plano"
      }));
      const { error: itemsError } = await db.from("commercial_proposal_items").insert(itemsToInsert);
      if (itemsError) {
        const { error: delError } = await db.from("commercial_proposals").delete().eq("id", data.id);
        if (delError) {
          await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "system.consistency.error", entity_type: "commercial_proposals", entity_id: data.id, severity: "critical", metadata: { reason: "Falha tentar exclus\xE3o do pai ao reverter transa\xE7\xE3o", itemsError: itemsError.message, delError: delError.message } });
          return res.status(500).json({ error: "Incoer\xEAncia cr\xEDtica: n\xE3o foi poss\xEDvel remover a proposta ap\xF3s falha nos itens." });
        }
        await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.proposal.rollback", entity_type: "commercial_proposals", entity_id: data.id, severity: "info", metadata: { reason: "Sucesso ao reverter", itemsError: itemsError.message } });
        return res.status(500).json({ error: itemsError.message });
      }
    }
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.proposal.created", entity_type: "commercial_proposals", entity_id: data.id, team_id: data.team_id, severity: "info", ...auditContext(req, { result: "success", after: { amount_cents: data.amount_cents, subtotal, discount, solution_count: requestedSolutions.length } }) });
    void captureServerAnalytics("proposal_created", req.user.id, { plan_ref: input.plan_id, status: data.status, source: "admin_commercial" });
    return res.status(201).json(data);
  });
  adminRouter.post("/commercial/proposals/:id/approve", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.approve"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const { data: proposal, error: readError } = await db.from("commercial_proposals").select("*").eq("id", req.params.id).single();
    if (readError) return res.status(404).json({ error: "Proposta n\xE3o encontrada." });
    if (req.platformContext.role.key !== "admin" && !req.platformContext.managedTeams.some((team) => team.id === proposal.team_id)) {
      return res.status(403).json({ error: "Proposta fora da sua al\xE7ada." });
    }
    if (req.platformContext.role.key !== "admin") {
      const team = req.platformContext.managedTeams.find((item) => item.id === proposal.team_id);
      if (!withinManagerApprovalLimit(team, proposal.amount_cents, "proposal")) return res.status(403).json({ error: "Valor acima da al\xE7ada configurada; aprova\xE7\xE3o de admin necess\xE1ria." });
    }
    const reason = typeof req.body.approval_notes === "string" ? req.body.approval_notes.trim() : "";
    if (!reason) return res.status(400).json({ error: "A justificativa da aprova\xE7\xE3o \xE9 obrigat\xF3ria." });
    const transitioned = await db.rpc("admin_transition_control_plane", {
      p_entity_type: "proposal",
      p_entity_id: proposal.id,
      p_to_status: "approved",
      p_actor_user_id: req.user.id,
      p_reason: reason,
      p_team_id: proposal.team_id,
      p_tenant_id: null,
      p_request_id: req.requestId || null,
      p_metadata: { approval_limit_checked: true, amount_cents: proposal.amount_cents }
    });
    if (transitioned.error) return res.status(409).json({ error: transitioned.error.message });
    await db.from("commercial_proposals").update({ approval_notes: reason }).eq("id", proposal.id);
    const saved = await db.from("commercial_proposals").select("*").eq("id", proposal.id).single();
    return res.json(saved.data);
  });
  adminRouter.post("/commercial/proposals/:id/versions", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) return res.status(400).json({ error: "O motivo da nova vers\xE3o \xE9 obrigat\xF3rio." });
    const db = getSupabaseAdmin2();
    const existing = await db.from("commercial_proposals").select("*").eq("id", req.params.id).maybeSingle();
    if (existing.error || !existing.data) return res.status(404).json({ error: "Proposta n\xE3o encontrada." });
    if (!canReadAssignedResource(req.platformContext, existing.data, "member_lead_visibility")) return res.status(403).json({ error: "Proposta fora do seu escopo." });
    const allowedChanges = ["plan_id", "amount_cents", "cycle", "billing_type", "valid_until", "discount_cents", "notes", "vigency_starts_on", "vigency_ends_on", "limits_snapshot"];
    const changes = Object.fromEntries(Object.entries(req.body?.changes || {}).filter(([key]) => allowedChanges.includes(key)));
    const created = await db.rpc("admin_create_proposal_version", { p_proposal_id: req.params.id, p_actor_user_id: req.user.id, p_changes: changes });
    if (created.error) return res.status(409).json({ error: created.error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.proposal.version_created", entity_type: "commercial_proposals", entity_id: created.data, team_id: existing.data.team_id, severity: "info", ...auditContext(req, { result: "success", reason, supersedes: existing.data.id }) });
    const saved = await db.from("commercial_proposals").select("*,commercial_proposal_items(*)").eq("id", created.data).single();
    return res.status(201).json(saved.data);
  });
  adminRouter.post("/commercial/proposals/:id/accept", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const existing = await db.from("commercial_proposals").select("*").eq("id", req.params.id).maybeSingle();
    if (existing.error || !existing.data) return res.status(404).json({ error: "Proposta n\xE3o encontrada." });
    if (!canReadAssignedResource(req.platformContext, existing.data, "member_lead_visibility")) return res.status(403).json({ error: "Proposta fora do seu escopo." });
    if (existing.data.status === "accepted") return res.json({ success: true, message: "Proposta j\xE1 aceita." });
    if (existing.data.status === "rejected" || existing.data.status === "superseded") return res.status(400).json({ error: "Status atual n\xE3o permite aceite." });
    if (existing.data.status !== "approved") return res.status(400).json({ error: "A proposta precisa ser aprovada antes do aceite." });
    if (existing.data.valid_until && new Date(existing.data.valid_until) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "Proposta expirada." });
    }
    const { error: updateErr } = await db.from("commercial_proposals").update({ status: "accepted" }).eq("id", existing.data.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.proposal.accepted", entity_type: "commercial_proposals", entity_id: existing.data.id, team_id: existing.data.team_id, severity: "info", ...auditContext(req, { result: "success" }) });
    return res.json({ success: true, status: "accepted" });
  });
  adminRouter.post("/commercial/proposals/:id/create-contract", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const { data: proposal, error } = await db.from("commercial_proposals").select("*, marketing_leads(*), billing_plans(*)").eq("id", req.params.id).single();
    if (error || !proposal) return res.status(404).json({ error: "Proposta n\xE3o encontrada." });
    if (proposal.status !== "approved") return res.status(409).json({ error: "A proposta precisa estar aprovada." });
    if (req.platformContext.role.key !== "admin" && !canReadAssignedResource(req.platformContext, proposal, "member_lead_visibility")) {
      return res.status(403).json({ error: "Proposta fora do seu escopo." });
    }
    const lead = proposal.marketing_leads;
    const { data: contract, error: contractError } = await db.from("commercial_contracts").insert({
      proposal_id: proposal.id,
      lead_id: proposal.lead_id,
      plan_id: proposal.plan_id,
      team_id: proposal.team_id,
      owner_platform_member_id: proposal.owner_platform_member_id,
      customer_name: lead.company,
      customer_email: lead.email,
      customer_tax_id: req.body.customer_tax_id || null,
      customer_phone: req.body.customer_phone || lead.phone,
      owner_name: lead.name,
      owner_email: lead.email,
      status: "pending_approval",
      amount_cents: proposal.amount_cents,
      currency: proposal.currency,
      cycle: proposal.cycle,
      billing_type: proposal.billing_type || "UNDEFINED",
      grace_days: proposal.billing_plans?.grace_days ?? 5,
      created_by_user_id: req.user.id
    }).select().single();
    if (contractError) return res.status(contractError.code === "23505" ? 409 : 400).json({ error: contractError.code === "23505" ? "Esta proposta j\xE1 possui contrato." : contractError.message });
    const { data: proposalItems } = await db.from("commercial_proposal_items").select("solution_id,limits").eq("proposal_id", proposal.id);
    if (proposalItems?.length) {
      const { error: cntItemsErr } = await db.from("commercial_contract_items").insert(proposalItems.map((item) => ({ contract_id: contract.id, solution_id: item.solution_id, limits: item.limits })));
      if (cntItemsErr) {
        const { error: delError } = await db.from("commercial_contracts").delete().eq("id", contract.id);
        if (delError) {
          await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "system.consistency.error", entity_type: "commercial_contracts", entity_id: contract.id, severity: "critical", metadata: { reason: "Falha tentar exclus\xE3o do pai ao reverter transa\xE7\xE3o", itemsError: cntItemsErr.message, delError: delError.message } });
          return res.status(500).json({ error: "Incoer\xEAncia cr\xEDtica: n\xE3o foi poss\xEDvel remover o contrato ap\xF3s falha nos itens." });
        }
        await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.contract.rollback", entity_type: "commercial_contracts", entity_id: contract.id, severity: "info", metadata: { reason: "Sucesso ao reverter", itemsError: cntItemsErr.message } });
        return res.status(500).json({ error: cntItemsErr.message });
      }
    }
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.contract.created_from_proposal", entity_type: "commercial_contracts", entity_id: contract.id, team_id: proposal.team_id, severity: "info", metadata: { proposal_id: proposal.id } });
    return res.status(201).json(contract);
  });
  adminRouter.get("/commercial/contracts", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.read"), async (req, res) => {
    let query = getSupabaseAdmin2().from("commercial_contracts").select("*, billing_plans(name,code,version), commercial_contract_items(*, solutions(id,key,name)), billing_subscriptions(id,status,provider_subscription_id), tenant_billing_state(access_status,paid_through,grace_ends_at)").order("created_at", { ascending: false });
    if (req.platformContext.role.key !== "admin") {
      const teamIds = req.platformContext.teams.map((team) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const scoped = req.platformContext.role.key === "admin" ? data : (data || []).filter((item) => canReadAssignedResource(req.platformContext, item, "member_client_visibility"));
    const { page, pageSize, from, to } = parsePagination(req.query);
    return res.json(req.query.page !== void 0 ? pageResult(scoped.slice(from, to + 1), scoped.length, page, pageSize) : scoped);
  });
  adminRouter.post("/commercial/contracts", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    return res.status(405).json({ error: "Crie o contrato a partir de uma proposta aprovada." });
  });
  adminRouter.post("/commercial/contracts/:id/approve", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.approve"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const { data: contract, error: readError } = await db.from("commercial_contracts").select("*").eq("id", req.params.id).single();
    if (readError) return res.status(404).json({ error: "Contrato n\xE3o encontrado." });
    if (req.platformContext.role.key !== "admin" && !req.platformContext.managedTeams.some((team) => team.id === contract.team_id)) {
      return res.status(403).json({ error: "Contrato fora da sua al\xE7ada." });
    }
    if (req.platformContext.role.key !== "admin") {
      const team = req.platformContext.managedTeams.find((item) => item.id === contract.team_id);
      if (!withinManagerApprovalLimit(team, contract.amount_cents, "contract")) return res.status(403).json({ error: "Valor acima da al\xE7ada configurada; aprova\xE7\xE3o de admin necess\xE1ria." });
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) return res.status(400).json({ error: "A justificativa da aprova\xE7\xE3o \xE9 obrigat\xF3ria." });
    const transitioned = await db.rpc("admin_transition_control_plane", {
      p_entity_type: "contract",
      p_entity_id: contract.id,
      p_to_status: "approved",
      p_actor_user_id: req.user.id,
      p_reason: reason,
      p_team_id: contract.team_id,
      p_tenant_id: contract.tenant_id || null,
      p_request_id: req.requestId || null,
      p_metadata: { approval_limit_checked: true, amount_cents: contract.amount_cents }
    });
    if (transitioned.error) return res.status(409).json({ error: transitioned.error.message });
    const saved = await db.from("commercial_contracts").select("*").eq("id", contract.id).single();
    return res.json(saved.data);
  });
  adminRouter.post("/commercial/contracts/:id/accept", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.commercial.manage"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const { data: contract, error: err } = await db.from("commercial_contracts").select("*").eq("id", req.params.id).single();
    if (err || !contract) return res.status(404).json({ error: "Contrato n\xE3o encontrado." });
    if (contract.status !== "approved") return res.status(409).json({ error: "Contrato precisa estar aprovado antes do aceite final." });
    if (req.platformContext.role.key !== "admin" && !canReadAssignedResource(req.platformContext, contract, "member_client_visibility")) {
      return res.status(403).json({ error: "Contrato fora do escopo." });
    }
    const metadata = { ip: req.ip, user_agent: req.headers["user-agent"], accepted_by: req.user.id, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
    const { error: updateErr } = await db.from("commercial_contracts").update({ status: "accepted", metadata }).eq("id", contract.id);
    if (updateErr) return res.status(400).json({ error: updateErr.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.contract.accepted", entity_type: "commercial_contracts", entity_id: contract.id, team_id: contract.team_id, severity: "info", ...auditContext(req, { result: "success", metadata }) });
    return res.json({ success: true, status: "accepted" });
  });
  adminRouter.post("/commercial/contracts/:id/mock-sandbox-payment", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.webhooks.manage"), async (req, res) => {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.ASAAS_ENV !== "sandbox") {
      return res.status(403).json({ error: "Sandbox mock disponivel apenas em dev/staging." });
    }
    const db = getSupabaseAdmin2();
    const { data: contract } = await db.from("commercial_contracts").select("*").eq("id", req.params.id).single();
    if (!contract || contract.status !== "pending_payment") return res.status(400).json({ error: "Contrato invalido ou nao aguarda pagamento." });
    if (req.platformContext.role.key !== "admin" && !canReadAssignedResource(req.platformContext, contract, "member_client_visibility")) {
      return res.status(403).json({ error: "Contrato fora do escopo." });
    }
    const { data: subscription } = await db.from("billing_subscriptions").select("*").eq("contract_id", contract.id).maybeSingle();
    if (!subscription) return res.status(400).json({ error: "Assinatura nao encontrada." });
    const fakePaymentId = `mock:payment:${contract.id}`;
    const fakeEventId = `mock:event:payment_confirmed:${contract.id}`;
    const { data: existingEvent } = await db.from("billing_webhook_events").select("*").eq("provider_event_id", fakeEventId).maybeSingle();
    let webhookEvent = existingEvent;
    if (!webhookEvent) {
      const fakePayload = {
        event: "PAYMENT_CONFIRMED",
        payment: {
          id: fakePaymentId,
          customer: subscription.provider_customer_id || "cus_mock",
          subscription: subscription.provider_subscription_id,
          value: contract.amount_cents / 100,
          netValue: contract.amount_cents / 100,
          status: "CONFIRMED",
          externalReference: contract.external_reference,
          confirmedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
        }
      };
      const { data: newWebhook, error: whErr } = await db.from("billing_webhook_events").insert({
        event_type: "PAYMENT_CONFIRMED",
        provider: "asaas",
        provider_event_id: fakeEventId,
        payload: fakePayload,
        status: "pending"
      }).select().single();
      if (whErr) return res.status(500).json({ error: "Falha ao injetar evento sandbox: " + whErr.message });
      webhookEvent = newWebhook;
    }
    if (webhookEvent && webhookEvent.status === "pending") {
      const { processStoredEvent: processStoredEvent2 } = await Promise.resolve().then(() => (init_router(), router_exports));
      try {
        const processResult = await processStoredEvent2(db, webhookEvent);
        await db.from("billing_webhook_events").update({
          status: processResult,
          processed_at: (/* @__PURE__ */ new Date()).toISOString(),
          last_error: null
        }).eq("id", webhookEvent.id);
        await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.sandbox_payment.processed", entity_type: "billing_webhook_events", entity_id: webhookEvent.id, severity: "info", metadata: { contract_id: contract.id, subscription_id: subscription.id, provider_event_id: fakeEventId, result: processResult } });
      } catch (err) {
        await db.from("billing_webhook_events").update({
          status: "failed",
          last_error: err.message
        }).eq("id", webhookEvent.id);
        await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.sandbox_payment.failed", entity_type: "billing_webhook_events", entity_id: webhookEvent.id, severity: "error", metadata: { contract_id: contract.id, subscription_id: subscription.id, provider_event_id: fakeEventId, result: "failed", error: err.message } });
        return res.status(500).json({ error: err.message });
      }
    } else {
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.sandbox_payment.reused", entity_type: "billing_webhook_events", entity_id: webhookEvent.id, severity: "info", metadata: { contract_id: contract.id, subscription_id: subscription.id, provider_event_id: fakeEventId, result: "ignored_by_idempotency" } });
    }
    return res.json({ success: true, message: "Pago mock processado (idempotente) com sucesso." });
  });
  adminRouter.post("/commercial/contracts/:id/start-billing", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.manage"), async (req, res) => {
    try {
      const config = getBillingConfig();
      const provider = new AsaasBillingProvider(config);
      const db = getSupabaseAdmin2();
      const { data: contract, error } = await db.from("commercial_contracts").select("*").eq("id", req.params.id).single();
      if (error || !contract) return res.status(404).json({ error: "Contrato n\xE3o encontrado." });
      if (contract.status !== "approved") return res.status(409).json({ error: "O contrato precisa estar aprovado." });
      if (!contract.customer_tax_id) return res.status(400).json({ error: "CPF/CNPJ \xE9 obrigat\xF3rio para criar o cliente no Asaas." });
      let { data: customer } = await db.from("billing_customers").select("*").eq("contract_id", contract.id).maybeSingle();
      if (!customer) {
        const remote = await provider.findCustomerByExternalReference(contract.external_reference) || await provider.createCustomer({ name: contract.customer_name, email: contract.customer_email, cpfCnpj: contract.customer_tax_id, mobilePhone: contract.customer_phone, externalReference: contract.external_reference });
        const saved = await db.from("billing_customers").insert({
          contract_id: contract.id,
          lead_id: contract.lead_id,
          provider_customer_id: remote.id,
          external_reference: contract.external_reference,
          name: contract.customer_name,
          email: contract.customer_email,
          tax_id_last4: contract.customer_tax_id.replace(/\D/g, "").slice(-4),
          provider_status: "ACTIVE"
        }).select().single();
        if (saved.error) throw saved.error;
        customer = saved.data;
      }
      const nextDueDate = req.body.next_due_date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate || "")) return res.status(400).json({ error: "next_due_date deve usar YYYY-MM-DD." });
      const { data: existingSubscription } = await db.from("billing_subscriptions").select("*").eq("contract_id", contract.id).maybeSingle();
      if (existingSubscription) return res.status(200).json(existingSubscription);
      const remoteSubscription = await provider.findSubscriptionByExternalReference(contract.external_reference) || await provider.createSubscription({
        customerId: customer.provider_customer_id,
        billingType: contract.billing_type,
        cycle: contract.cycle,
        amountCents: contract.amount_cents,
        nextDueDate,
        externalReference: contract.external_reference,
        description: `Contrato Ordum #${contract.contract_number}`
      });
      const savedSubscription = await db.from("billing_subscriptions").insert({
        contract_id: contract.id,
        customer_id: customer.id,
        provider_subscription_id: remoteSubscription.id,
        external_reference: contract.external_reference,
        status: "pending",
        provider_status: remoteSubscription.status || null,
        cycle: contract.cycle,
        billing_type: contract.billing_type,
        amount_cents: contract.amount_cents,
        next_due_date: nextDueDate
      }).select().single();
      if (savedSubscription.error) throw savedSubscription.error;
      await db.from("commercial_contracts").update({ status: "pending_payment" }).eq("id", contract.id);
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.subscription.created", entity_type: "billing_subscriptions", entity_id: savedSubscription.data.id, team_id: contract.team_id, severity: "info" });
      return res.status(201).json(savedSubscription.data);
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
  });
  adminRouter.post("/billing/subscriptions/:id/cancel", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.manage"), async (req, res) => {
    if (req.platformContext.role?.key !== "admin") return res.status(403).json({ error: "Somente admin pode cancelar recorr\xEAncia." });
    if (!req.body?.reason || String(req.body.reason).trim().length < 5) return res.status(400).json({ error: "Informe um motivo de cancelamento." });
    const db = getSupabaseAdmin2();
    const local = await db.from("billing_subscriptions").select("*, commercial_contracts(*)").eq("id", req.params.id).single();
    if (local.error || !local.data) return res.status(404).json({ error: "Assinatura n\xE3o encontrada." });
    try {
      const provider = new AsaasBillingProvider(getBillingConfig());
      await provider.cancelSubscription(local.data.provider_subscription_id);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.from("billing_subscriptions").update({ status: "cancelled", cancelled_at: now }).eq("id", local.data.id);
      await db.from("commercial_contracts").update({ status: "cancelled", cancelled_at: now, cancellation_at_period_end: true }).eq("id", local.data.contract_id);
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "billing.subscription.cancelled",
        entity_type: "billing_subscriptions",
        entity_id: local.data.id,
        team_id: local.data.commercial_contracts?.team_id || null,
        severity: "warning",
        ...auditContext(req, { result: "success", reason: String(req.body.reason).slice(0, 500), access_until: local.data.commercial_contracts?.ends_on || null })
      });
      return res.json({ success: true, accessPolicy: "period_end" });
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
  });
  adminRouter.get("/billing/webhooks", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.manage"), async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : null;
    let query = getSupabaseAdmin2().from("billing_webhook_events").select("id,provider_event_id,event_type,status,received_at,processed_at,attempts,last_error,correlation_id", { count: "exact" }).order("received_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { page, pageSize, from, to } = parsePagination(req.query);
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(req.query.page !== void 0 ? pageResult(data || [], count, page, pageSize) : data);
  });
  adminRouter.post("/billing/webhooks/:id/reprocess", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.manage"), async (req, res) => {
    const db = getSupabaseAdmin2();
    const { data: eventRow, error } = await db.from("billing_webhook_events").select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ error: "Evento n\xE3o encontrado." });
    try {
      const provider = new AsaasBillingProvider(getBillingConfig());
      await db.from("billing_webhook_events").update({ status: "received", next_attempt_at: (/* @__PURE__ */ new Date()).toISOString(), locked_at: null, last_error: null }).eq("id", eventRow.id);
      const results = await processPendingWebhookEvents(db, provider, 1);
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.webhook.reprocessed", entity_type: "billing_webhook_events", entity_id: eventRow.id, severity: "warning", ...auditContext(req, { result: results[0]?.status || "not_claimed" }) });
      return res.json({ success: true, status: results[0]?.status || "queued" });
    } catch (reprocessError) {
      return res.status(500).json({ error: cleanError(reprocessError) });
    }
  });
  adminRouter.post("/billing/reconcile", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.billing.manage"), async (req, res) => {
    if (req.platformContext.role?.key !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const result = await runBillingReconciliation(getSupabaseAdmin2(), req.user.id);
      await getSupabaseAdmin2().from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.reconciliation.executed", entity_type: "billing_reconciliation_runs", severity: "warning", ...auditContext(req, { result }) });
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Falha na concilia\xE7\xE3o." });
    }
  });
  internalRouter.get("/reconcile", async (req, res) => {
    if (!webhookTokenMatches(req.header("authorization")?.replace(/^Bearer\s+/i, ""), process.env.CRON_SECRET)) return res.status(401).json({ error: "Unauthorized" });
    try {
      return res.json(await runBillingReconciliation(getSupabaseAdmin2()));
    } catch {
      return res.status(500).json({ error: "Falha na concilia\xE7\xE3o." });
    }
  });
  return { publicRouter, adminRouter, internalRouter };
}
var init_router = __esm({
  "src/server/billing/router.ts"() {
    init_asaas();
    init_authorization();
    init_operational();
    init_config();
    init_analytics();
    init_tenantAuth();
    init_domain();
  }
});

// server.ts
import express from "express";
import path from "path";

// src/server/adminLeadsRouter.ts
init_authorization();
init_operational();
init_tenantAuth();
import { Router } from "express";
import { z } from "zod";
function createAdminLeadsRouter(getSupabaseAdmin2, _old_requirePlatformAuth) {
  const router = Router();
  router.get("/", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.leads.read"), async (req, res) => {
    try {
      const { platformContext } = req;
      const { page, pageSize, from, to } = parsePagination(req.query);
      const paginated = req.query.page !== void 0;
      let visibleLeadIds = null;
      if (platformContext.role?.key !== "admin") {
        const visibleTeams = platformContext.teams.filter((team) => platformContext.managedTeams.some((managed) => managed.id === team.id) || ["team", "all"].includes(team.member_lead_visibility)).map((team) => team.id);
        let assignmentQuery = getSupabaseAdmin2().from("platform_lead_assignments").select("lead_id");
        const clauses = [`owner_platform_member_id.eq.${platformContext.platformMember.id}`];
        if (visibleTeams.length) clauses.push(`team_id.in.(${visibleTeams.join(",")})`);
        assignmentQuery = assignmentQuery.or(clauses.join(","));
        const assignmentResult = await assignmentQuery;
        if (assignmentResult.error) throw assignmentResult.error;
        visibleLeadIds = [...new Set((assignmentResult.data || []).map((item) => String(item.lead_id)))];
        if (!visibleLeadIds.length) return res.json(paginated ? pageResult([], 0, page, pageSize) : []);
      }
      let query = getSupabaseAdmin2().from("marketing_leads").select("*, platform_lead_assignments(*, platform_teams(name,allow_self_claim), platform_members(user_id, platform_roles(key, name))), commercial_activities(id,activity_type,subject,status,scheduled_at,result,next_action,next_action_at,created_at), commercial_demos(id,status,starts_at,expires_at,result,next_action,next_action_at)", { count: "exact" }).order("created_at", { ascending: false });
      if (visibleLeadIds) query = query.in("id", visibleLeadIds);
      if (typeof req.query.status === "string" && req.query.status) query = query.eq("status", req.query.status);
      if (typeof req.query.priority === "string" && req.query.priority) query = query.eq("priority", req.query.priority);
      if (typeof req.query.search === "string" && req.query.search.trim()) {
        const term = req.query.search.trim().replace(/[%(),]/g, "").slice(0, 100);
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
      }
      if (paginated) query = query.range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin2().auth.admin.listUsers();
      let leads = data.map((l) => {
        const assignment = l.platform_lead_assignments?.[0];
        let owner = null;
        if (assignment?.platform_members?.user_id) {
          const u = usersData?.users?.find((u2) => u2.id === assignment.platform_members.user_id);
          if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
        }
        return { ...l, assignment, owner };
      });
      res.json(paginated ? pageResult(leads, count, page, pageSize) : leads);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const assignLeadSchema = z.object({
    team_id: z.string().uuid(),
    owner_platform_member_id: z.string().uuid().optional().nullable(),
    reason: z.string().min(1)
  });
  router.post("/:id/assign", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.leads.assign"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const leadId = req.params.id;
      const input = assignLeadSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "Equipe e motivo da transfer\xEAncia s\xE3o obrigat\xF3rios." });
      const { team_id, owner_platform_member_id, reason } = input.data;
      const current = await getSupabaseAdmin2().from("platform_lead_assignments").select("*").eq("lead_id", leadId).maybeSingle();
      if (current.error) throw current.error;
      if (platformContext.role?.key !== "admin") {
        const isManager = platformContext.managedTeams.some((t) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
        if (!current.data || !platformContext.managedTeams.some((team) => team.id === current.data.team_id)) {
          return res.status(403).json({ error: "Lead fora do escopo gerenciado." });
        }
      }
      if (owner_platform_member_id) {
        const target = await getSupabaseAdmin2().from("platform_team_members").select("platform_member_id").eq("team_id", team_id).eq("platform_member_id", owner_platform_member_id).eq("status", "active").maybeSingle();
        if (!target.data) return res.status(400).json({ error: "O respons\xE1vel precisa ser membro ativo da equipe." });
      }
      const { data, error } = await getSupabaseAdmin2().from("platform_lead_assignments").upsert({
        lead_id: leadId,
        team_id,
        owner_platform_member_id: owner_platform_member_id || null,
        assigned_by_user_id: req.user.id
      }, { onConflict: "lead_id" }).select().single();
      if (error) throw error;
      await getSupabaseAdmin2().from("commercial_lead_assignment_history").insert({
        lead_id: leadId,
        from_team_id: current.data?.team_id || null,
        to_team_id: team_id,
        from_owner_platform_member_id: current.data?.owner_platform_member_id || null,
        to_owner_platform_member_id: owner_platform_member_id || null,
        reason: reason.trim(),
        actor_user_id: req.user.id
      });
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "lead.assigned",
        entity_type: "platform_lead_assignments",
        entity_id: leadId,
        severity: "info",
        team_id,
        ...auditContext(req, { result: "success", after: { team_id, owner_platform_member_id: owner_platform_member_id || null } })
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.patch("/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.leads.assign", "platform.leads.claim"]), async (req, res) => {
    try {
      const db = getSupabaseAdmin2();
      const { data: lead, error: leadError } = await db.from("marketing_leads").select("*, platform_lead_assignments(*)").eq("id", req.params.id).single();
      if (leadError || !lead) return res.status(404).json({ error: "Lead n\xE3o encontrado." });
      const assignment = lead.platform_lead_assignments?.[0];
      if (req.platformContext.role?.key !== "admin" && !canReadAssignedResource(req.platformContext, assignment, "member_lead_visibility")) {
        return res.status(403).json({ error: "Lead fora do seu escopo." });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
        return res.status(409).json({ error: "Altera\xE7\xF5es de estado usam a m\xE1quina de transi\xE7\xE3o e exigem motivo." });
      }
      const allowed = ["priority", "qualification_state", "first_contact_at", "won_reason", "lost_reason"];
      const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
      if (!Object.keys(updates).length) return res.status(400).json({ error: "Nenhum campo permitido." });
      const saved = await db.from("marketing_leads").update(updates).eq("id", lead.id).select().single();
      if (saved.error) return res.status(400).json({ error: saved.error.message });
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "lead.updated",
        entity_type: "marketing_leads",
        entity_id: lead.id,
        team_id: assignment?.team_id || null,
        severity: "info",
        ...auditContext(req, { result: "success", before: { status: lead.status, priority: lead.priority }, after: updates })
      });
      return res.json(saved.data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.get("/:id/duplicates", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.leads.read"), async (req, res) => {
    try {
      const db = getSupabaseAdmin2();
      const leadResult = await db.from("marketing_leads").select("id,platform_lead_assignments(*)").eq("id", req.params.id).maybeSingle();
      if (leadResult.error || !leadResult.data) return res.status(404).json({ error: "Lead n\xE3o encontrado." });
      const assignment = leadResult.data.platform_lead_assignments?.[0];
      if (!canReadAssignedResource(req.platformContext, assignment, "member_lead_visibility")) return res.status(403).json({ error: "Lead fora do seu escopo." });
      const keys = await db.from("commercial_lead_identity_keys").select("key_type,key_hash").eq("lead_id", req.params.id);
      if (keys.error) throw keys.error;
      if (!keys.data?.length) return res.json({ duplicates: [], matchedBy: [] });
      const hashes = [...new Set(keys.data.map((key) => key.key_hash))];
      const matches = await db.from("commercial_lead_identity_keys").select("lead_id,key_type").in("key_hash", hashes).neq("lead_id", req.params.id).limit(100);
      if (matches.error) throw matches.error;
      const leadIds = [...new Set((matches.data || []).map((item) => item.lead_id))];
      if (!leadIds.length) return res.json({ duplicates: [], matchedBy: [] });
      const leads = await db.from("marketing_leads").select("id,name,email,company,phone,status,created_at,platform_lead_assignments(*)").in("id", leadIds);
      if (leads.error) throw leads.error;
      const visible = (leads.data || []).filter((lead) => canReadAssignedResource(req.platformContext, lead.platform_lead_assignments?.[0], "member_lead_visibility"));
      return res.json({ duplicates: visible, matches: (matches.data || []).filter((match) => visible.some((lead) => lead.id === match.lead_id)) });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.post("/:id/auto-assign", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.leads.assign"]), async (req, res) => {
    try {
      const teamId = req.body?.teamId;
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!teamId || !reason) return res.status(400).json({ error: "Equipe e motivo s\xE3o obrigat\xF3rios." });
      if (req.platformContext.role?.key !== "admin" && !req.platformContext.managedTeams.some((team) => team.id === teamId)) return res.status(403).json({ error: "Equipe fora do escopo gerenciado." });
      const result = await getSupabaseAdmin2().rpc("admin_auto_assign_lead", { p_lead_id: req.params.id, p_team_id: teamId, p_actor_user_id: req.user.id, p_reason: reason });
      if (result.error) return res.status(409).json({ error: result.error.message });
      return res.json({ ownerPlatformMemberId: result.data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.post("/:id/recalculate-score", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.leads.assign", "platform.leads.claim"]), async (req, res) => {
    try {
      const db = getSupabaseAdmin2();
      const lead = await db.from("marketing_leads").select("*").eq("id", req.params.id).maybeSingle();
      if (lead.error || !lead.data) return res.status(404).json({ error: "Lead n\xE3o encontrado." });
      const assignmentResult = await db.from("platform_lead_assignments").select("*").eq("lead_id", req.params.id).maybeSingle();
      if (!canReadAssignedResource(req.platformContext, assignmentResult.data, "member_lead_visibility")) return res.status(403).json({ error: "Lead fora do seu escopo." });
      const rules = await db.from("commercial_scoring_rules").select("*").eq("active", true).order("priority").limit(100);
      if (rules.error) throw rules.error;
      const explanations = [];
      let score = 0;
      for (const rule of rules.data || []) {
        const actual = rule.field.split(".").reduce((value, key) => value?.[key], lead.data);
        const expected = rule.comparison_value;
        const matched = rule.operator === "present" ? actual !== null && actual !== void 0 && String(actual).trim() !== "" : rule.operator === "equals" ? String(actual ?? "").toLowerCase() === String(expected ?? "").toLowerCase() : rule.operator === "contains" ? String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase()) : rule.operator === "in" ? Array.isArray(expected) && expected.map(String).includes(String(actual)) : rule.operator === "gte" ? Number(actual) >= Number(expected) : rule.operator === "lte" ? Number(actual) <= Number(expected) : false;
        if (matched) {
          score += Number(rule.points);
          explanations.push({ ruleId: rule.id, name: rule.name, points: rule.points });
        }
      }
      score = Math.max(0, Math.min(100, score));
      const saved = await db.from("marketing_leads").update({ score, score_explanation: explanations, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", req.params.id).select("id,score,score_explanation").single();
      if (saved.error) throw saved.error;
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "lead.score_recalculated", entity_type: "marketing_leads", entity_id: req.params.id, severity: "info", ...auditContext(req, { result: "success", after: { score, matched_rules: explanations.length } }) });
      return res.json(saved.data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.post("/:id/claim", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.leads.claim"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const leadId = req.params.id;
      const myMemberId = platformContext.platformMember.id;
      const { data: assignment, error: err1 } = await getSupabaseAdmin2().from("platform_lead_assignments").select("*, platform_teams(allow_self_claim)").eq("lead_id", leadId).single();
      if (err1 || !assignment) return res.status(404).json({ error: "Lead assignment not found" });
      if (!assignment.platform_teams?.allow_self_claim) {
        return res.status(403).json({ error: "Self claim not allowed for this team" });
      }
      if (assignment.owner_platform_member_id) {
        return res.status(409).json({ error: "Lead already claimed" });
      }
      if (!platformContext.teams.some((t) => t.id === assignment.team_id)) {
        return res.status(403).json({ error: "You are not in this team" });
      }
      const { data, error } = await getSupabaseAdmin2().from("platform_lead_assignments").update({ owner_platform_member_id: myMemberId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("lead_id", leadId).is("owner_platform_member_id", null).select().single();
      if (error || !data) {
        return res.status(409).json({ error: "Failed to claim lead. It may have been claimed by someone else." });
      }
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "lead.claimed",
        entity_type: "platform_lead_assignments",
        entity_id: leadId,
        severity: "info",
        team_id: assignment.team_id
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/demos", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.commercial.manage"]), async (req, res) => {
    try {
      const db = getSupabaseAdmin2();
      const lead = await db.from("marketing_leads").select("*").eq("id", req.params.id).maybeSingle();
      if (lead.error || !lead.data) return res.status(404).json({ error: "Lead n\xE3o encontrado." });
      const assignmentResult = await db.from("platform_lead_assignments").select("*").eq("lead_id", req.params.id).maybeSingle();
      if (!assignmentResult.data || !canReadAssignedResource(req.platformContext, assignmentResult.data, "member_lead_visibility")) {
        return res.status(403).json({ error: "Lead fora do seu escopo." });
      }
      if (req.platformContext.role.key !== "admin" && req.body.team_id && req.body.team_id !== assignmentResult.data.team_id) {
        return res.status(403).json({ error: "A demo deve pertencer \xE0 mesma equipe do lead." });
      }
      const starts_at = req.body.starts_at;
      if (!starts_at || isNaN(new Date(starts_at).getTime())) return res.status(400).json({ error: "Data/hora inv\xE1lida." });
      const { data, error } = await db.from("commercial_demos").insert({
        lead_id: req.params.id,
        team_id: req.body.team_id || assignmentResult.data.team_id,
        owner_platform_member_id: req.body.owner_platform_member_id || assignmentResult.data.owner_platform_member_id || req.platformContext.platformMember.id,
        status: "scheduled",
        starts_at,
        notes: req.body.notes || null,
        created_by_user_id: req.user.id
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      await db.from("commercial_activities").insert({
        lead_id: req.params.id,
        activity_type: "demo",
        subject: "Demonstra\xE7\xE3o agendada",
        status: "completed",
        result: `Demo agendada para ${starts_at}. ${req.body.notes || ""}`,
        created_by_user_id: req.user.id
      });
      await db.from("marketing_leads").update({ next_action: "Demonstra\xE7\xE3o", next_action_at: starts_at }).eq("id", req.params.id);
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "commercial.demo.scheduled",
        entity_type: "commercial_demos",
        entity_id: data.id,
        team_id: data.team_id,
        severity: "info",
        ...auditContext(req, { result: "success", after: data })
      });
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// src/server/adminClientsRouter.ts
init_authorization();
init_operational();
init_tenantAuth();
import { Router as Router2 } from "express";
import { z as z2 } from "zod";
function createAdminClientsRouter(getSupabaseAdmin2) {
  const router = Router2();
  router.get("/", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.clients.read", "platform.commercial.read"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const { page, pageSize, from, to } = parsePagination(req.query);
      const paginated = req.query.page !== void 0;
      let visibleTenantIds2 = null;
      if (platformContext.role?.key !== "admin") {
        const visibleTeams = platformContext.teams.filter((team) => platformContext.managedTeams.some((managed) => managed.id === team.id) || ["team", "all"].includes(team.member_client_visibility)).map((team) => team.id);
        let assignmentQuery = getSupabaseAdmin2().from("platform_client_assignments").select("tenant_id");
        const clauses = [`owner_platform_member_id.eq.${platformContext.platformMember.id}`];
        if (visibleTeams.length) clauses.push(`team_id.in.(${visibleTeams.join(",")})`);
        assignmentQuery = assignmentQuery.or(clauses.join(","));
        const assignmentResult = await assignmentQuery;
        if (assignmentResult.error) throw assignmentResult.error;
        visibleTenantIds2 = [...new Set((assignmentResult.data || []).map((item) => String(item.tenant_id)))];
        if (!visibleTenantIds2.length) return res.json(paginated ? pageResult([], 0, page, pageSize) : []);
      }
      let query = getSupabaseAdmin2().from("tenants").select("*, tenant_solutions(*), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))), tenant_billing_state(*), tenant_domains(*), memberships(id,status,user_id,employment_level), departments(id,name,active)", { count: "exact" }).in("status", ["active", "trial", "suspended"]).order("created_at", { ascending: false });
      if (visibleTenantIds2) query = query.in("id", visibleTenantIds2);
      if (typeof req.query.status === "string" && req.query.status) query = query.eq("status", req.query.status);
      if (typeof req.query.search === "string" && req.query.search.trim()) query = query.ilike("name", `%${req.query.search.trim().slice(0, 100)}%`);
      if (paginated) query = query.range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin2().auth.admin.listUsers();
      let clients = data.map((c) => {
        const assignment = c.platform_client_assignments?.[0];
        let owner = null;
        if (assignment?.platform_members?.user_id) {
          const u = usersData?.users?.find((u2) => u2.id === assignment.platform_members.user_id);
          if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
        }
        return { ...c, assignment, owner };
      });
      res.json(paginated ? pageResult(clients, count, page, pageSize) : clients);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.clients.read", "platform.commercial.read"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const { data, error } = await getSupabaseAdmin2().from("tenants").select("*, tenant_solutions(solution_id, status, solutions(key,name)), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))), tenant_domains(*), departments(*), memberships(id,user_id,status,employment_level,joined_at), tenant_billing_state(*), commercial_contracts(*, billing_subscriptions(*), billing_payments(*))").eq("id", clientId).single();
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin2().auth.admin.listUsers();
      const assignment = data.platform_client_assignments?.[0];
      let owner = null;
      if (assignment?.platform_members?.user_id) {
        const u = usersData?.users?.find((u2) => u2.id === assignment.platform_members.user_id);
        if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
      }
      if (platformContext.role?.key !== "admin") {
        if (!canReadAssignedResource(platformContext, assignment, "member_client_visibility")) return res.status(403).json({ error: "Forbidden" });
      }
      const { data: audit } = await getSupabaseAdmin2().from("platform_audit_logs").select("id,action,severity,metadata,created_at,actor_user_id,request_id").eq("entity_id", clientId).order("created_at", { ascending: false }).limit(50);
      res.json({ ...data, assignment, owner, audit: audit || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/assign", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.clients.manage", "platform.commercial.manage"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const schema = z2.object({ team_id: z2.string().uuid(), owner_platform_member_id: z2.string().uuid().optional().nullable(), reason: z2.string().min(3) });
      const parse = schema.safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: "Equipe e motivo s\xE3o obrigat\xF3rios.", details: parse.error.issues });
      const { team_id, owner_platform_member_id, reason } = parse.data;
      if (!team_id || !reason) return res.status(400).json({ error: "Equipe e motivo da transfer\xEAncia s\xE3o obrigat\xF3rios." });
      const previous = await getSupabaseAdmin2().from("platform_client_assignments").select("*").eq("tenant_id", clientId).eq("assignment_type", "commercial").maybeSingle();
      if (previous.error) throw previous.error;
      if (platformContext.role?.key !== "admin") {
        const isManager = platformContext.managedTeams.some((t) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
        if (!previous.data || !platformContext.managedTeams.some((team) => team.id === previous.data.team_id)) {
          return res.status(403).json({ error: "Cliente fora do escopo gerenciado." });
        }
      }
      if (owner_platform_member_id) {
        const target = await getSupabaseAdmin2().from("platform_team_members").select("platform_member_id").eq("team_id", team_id).eq("platform_member_id", owner_platform_member_id).eq("status", "active").maybeSingle();
        if (!target.data) return res.status(400).json({ error: "O respons\xE1vel precisa ser membro ativo da equipe." });
      }
      const { data, error } = await getSupabaseAdmin2().from("platform_client_assignments").upsert({
        tenant_id: clientId,
        team_id,
        owner_platform_member_id: owner_platform_member_id || null,
        assigned_by_user_id: req.user.id,
        assignment_type: "commercial",
        status: "active"
      }, { onConflict: "tenant_id,team_id,assignment_type" }).select().single();
      if (error) throw error;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "client.assigned",
        entity_type: "platform_client_assignments",
        entity_id: clientId,
        severity: "info",
        team_id,
        ...auditContext(req, { result: "success", reason, before: previous.data ? { team_id: previous.data.team_id, owner_platform_member_id: previous.data.owner_platform_member_id } : null, after: { team_id, owner_platform_member_id: owner_platform_member_id || null } })
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/suspend", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.clients.manage"), async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const parse = z2.object({ reason: z2.string().min(5) }).safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: "Motivo da suspens\xE3o \xE9 obrigat\xF3rio." });
      const db = getSupabaseAdmin2();
      const existing = await db.from("tenants").select("status, lifecycle_status").eq("id", clientId).single();
      if (existing.error) return res.status(404).json({ error: "Cliente n\xE3o encontrado." });
      if (existing.data.status === "suspended") return res.status(400).json({ error: "Cliente j\xE1 est\xE1 suspenso." });
      const updated = await db.from("tenants").update({ status: "suspended", lifecycle_status: "churn", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", clientId).select().single();
      if (updated.error) throw updated.error;
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "client.suspended",
        entity_type: "tenants",
        entity_id: clientId,
        severity: "high",
        ...auditContext(req, { result: "success", reason: parse.data.reason, before: existing.data, after: { status: "suspended", lifecycle_status: "churn" } })
      });
      res.json({ success: true, tenant: updated.data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/reactivate", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.clients.manage"), async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const parse = z2.object({ reason: z2.string().min(5) }).safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: "Motivo da reativa\xE7\xE3o \xE9 obrigat\xF3rio." });
      const db = getSupabaseAdmin2();
      const existing = await db.from("tenants").select("status, lifecycle_status").eq("id", clientId).single();
      if (existing.error) return res.status(404).json({ error: "Cliente n\xE3o encontrado." });
      if (existing.data.status === "active") return res.status(400).json({ error: "Cliente j\xE1 est\xE1 ativo." });
      const updated = await db.from("tenants").update({ status: "active", lifecycle_status: "active", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", clientId).select().single();
      if (updated.error) throw updated.error;
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "client.reactivated",
        entity_type: "tenants",
        entity_id: clientId,
        severity: "info",
        ...auditContext(req, { result: "success", reason: parse.data.reason, before: existing.data, after: { status: "active", lifecycle_status: "active" } })
      });
      res.json({ success: true, tenant: updated.data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.put("/:id/solutions", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.solutions.manage"), async (req, res) => {
    try {
      const clientId = req.params.id;
      const parse = z2.object({ solutionKeys: z2.array(z2.string()) }).safeParse(req.body);
      if (!parse.success) return res.status(400).json({ error: "solutionKeys deve ser uma lista de chaves v\xE1lidas." });
      const { solutionKeys } = parse.data;
      const before = await getSupabaseAdmin2().from("tenant_solutions").select("solutions(key)").eq("tenant_id", clientId);
      const replaced = await getSupabaseAdmin2().rpc("admin_replace_tenant_solutions", {
        p_tenant_id: clientId,
        p_solution_keys: [...new Set(solutionKeys)]
      });
      if (replaced.error) throw replaced.error;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "solution.updated",
        entity_type: "tenant_solutions",
        entity_id: clientId,
        severity: "info",
        ...auditContext(req, { result: "success", before: before.data, after: { solutions: solutionKeys } })
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// src/server/adminOtherRouter.ts
init_config();
init_operational();
init_analytics();
import { Router as Router3 } from "express";

// src/server/observability.ts
init_telemetryPrivacy();
import * as Sentry from "@sentry/node";
var initialized = false;
function initServerObservability() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return Boolean(dsn);
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend(event) {
      return sanitizeSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeSentryEvent({ breadcrumb }).breadcrumb;
    }
  });
  initialized = true;
  return true;
}
function reportServerError(error, request, operation) {
  const safeMessage = error instanceof Error ? error.message.replace(/(token|secret|password|authorization)=[^\s&]+/gi, "$1=[REDACTED]").slice(0, 300) : "Unknown error";
  const requestId = request ? String(request.requestId || "") : "";
  console.error(JSON.stringify({
    level: "error",
    message: safeMessage,
    method: request?.method,
    operation,
    requestId,
    route: request?.path
  }));
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (operation) scope.setTag("operation", operation.slice(0, 128));
    if (requestId) scope.setTag("request_id", requestId.slice(0, 128));
    if (request?.method) scope.setTag("http.method", request.method);
    if (request?.path) scope.setTag("http.route", request.path.slice(0, 256));
    Sentry.captureException(error);
  });
}
function installServerErrorHandler(app) {
  if (initialized) Sentry.setupExpressErrorHandler(app);
}

// src/server/adminOtherRouter.ts
init_tenantAuth();
import { z as z3 } from "zod";
function createAdminOtherRouter(getSupabaseAdmin2, _old_requirePlatformAuth) {
  const router = Router3();
  router.get("/staff", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.staff.read"), async (req, res) => {
    try {
      const { platformContext } = req;
      const { data: members, error: memberErr } = await getSupabaseAdmin2().from("platform_members").select(`
          *,
          platform_roles(*),
          platform_team_members(*, platform_teams(*))
        `);
      if (memberErr) throw memberErr;
      const { data: usersData, error: userErr } = await getSupabaseAdmin2().auth.admin.listUsers();
      if (userErr) throw userErr;
      let result = members.map((m) => {
        const user = usersData.users.find((u) => u.id === m.user_id);
        const role = m.platform_roles;
        const teams = (m.platform_team_members || []).map((tm) => tm.platform_teams);
        return {
          ...m,
          user: user ? {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            last_sign_in_at: user.last_sign_in_at,
            created_at: user.created_at
          } : null,
          role,
          teams
        };
      });
      if (platformContext.role?.key !== "admin") {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team) => team.id));
        result = result.filter((member) => member.user_id === req.user.id || member.role?.key === "sales" && member.platform_team_members?.some((membership) => managedTeamIds.has(membership.team_id)));
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const inviteSchema = z3.object({
    email: z3.string().email(),
    role_key: z3.string(),
    relationship_type: z3.string(),
    team_ids: z3.array(z3.string().uuid()).optional()
  });
  router.post("/staff", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.staff.manage", "platform.staff.invite_sales"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const callerRoleKey = platformContext.role?.key;
      if (!platformContext.permissions.includes("platform.staff.manage") && callerRoleKey !== "admin") {
        if (callerRoleKey !== "manager") {
          return res.status(403).json({ error: "Forbidden: Insufficient permissions to invite staff." });
        }
      }
      const input = inviteSchema.safeParse(req.body);
      if (!input.success) {
        return res.status(400).json({ error: "Campos obrigat\xF3rios: e-mail, fun\xE7\xE3o e v\xEDnculo v\xE1lidos." });
      }
      const { email, role_key, relationship_type, team_ids } = input.data;
      if (callerRoleKey === "manager" && role_key !== "sales") {
        return res.status(403).json({ error: "Gerentes s\xF3 podem convidar membros para a fun\xE7\xE3o Sales (Vendas)." });
      }
      if (callerRoleKey === "manager") {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team) => team.id));
        if (!team_ids || team_ids.length === 0 || team_ids.some((teamId) => !managedTeamIds.has(teamId))) {
          return res.status(403).json({ error: "Gerentes s\xF3 podem convidar Sales para equipes que gerenciam." });
        }
      }
      let finalRelationshipType = relationship_type;
      if (role_key === "admin") {
        finalRelationshipType = "partner";
      }
      const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
      const redirectTo = `${origin}/#/auth/accept-invite`;
      const { data: roleData } = await getSupabaseAdmin2().from("platform_roles").select("id").eq("key", role_key).single();
      if (!roleData) return res.status(400).json({ error: "Fun\xE7\xE3o interna inv\xE1lida." });
      let userId;
      const { data: inviteData, error: inviteErr } = await getSupabaseAdmin2().auth.admin.inviteUserByEmail(email, {
        redirectTo
      });
      if (inviteErr) {
        const { data: usersList } = await getSupabaseAdmin2().auth.admin.listUsers();
        const existingUser = usersList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existingUser) {
          return res.status(400).json({ error: inviteErr.message || "Erro ao enviar convite por e-mail." });
        }
        userId = existingUser.id;
      } else {
        userId = inviteData.user.id;
      }
      let { data: member } = await getSupabaseAdmin2().from("platform_members").select("*").eq("user_id", userId).maybeSingle();
      if (!member) {
        const { data: newMem, error: insMemErr } = await getSupabaseAdmin2().from("platform_members").insert({
          user_id: userId,
          relationship_type: finalRelationshipType,
          role_id: roleData?.id || null,
          status: "invited"
        }).select().single();
        if (insMemErr) throw insMemErr;
        member = newMem;
      } else {
        await getSupabaseAdmin2().from("platform_members").update({
          relationship_type: finalRelationshipType,
          role_id: roleData?.id || member.role_id
        }).eq("id", member.id);
      }
      if (Array.isArray(team_ids) && team_ids.length > 0) {
        for (const teamId of team_ids) {
          await getSupabaseAdmin2().from("platform_team_members").upsert({
            team_id: teamId,
            platform_member_id: member.id,
            team_role: "member",
            status: "active"
          }, { onConflict: "team_id,platform_member_id" });
        }
      }
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "platform.member.invited",
        entity_type: "platform_members",
        entity_id: member.id,
        severity: "info",
        metadata: { role_key, relationship_type: finalRelationshipType }
      });
      void captureServerAnalytics("user_invited", req.user.id, { role: role_key, source: "platform_admin" });
      res.json({ success: true, member });
    } catch (e) {
      reportServerError(e, req, "platform_member_invite");
      res.status(500).json({ error: "N\xE3o foi poss\xEDvel concluir o convite." });
    }
  });
  const updateStaffSchema = z3.object({
    role_key: z3.string().optional(),
    relationship_type: z3.string().optional(),
    team_ids: z3.array(z3.string().uuid()).optional()
  });
  router.patch("/staff/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.staff.manage", "platform.staff.invite_sales"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const callerRoleKey = platformContext.role?.key;
      const isManager = callerRoleKey === "manager";
      if (!platformContext.permissions.includes("platform.staff.manage") && callerRoleKey !== "admin" && !isManager) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const memberId = req.params.id;
      const input = updateStaffSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "Payload inv\xE1lido." });
      const { role_key, relationship_type, team_ids } = input.data;
      const { data: targetMember, error: tgtErr } = await getSupabaseAdmin2().from("platform_members").select("*, platform_roles(key)").eq("id", memberId).single();
      if (tgtErr || !targetMember) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado." });
      }
      if (targetMember.user_id === req.user.id && role_key && role_key !== targetMember.platform_roles?.key) {
        return res.status(403).json({ error: "Ningu\xE9m pode alterar a pr\xF3pria fun\xE7\xE3o global." });
      }
      if (isManager) {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team) => team.id));
        const { data: targetTeams } = await getSupabaseAdmin2().from("platform_team_members").select("team_id").eq("platform_member_id", memberId).eq("status", "active");
        const inScope = (targetTeams || []).some((team) => managedTeamIds.has(team.team_id));
        const requestedTeamsAreScoped = !Array.isArray(team_ids) || team_ids.length > 0 && team_ids.every((teamId) => managedTeamIds.has(teamId));
        if (targetMember.platform_roles?.key !== "sales" || role_key && role_key !== "sales" || !inScope || !requestedTeamsAreScoped) {
          return res.status(403).json({ error: "Gerentes s\xF3 podem administrar vendedores das pr\xF3prias equipes." });
        }
      }
      const targetCurrentRole = targetMember.platform_roles?.key;
      if (targetCurrentRole === "admin" && role_key && role_key !== "admin") {
        const { data: adminRole } = await getSupabaseAdmin2().from("platform_roles").select("id").eq("key", "admin").single();
        if (adminRole) {
          const { data: activeAdmins } = await getSupabaseAdmin2().from("platform_members").select("id").eq("role_id", adminRole.id).eq("status", "active");
          if ((activeAdmins || []).length <= 1) {
            return res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel rebaixar a fun\xE7\xE3o do \xFAnico Admin ativo da plataforma." });
          }
        }
      }
      let finalRelationshipType = relationship_type || targetMember.relationship_type;
      if (role_key === "admin") {
        finalRelationshipType = "partner";
      }
      if (relationship_type && finalRelationshipType !== targetMember.relationship_type) {
        await getSupabaseAdmin2().from("platform_members").update({ relationship_type: finalRelationshipType }).eq("id", memberId);
        await getSupabaseAdmin2().from("platform_audit_logs").insert({
          actor_user_id: req.user.id,
          action: "platform.member.relationship_changed",
          entity_type: "platform_members",
          entity_id: memberId,
          severity: "info",
          metadata: { old: targetMember.relationship_type, new: finalRelationshipType }
        });
      }
      if (role_key && role_key !== targetCurrentRole) {
        const { data: roleData } = await getSupabaseAdmin2().from("platform_roles").select("id").eq("key", role_key).single();
        if (roleData) {
          await getSupabaseAdmin2().from("platform_members").update({ role_id: roleData.id }).eq("id", memberId);
          await getSupabaseAdmin2().from("platform_audit_logs").insert({
            actor_user_id: req.user.id,
            action: "platform.member.role_changed",
            entity_type: "platform_members",
            entity_id: memberId,
            severity: "info",
            metadata: { old: targetCurrentRole, new: role_key }
          });
        }
      }
      if (Array.isArray(team_ids)) {
        await getSupabaseAdmin2().from("platform_team_members").delete().eq("platform_member_id", memberId);
        for (const teamId of team_ids) {
          await getSupabaseAdmin2().from("platform_team_members").insert({
            team_id: teamId,
            platform_member_id: memberId,
            team_role: "member",
            status: "active"
          });
        }
        await getSupabaseAdmin2().from("platform_audit_logs").insert({
          actor_user_id: req.user.id,
          action: "platform.member.team_added",
          entity_type: "platform_members",
          entity_id: memberId,
          severity: "info",
          metadata: { team_ids }
        });
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Error in PATCH /api/admin/staff/:id:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/staff/:id/suspend", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.staff.manage"), async (req, res) => {
    try {
      const memberId = req.params.id;
      const { data: targetMember } = await getSupabaseAdmin2().from("platform_members").select("*, platform_roles(key)").eq("id", memberId).single();
      if (!targetMember) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado." });
      }
      const targetRole = targetMember.platform_roles?.key;
      if (targetRole === "admin" && targetMember.status === "active") {
        const { data: adminRole } = await getSupabaseAdmin2().from("platform_roles").select("id").eq("key", "admin").single();
        if (adminRole) {
          const { data: activeAdmins } = await getSupabaseAdmin2().from("platform_members").select("id").eq("role_id", adminRole.id).eq("status", "active");
          if ((activeAdmins || []).length <= 1) {
            return res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel suspender o \xFAnico Admin ativo do sistema." });
          }
        }
      }
      const { error: updErr } = await getSupabaseAdmin2().from("platform_members").update({ status: "suspended" }).eq("id", memberId);
      if (updErr) throw updErr;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "platform.member.suspended",
        entity_type: "platform_members",
        entity_id: memberId,
        severity: "warning"
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error suspending member:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/staff/:id/reactivate", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.staff.manage"), async (req, res) => {
    try {
      const memberId = req.params.id;
      const { error: updErr } = await getSupabaseAdmin2().from("platform_members").update({ status: "active" }).eq("id", memberId);
      if (updErr) throw updErr;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "platform.member.reactivated",
        entity_type: "platform_members",
        entity_id: memberId,
        severity: "info"
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error reactivating member:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/audit", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.audit.read", "platform.audit.team.read"]), async (req, res) => {
    try {
      const { platformContext } = req;
      const { page, pageSize, from, to } = parsePagination(req.query);
      let query = getSupabaseAdmin2().from("platform_audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      if (typeof req.query.action === "string" && req.query.action) query = query.ilike("action", `%${req.query.action.replace(/[%(),]/g, "").slice(0, 100)}%`);
      if (typeof req.query.severity === "string" && req.query.severity) query = query.eq("severity", req.query.severity);
      if (platformContext.role?.key !== "admin") {
        if (!platformContext.permissions.includes("platform.audit.team.read")) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const teamIds = platformContext.managedTeams.map((t) => t.id);
        if (teamIds.length === 0) return res.json(pageResult([], 0, page, pageSize));
        query = query.in("team_id", teamIds);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin2().auth.admin.listUsers();
      const result = data.map((log) => {
        const user = usersData?.users?.find((u) => u.id === log.actor_user_id);
        return { ...log, actor_email: user?.email || "Sistema" };
      });
      res.json(pageResult(result, count, page, pageSize));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/system/health", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.system.read"), async (req, res) => {
    try {
      const dbStart = performance.now();
      const { error } = await getSupabaseAdmin2().from("platform_roles").select("id").limit(1);
      const databaseLatencyMs = Math.round(performance.now() - dbStart);
      const authStart = performance.now();
      const authCheck = await getSupabaseAdmin2().auth.admin.listUsers({ page: 1, perPage: 1 });
      const authLatencyMs = Math.round(performance.now() - authStart);
      const [lastWebhook, queue, lastReconciliation] = await Promise.all([
        getSupabaseAdmin2().from("billing_webhook_events").select("event_type,status,received_at").order("received_at", { ascending: false }).limit(1).maybeSingle(),
        getSupabaseAdmin2().from("billing_webhook_events").select("*", { count: "exact", head: true }).in("status", ["received", "processing", "failed"]),
        getSupabaseAdmin2().from("billing_reconciliation_runs").select("status,started_at,completed_at,error_count,summary").order("started_at", { ascending: false }).limit(1).maybeSingle()
      ]);
      res.json({
        status: !error && !authCheck.error ? "operational" : "degraded",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: process.env.NODE_ENV || "development",
        database: { status: error ? "error" : "connected", latencyMs: databaseLatencyMs },
        auth: { status: authCheck.error ? "error" : "connected", latencyMs: authLatencyMs },
        billing: publicBillingHealth(),
        webhook: { last: lastWebhook.data || null, queued: queue.count || 0 },
        reconciliation: lastReconciliation.data || null,
        deploy: { commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null, url: process.env.VERCEL_URL || null, region: process.env.VERCEL_REGION || null },
        uptime: process.uptime()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/staff/:id/terminate-sessions", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.staff.manage"), async (req, res) => {
    if (req.platformContext.role?.key !== "admin") return res.status(403).json({ error: "Somente admin pode encerrar sess\xF5es." });
    const db = getSupabaseAdmin2();
    const target = await db.from("platform_members").select("id,user_id").eq("id", req.params.id).single();
    if (target.error) return res.status(404).json({ error: "Membro n\xE3o encontrado." });
    if (target.data.user_id === req.user.id) return res.status(403).json({ error: "Encerre sua pr\xF3pria sess\xE3o pelo logout." });
    const result = await db.rpc("admin_terminate_user_sessions", { p_user_id: target.data.user_id });
    if (result.error) return res.status(500).json({ error: result.error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "platform.member.sessions_terminated", entity_type: "platform_members", entity_id: target.data.id, severity: "warning", ...auditContext(req, { result: "success" }) });
    return res.json({ success: true });
  });
  router.get("/system/solutions", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.solutions.read"), async (req, res) => {
    const result = await getSupabaseAdmin2().from("solutions").select("id,key,name,created_at").order("name");
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.json(result.data);
  });
  const solutionSchema = z3.object({ name: z3.string().min(1).max(100) });
  router.patch("/system/solutions/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.solutions.manage"), async (req, res) => {
    if (req.platformContext.role?.key !== "admin") return res.status(403).json({ error: "Forbidden" });
    const input = solutionSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: "Nome \xE9 obrigat\xF3rio." });
    const { name } = input.data;
    const db = getSupabaseAdmin2();
    const before = await db.from("solutions").select("*").eq("id", req.params.id).single();
    if (before.error) return res.status(404).json({ error: "Solu\xE7\xE3o n\xE3o encontrada." });
    const saved = await db.from("solutions").update({ name }).eq("id", req.params.id).select().single();
    if (saved.error) return res.status(400).json({ error: saved.error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "platform.solution.updated", entity_type: "solutions", entity_id: req.params.id, severity: "info", ...auditContext(req, { result: "success", before: { name: before.data.name }, after: { name } }) });
    return res.json(saved.data);
  });
  router.get("/system/deploy", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.deploy.read"), async (req, res) => {
    return res.json({ commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null, commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null, branch: process.env.VERCEL_GIT_COMMIT_REF || null, url: process.env.VERCEL_URL || null, region: process.env.VERCEL_REGION || null, environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development" });
  });
  router.get("/system/settings", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.settings.read"), async (req, res) => {
    return res.json({ billing: publicBillingHealth(), publicSignup: false, authProvider: "supabase", billingProvider: "asaas", billingEnvironment: process.env.ASAAS_ENV || "sandbox", webhookConfigured: Boolean(process.env.ASAAS_WEBHOOK_TOKEN), cronConfigured: Boolean(process.env.CRON_SECRET) });
  });
  router.get("/performance/own", authenticateRequest, resolvePlatformContext, async (req, res) => {
    const db = getSupabaseAdmin2();
    const memberId = req.platformContext.platformMember.id;
    const [leads, activities, proposals, contracts] = await Promise.all([
      db.from("platform_lead_assignments").select("*", { count: "exact", head: true }).eq("owner_platform_member_id", memberId),
      db.from("commercial_activities").select("*", { count: "exact", head: true }).eq("owner_platform_member_id", memberId).eq("status", "completed"),
      db.from("commercial_proposals").select("*", { count: "exact", head: true }).eq("owner_platform_member_id", memberId),
      db.from("commercial_contracts").select("amount_cents,status").eq("owner_platform_member_id", memberId).in("status", ["active", "approved", "pending_payment"])
    ]);
    const revenueCents = (contracts.data || []).reduce((sum, contract) => sum + Number(contract.amount_cents || 0), 0);
    return res.json({ assignedLeads: leads.count || 0, completedActivities: activities.count || 0, proposals: proposals.count || 0, contracts: contracts.data?.length || 0, contractedRecurringCents: revenueCents });
  });
  return router;
}

// src/server/adminControlPlaneRouter.ts
init_authorization();
init_operational();
init_tenantAuth();
import { Router as Router4 } from "express";
var MODULES = {
  onboarding: { table: "onboarding_runs", select: "*, tenants(id,name,lifecycle_status), onboarding_items(*)", permission: "platform.onboarding.read", tenantField: "tenant_id", ownerField: "owner_platform_member_id", orderField: "created_at" },
  success: { table: "customer_success_accounts", select: "*, tenants(id,name,lifecycle_status,risk_level)", permission: "platform.success.read", tenantField: "tenant_id", ownerField: "manager_platform_member_id", orderField: "updated_at" },
  support: { table: "support_tickets", select: "*, tenants(id,name), solutions(id,key,name)", permission: "platform.support.read", tenantField: "tenant_id", teamField: "team_id", ownerField: "owner_platform_member_id", orderField: "created_at" },
  privacy: { table: "lgpd_requests", select: "id,request_number,tenant_id,request_type,status,data_subject_reference,legal_hold,retention_until,due_at,owner_platform_member_id,reason,result_summary,excludes_integrity_data,created_at,updated_at,completed_at,tenants(id,name)", permission: "platform.privacy.read", tenantField: "tenant_id", ownerField: "owner_platform_member_id", orderField: "created_at" },
  targets: { table: "sales_targets", select: "*", permission: "platform.targets.read", teamField: "team_id", ownerField: "platform_member_id", orderField: "period_start" },
  operations: { table: "platform_operational_events", select: "id,source,event_type,status,correlation_id,attempts,last_error,payload_summary,next_attempt_at,started_at,completed_at,created_at", permission: "platform.operations.read", orderField: "created_at" }
};
function hasPermission(context, permission) {
  return context.role?.key === "admin" || context.permissions.includes(permission);
}
function cleanUuidList(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const values = value.split(",").map((item) => item.trim()).filter((item) => /^[0-9a-f-]{36}$/i.test(item));
  return values.length ? [...new Set(values)].slice(0, 100) : null;
}
function validDate(value, fallback) {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
}
async function visibleTenantIds(db, context) {
  if (isGlobalAdmin(context)) return null;
  const visibleTeams = context.teams.filter((team) => context.managedTeams.some((managed) => managed.id === team.id) || ["team", "all"].includes(team.member_client_visibility)).map((team) => team.id);
  const clauses = [`owner_platform_member_id.eq.${context.platformMember.id}`];
  if (visibleTeams.length) clauses.push(`team_id.in.(${visibleTeams.join(",")})`);
  const result = await db.from("platform_client_assignments").select("tenant_id").eq("assignment_type", "commercial").or(clauses.join(","));
  if (result.error) throw result.error;
  return [...new Set((result.data || []).map((item) => String(item.tenant_id)))];
}
function intersectAllowed(requested, allowed) {
  if (allowed === null) return requested;
  if (requested === null) return allowed;
  const allowedSet = new Set(allowed);
  return requested.filter((id) => allowedSet.has(id));
}
function csvCell(value) {
  const raw = value === null || value === void 0 ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}
function createAdminControlPlaneRouter(getSupabaseAdmin2) {
  const router = Router4();
  router.get("/control-plane/metrics", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.commercial.read", "platform.clients.read", "platform.billing.read", "platform.support.read"]), async (req, res) => {
    try {
      const db = getSupabaseAdmin2();
      const now = /* @__PURE__ */ new Date();
      const defaultFrom = new Date(now.valueOf() - 30 * 864e5);
      const from = validDate(req.query.from, defaultFrom);
      const to = validDate(req.query.to, now);
      if (from >= to || to.valueOf() - from.valueOf() > 366 * 864e5) return res.status(400).json({ error: "Per\xEDodo inv\xE1lido ou superior a 366 dias." });
      const requestedTeams = cleanUuidList(req.query.team);
      const requestedOwners = cleanUuidList(req.query.owner);
      const requestedTenants = cleanUuidList(req.query.tenant);
      const requestedPlans = cleanUuidList(req.query.plan);
      const context = req.platformContext;
      const allowedTenants = await visibleTenantIds(db, context);
      const tenantIds = intersectAllowed(requestedTenants, allowedTenants);
      if (allowedTenants !== null && tenantIds?.length === 0) {
        return res.json({ current: null, previous: null, emptyReason: "Nenhum registro est\xE1 dispon\xEDvel no escopo e filtros selecionados." });
      }
      let teamIds = requestedTeams;
      let ownerIds = requestedOwners;
      if (!isGlobalAdmin(context)) {
        const managed = context.managedTeams.map((team) => team.id);
        const visible = context.teams.filter((team) => ["team", "all"].includes(team.member_lead_visibility)).map((team) => team.id);
        const allowedTeams = [.../* @__PURE__ */ new Set([...managed, ...visible])];
        teamIds = intersectAllowed(requestedTeams, allowedTeams);
        if (!teamIds?.length) ownerIds = [context.platformMember.id];
        else if (requestedOwners?.length) ownerIds = requestedOwners.includes(context.platformMember.id) ? [context.platformMember.id] : null;
      }
      const duration = to.valueOf() - from.valueOf();
      const previousFrom = new Date(from.valueOf() - duration);
      const args = (start, end) => ({
        p_from: start.toISOString(),
        p_to: end.toISOString(),
        p_team_ids: teamIds,
        p_owner_ids: ownerIds,
        p_tenant_ids: tenantIds,
        p_plan_ids: requestedPlans,
        p_is_admin: isGlobalAdmin(context)
      });
      const [currentResult, previousResult] = await Promise.all([
        db.rpc("admin_control_plane_metrics", args(from, to)),
        db.rpc("admin_control_plane_metrics", args(previousFrom, from))
      ]);
      if (currentResult.error) throw currentResult.error;
      if (previousResult.error) throw previousResult.error;
      return res.json({ current: currentResult.data, previous: previousResult.data, emptyReason: currentResult.data?.has_commercial_data || currentResult.data?.has_financial_data ? null : "Ainda n\xE3o h\xE1 dados suficientes no per\xEDodo selecionado." });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.get("/control-plane/filters", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.commercial.read", "platform.clients.read"]), async (req, res) => {
    try {
      const db = getSupabaseAdmin2();
      const context = req.platformContext;
      const teamIds = isGlobalAdmin(context) ? null : context.teams.map((team) => team.id);
      let teamsQuery = db.from("platform_teams").select("id,name,status").eq("status", "active").order("name");
      if (teamIds !== null) {
        if (!teamIds.length) return res.json({ teams: [], people: [], plans: [], solutions: [] });
        teamsQuery = teamsQuery.in("id", teamIds);
      }
      const [teams, members, plans, solutions] = await Promise.all([
        teamsQuery,
        db.from("platform_members").select("id,user_id,status,relationship_type,platform_roles(key,name)").eq("status", "active"),
        db.from("billing_plans").select("id,code,version,name,active").order("name"),
        db.from("solutions").select("id,key,name").order("name")
      ]);
      for (const result of [teams, members, plans, solutions]) if (result.error) throw result.error;
      return res.json({ teams: teams.data || [], people: members.data || [], plans: plans.data || [], solutions: solutions.data || [] });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.get("/control-plane/modules/:module", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.commercial.read", "platform.operations.read", "platform.onboarding.read", "platform.success.read", "platform.support.read", "platform.privacy.read"]), async (req, res) => {
    try {
      const config = MODULES[req.params.module];
      if (!config) return res.status(404).json({ error: "M\xF3dulo n\xE3o encontrado." });
      if (!hasPermission(req.platformContext, config.permission)) return res.status(403).json({ error: "Forbidden" });
      if (req.params.module === "operations" && !isGlobalAdmin(req.platformContext)) return res.status(403).json({ error: "Opera\xE7\xF5es globais exigem perfil admin." });
      const db = getSupabaseAdmin2();
      const { page, pageSize, from, to } = parsePagination(req.query);
      let query = db.from(config.table).select(config.select, { count: "exact" }).order(config.orderField, { ascending: false }).range(from, to);
      const tenants = config.tenantField ? await visibleTenantIds(db, req.platformContext) : null;
      if (config.tenantField && tenants !== null) {
        if (!tenants.length) return res.json(pageResult([], 0, page, pageSize));
        query = query.in(config.tenantField, tenants);
      }
      if (config.teamField && !isGlobalAdmin(req.platformContext)) {
        const teamIds = req.platformContext.teams.map((team) => team.id);
        if (!teamIds.length && config.ownerField) query = query.eq(config.ownerField, req.platformContext.platformMember.id);
        else if (teamIds.length) query = query.or(`${config.teamField}.in.(${teamIds.join(",")}),${config.ownerField}.eq.${req.platformContext.platformMember.id}`);
      }
      if (typeof req.query.status === "string" && req.query.status) query = query.eq("status", req.query.status);
      const result = await query;
      if (result.error) throw result.error;
      return res.json(pageResult(result.data || [], result.count, page, pageSize));
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.post("/control-plane/transition", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.commercial.manage", "platform.onboarding.manage", "platform.support.manage", "platform.privacy.manage", "platform.clients.manage"]), async (req, res) => {
    try {
      const { entityType, entityId, toStatus, reason, teamId, tenantId, requestId, metadata } = req.body || {};
      if (!["lead", "proposal", "contract", "tenant", "onboarding", "support", "lgpd"].includes(entityType)) return res.status(400).json({ error: "Tipo de recurso inv\xE1lido." });
      if (!entityId || !toStatus || typeof reason !== "string" || !reason.trim()) return res.status(400).json({ error: "Recurso, pr\xF3ximo estado e motivo s\xE3o obrigat\xF3rios." });
      const permission = entityType === "onboarding" ? "platform.onboarding.manage" : entityType === "support" ? "platform.support.manage" : entityType === "lgpd" ? "platform.privacy.manage" : entityType === "tenant" ? "platform.clients.manage" : "platform.commercial.manage";
      if (!hasPermission(req.platformContext, permission)) return res.status(403).json({ error: "Forbidden" });
      if (!isGlobalAdmin(req.platformContext) && teamId && !req.platformContext.managedTeams.some((team) => team.id === teamId)) return res.status(403).json({ error: "Recurso fora do escopo gerenciado." });
      const result = await getSupabaseAdmin2().rpc("admin_transition_control_plane", {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_to_status: toStatus,
        p_actor_user_id: req.user.id,
        p_reason: reason.trim(),
        p_request_id: requestId || req.requestId || null,
        p_team_id: teamId || null,
        p_tenant_id: tenantId || null,
        p_metadata: metadata || {}
      });
      if (result.error) return res.status(409).json({ error: result.error.message });
      return res.json({ status: result.data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  router.post("/control-plane/onboarding/start", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.onboarding.manage"), async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.onboarding.manage")) return res.status(403).json({ error: "Forbidden" });
    const tenants = await visibleTenantIds(getSupabaseAdmin2(), req.platformContext);
    if (tenants !== null && !tenants.includes(req.body?.tenantId)) return res.status(403).json({ error: "Cliente fora do escopo." });
    const result = await getSupabaseAdmin2().rpc("admin_start_onboarding", {
      p_tenant_id: req.body?.tenantId,
      p_template_id: req.body?.templateId,
      p_actor_user_id: req.user.id,
      p_owner_platform_member_id: req.body?.ownerId || null
    });
    if (result.error) return res.status(409).json({ error: result.error.message });
    return res.status(201).json({ id: result.data });
  });
  router.post("/control-plane/onboarding/:id/refresh", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.onboarding.manage"), async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.onboarding.manage")) return res.status(403).json({ error: "Forbidden" });
    const result = await getSupabaseAdmin2().rpc("admin_refresh_onboarding_progress", { p_run_id: req.params.id, p_actor_user_id: req.user.id });
    if (result.error) return res.status(409).json({ error: result.error.message });
    return res.json({ progressPercent: result.data });
  });
  router.get("/control-plane/tenants/:id/entitlements", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.clients.read"), async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.clients.read")) return res.status(403).json({ error: "Forbidden" });
    const tenants = await visibleTenantIds(getSupabaseAdmin2(), req.platformContext);
    if (tenants !== null && !tenants.includes(req.params.id)) return res.status(403).json({ error: "Cliente fora do escopo." });
    const result = await getSupabaseAdmin2().rpc("admin_effective_entitlements", { p_tenant_id: req.params.id });
    if (result.error) throw result.error;
    return res.json(result.data);
  });
  router.get("/access/matrix", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.access.simulate"), async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.access.simulate")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin2();
    const [members, permissions, memberships] = await Promise.all([
      db.from("platform_members").select("id,user_id,status,relationship_type,platform_roles(id,key,name)"),
      db.from("platform_role_permissions").select("role_id,platform_permissions(key,category,description)"),
      db.from("platform_team_members").select("platform_member_id,team_id,team_role,status,platform_teams(id,name)")
    ]);
    for (const result of [members, permissions, memberships]) if (result.error) throw result.error;
    return res.json({ members: members.data || [], rolePermissions: permissions.data || [], teamMemberships: memberships.data || [], rule: "relationship_type \xE9 informativo e nunca concede privil\xE9gios." });
  });
  router.post("/access/simulate", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.access.simulate"), async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.access.simulate")) return res.status(403).json({ error: "Forbidden" });
    const { platformMemberId, permission, teamId, ownerPlatformMemberId } = req.body || {};
    const db = getSupabaseAdmin2();
    const member = await db.from("platform_members").select("id,status,relationship_type,platform_roles(id,key,name)").eq("id", platformMemberId).maybeSingle();
    if (member.error || !member.data) return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    const role = member.data.platform_roles;
    const rolePermission = await db.from("platform_role_permissions").select("platform_permissions!inner(key)").eq("role_id", role.id).eq("platform_permissions.key", permission).maybeSingle();
    const membership = teamId ? await db.from("platform_team_members").select("team_role,status,platform_teams(name,member_lead_visibility,member_client_visibility)").eq("platform_member_id", platformMemberId).eq("team_id", teamId).maybeSingle() : { data: null, error: null };
    let allowed = member.data.status === "active" && (role.key === "admin" || Boolean(rolePermission.data));
    let origin = allowed ? `papel:${role.key}` : member.data.status !== "active" ? "usu\xE1rio suspenso" : `papel:${role.key} sem ${permission}`;
    if (allowed && role.key !== "admin" && teamId) {
      const teamScope = membership.data?.status === "active" && (membership.data.team_role === "manager" || ownerPlatformMemberId === platformMemberId || ["team", "all"].includes(membership.data.platform_teams?.member_client_visibility));
      allowed = Boolean(teamScope);
      origin = allowed ? `equipe:${membership.data?.platform_teams?.name || teamId}` : "fora do escopo da equipe/owner";
    }
    return res.json({ allowed, role: role.key, relationshipType: member.data.relationship_type, teamId: teamId || null, permission, origin, note: "relationship_type n\xE3o participa da decis\xE3o." });
  });
  router.get("/control-plane/search", authenticateRequest, resolvePlatformContext, requirePlatformPermission(["platform.commercial.read", "platform.clients.read", "platform.billing.read"]), async (req, res) => {
    const term = typeof req.query.q === "string" ? req.query.q.trim().replace(/[%(),]/g, "").slice(0, 80) : "";
    if (term.length < 2) return res.json({ items: [] });
    const db = getSupabaseAdmin2();
    const tenantScope = await visibleTenantIds(db, req.platformContext);
    let tenantQuery = db.from("tenants").select("id,name,slug,lifecycle_status").ilike("name", `%${term}%`).limit(8);
    if (tenantScope !== null) {
      if (!tenantScope.length) tenantQuery = tenantQuery.eq("id", "00000000-0000-0000-0000-000000000000");
      else tenantQuery = tenantQuery.in("id", tenantScope);
    }
    const tenants = await tenantQuery;
    if (tenants.error) throw tenants.error;
    return res.json({ items: (tenants.data || []).map((item) => ({ type: "client", id: item.id, title: item.name, subtitle: item.lifecycle_status, href: `#/admin/empresas/${item.id}` })) });
  });
  router.get("/control-plane/export/:resource", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.exports.execute"), async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.exports.execute")) return res.status(403).json({ error: "Forbidden" });
    const resource = String(req.params.resource);
    const allowed = {
      clients: { table: "tenants", columns: "id,name,slug,status,lifecycle_status,risk_level,created_at", permission: "platform.clients.read", tenantField: "id" },
      support: { table: "support_tickets", columns: "id,ticket_number,tenant_id,category,priority,severity,status,subject,sla_due_at,created_at", permission: "platform.support.read", tenantField: "tenant_id" }
    };
    const config = allowed[resource];
    if (!config || !hasPermission(req.platformContext, config.permission)) return res.status(404).json({ error: "Exporta\xE7\xE3o indispon\xEDvel." });
    const db = getSupabaseAdmin2();
    const tenants = await visibleTenantIds(db, req.platformContext);
    let query = db.from(config.table).select(config.columns).limit(1e3);
    if (tenants !== null) {
      if (!tenants.length) return res.status(204).end();
      query = query.in(config.tenantField, tenants);
    }
    const result = await query;
    if (result.error) throw result.error;
    const rows = result.data || [];
    const headers = rows.length ? Object.keys(rows[0]) : config.columns.split(",");
    const csv = ["sep=,", headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n");
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "admin.exported", entity_type: resource, severity: "info", ...auditContext(req, { result: "success", row_count: rows.length, excludes_integrity_data: true }) });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ordum-${resource}.csv"`);
    return res.send(`\uFEFF${csv}`);
  });
  return router;
}

// src/server/adminTeamsRouter.ts
init_operational();
init_tenantAuth();
import { Router as Router5 } from "express";
import { z as z4 } from "zod";
function createAdminTeamsRouter(getSupabaseAdmin2, _old_requirePlatformAuth) {
  const router = Router5();
  router.get("/", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.read"), async (req, res) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin2().from("platform_teams").select("*").order("name");
      if (platformContext.role?.key !== "admin") {
        const teamIds = platformContext.teams.map((t) => t.id);
        if (teamIds.length === 0) return res.json([]);
        query = query.in("id", teamIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const createTeamSchema = z4.object({
    name: z4.string().min(1),
    team_type: z4.string(),
    channel: z4.string(),
    description: z4.string().optional(),
    member_lead_visibility: z4.string(),
    member_client_visibility: z4.string(),
    allow_self_claim: z4.boolean()
  });
  router.post("/", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.create"), async (req, res) => {
    try {
      const input = createTeamSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "Payload de cria\xE7\xE3o inv\xE1lido" });
      const { name, team_type, channel, description, member_lead_visibility, member_client_visibility, allow_self_claim } = input.data;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data, error } = await getSupabaseAdmin2().from("platform_teams").insert({
        name,
        slug,
        team_type,
        channel,
        description,
        member_lead_visibility,
        member_client_visibility,
        allow_self_claim,
        status: "active",
        created_by: req.user.id
      }).select().single();
      if (error) throw error;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "team.created",
        entity_type: "platform_teams",
        entity_id: data.id,
        severity: "info",
        ...auditContext(req, { result: "success", after: { name: data.name, team_type: data.team_type, channel: data.channel } })
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.read"), async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      if (platformContext.role?.key !== "admin") {
        const isMember = platformContext.teams.some((t) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin2().from("platform_teams").select("*").eq("id", teamId).single();
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const updateTeamSchema = z4.object({
    name: z4.string().optional(),
    description: z4.string().optional(),
    team_type: z4.string().optional(),
    channel: z4.string().optional(),
    status: z4.string().optional(),
    member_lead_visibility: z4.string().optional(),
    member_client_visibility: z4.string().optional(),
    allow_self_claim: z4.boolean().optional(),
    settings: z4.any().optional()
  });
  router.patch("/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.manage"), async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      let isManager = false;
      if (platformContext.role?.key !== "admin") {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const input = updateTeamSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "Payload de atualiza\xE7\xE3o inv\xE1lido" });
      const allowedFields = isManager ? ["description", "member_lead_visibility", "member_client_visibility", "allow_self_claim"] : ["name", "description", "team_type", "channel", "status", "member_lead_visibility", "member_client_visibility", "allow_self_claim", "settings"];
      const updates = Object.fromEntries(Object.entries(input.data).filter(([key, val]) => allowedFields.includes(key) && val !== void 0));
      if (updates.settings && typeof updates.settings === "object") {
        for (const key of ["proposal_approval_limit_cents", "contract_approval_limit_cents"]) {
          const value = updates.settings[key];
          if (value !== void 0 && value !== null && (!Number.isInteger(value) || value < 0)) {
            return res.status(400).json({ error: `${key} deve ser um inteiro n\xE3o negativo em centavos.` });
          }
        }
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });
      const before = await getSupabaseAdmin2().from("platform_teams").select("*").eq("id", teamId).single();
      const { data, error } = await getSupabaseAdmin2().from("platform_teams").update(updates).eq("id", teamId).select().single();
      if (error) throw error;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "team.updated",
        entity_type: "platform_teams",
        entity_id: data.id,
        severity: "info",
        team_id: teamId,
        ...auditContext(req, { result: "success", before: before.data, after: data })
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id/members", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.members.read"), async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      if (platformContext.role?.key !== "admin") {
        const isMember = platformContext.teams.some((t) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: "Forbidden" });
      }
      const { data: teamMembers, error } = await getSupabaseAdmin2().from("platform_team_members").select(`
          team_role,
          status,
          joined_at,
          platform_members (
            id,
            user_id,
            relationship_type,
            status,
            platform_roles ( key, name )
          )
        `).eq("team_id", teamId);
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin2().auth.admin.listUsers();
      const result = teamMembers.map((tm) => {
        const member = tm.platform_members;
        const user = usersData?.users?.find((u) => u.id === member.user_id);
        const role = member?.platform_roles;
        return {
          platform_member_id: member.id,
          team_role: tm.team_role,
          status: tm.status,
          joined_at: tm.joined_at,
          member_status: member.status,
          relationship_type: member.relationship_type,
          user: user ? { email: user.email, name: user.user_metadata?.full_name } : null,
          role
        };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const teamMemberSchema = z4.object({
    platform_member_id: z4.string().uuid(),
    team_role: z4.string()
  });
  router.post("/:id/members", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.members.manage"), async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const input = teamMemberSchema.safeParse(req.body);
      if (!input.success) return res.status(400).json({ error: "Membro ou fun\xE7\xE3o inv\xE1lidos" });
      const { platform_member_id, team_role } = input.data;
      let isManager = false;
      const hasGlobal = platformContext.role?.key === "admin";
      if (!hasGlobal) {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
        const { data: tgtMember } = await getSupabaseAdmin2().from("platform_members").select("platform_roles(key)").eq("id", platform_member_id).single();
        if (tgtMember?.platform_roles?.key !== "sales") {
          return res.status(403).json({ error: "Managers can only add Sales to their team" });
        }
        if (team_role === "manager") {
          return res.status(403).json({ error: "Managers cannot create other Managers" });
        }
      }
      const { data, error } = await getSupabaseAdmin2().from("platform_team_members").upsert({
        team_id: teamId,
        platform_member_id,
        team_role,
        status: "active"
      }, { onConflict: "team_id,platform_member_id" }).select().single();
      if (error) throw error;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: team_role === "manager" ? "team.manager.added" : "team.member.added",
        entity_type: "platform_team_members",
        entity_id: platform_member_id,
        severity: "info",
        team_id: teamId
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.delete("/:id/members/:memberId", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.teams.members.manage"), async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const platform_member_id = req.params.memberId;
      let isManager = false;
      if (platformContext.role?.key !== "admin") {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
        const { data: target } = await getSupabaseAdmin2().from("platform_team_members").select("team_role, platform_members(platform_roles(key))").eq("team_id", teamId).eq("platform_member_id", platform_member_id).maybeSingle();
        if (target?.team_role === "manager" || target?.platform_members?.platform_roles?.key !== "sales") {
          return res.status(403).json({ error: "Managers can only remove Sales members from their team" });
        }
      }
      const { error } = await getSupabaseAdmin2().from("platform_team_members").delete().eq("team_id", teamId).eq("platform_member_id", platform_member_id);
      if (error) throw error;
      await getSupabaseAdmin2().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "team.member.removed",
        entity_type: "platform_team_members",
        entity_id: platform_member_id,
        severity: "info",
        team_id: teamId
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// server.ts
init_router();
init_authorization();
import { createClient as createClient2 } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
import { randomUUID as randomUUID2 } from "node:crypto";
init_tenantAuth();
dotenv.config({ path: [".env.local", ".env"] });
async function createApp() {
  initServerObservability();
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || randomUUID2();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (req.path.startsWith("/api/")) res.setHeader("cache-control", "no-store");
    next();
  });
  app.use(express.json({ limit: "512kb" }));
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, "body")) {
      return res.status(400).json({ error: "Invalid JSON body", requestId: req.requestId });
    }
    next(error);
  });
  app.use(cors());
  let _supabaseAdmin = null;
  const getSupabaseAdmin2 = () => {
    if (!_supabaseAdmin) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!url || !key) {
        throw new Error("Missing server-side Supabase credentials");
      }
      _supabaseAdmin = createClient2(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    }
    return _supabaseAdmin;
  };
  const requirePlatformAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin2().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });
      const { data: platformMember, error: memberErr } = await getSupabaseAdmin2().from("platform_members").select("*, platform_roles(*)").eq("user_id", user.id).maybeSingle();
      if (memberErr || !platformMember) {
        return res.status(403).json({ error: "Forbidden: Not a platform member" });
      }
      if (platformMember.status === "suspended") {
        return res.status(403).json({ error: "Seu acesso administrativo est\xE1 suspenso." });
      }
      const role = platformMember.platform_roles;
      if (!role) {
        return res.status(403).json({ error: "Forbidden: No platform role assigned" });
      }
      const { data: rolePerms } = await getSupabaseAdmin2().from("platform_role_permissions").select("platform_permissions(key)").eq("role_id", role.id);
      const permissions = (rolePerms || []).map((rp) => rp.platform_permissions?.key).filter(Boolean);
      if (!permissions.includes("platform.access") && role.key !== "admin") {
        return res.status(403).json({ error: "Forbidden: platform.access is required" });
      }
      const { data: teamMemberships } = await getSupabaseAdmin2().from("platform_team_members").select("*, platform_teams(*)").eq("platform_member_id", platformMember.id).eq("status", "active");
      const teams = (teamMemberships || []).map((tm) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm) => tm.team_role === "manager").map((tm) => tm.platform_teams);
      req.user = user;
      req.platformContext = {
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams
      };
      next();
    } catch (e) {
      reportServerError(e, req, "platform_auth");
      return res.status(500).json({ error: "Configuration error on server" });
    }
  };
  app.get("/api/admin/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin2().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });
      const { data: tenantMemberships } = await getSupabaseAdmin2().from("memberships").select("*, tenants(*)").eq("user_id", user.id);
      const { data: platformMember } = await getSupabaseAdmin2().from("platform_members").select("*, platform_roles(*)").eq("user_id", user.id).maybeSingle();
      if (!platformMember) {
        return res.json({
          user,
          isPlatformMember: false,
          isPlatformSuspended: false,
          tenantMemberships: tenantMemberships || []
        });
      }
      if (platformMember.status === "suspended") {
        return res.json({
          user,
          isPlatformMember: true,
          isPlatformSuspended: true,
          platformMember,
          tenantMemberships: tenantMemberships || [],
          error: "Seu acesso administrativo est\xE1 suspenso."
        });
      }
      const role = platformMember.platform_roles;
      const { data: rolePerms } = role ? await getSupabaseAdmin2().from("platform_role_permissions").select("platform_permissions(key)").eq("role_id", role.id) : { data: [] };
      const permissions = (rolePerms || []).map((rp) => rp.platform_permissions?.key).filter(Boolean);
      const { data: teamMemberships } = await getSupabaseAdmin2().from("platform_team_members").select("*, platform_teams(*)").eq("platform_member_id", platformMember.id).eq("status", "active");
      const teams = (teamMemberships || []).map((tm) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm) => tm.team_role === "manager").map((tm) => tm.platform_teams);
      return res.json({
        user,
        isPlatformMember: true,
        isPlatformSuspended: false,
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams,
        tenantMemberships: tenantMemberships || []
      });
    } catch (e) {
      reportServerError(e, req, "admin_session_resolve");
      return res.status(500).json({ error: "N\xE3o foi poss\xEDvel resolver a sess\xE3o administrativa." });
    }
  });
  app.get("/api/workspace/me", authenticateRequest, resolveTenantContext, requireTenantPermission("workspace.access"), async (req, res) => {
    const { tenantContext, user } = req;
    res.json({
      success: true,
      user_id: user.id,
      tenant: tenantContext.tenant.name,
      permissions: tenantContext.permissions,
      membership_id: tenantContext.membership.id
    });
  });
  app.get("/api/admin/tenants", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.access"), async (req, res) => {
    res.redirect(307, "/api/admin/clients");
  });
  app.get("/api/admin/tenants/:id", authenticateRequest, resolvePlatformContext, requirePlatformPermission("platform.access"), async (req, res) => {
    res.redirect(307, `/api/admin/clients/${encodeURIComponent(req.params.id)}`);
  });
  app.post("/api/admin/tenants/release-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.demos.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { tenantId, solutionIds, primaryColor, logoInitials } = req.body;
      if (!Array.isArray(solutionIds) || solutionIds.length === 0) return res.status(400).json({ error: "Selecione ao menos uma solu\xE7\xE3o para o trial." });
      const db = getSupabaseAdmin2();
      const { data: lead, error: leadError } = await db.from("marketing_leads").select("*").eq("id", tenantId).single();
      if (leadError || !lead) return res.status(404).json({ error: "Lead not found" });
      const { data: leadAssignment } = await db.from("platform_lead_assignments").select("*").eq("lead_id", lead.id).maybeSingle();
      if (platformContext.role?.key !== "admin") {
        const managesTeam = leadAssignment && platformContext.managedTeams.some((team) => team.id === leadAssignment.team_id);
        const ownsLead = leadAssignment?.owner_platform_member_id === platformContext.platformMember.id;
        if (!managesTeam && !ownsLead) return res.status(403).json({ error: "Lead fora do seu escopo." });
      }
      const { data: { users }, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1e3 });
      if (usersError) throw usersError;
      let user = users.find((candidate) => candidate.email?.toLowerCase() === lead.email.toLowerCase());
      if (!user) {
        const origin = process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get("host")}`;
        const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(lead.email, {
          redirectTo: `${String(origin).replace(/\/$/, "")}/#/auth/accept-invite`,
          data: { full_name: lead.name }
        });
        if (inviteError) throw inviteError;
        user = inviteData.user;
      }
      const baseSlug = lead.company.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "demo";
      const slug = `${baseSlug}-${lead.id.replace(/-/g, "").slice(0, 8)}`;
      let { data: tenant } = await db.from("tenants").select("*").eq("slug", slug).maybeSingle();
      if (!tenant) {
        const { data: provisionedTenantId, error: provisionError } = await db.rpc("provision_tenant", {
          p_name: lead.company,
          p_slug: slug,
          p_owner_user_id: user.id
        });
        if (provisionError) throw provisionError;
        const tenantResult = await db.from("tenants").select("*").eq("id", provisionedTenantId).single();
        if (tenantResult.error) throw tenantResult.error;
        tenant = tenantResult.data;
      }
      const expiresAt = new Date(Date.now() + 14 * 864e5).toISOString();
      await db.from("tenants").update({ status: "trial", settings: { ...tenant.settings || {}, primaryColor, logoInitials, demo: true, demoExpiresAt: expiresAt } }).eq("id", tenant.id);
      await db.from("tenant_solutions").delete().eq("tenant_id", tenant.id);
      const { data: dbSolutions, error: solutionError } = await db.from("solutions").select("id,key").in("key", solutionIds);
      if (solutionError) throw solutionError;
      if (dbSolutions?.length) await db.from("tenant_solutions").insert(dbSolutions.map((solution) => ({ tenant_id: tenant.id, solution_id: solution.id, status: "trial" })));
      if (leadAssignment) await db.from("platform_client_assignments").upsert({
        tenant_id: tenant.id,
        team_id: leadAssignment.team_id,
        owner_platform_member_id: leadAssignment.owner_platform_member_id,
        assigned_by_user_id: req.user.id,
        assignment_type: "commercial",
        status: "active"
      }, { onConflict: "tenant_id,team_id,assignment_type" });
      await db.from("marketing_leads").update({ status: "contacted" }).eq("id", lead.id);
      await db.from("commercial_demos").upsert({
        lead_id: lead.id,
        tenant_id: tenant.id,
        team_id: leadAssignment?.team_id || null,
        owner_platform_member_id: leadAssignment?.owner_platform_member_id || null,
        status: "active",
        starts_at: (/* @__PURE__ */ new Date()).toISOString(),
        expires_at: expiresAt,
        approved_by_user_id: req.user.id,
        approved_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { onConflict: "lead_id" });
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "demo.released",
        entity_type: "commercial_demos",
        entity_id: lead.id,
        team_id: leadAssignment?.team_id || null,
        severity: "info",
        metadata: { tenant_id: tenant.id, expires_at: expiresAt, solution_keys: solutionIds }
      });
      res.json({ success: true, tenant: { ...tenant, status: "trial" }, expiresAt });
    } catch (e) {
      reportServerError(e, req, "demo_release");
      res.status(500).json({ error: "N\xE3o foi poss\xEDvel liberar a demonstra\xE7\xE3o." });
    }
  });
  app.post("/api/admin/tenants/revoke-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.demos.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { tenantId } = req.body;
      const db = getSupabaseAdmin2();
      const { data: assignment } = await db.from("platform_client_assignments").select("*").eq("tenant_id", tenantId).eq("assignment_type", "commercial").maybeSingle();
      if (platformContext.role?.key !== "admin") {
        const managesTeam = assignment && platformContext.managedTeams.some((team) => team.id === assignment.team_id);
        const ownsClient = assignment?.owner_platform_member_id === platformContext.platformMember.id;
        if (!managesTeam && !ownsClient) return res.status(403).json({ error: "Demonstra\xE7\xE3o fora do seu escopo." });
      }
      await db.from("tenants").update({ status: "suspended" }).eq("id", tenantId);
      await db.from("commercial_demos").update({ status: "revoked" }).eq("tenant_id", tenantId);
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "demo.revoked", entity_type: "commercial_demos", entity_id: tenantId, team_id: assignment?.team_id || null, severity: "warning" });
      res.json({ success: true });
    } catch (e) {
      reportServerError(e, req, "demo_revoke");
      res.status(500).json({ error: "N\xE3o foi poss\xEDvel revogar a demonstra\xE7\xE3o." });
    }
  });
  app.get("/api/admin/consultants", requirePlatformAuth, async (_req, res) => {
    res.redirect(307, "/api/admin/staff");
  });
  app.get("/api/admin/contracts", requirePlatformAuth, async (req, res) => {
    res.redirect(307, "/api/admin/commercial/contracts");
  });
  app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin2, requirePlatformAuth));
  app.use("/api/admin/leads", createAdminLeadsRouter(getSupabaseAdmin2, requirePlatformAuth));
  app.use("/api/admin/clients", createAdminClientsRouter(getSupabaseAdmin2));
  app.use("/api/admin", createAdminControlPlaneRouter(getSupabaseAdmin2));
  app.use("/api/admin", createAdminOtherRouter(getSupabaseAdmin2, requirePlatformAuth));
  const billingRouters = createBillingRouters(getSupabaseAdmin2);
  app.use("/api/webhooks", billingRouters.publicRouter);
  app.use("/api/admin", billingRouters.adminRouter);
  app.use("/api/internal/billing", billingRouters.internalRouter);
  app.get("/api/admin/stats", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const db = getSupabaseAdmin2();
      const [leadAssignments, clientAssignments] = await Promise.all([
        db.from("platform_lead_assignments").select("*"),
        db.from("platform_client_assignments").select("*").eq("assignment_type", "commercial")
      ]);
      const scopedLeads = platformContext.role?.key === "admin" ? leadAssignments.data || [] : (leadAssignments.data || []).filter((item) => canReadAssignedResource(platformContext, item, "member_lead_visibility"));
      const scopedClients = platformContext.role?.key === "admin" ? clientAssignments.data || [] : (clientAssignments.data || []).filter((item) => canReadAssignedResource(platformContext, item, "member_client_visibility"));
      const leadIds = [...new Set(scopedLeads.map((item) => item.lead_id))];
      const tenantIds = [...new Set(scopedClients.map((item) => item.tenant_id))];
      let leadsQuery = db.from("marketing_leads").select("id,status");
      let demosQuery = db.from("commercial_demos").select("id,status,lead_id");
      let proposalsQuery = db.from("commercial_proposals").select("id,status,lead_id,amount_cents");
      let contractsQuery = db.from("commercial_contracts").select("id,status,tenant_id,amount_cents,cycle,team_id,owner_platform_member_id");
      let tenantsQuery = db.from("tenants").select("id,status,onboarding_status");
      if (platformContext.role?.key !== "admin") {
        if (!leadIds.length && !tenantIds.length) return res.json({ clients: 0, leads: 0, demos: 0, teams: platformContext.teams.length, proposals: 0, contracts: 0, conversionRate: 0, onboarding: 0, subscriptions: {}, overdue: 0, mrrCents: 0, alerts: [], leadsByStatus: {}, recentActivity: [] });
        if (leadIds.length) {
          leadsQuery = leadsQuery.in("id", leadIds);
          demosQuery = demosQuery.in("lead_id", leadIds);
          proposalsQuery = proposalsQuery.in("lead_id", leadIds);
        } else {
          leadsQuery = leadsQuery.eq("id", randomUUID2());
          demosQuery = demosQuery.eq("id", randomUUID2());
          proposalsQuery = proposalsQuery.eq("id", randomUUID2());
        }
        if (tenantIds.length) tenantsQuery = tenantsQuery.in("id", tenantIds);
        else tenantsQuery = tenantsQuery.eq("id", randomUUID2());
      }
      const [leads, demos, proposals, contractsResult, tenants, teams, subscriptions, overdue, recentActivity] = await Promise.all([
        leadsQuery,
        demosQuery,
        proposalsQuery,
        contractsQuery,
        tenantsQuery,
        db.from("platform_teams").select("*", { count: "exact", head: true }).eq("status", "active"),
        db.from("billing_subscriptions").select("status,amount_cents,cycle,contract_id"),
        db.from("billing_payments").select("id,contract_id,status").eq("status", "overdue"),
        db.from("commercial_activities").select("id,subject,activity_type,status,created_at,team_id,owner_platform_member_id").order("created_at", { ascending: false }).limit(10)
      ]);
      const contracts = platformContext.role?.key === "admin" ? contractsResult.data || [] : (contractsResult.data || []).filter((item) => canReadAssignedResource(platformContext, item, "member_client_visibility"));
      const contractIds = new Set(contracts.map((item) => item.id));
      const scopedSubscriptions = (subscriptions.data || []).filter((item) => platformContext.role?.key === "admin" || contractIds.has(item.contract_id));
      const scopedOverdue = (overdue.data || []).filter((item) => platformContext.role?.key === "admin" || contractIds.has(item.contract_id));
      const cycleDivisor = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12 };
      const activeSubscriptions = scopedSubscriptions.filter((item) => item.status === "active");
      const mrrCents = Math.round(activeSubscriptions.reduce((sum, item) => sum + Number(item.amount_cents || 0) * (cycleDivisor[item.cycle] || 0), 0));
      const leadsByStatus = (leads.data || []).reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
      const subscriptionStates = scopedSubscriptions.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
      const scopedRecent = platformContext.role?.key === "admin" ? recentActivity.data || [] : (recentActivity.data || []).filter((item) => canReadAssignedResource(platformContext, item, "member_lead_visibility"));
      const alerts = [scopedOverdue.length ? { type: "overdue", count: scopedOverdue.length, label: "Pagamentos vencidos" } : null, subscriptionStates.past_due ? { type: "subscription", count: subscriptionStates.past_due, label: "Assinaturas em atraso" } : null].filter(Boolean);
      res.json({
        clients: tenants.data?.length || 0,
        leads: leads.data?.length || 0,
        demos: demos.data?.length || 0,
        teams: platformContext.role?.key === "admin" ? teams.count || 0 : platformContext.teams.length,
        proposals: proposals.data?.length || 0,
        contracts: contracts.length,
        conversionRate: leads.data?.length ? Math.round(contracts.length / leads.data.length * 1e3) / 10 : 0,
        onboarding: (tenants.data || []).filter((item) => item.onboarding_status === "in_progress").length,
        subscriptions: subscriptionStates,
        overdue: scopedOverdue.length,
        mrrCents,
        alerts,
        leadsByStatus,
        recentActivity: scopedRecent
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/public/tenants/resolve", async (req, res) => {
    try {
      const { slug, domain } = req.query;
      let tenant = null;
      if (slug) {
        const { data, error } = await getSupabaseAdmin2().from("tenants").select("id, name, slug, status, settings").eq("slug", slug).in("status", ["active", "trial"]).single();
        if (!error && data) tenant = data;
      } else if (domain) {
        const { data: td, error: e1 } = await getSupabaseAdmin2().from("tenant_domains").select("tenant_id").eq("hostname", domain).single();
        if (!e1 && td) {
          const { data, error } = await getSupabaseAdmin2().from("tenants").select("id, name, slug, status, settings").eq("id", td.tenant_id).in("status", ["active", "trial"]).single();
          if (!error && data) tenant = data;
        }
      }
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  installServerErrorHandler(app);
  app.use((error, req, res, _next) => {
    reportServerError(error, req, "unhandled_request");
    if (res.headersSent) return;
    res.status(500).json({ error: "Unexpected server error", requestId: req.requestId });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  return app;
}
async function startServer() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3e3);
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}

// vercel-handler.ts
var appPromise = createApp();
async function handler(req, res) {
  const app = await appPromise;
  const path2 = typeof req.query.path === "string" ? req.query.path : "";
  if (path2) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string") query.append(key, item);
        });
      } else if (typeof value === "string") {
        query.set(key, value);
      }
    }
    req.url = `/api/${path2}${query.size ? `?${query}` : ""}`;
  }
  return app(req, res);
}
export {
  handler as default
};
