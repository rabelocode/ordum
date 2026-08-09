import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const migration = fs.readFileSync("supabase/migrations/20260809184617_integrity_phase4f_investigation_governance.sql","utf8");
const router = fs.readFileSync("src/server/integrityRouter.ts","utf8");
const publicRouter = fs.readFileSync("src/server/integrityPublicRouter.ts","utf8");
const adminRouter = [
  fs.readFileSync("src/server/adminClientsRouter.ts","utf8"),
  fs.readFileSync("src/server/adminControlPlaneRouter.ts","utf8"),
].join("\n");
const moduleView = fs.readFileSync("src/components/workspace/IntegrityModuleView.tsx","utf8");

describe("Ordum Integridade Phase 4F", () => {
  it("models additional investigators without widening tenant or case scope", () => {
    assert.match(migration,/integrity_case_collaborators/);
    assert.match(migration,/private\.can_access_integrity_case\(case_id\)/);
    assert.match(migration,/c\.owner_membership_id=m\.id[\s\S]*integrity_case_collaborators/);
    assert.match(router,/collaborators\.data[\s\S]*id\.in/);
  });
  it("records SHA-256 custody metadata on internal and reporter uploads", () => {
    assert.match(migration,/checksum_sha256/);
    assert.match(router,/createHash\("sha256"\)/);
    assert.match(publicRouter,/createHash\("sha256"\)/);
    assert.match(router,/evidence_downloaded/);
  });
  it("keeps retention explicit and never performs an automatic physical purge", () => {
    assert.match(migration,/retention_state text not null default 'active'/);
    assert.match(router,/physical_purge: false/);
    assert.doesNotMatch(router,/settings\/retention[\s\S]{0,1000}\.delete\(/);
  });
  it("keeps templates tenant-scoped and reviewable", () => {
    assert.match(migration,/create table if not exists public\.integrity_templates/);
    assert.match(migration,/integrity_templates_manage/);
    assert.match(router,/settings\/templates/);
  });
  it("persists sanitized internal notifications with recipient scoping", () => {
    assert.match(migration,/create table if not exists public\.integrity_notifications/);
    assert.match(migration,/recipient_membership_id in/);
    assert.match(router,/notifications\/:id\/read/);
  });
  it("requires explicit identity permission and opt-in for PDF", () => {
    assert.match(router,/includeIdentity && !hasPermission\(req, "integrity\.identity\.read"\)/);
    assert.match(router,/reporter_mode === "identified"/);
    assert.match(router,/cache-control", "private, no-store/);
  });
  it("does not expose individual dossier through Platform Admin", () => {
    assert.doesNotMatch(adminRouter,/dossier\.pdf|case_dossier_exported/);
    assert.match(router,/requireAny\("integrity\.dossier\.export"/);
  });
  it("leaves IntegrityModuleView as composition instead of domain implementation", () => {
    assert.ok(moduleView.split("\n").length < 100);
    for (const component of ["IntegrityDashboard","IntegrityCasesList","IntegrityCaseDetail","IntegritySettings","IntegrityNotifications"])
      assert.ok(moduleView.includes(component));
  });
});
