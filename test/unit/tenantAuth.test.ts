import { describe, it } from 'node:test';
import assert from 'node:assert';
import { authenticateRequest, resolveTenantContext } from '../../src/server/tenantAuth';

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

describe('Server Tenant Middlewares Unit', () => {
  it('should block missing token in authenticateRequest', async () => {
    const req = { headers: {} } as any;
    const res: any = {};
    res.status = fnMock().mockReturnValue(res);
    res.json = fnMock().mockReturnValue(res);
    const next = fnMock();
    
    await authenticateRequest(req, res, next as any);
    assert.strictEqual(res.status.calls[0][0], 401);
  });

  it('should block absent tenant id in resolveTenantContext', async () => {
    const req = { headers: {}, body: {} } as any;
    const res: any = {};
    res.status = fnMock().mockReturnValue(res);
    res.json = fnMock().mockReturnValue(res);
    const next = fnMock();
    
    await resolveTenantContext(req, res, next as any);
    assert.strictEqual(res.status.calls[0][0], 400);
  });
});
