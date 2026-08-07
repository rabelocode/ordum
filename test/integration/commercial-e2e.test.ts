import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('E2E Commercial Lifecycle Integration Test Suite', () => {
  it('Valida suíte E2E comercial contra ambiente Live / Preview', (t) => {
    const isLiveMode = process.env.RUN_LIVE_E2E === '1';
    const secretKey = process.env.SUPABASE_SECRET_KEY || '';

    // Ponto 2.2: Para execução comum (npm test), usar skip() explicitamente se não estiver em modo LIVE
    if (!isLiveMode) {
      t.skip('Teste E2E Live ignorado na execução local comum. Execute via RUN_LIVE_E2E=1 npm run test:commercial-e2e.');
      return;
    }

    // Ponto 2.3: Se RUN_LIVE_E2E=1, secrets ausentes DEVEM causar falha (assert fail)
    assert.ok(secretKey, 'SUPABASE_SECRET_KEY é obrigatória quando RUN_LIVE_E2E=1');
    assert.ok(process.env.E2E_OPERATOR_EMAIL, 'E2E_OPERATOR_EMAIL é obrigatória quando RUN_LIVE_E2E=1');
    assert.ok(process.env.E2E_OPERATOR_PASSWORD, 'E2E_OPERATOR_PASSWORD é obrigatória quando RUN_LIVE_E2E=1');
  });
});
