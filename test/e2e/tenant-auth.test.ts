import { describe, it, expect, vi } from 'vitest';
import { authenticateRequest, resolveTenantContext } from '../../src/server/tenantAuth';

// Cenário Fictício: Multi-tenant com User A / Tenant A e User B / Tenant B
// Membership: User A tem Tenant A, User B tem Tenant B

describe('E2E (Mock) - Proteção de Acesso Multi-tenant e Spoofing', () => {

  const mockSupabase = {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  };

  const reqHelper = (token: string, tenantId?: string) => ({
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
      'x-tenant-id': tenantId
    },
    get: (key: string) => key === 'x-tenant-id' ? tenantId : undefined,
  });

  const resHelper = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('A acessa A: Deve invocar next() e injetar tenantContext', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'userA' } } });
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({
        data: { id: 'membershipA', tenant_id: 'tenantA', role_id: 'r1', status: 'active', tenants: { status: 'active' } }
      })
    });
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValueOnce({ data: [] }) // permissions fake
    });

    const req = reqHelper('valid_token_A', 'tenantA') as any;
    req.supabaseAdmin = mockSupabase; // Mock injetado para teste
    
    // Auth bypass mock
    req.user = { id: 'userA' };

    const res = resHelper();
    const next = vi.fn();

    await resolveTenantContext(req, res, next);
    
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.tenantContext.tenantId).toBe('tenantA');
  });

  it('A não acessa B: Spoofing Header falha devolvendo 403 Forbidden', async () => {
    // User A calls with Tenant B in header
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({
        data: null // User A não possui membership no Tenant B
      })
    });

    const req = reqHelper('valid_token_A', 'tenantB') as any;
    req.user = { id: 'userA' };
    req.supabaseAdmin = mockSupabase;

    const res = resHelper();
    const next = vi.fn();

    await resolveTenantContext(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Forbidden') }));
    expect(next).not.toHaveBeenCalled();
  });
});
