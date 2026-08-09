import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { integrityDashboard } from "../../../src/domain/integrity";

const migration = fs.readFileSync("supabase/migrations/20260809173050_integrity_phase4e_governance.sql", "utf8");
const router = fs.readFileSync("src/server/integrityRouter.ts", "utf8");
const admin = fs.readFileSync("src/server/adminClientsRouter.ts", "utf8");
const billing = fs.readFileSync("src/server/billing/router.ts", "utf8");
const api = fs.readFileSync("src/components/workspace/integrityApi.ts", "utf8");

describe("Ordum Integridade Phase 4E", () => {
  it("computes operational distributions, unassigned work and evolution", () => {
    const result = integrityDashboard([
      { id: "1", status: "received", severity: "critical", created_at: "2026-08-08T10:00:00Z", category_id: "c1", unit_id: "u1", integrity_categories: { name: "Assédio" }, integrity_units: { name: "Matriz" }, owner_membership_id: null },
      { id: "2", status: "closed", severity: "low", created_at: "2026-08-08T12:00:00Z", closed_at: "2026-08-09T12:00:00Z", category_id: "c1", integrity_categories: { name: "Assédio" }, owner_membership_id: "m1" },
    ], new Date("2026-08-09T18:00:00Z"));
    assert.equal(result.unassigned, 1);
    assert.deepEqual(result.by_category, [{ label: "Assédio", count: 2 }]);
    assert.deepEqual(result.by_severity, [{ label: "critical", count: 1 }, { label: "low", count: 1 }]);
    assert.deepEqual(result.evolution, [{ date: "2026-08-08", count: 2 }]);
  });

  it("keeps list filters and pagination in database queries", () => {
    for (const filter of ["category_id", "unit_id", "owner_id", "committee_id", "from", "to"])
      assert.match(router, new RegExp(`q\\.${filter}`));
    assert.match(router, /\.range\(from, from \+ q\.limit - 1\)/);
  });

  it("exports bounded CSV, neutralizes formula injection and audits", () => {
    assert.match(router, /integrity\.cases\.exported/);
    assert.match(router, /\.limit\(1000\)/);
    assert.match(router, /\^\[=\+\\-@\\t\\r\]/);
    assert.match(api, /URL\.createObjectURL/);
  });

  it("exports case identity only with its explicit permission", () => {
    assert.match(router, /hasPermission\(req, "integrity\.identity\.read"\)/);
    assert.match(router, /case_report_exported/);
    assert.match(router, /included_identity/);
  });

  it("provisions an Integridade-specific onboarding template idempotently", () => {
    assert.match(migration, /ensure_integrity_onboarding_template/);
    assert.match(migration, /on conflict \(tenant_id\) do nothing/i);
    assert.match(migration, /Publicar canal/);
    assert.match(billing, /ensure_integrity_onboarding_template/);
  });

  it("tracks channel readiness and configuration changes in audit", () => {
    assert.match(router, /settings\/channel-test/);
    assert.match(router, /integrity\.channel\.tested/);
    assert.match(router, /integrity\.settings\.updated/);
    assert.match(migration, /channel_tested_at/);
  });

  it("keeps Admin Ordum aggregate-only", () => {
    assert.match(admin, /confidentiality_boundary:\s*"aggregate_only"/);
    assert.doesNotMatch(admin, /integrity_report_messages|integrity_report_identities|integrity_attachments/);
  });

  it("keeps governance RPC service-only with a fixed search path", () => {
    assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
    assert.match(migration, /revoke all on function public\.ensure_integrity_onboarding_template\(uuid\) from public, anon, authenticated/i);
    assert.match(migration, /grant execute on function public\.ensure_integrity_onboarding_template\(uuid\) to service_role/i);
  });
});
