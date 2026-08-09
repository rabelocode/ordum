import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('commercial live E2E', () => {
  it('executes the real lifecycle without false positives', async (t) => {
    if (process.env.RUN_LIVE_E2E !== '1') {
      t.skip('Set RUN_LIVE_E2E=1 and use npm run test:commercial-e2e.');
      return;
    }
    for (const name of ['SUPABASE_SECRET_KEY', 'E2E_OPERATOR_EMAIL', 'E2E_OPERATOR_PASSWORD', 'ASAAS_API_KEY']) {
      assert.ok(process.env[name], `${name} is required when RUN_LIVE_E2E=1`);
    }
    const { runCommercialE2E } = await import('../../scripts/run-e2e.js');
    const evidence = await runCommercialE2E();
    assert.equal(evidence.diagnosticsHttp, 200);
    assert.equal(evidence.billingConfigured, true);
    assert.equal(evidence.cleanupLocal, true);
    assert.equal(evidence.cleanupRemote, true);
    assert.equal(evidence.authResidual, 0);
    assert.equal(evidence.platformMemberResidual, 0);
  });
});
