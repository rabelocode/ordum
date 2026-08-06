import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { 
  acceptCommercialProposalCore, 
  createContractFromProposalCore, 
  mockSandboxPaymentCore,
  selectOnboardingTemplate, 
  buildDeterministicSandboxEvent, 
  validateSandboxEnv, 
  executeProposalItemsRollback, 
  executeContractItemsRollback,
  processStoredEvent
} from '../../../src/server/billing/router.js';

const mockDb: any = {
  from: function() { return this; },
  select: function() { return this; },
  insert: async function(payload: any) { return { data: payload, error: null }; },
  update: function() { return this; },
  delete: function() { return this; },
  eq: async function() { return { data: { success: true }, error: null }; },
  upsert: function() { return this; },
  order: function() { 
      const self = this;
      return Object.assign(Promise.resolve({ data: [{ id: 'mock_template', plan_id: 'p1', solution_id: null, version: 1 }], error: null }), self);
  },
  in: function() { return this; },
  auth: { admin: { 
      listUsers: async () => ({ data: { users: [{ id: 'owner_user_1', email: 'mock@mock.com' }] }, error: null }),
      inviteUserByEmail: async () => ({ data: { user: { id: 'invited_user_1' } }, error: null })
  }},
  rpc: async (...args: any[]) => ({ data: 'rpc_success', error: null }),
  maybeSingle: async () => ({ data: null, error: null }),
  single: async () => ({ data: {}, error: null })
};

describe('Billing Sandbox & Lifecycle - Exhaustive Core Tests', () => {

    describe('Environment & Determinism Helpers', () => {
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

    describe('Template Selector Precedence', () => {
        it('selectOnboardingTemplate: deve respeitar precedencia plan+solution, plan_only, solution_only, generic e ignorar solution não contratada', () => {
            const templates = [
               { id: '1', plan_id: null, solution_id: null },
               { id: '2', plan_id: 'plan_A', solution_id: null },
               { id: '3', plan_id: 'plan_A', solution_id: 'sol_X' }
            ];
            assert.strictEqual(selectOnboardingTemplate(templates, 'plan_B', []).id, '1');
            assert.strictEqual(selectOnboardingTemplate(templates, 'plan_A', []).id, '2');
            assert.strictEqual(selectOnboardingTemplate(templates, 'plan_A', ['sol_Y']).id, '2'); // sol_Y errada, fallback para plan_only
            assert.strictEqual(selectOnboardingTemplate(templates, 'plan_A', ['sol_X']).id, '3');
        });
    });

    describe('Rollbacks & Atomicity', () => {
        it('executeProposalItemsRollback: delete falhando emite erro de inconsistencia 500', async () => {
            const brokenDb = { ...mockDb, delete: function() { return this; }, eq: async function() { return { data: null, error: new Error('Cannot delete') }; } };
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

    describe('Lifecycle: POST /commercial/contracts/:id/mock-sandbox-payment', () => {
      let origEnv: any;
      before(() => { origEnv = { ...process.env }; });
      after(() => { process.env = origEnv; });

      it('bloqueio por NODE_ENV=production', async () => {
         process.env.NODE_ENV = 'production';
         let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
         await mockSandboxPaymentCore({} as any, res, null, null);
         assert.strictEqual(resCode, 403);
      });
      it('bloqueio por VERCEL_ENV=production', async () => {
         process.env.NODE_ENV = 'development'; process.env.VERCEL_ENV = 'production';
         let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
         await mockSandboxPaymentCore({} as any, res, null, null);
         assert.strictEqual(resCode, 403);
      });
      it('bloqueio quando ASAAS_ENV !== sandbox', async () => {
         process.env.NODE_ENV = 'development'; process.env.VERCEL_ENV = 'development'; process.env.ASAAS_ENV = 'production';
         let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
         await mockSandboxPaymentCore({} as any, res, null, null);
         assert.strictEqual(resCode, 403);
      });

      describe('Com ambiente sandbox permitido', () => {
          beforeEach(() => {
              process.env.NODE_ENV = 'development'; process.env.VERCEL_ENV = ''; process.env.ASAAS_ENV = 'sandbox';
          });
          it('contrato fora do escopo ou inexistente', async () => {
             const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) };
             let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
             await mockSandboxPaymentCore({ params: { id: '1' } } as any, res, db, null);
             assert.strictEqual(resCode, 400); 
          });
          it('contrato fora de pending_payment retorna 400', async () => {
             const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { status: 'approved' } }) }) }) }) };
             let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
             await mockSandboxPaymentCore({ params: { id: '1' } } as any, res, db, null);
             assert.strictEqual(resCode, 400);
          });
          it('subscription ausente', async () => {
             const db = { from: (table: string) => ({
                select: () => ({ eq: () => ({ 
                   single: async () => ({ data: { id: 'c1', status: 'pending_payment' } }),
                   maybeSingle: async () => ({ data: null })
                }) })
             }) };
             let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
             const req = { params: { id: '1' }, platformContext: { role: { key: 'admin' } } };
             await mockSandboxPaymentCore(req, res, db, null);
             assert.strictEqual(resCode, 400); 
          });
          
          it('criação do evento determinístico, auditorias (processed/reused) e erro no processamento 500', async () => {
             let updatePayload = null; let insertPayloads: any[] = [];
             const db = { from: (table: string) => ({
                select: () => ({ eq: () => ({ 
                   single: async () => ({ data: table === 'commercial_contracts' ? { id: 'c1', status: 'pending_payment' } : { id: 'e1' } }),
                   maybeSingle: async () => ({ data: table === 'billing_subscriptions' ? { id: 'sub1' } : { id: 'evt1', status: 'pending'} })
                }) }),
                update: (payload: any) => { updatePayload = payload; return { eq: async() => {} }; },
                insert: (payload: any) => { insertPayloads.push({table, payload}); return { select: () => ({ single: async () => ({ data: { id: 'e1' } })})}; }
             }) };
             const pStored = async () => { throw new Error('Falha processamento manual'); };
             let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
             const req = { params: { id: '1' }, platformContext: { role: { key: 'admin' } } };
             
             await mockSandboxPaymentCore(req, res, db, pStored);
             assert.strictEqual(resCode, 500); 
             assert.strictEqual((updatePayload as any)?.status, 'failed');
             assert.ok(insertPayloads.find(p => p.table === 'platform_audit_logs' && p.payload.action === 'billing.sandbox_payment.failed'));
             
             insertPayloads = []; 
             const pStoredOk = async (d: any, e: any) => { return 'processed'; };
             const reusingDb = { ...db, from: (table: string) => ({
                 ...db.from(table),
                 select: () => ({ eq: () => ({ 
                    single: async () => ({ data: table === 'commercial_contracts' ? { id: 'c1', status: 'pending_payment' } : { id: 'e1' } }),
                    maybeSingle: async () => ({ data: table === 'billing_subscriptions' ? { id: 'sub1' } : { id: 'evt1', status: 'processed'} })
                 }) }),
             })};
             
             let resCode2 = 200; const res2 = { status: (c: number) => { resCode2 = c; return res2; }, json: () => {} };
             await mockSandboxPaymentCore(req, res2, reusingDb as any, pStoredOk);
             assert.strictEqual(resCode2, 200);
             assert.ok(insertPayloads.find(p => p.table === 'platform_audit_logs' && p.payload.action === 'billing.sandbox_payment.reused'));
          });
      });
    });

    describe('Service Real de Onboarding (processStoredEvent)', () => {
        it('Rejeita payloads que nao sejam PAYMENTS_CONFIRMED', async () => {
             const result = await processStoredEvent(mockDb as any, { event_type: 'RANDOM', payload: {} });
             assert.strictEqual(result, 'ignored');
        });
        
        it('Payload sem payment retorna ignored', async () => {
             const result = await processStoredEvent(mockDb as any, { event_type: 'PAYMENT_CONFIRMED', payload: {} });
             assert.strictEqual(result, 'ignored');
        });
        
        it('run existente impede nova RPC, mas atualiza state', async () => {
             const specialDb: any = { ...mockDb, from: (table: string) => ({
                 ...mockDb.from(),
                     eq: function() { return { 
                         maybeSingle: async () => {
                             if (table === 'onboarding_runs') return { data: { id: 'run1' } };
                             if (table === 'billing_subscriptions') return { data: { contract_id: 'c1', commercial_contracts: { id: 'c1', plan_id: 'p1', owner_email: 'mock@mock.com' } } };
                             return { data: null };
                         },
                         order: function() { const s = this; return Object.assign(Promise.resolve({data:[{id:'mock_template',plan_id:'p1'}],error:null}),s); },
                         in: () => ({ select: () => ({}) }),
                         eq: function() { return this; }
                     } },
                 upsert: () => ({ select: () => ({ single: async () => ({ data: { id: 'pay1' } }) }) })
             })};
             let rpcCalled = false;
             specialDb.rpc = async (name: string) => { if(name === 'admin_start_onboarding') rpcCalled = true; return { data: null, error: null }; }
             
             const payload = { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay1', confirmationDate: '2023-01-01', subscription: 'sub1', value: 100 } };
             const result = await processStoredEvent(specialDb as any, { event_type: 'PAYMENT_CONFIRMED', payload });
             assert.strictEqual(result, 'processed');
             assert.strictEqual(rpcCalled, false);
        });

        it('admin_start_onboarding recebe p_owner_platform_member_id e erro propagate', async () => {
             const theDb: any = { ...mockDb, from: (table: string) => ({
                 ...mockDb.from(),
                 select: () => ({ eq: function() { return { 
                    maybeSingle: async () => {
                         if(table === 'billing_subscriptions') return { data: { contract_id: 'c1', commercial_contracts: { id: 'c1', owner_platform_member_id: 'owner1', plan_id: 'p1', amount_cents: 100, owner_email: 'mock@mock.com' } } };
                         if(table === 'onboarding_runs') return { data: null };
                         return { data: null };
                    },
                    order: function() { const s = this; return Object.assign(Promise.resolve({data:[{id:'mock_template',plan_id:'p1'}],error:null}),s); },
                    in: () => ({
                         select: () => ({ maybeSingle: async () => ({ data: null }) })
                    }),
                    eq: function() { return this; }
                 } } }),
                 upsert: () => ({ select: () => ({ single: async () => ({ data: { id: 'pay1' } }) }) })
             })};
             
             let passedMemberId: any = null;
             theDb.rpc = async (name: string, p: any) => {
                 if (name === 'admin_start_onboarding') {
                     passedMemberId = p.p_owner_platform_member_id;
                     return { data: null, error: new Error('RPC_CRASH') };
                 }
                 if (name === 'provision_paid_contract') {
                     return { data: 'tenant1', error: null };
                 }
                 return { data: null, error: null };
             };
             
             try {
                 const payload = { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay1', confirmationDate: '2023-01-01', subscription: 'sub1', value: 100 } };
                 await processStoredEvent(theDb as any, { event_type: 'PAYMENT_CONFIRMED', payload });
                 assert.fail('Deveria propagar o erro');
             } catch (e: any) {
                 assert.strictEqual(passedMemberId, 'owner1');
                 assert.match(e.message, /RPC_CRASH/); // Error propagate tested
             }
        });
    });

    describe('Lifecycle Comercial - Proposals e Contracts', () => {
        it('proposta não aprovada não pode ser aceita / gerar contrato', async () => {
            const dbRef = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'draft' } }), single: async () => ({ data: { status: 'draft' } }) }) }) }) };
            let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
            
            await acceptCommercialProposalCore({ params: { id: 'p1'} } as any, res, dbRef);
            assert.strictEqual(resCode, 400);            

            await createContractFromProposalCore({ params: { id: 'p1'} } as any, res, dbRef, null);
            assert.strictEqual(resCode, 409); 
        });
        
        it('proposta expirada é bloqueada de aceite', async () => {
            const dbRef = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'approved', valid_until: '2020-01-01T00:00:00Z' } }) }) }) }) };
            let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
            await acceptCommercialProposalCore({ params: { id: 'p1'} } as any, res, dbRef);
            assert.strictEqual(resCode, 400);            
        });
        
        it('proposta rejeitada ou superseded bloqueada', async () => {
            const dbRef = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'rejected' } }) }) }) }) };
            let resCode = 0; const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
            await acceptCommercialProposalCore({ params: { id: 'p1'} } as any, res, dbRef);
            assert.strictEqual(resCode, 400);            
        });
        
        it('aceite repetido é idempotente', async () => {
            const dbRef = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'accepted' } }) }) }) }) };
            let resCode = 200; let jsonResponse: any; 
            const res = { status: (c: number) => { resCode = c; return res; }, json: (v: any) => { jsonResponse = v; } };
            await acceptCommercialProposalCore({ params: { id: 'p1'} } as any, res, dbRef);
            assert.strictEqual(jsonResponse.message, 'Proposta já aceita.');         
            assert.strictEqual(resCode, 200);   
        });

        it('geração de contrato não altera status da proposta para accepted', async () => {
            let triedToUpdate = false;
            const customDb: any = { ...mockDb, from: (table: string) => ({
                 ...mockDb.from(),
                 select: () => ({ eq: () => ({ single: async () => ({ data: { status: 'approved' } }) }) }),
                 insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'c1' } }) }) }),
                 update: (payload: any) => { if(table==='commercial_proposals' && payload?.status === 'accepted') triedToUpdate = true; return mockDb; }
            })};
            
            let resCode = 0; 
            const res = { status: (c: number) => { resCode = c; return res; }, json: () => {} };
            await createContractFromProposalCore({ params: { id: 'p1'} } as any, res, customDb, () => {});
            assert.strictEqual(triedToUpdate, false); 
            assert.strictEqual(resCode, 201);
        });

        it('segundo contrato para a mesma proposta retorna 409', async () => {
            const errDb = { from: () => ({ 
                select: () => ({ eq: () => ({ single: async () => ({ data: { status: 'approved' } }) }) }),
                insert: () => ({ select: () => ({ single: async () => ({ error: { code: '23505' } }) }) }) 
            }) };
            let resCode = 0; let jsonResponse: any;
            const res = { status: (c: number) => { resCode = c; return res; }, json: (b: any) => { jsonResponse = b; } };
            await createContractFromProposalCore({ params: { id: 'p1'} } as any, res, errDb, null);
            assert.strictEqual(resCode, 409);        
            assert.match(jsonResponse.error, /Esta proposta já possui /);    
        });
    });
});
