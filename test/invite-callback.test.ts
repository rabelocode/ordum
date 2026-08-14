import assert from "node:assert/strict";
import test from "node:test";
import { readInviteCallback } from "../src/lib/inviteCallbackParams";
import { inviteRedirectUrl } from "../src/server/inviteRedirect";

test("invite callback parses the standard Supabase token fragment", () => {
  const result = readInviteCallback("https://app.example/auth/invite-callback#access_token=access&refresh_token=refresh&type=invite");
  assert.equal(result.accessToken, "access");
  assert.equal(result.refreshToken, "refresh");
  assert.equal(result.isInvite, true);
});

test("invite callback remains compatible with already issued nested-hash links", () => {
  const result = readInviteCallback("https://app.example/#/auth/accept-invite#access_token=access&refresh_token=refresh&type=invite");
  assert.equal(result.accessToken, "access");
  assert.equal(result.refreshToken, "refresh");
  assert.equal(result.isInvite, true);
});

test("invite callback accepts a PKCE code without treating recovery tokens as an invite", () => {
  assert.deepEqual(readInviteCallback("https://app.example/auth/invite-callback?code=pkce").code, "pkce");
  assert.equal(readInviteCallback("https://app.example/#access_token=a&refresh_token=r&type=recovery").isInvite, false);
});

test("server invite redirect never nests an auth fragment inside the hash router", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://app.example/";
  try {
    assert.equal(inviteRedirectUrl(), "https://app.example/auth/invite-callback");
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});
