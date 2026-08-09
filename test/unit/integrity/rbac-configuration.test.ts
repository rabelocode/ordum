import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260809162824_integrity_rbac_and_configuration_lifecycle.sql", "utf8");
const hardening = fs.readFileSync("supabase/migrations/20260809163845_private_integrity_case_scope_helper.sql", "utf8");
const router = fs.readFileSync("src/server/integrityRouter.ts", "utf8");
const workspace = [
  fs.readFileSync("src/components/workspace/IntegrityModuleView.tsx", "utf8"),
  fs.readFileSync("src/components/workspace/integrity/IntegrityCaseDetail.tsx", "utf8"),
  fs.readFileSync("src/components/workspace/integrity/useIntegrityCasePermissions.ts", "utf8"),
].join("\n");

describe("Ordum Integridade Phase 4D", () => {
  it("scopes investigators to current ownership or active committee membership", () => {
    assert.match(migration, /c\.owner_membership_id=m\.id/);
    assert.match(migration, /cm\.committee_id=c\.committee_id/);
    assert.match(router, /owner_membership_id\.eq/);
    assert.match(router, /committee_id\.in/);
  });
  it("keeps identity behind an explicit permission and case scope", () => {
    assert.match(migration, /integrity\.identity\.read/);
    assert.match(migration, /can_access_integrity_case\(c\.id\)/);
    assert.match(router, /cases\/:id\/identity/);
  });
  it("keeps the assigned-case SECURITY DEFINER helper outside the exposed schema", () => {
    assert.match(hardening, /set schema private/);
    assert.match(hardening, /revoke all on function private\.can_access_integrity_case\(uuid\) from public, anon/);
  });
  it("separates investigation, notes, recommendation, close and reopen permissions", () => {
    for (const permission of ["integrity.cases.investigate", "integrity.notes.create", "integrity.cases.recommend", "integrity.cases.close", "integrity.cases.reopen"])
      assert.ok(migration.includes(permission));
  });
  it("provisions investigator and compliance roles without platform privilege", () => {
    assert.match(migration, /integrity_investigator/);
    assert.match(migration, /integrity_compliance/);
    assert.doesNotMatch(migration, /platform_role_permissions/);
  });
  it("supports committee and routing lifecycle without destructive deletes", () => {
    assert.match(router, /settings\/committees\/:id/);
    assert.match(router, /settings\/routing\/:id/);
    assert.match(router, /possui.*caso\(s\) ativo\(s\)/);
    assert.doesNotMatch(router, /from\("integrity_committees"\)\.delete/);
  });
  it("previews routing and detects equal-priority conflicts", () => {
    assert.match(router, /settings\/routing\/preview/);
    assert.match(router, /deterministic: conflicts\.length === 0/);
    assert.match(migration, /integrity_routing_single_fallback_idx/);
  });
  it("returns a real operational checklist", () => {
    assert.match(router, /configuration_status/);
    for (const item of ["texts", "channel", "mode", "categories", "committee", "routing", "sla"])
      assert.ok(router.includes(`key: "${item}"`));
  });
  it("hides unauthorized CTAs in the case workspace", () => {
    for (const flag of ["canInvestigate", "canWriteNote", "canSendMessage", "canClose", "canReopen", "canRecommend", "canReadIdentity"])
      assert.ok(workspace.includes(flag));
  });
});
