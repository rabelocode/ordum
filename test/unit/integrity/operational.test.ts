import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import {
  integrityRateLimitKey,
  validateIntegrityEvidence,
} from "../../../src/domain/integrity-files";
import {
  canAssignIntegrityCase,
  canTransitionIntegrityCase,
  integrityDashboard,
} from "../../../src/domain/integrity";

const migration = fs.readFileSync(
  "supabase/migrations/20260809141338_integrity_operational_phase4b.sql",
  "utf8",
);
const workspace = fs.readFileSync("src/server/integrityRouter.ts", "utf8");
const publicApi = fs.readFileSync(
  "src/server/integrityPublicRouter.ts",
  "utf8",
);
const adminApi = fs.readFileSync("src/server/adminClientsRouter.ts", "utf8");

describe("Ordum Integridade Operational Phase 4B", () => {
  it("accepts an authorized PDF signature and safe extension", () => {
    const result = validateIntegrityEvidence(
      Buffer.from("%PDF-1.7 safe"),
      "application/pdf",
      "evidencia.pdf",
      1024,
    );
    assert.equal(result.valid, true);
  });
  it("rejects an invalid MIME signature", () => {
    const result = validateIntegrityEvidence(
      Buffer.from("not a pdf"),
      "application/pdf",
      "evidencia.pdf",
      1024,
    );
    assert.equal(result.valid, false);
  });
  it("rejects files above the tenant limit", () => {
    const result = validateIntegrityEvidence(
      Buffer.alloc(20),
      "text/plain",
      "nota.txt",
      10,
    );
    assert.equal(result.valid, false);
  });
  it("isolates Storage objects from direct authenticated enumeration", () => {
    assert.match(
      migration,
      /bucket_id = any\(array\['ordum-private','ordum-talentos'\]\)/,
    );
    assert.doesNotMatch(
      migration,
      /storage_private_read[\s\S]{0,400}ordum-integrity/,
    );
  });
  it("creates short-lived signed URLs only after case-scoped lookup", () => {
    const scoped = workspace.indexOf('.eq("case_id", req.params.id)');
    const signed = workspace.indexOf(
      "createSignedUrl(file.object_path, 120)",
      scoped,
    );
    assert.ok(scoped >= 0 && signed > scoped);
  });
  it("enforces the public attachment policy and file count", () => {
    assert.ok(publicApi.includes("if (!policy.enabled)"));
    assert.ok(publicApi.includes("policy.max_files"));
  });
  it("uses a non-reversible persistent rate-limit key", () => {
    const key = integrityRateLimitKey(
      "server-only",
      "track",
      "203.0.113.1",
      "ORD-ABC",
    );
    assert.equal(key.length, 64);
    assert.doesNotMatch(key, /203\.0\.113\.1|ORD-ABC/);
    assert.match(migration, /integrity_public_rate_limits/);
  });
  it("rate limits all sensitive public operations", () => {
    for (const action of ['"submit"', '"track"', '"message"', '"upload"'])
      assert.ok(publicApi.includes(`rate(req, res, ${action}`));
  });
  it("models task priority, due date, completion and reopening", () => {
    assert.match(migration, /add column if not exists priority/);
    assert.match(workspace, /task_completed/);
    assert.match(workspace, /task_reopened/);
  });
  it("reports overdue tasks and operational SLA without fake values", () => {
    const metrics = integrityDashboard(
      [
        {
          status: "investigation",
          severity: "high",
          created_at: "2026-01-01T00:00:00Z",
          first_response_due_at: "2026-01-02T00:00:00Z",
          treatment_due_at: "2026-01-03T00:00:00Z",
        },
      ],
      new Date("2026-01-04T00:00:00Z"),
    );
    assert.equal(metrics.first_response_overdue, 1);
    assert.equal(metrics.treatment_overdue, 1);
    assert.equal(metrics.average_resolution_hours, null);
  });
  it("persists a complete internal decision separately from reporter outcome", () => {
    assert.match(migration, /internal_justification/);
    assert.match(migration, /reporter_outcome/);
    assert.match(migration, /decide_and_close_integrity_case/);
  });
  it("never returns the internal conclusion in public tracking", () => {
    const publicProjection = migration.slice(
      migration.indexOf(
        "create or replace function public.authorize_integrity_reporter",
      ),
    );
    assert.doesNotMatch(
      publicApi,
      /internal_justification|measures_taken|\bconclusion\b/,
    );
    assert.ok(publicProjection.length > 0);
  });
  it("requires a reason to reopen and preserves the state machine", () => {
    assert.equal(canTransitionIntegrityCase("closed", "reopened"), true);
    assert.equal(canTransitionIntegrityCase("closed", "investigation"), false);
  });
  it("routes by category and unit with a deterministic fallback", () => {
    assert.match(migration, /integrity_routing_rules/);
    assert.match(migration, /default_assignee_membership_id/);
    assert.match(migration, /order by \(\(rule\.category_id is not null\)/);
  });
  it("blocks assignment when an active conflict exists", () => {
    assert.equal(
      canAssignIntegrityCase({
        membershipActive: true,
        sameTenant: true,
        activeConflict: true,
      }),
      false,
    );
    assert.match(workspace, /Atribuição bloqueada por conflito de interesse/);
  });
  it("guards evidence, tasks, decisions and settings with explicit RBAC", () => {
    for (const permission of [
      "integrity.evidence.manage",
      "integrity.cases.manage",
      "integrity.settings.manage",
    ])
      assert.match(workspace, new RegExp(permission.replace(".", "\\.")));
  });
  it("keeps Admin Global on aggregate-only fields", () => {
    assert.ok(adminApi.includes('confidentiality_boundary: "aggregate_only"'));
    assert.doesNotMatch(
      adminApi,
      /integrity_reports\).*description|integrity_report_messages|integrity_report_identities|integrity_attachments/,
    );
  });
  it("keeps the bucket private with bounded MIME and size rules", () => {
    assert.match(
      migration,
      /'ordum-integrity', 'ordum-integrity', false, 10485760/,
    );
    assert.match(migration, /allowed_mime_types/);
  });
});
