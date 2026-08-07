import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSandboxEnv } from '../../../src/server/billing/router';

describe('validateSandboxEnv', () => {
  it('allows NODE_ENV=production + VERCEL_ENV=preview + ASAAS_ENV=sandbox', () => {
    const result = validateSandboxEnv('production', 'preview', 'sandbox');
    assert.equal(result, true);
  });

  it('allows VERCEL_ENV=development + ASAAS_ENV=sandbox', () => {
    const result = validateSandboxEnv('production', 'development', 'sandbox');
    assert.equal(result, true);
  });

  it('blocks VERCEL_ENV=production regardless of NODE_ENV', () => {
    const result = validateSandboxEnv('development', 'production', 'sandbox');
    assert.equal(result, false);
  });

  it('blocks when ASAAS_ENV is not sandbox', () => {
    const result1 = validateSandboxEnv('development', 'preview', 'production');
    const result2 = validateSandboxEnv('development', undefined, 'production');
    assert.equal(result1, false);
    assert.equal(result2, false);
  });

  it('uses NODE_ENV when VERCEL_ENV is undefined', () => {
    assert.equal(validateSandboxEnv('development', undefined, 'sandbox'), true);
    assert.equal(validateSandboxEnv('production', undefined, 'sandbox'), false);
  });
});
