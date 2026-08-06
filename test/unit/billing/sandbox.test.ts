import { describe, it } from 'node:test';
import assert from 'node:assert';
import { selectOnboardingTemplate, buildDeterministicSandboxEvent, validateSandboxEnv, executeProposalItemsRollback, executeContractItemsRollback } from '../../../src/server/billing/router.js';

const mockDb = {
  from: function() { return this; },
  select: function() { return this; },
  insert: async function(payload: any) { 
     // simulate audit logs being pushed
     return { data: payload, error: null };
  },
  update: function() { return this; },
  delete: function() { return this; },
  eq: async function() { return { data: { success: true }, error: null }; },
  upsert: function() { return this; },
  order: function() { return this; },
  rpc: async () => ({ data: 'rpc_success', error: null }),
  maybeSingle: async () => ({ data: null, error: null }),
  single: async () => ({ data: {}, error: null })
};

describe('Billing Sandbox & Stabilization - Pure Functions Unit Tests', () => {

  describe('Sandbox Webhook Idempotency & ProcessStoredEvent', () => {
    it('Deve rejeitar evento não suportado (ex: RANDOM_UNSUPPORTED)', async () => {
      const { processStoredEvent } = await import('../../../src/server/billing/router.js');
      const status = await processStoredEvent(mockDb as any, { event_type: 'RANDOM', payload: {} });
      assert.strictEqual(status, 'ignored');
    });

    it('Deve rejeitar payload ausente ou sem payment (Missing payload)', async () => {
      const { processStoredEvent } = await import('../../../src/server/billing/router.js');
      const status = await processStoredEvent(mockDb as any, { event_type: 'PAYMENT_CONFIRMED', payload: {} });
      assert.strictEqual(status, 'ignored');
    });
  });

  describe('Billing Helpers: Environment and Deterministic Payloads', () => {
    it('validateSandboxEnv: deve bloquear acessos indevidos', () => {
       assert.strictEqual(validateSandboxEnv('production', undefined, 'sandbox'), false);
       assert.strictEqual(validateSandboxEnv(undefined, 'production', 'sandbox'), false);
       assert.strictEqual(validateSandboxEnv(undefined, undefined, 'production'), false);
       assert.strictEqual(validateSandboxEnv(undefined, undefined, 'sandbox'), true);
    });

    it('buildDeterministicSandboxEvent: deve gerar chaves mock:<id>', () => {
       const sub = { provider_customer_id: 'cus_1', provider_subscription_id: 'sub_1' };
       const result = buildDeterministicSandboxEvent('ctr_1', 10000, 'ext_ref_1', sub);
       assert.strictEqual(result.fakePaymentId, 'mock:payment:ctr_1');
       assert.strictEqual(result.fakeEventId, 'mock:event:payment_confirmed:ctr_1');
       assert.strictEqual(result.fakePayload.payment.value, 100);
    });
  });

  describe('Billing Helpers: Template Selector', () => {
     it('selectOnboardingTemplate: deve respeitar precedencia plan+solution, plan_only, solution_only, generic', () => {
        const templates = [
           { id: '1', plan_id: null, solution_id: null },
           { id: '2', plan_id: 'plan_A', solution_id: null },
           { id: '3', plan_id: 'plan_A', solution_id: 'sol_X' },
           { id: '4', plan_id: null, solution_id: 'sol_X' }
        ];

        // 1. fallbacks genéricos
        assert.strictEqual(selectOnboardingTemplate(templates, 'plan_B', []).id, '1');
        
        // 2. plan match, sem solution (retorna plan_only template id=2)
        assert.strictEqual(selectOnboardingTemplate(templates, 'plan_A', []).id, '2');
        assert.strictEqual(selectOnboardingTemplate(templates, 'plan_A', ['sol_Y']).id, '2');
        
        // 3. plan+solution match
        assert.strictEqual(selectOnboardingTemplate(templates, 'plan_A', ['sol_X']).id, '3');
        
        // 4. solution_only (nao macha o plan_A com sol_X pois já retornaria plan_A+sol_X.. entao testa plan_C)
        assert.strictEqual(selectOnboardingTemplate(templates, 'plan_C', ['sol_X']).id, '4');
     });
  });

  describe('Billing Helpers: Rollbacks', () => {
     it('executeProposalItemsRollback: delete falhando emite erro de inconsistencia', async () => {
        const brokenDb = { ...mockDb, 
           delete: function() { return this; },
           eq: async function() { return { data: null, error: new Error('Cannot delete') }; }
        };
        const result = await executeProposalItemsRollback(brokenDb as any, { id: 'u1' }, 'prop_1', 'Items missing');
        assert.strictEqual(result.status, 500);
        assert.match(result.error, /Incoerência crítica/);
     });

     it('executeContractItemsRollback: delete bem sucedido repassa erro dos itens', async () => {
        const result = await executeContractItemsRollback(mockDb as any, { id: 'u1' }, 'ctr_1', 'Failed insert limit');
        assert.strictEqual(result.status, 500);
        assert.strictEqual(result.error, 'Failed insert limit');
     });
  });

});
