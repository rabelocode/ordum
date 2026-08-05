import { describe, it, expect, vi } from 'vitest';
import { authenticateRequest, resolveTenantContext } from '../../src/server/tenantAuth';

// TODO: Phase 2.2 - Require complete mocking of active Supabase Client injected inside server
describe('Server Tenant Middlewares', () => {
  it('should block missing token in authenticateRequest', async () => {
    const req = { headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    
    await authenticateRequest(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authorization header' });
  });

  it('should block absent tenant id in resolveTenantContext', async () => {
    const req = { headers: {}, body: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    
    await resolveTenantContext(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing tenant identification' });
  });
});
