import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) throw new Error("Missing server-side Supabase credentials");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

export const authenticateRequest = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    const token = authHeader.replace("Bearer ", "");
    try {
        const db = getSupabaseAdmin();
        const { data: { user }, error: authErr } = await db.auth.getUser(token);
        
        if (authErr || !user) return res.status(401).json({ error: "Invalid or expired session" });

        (req as any).user = user;
        next();
    } catch (e: any) {
        return res.status(500).json({ error: "Authentication system error" });
    }
};

export const resolveTenantContext = async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.headers['x-tenant-id'] || req.body.tenant_id;
    if (!tenantId) {
        return res.status(400).json({ error: "Missing tenant identification" });
    }

    try {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: "Authentication required before tenant resolution" });

        const db = getSupabaseAdmin();
        
        const { data: membership } = await db
            .from('memberships')
            .select('*, tenants(*)')
            .eq('user_id', user.id)
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .single();

        if (!membership) {
            return res.status(403).json({ error: "Forbidden: No active membership in this tenant" });
        }

        const { data: roleRefs } = await db
            .from('membership_roles')
            .select('role_id')
            .eq('membership_id', membership.id);

        let roles: any[] = [];
        let permissions: string[] = [];

        if (roleRefs && roleRefs.length > 0) {
            const roleIds = roleRefs.map((r: any) => r.role_id);
            const { data: rolesData } = await db.from('roles').select('id, key').in('id', roleIds);
            if (rolesData) roles = rolesData;

            const { data: pRefs } = await db.from('role_permissions').select('permission_id').in('role_id', roleIds);
            if (pRefs && pRefs.length > 0) {
                const { data: pData } = await db.from('permissions').select('key').in('id', pRefs.map((p: any) => p.permission_id));
                if (pData) permissions = pData.map((p: any) => p.key);
            }
        }

        const { data: sRefs } = await db.from('tenant_solutions').select('solution_id').eq('tenant_id', tenantId).eq('status', 'active');
        let solutions: string[] = [];
        if (sRefs && sRefs.length > 0) {
            const sIds = sRefs.map((s: any) => s.solution_id);
            const { data: sData } = await db.from('solutions').select('key').in('id', sIds);
            if (sData) solutions = sData.map((s: any) => s.key);
        }

        (req as any).tenantContext = {
            membership,
            tenant: membership.tenants,
            roles,
            permissions,
            solutions
        };

        next();
    } catch (e: any) {
        return res.status(500).json({ error: "Tenant resolution error" });
    }
};

export const requireTenantPermission = (requiredPermission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const context = (req as any).tenantContext;
        if (!context) return res.status(500).json({ error: "Missing tenant context" });

        if (!context.permissions.includes(requiredPermission)) {
            return res.status(403).json({ error: `Forbidden: requires permission ${requiredPermission}` });
        }
        next();
    };
};

export const requireTenantSolution = (requiredSolution: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const context = (req as any).tenantContext;
        if (!context) return res.status(500).json({ error: "Missing tenant context" });

        if (!context.solutions.includes(requiredSolution)) {
            return res.status(403).json({ error: `Forbidden: requires active solution ${requiredSolution}` });
        }
        next();
    };
};
