import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { createIntegrityRouter } from '../../../src/server/integrityRouter';

describe('Integrity Cases Phase 4A - Core API Tests (Supertest)', () => {

  const getApp = (mockDb: any, mockContext?: any) => {
      const app = express();
      app.use(express.json());
      
      const auth = {
          authenticateRequest: (req: any, res: any, next: any) => {
              req.user = { id: 'u1' }; 
              next();
          },
          resolveTenantContext: (req: any, res: any, next: any) => {
              req.tenantContext = mockContext || {
                  tenant: { id: 't1', status: 'active' },
                  membership: { id: 'mem1', status: 'active' },
                  permissions: ['integrity.cases.read', 'integrity.cases.manage'],
                  solutions: ['integrity']
              };
              next();
          },
          requireTenantSolution: (solution: string) => {
              return (req: any, res: any, next: any) => {
                  if (!req.tenantContext.solutions.includes(solution)) {
                      return res.status(403).json({ error: 'Forbidden: requires active solution' });
                  }
                  next();
              };
          },
          requireTenantPermission: (permission: string) => {
              return (req: any, res: any, next: any) => {
                  if (!req.tenantContext.permissions.includes(permission)) {
                      return res.status(403).json({ error: 'requires permission' });
                  }
                  next();
              };
          }
      };

      app.use('/api', createIntegrityRouter(() => mockDb, auth));
      return app;
  };

  it('bloqueia operação se usuário não tiver permissão', async () => {
      const mockContext = {
          tenant: { id: 't1', status: 'active' },
          membership: { id: 'mem1', status: 'active' },
          permissions: [], // NO PERMS
          solutions: ['integrity']
      };
      
      const app = getApp({}, mockContext);
      
      const res = await request(app).get('/api/cases');
      assert.strictEqual(res.statusCode, 403);
      assert.match(res.body.error || '', /requires permission/);
  });

  it('bloqueia acesso se a solução integrity estiver ausente do tenant', async () => {
      const mockContext = {
          tenant: { id: 't1', status: 'active' },
          membership: { id: 'mem1', status: 'active' },
          permissions: ['integrity.cases.read'], 
          solutions: ['other_solution'] // NO INTEGRITY
      };
      
      const app = getApp({}, mockContext);
      const res = await request(app).get('/api/cases');
      assert.strictEqual(res.statusCode, 403);
      assert.match(res.body.error || '', /requires active solution/);
  });

  it('cria auditoria ao transicionar status (mudança válida de status)', async () => {
      let insertCalled = false;
      const mockDb = {
          from: (table: string) => ({
              select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'c1', status: 'received' }, error: null }) }) }) }),
              update: () => ({ eq: async () => ({ error: null }) }),
              insert: async (p: any) => { 
                  if (table === 'integrity_case_events') insertCalled = true; 
                  return { error: null }; 
              }
          })
      };
      
      const app = getApp(mockDb);
      const res = await request(app)
        .post('/api/cases/c1/events')
        .send({ action: 'triage', note: 'Triagem inicial' });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'triage');
      assert.strictEqual(insertCalled, true);
  });

  it('recusa mudança de status inválido', async () => {
      const mockDb = {
          from: (table: string) => ({
              select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'c1', status: 'received' }, error: null }) }) }) }),
          })
      };
      
      const app = getApp(mockDb);
      const res = await request(app)
          .post('/api/cases/c1/events')
          .send({ action: 'fake_status', note: '' });
          
      assert.strictEqual(res.statusCode, 400); 
  });
  
  it('bloqueia assignment duplicado garantindo idempotência e validando rules', async () => {
      let inserts = 0;
      const mockDb = {
          from: (table: string) => ({
              select: () => ({ 
                  eq: () => ({ 
                      eq: () => ({ 
                          maybeSingle: async () => {
                              if (table === 'integrity_reports') return { data: { id: 'c1' } };
                              if (table === 'memberships') return { data: { id: 'mem2', status: 'active' } };
                              if (table === 'integrity_case_assignments') return { data: { membership_id: 'mem2' } };
                              return { data: null };
                          }
                      }) 
                  }) 
              }),
              insert: async () => { inserts++; return { error: null }; }
          })
      };
      
      const app = getApp(mockDb);
      const res = await request(app)
        .post('/api/cases/c1/assignments')
        .send({ membershipId: 'ba2beaca-35bc-440a-9d22-11c75908235e' });
        
      assert.strictEqual(res.statusCode, 200); 
      assert.strictEqual(inserts, 0); // is idempotent
  });

  it('ignora payloads com tenant_id adulterado em endpoints restritos', async () => {
      let querySpiedTenant = '';
      const mockDb = {
          from: (table: string) => ({
              select: () => ({ 
                  eq: (key: string, val: any) => { 
                      if (key === 'tenant_id') querySpiedTenant = val; 
                      return { 
                          order: async () => ({ data: [], error: null }),
                          eq: () => ({ maybeSingle: async () => ({ data: null }) })
                      };
                  }
              })
          })
      };
      
      const app = getApp(mockDb);
      const res = await request(app)
        .get('/api/cases?tenant_id=hacked_t2'); 
        
      assert.strictEqual(res.statusCode, 200); 
      assert.strictEqual(querySpiedTenant, 't1'); 
  });
  
  it('registra chat anônimo publicamente visível com permissão', async () => {
      let inserts = 0;
      let payloadPassed: any = {};
      const mockDb = {
          from: (table: string) => ({
              select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'c1', status: 'received' }, error: null }) }) }) }),
              insert: async (payload: any) => { 
                  inserts++; 
                  if (table === 'integrity_report_messages') payloadPassed = payload;
                  return { error: null }; 
              }
          })
      };
      
      const app = getApp(mockDb);
      const res = await request(app)
        .post('/api/cases/c1/messages')
        .send({ body: 'Vamos analisar em breve', visible_to_reporter: true });
        
      assert.strictEqual(res.statusCode, 200); 
      assert.strictEqual(inserts, 2); // Message + Audit Event
      assert.strictEqual(payloadPassed.visible_to_reporter, true);
      assert.strictEqual(payloadPassed.author_type, 'case_manager');
  });
});
