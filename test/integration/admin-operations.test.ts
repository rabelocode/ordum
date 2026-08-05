import test from 'node:test';
import assert from 'node:assert';
import { requirePlatformPermission, authenticateRequest, resolvePlatformContext } from '../../src/server/tenantAuth';

test('Admin Operations - tenantAuth (requirePlatformPermission)', async (t) => {
    
    // Helper to mock express req, res, next
    const createMockReq = (context: any) => ({
        platformContext: context
    });
    
    const createMockRes = () => {
        const res: any = {};
        res.status = (code: number) => {
            res.statusCode = code;
            return res;
        };
        res.json = (body: any) => {
            res.body = body;
            return res;
        };
        return res;
    };

    await t.test('single string permission - present', (t) => {
        const req = createMockReq({ permissions: ['platform.staff.manage'] });
        const res = createMockRes();
        let nextCalled = false;
        requirePlatformPermission('platform.staff.manage')(req as any, res as any, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    await t.test('single string permission - absent', (t) => {
        const req = createMockReq({ permissions: ['platform.staff.invite_sales'] });
        const res = createMockRes();
        let nextCalled = false;
        requirePlatformPermission('platform.staff.manage')(req as any, res as any, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 403);
    });

    await t.test('array with first permission present', (t) => {
        const req = createMockReq({ permissions: ['platform.staff.manage'] });
        const res = createMockRes();
        let nextCalled = false;
        requirePlatformPermission(['platform.staff.manage', 'platform.staff.invite_sales'])(req as any, res as any, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    await t.test('array with second permission present', (t) => {
        const req = createMockReq({ permissions: ['platform.staff.invite_sales'] });
        const res = createMockRes();
        let nextCalled = false;
        requirePlatformPermission(['platform.staff.manage', 'platform.staff.invite_sales'])(req as any, res as any, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    await t.test('no permissions present', (t) => {
        const req = createMockReq({ permissions: [] });
        const res = createMockRes();
        let nextCalled = false;
        requirePlatformPermission(['platform.staff.manage', 'platform.staff.invite_sales'])(req as any, res as any, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res.statusCode, 403);
    });

    await t.test('empty required array config throws', (t) => {
        assert.throws(() => {
            requirePlatformPermission([]);
        }, /requirePlatformPermission requires at least one permission/);
    });

    await t.test('missing context', (t) => {
        const req: any = {};
        const res = createMockRes();
        requirePlatformPermission('platform.staff.manage')(req, res, () => {});
        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.body.error, 'Platform authorization context is unavailable');
    });

    // We can also test more complex behavior but the core OR logic works.
});
