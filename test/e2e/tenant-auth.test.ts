import { describe, it } from 'node:test';
import assert from 'node:assert';
import { authenticateRequest, resolveTenantContext, requireTenantPermission, requireTenantSolution, resolvePlatformContext, requirePlatformPermission } from '../../src/server/tenantAuth';

describe('Tenant and Platform Middlewares', () => {

  const fnMock = (): any => {
     const calls: any[] = [];
     const f = function(...args: any[]) {
         calls.push(args);
         return (f as any)._ret;
     };
     f.mockReturnValue = (v: any) => { (f as any)._ret = v; return f; };
     f.mockResolvedValue = (v: any) => { (f as any)._ret = Promise.resolve(v); return f; };
     f.mockReturnThis = () => { (f as any)._ret = f; return f; };
     f.calls = calls;
     return f;
  };

  const reqHelper = (token?: string, tenantId?: string, authUserId?: string) => {
    const req: any = {
      headers: {
        authorization: token ? `Bearer ${token}` : undefined,
        'x-tenant-id': tenantId
      },
      body: {}
    };
    if (authUserId) req.user = { id: authUserId };
    return req;
  };

  const resHelper = () => {
    const res: any = {};
    res.status = fnMock().mockReturnValue(res);
    res.json = fnMock().mockReturnValue(res);
    return res;
  };

  describe('authenticateRequest', () => {
    it('Token ausente deve retornar 401', async () => {
      const req = reqHelper();
      const res = resHelper();
      const next = fnMock();
      await authenticateRequest(req as any, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 401);
    });

    it('Token inválido deve retornar 401', async () => {
      const req = reqHelper('invalid');
      req.supabaseAdmin = { auth: { getUser: fnMock().mockResolvedValue({ data: { user: null }, error: new Error('bad token') }) } };
      const res = resHelper();
      const next = fnMock();
      await authenticateRequest(req as any, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 401);
    });
  });

  const makeChain = (finalRet: any) => {
      const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          maybeSingle: async () => finalRet,
          single: async () => finalRet,
      };
      return chain;
  };

  describe('resolveTenantContext', () => {
    it('Tenant ausente deve retornar 400', async () => {
      const req = reqHelper('token', undefined, 'userA');
      const res = resHelper();
      const next = fnMock();
      await resolveTenantContext(req as any, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 400);
    });

    it('Membership inexistente falha com 403', async () => {
      const req = reqHelper('token', 'tenantA', 'userA');
      const dbFrom = fnMock().mockReturnValue(makeChain({ data: null }));
      req.supabaseAdmin = { from: dbFrom };
      
      const res = resHelper();
      const next = fnMock();
      await resolveTenantContext(req as any, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 403);
    });

    it('Tenant A acessando A injeta contexto via next', async () => {
      const req = reqHelper('token', 'tenantA', 'userA');
      const mockSupabase = { 
        from: (table: string) => {
          if (table === 'memberships') return makeChain({ data: { id: 'm1', tenants: { status: 'active' } } });
          if (table === 'membership_roles') return makeChain({ data: [] });
          if (table === 'tenant_solutions') return makeChain({ data: [] });
          return makeChain({ data: [] });
        }
      };
      req.supabaseAdmin = mockSupabase;
      const res = resHelper();
      const next = fnMock();
      await resolveTenantContext(req as any, res as any, next as any);
      assert.strictEqual(next.calls.length, 1);
      assert.strictEqual(req.tenantContext.membership.id, 'm1');
    });

    it('Tenant A tentando acessar Tenant B devolve 403', async () => {
      const req = reqHelper('token', 'tenantB', 'userA');
      const dbFrom = fnMock().mockReturnValue(makeChain({ data: null }));
      req.supabaseAdmin = { from: dbFrom };
      const res = resHelper();
      const next = fnMock();
      await resolveTenantContext(req as any, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 403);
    });
  });

  describe('Guards', () => {
    it('RequireTenantPermission - Permission ausente devolve 403', () => {
      const req: any = { tenantContext: { permissions: ['other-permission'] } };
      const res = resHelper();
      const next = fnMock();
      requireTenantPermission('required-permission')(req, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 403);
    });

    it('RequireTenantSolution - Solution inativa devolve 403', () => {
      const req: any = { tenantContext: { solutions: [] } };
      const res = resHelper();
      const next = fnMock();
      requireTenantSolution('people')(req, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 403);
    });

    it('RequirePlatformPermission - Platform member sem permission devolve 403', () => {
      const req: any = { platformContext: { permissions: [], role: { key: 'manager' } } };
      const res = resHelper();
      const next = fnMock();
      requirePlatformPermission('platform.settings.write')(req, res as any, next as any);
      assert.strictEqual(res.status.calls[0][0], 403);
    });
  });
});
