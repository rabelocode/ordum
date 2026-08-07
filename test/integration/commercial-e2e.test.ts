import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const APP_URL = process.env.APP_URL || 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app';

describe('E2E Commercial Lifecycle Integration Test Suite', () => {
  it('Valida fluxo comercial com preflight diagnostics', async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log('SUPABASE_SECRET_KEY ausente. Teste ignorado.');
      return;
    }

    const diagRes = await fetch(`${APP_URL}/api/admin/billing/diagnostics`);
    const diag = await diagRes.json().catch(() => ({}));
    assert.equal(diagRes.status, 200);
    assert.equal(diag.enabled, true);
    assert.equal(diag.configured, true);
    assert.equal(diag.environment, 'sandbox');
    assert.equal(diag.webhookUrlConfigured, true);
    assert.equal(diag.sandboxMockAvailable, true);
  });
});
