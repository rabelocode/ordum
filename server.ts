import express from 'express';
import path from 'path';
import { createAdminLeadsRouter } from './src/server/adminLeadsRouter';
import { createAdminClientsRouter } from './src/server/adminClientsRouter';
import { createAdminOtherRouter } from './src/server/adminOtherRouter';
import { createAdminControlPlaneRouter } from './src/server/adminControlPlaneRouter';
import { createAdminTeamsRouter } from './src/server/adminTeamsRouter';
import { createBillingRouters } from './src/server/billing/router';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { canReadAssignedResource } from './src/server/authorization';

dotenv.config({ path: ['.env.local', '.env'] });

export async function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));
  app.use(cors());
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') || randomUUID();
    (req as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  let _supabaseAdmin: any = null;
  const getSupabaseAdmin = () => {
    if (!_supabaseAdmin) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!url || !key) {
        throw new Error("Missing server-side Supabase credentials");
      }
      _supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    }
    return _supabaseAdmin;
  };

  // Simple auth middleware for API routes
  const requirePlatformAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });

      // Fetch platform member with role via direct join
      const { data: platformMember, error: memberErr } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*, platform_roles(*)')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (memberErr || !platformMember) {
        return res.status(403).json({ error: "Forbidden: Not a platform member" });
      }

      if (platformMember.status === 'suspended') {
        return res.status(403).json({ error: "Seu acesso administrativo está suspenso." });
      }

      const role = platformMember.platform_roles;

      if (!role) {
        return res.status(403).json({ error: "Forbidden: No platform role assigned" });
      }
      
      const { data: rolePerms } = await getSupabaseAdmin()
        .from('platform_role_permissions')
        .select('platform_permissions(key)')
        .eq('role_id', role.id);
        
      const permissions = (rolePerms || [])
        .map((rp: any) => rp.platform_permissions?.key)
        .filter(Boolean);

      if (!permissions.includes('platform.access') && role.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: platform.access is required' });
      }
      
      const { data: teamMemberships } = await getSupabaseAdmin()
        .from('platform_team_members')
        .select('*, platform_teams(*)')
        .eq('platform_member_id', platformMember.id)
        .eq('status', 'active');
        
      const teams = (teamMemberships || []).map((tm: any) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm: any) => tm.team_role === 'manager').map((tm: any) => tm.platform_teams);
      
      (req as any).user = user;
      (req as any).platformContext = {
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams
      };
      next();
    } catch (e: any) {
      console.error('requirePlatformAuth error:', e);
      return res.status(500).json({ error: "Configuration error on server" });
    }
  };

  app.get("/api/admin/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });

      // Fetch tenant memberships for post-login resolution
      const { data: tenantMemberships } = await getSupabaseAdmin()
        .from('memberships')
        .select('*, tenants(*)')
        .eq('user_id', user.id);

      // Fetch platform member with role via direct join
      const { data: platformMember } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*, platform_roles(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!platformMember) {
        return res.json({
          user,
          isPlatformMember: false,
          isPlatformSuspended: false,
          tenantMemberships: tenantMemberships || []
        });
      }

      if (platformMember.status === 'suspended') {
        return res.json({
          user,
          isPlatformMember: true,
          isPlatformSuspended: true,
          platformMember,
          tenantMemberships: tenantMemberships || [],
          error: "Seu acesso administrativo está suspenso."
        });
      }

      // Member is active: fetch role permissions & teams
      const role = platformMember.platform_roles;

      const { data: rolePerms } = role ? await getSupabaseAdmin()
        .from('platform_role_permissions')
        .select('platform_permissions(key)')
        .eq('role_id', role.id) : { data: [] };
        
      const permissions = (rolePerms || [])
        .map((rp: any) => rp.platform_permissions?.key)
        .filter(Boolean);
      
      const { data: teamMemberships } = await getSupabaseAdmin()
        .from('platform_team_members')
        .select('*, platform_teams(*)')
        .eq('platform_member_id', platformMember.id)
        .eq('status', 'active');
        
      const teams = (teamMemberships || []).map((tm: any) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm: any) => tm.team_role === 'manager').map((tm: any) => tm.platform_teams);

      return res.json({
        user,
        isPlatformMember: true,
        isPlatformSuspended: false,
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams,
        tenantMemberships: tenantMemberships || []
      });
    } catch (e: any) {
      console.error("Error in /api/admin/me:", e);
      return res.status(500).json({ error: e.message });
    }
  });


  app.get("/api/admin/tenants", requirePlatformAuth, async (req, res) => {
    res.redirect(307, '/api/admin/clients');
  });

  app.get("/api/admin/tenants/:id", requirePlatformAuth, async (req, res) => {
    res.redirect(307, `/api/admin/clients/${encodeURIComponent(req.params.id)}`);
  });

  app.post("/api/admin/tenants/release-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      if (!platformContext.permissions.includes('platform.demos.manage') && platformContext.role?.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { tenantId, solutionIds, primaryColor, logoInitials } = req.body;
      if (!Array.isArray(solutionIds) || solutionIds.length === 0) return res.status(400).json({ error: 'Selecione ao menos uma solução para o trial.' });

      const db = getSupabaseAdmin();
      const { data: lead, error: leadError } = await db.from('marketing_leads').select('*').eq('id', tenantId).single();
      if (leadError || !lead) return res.status(404).json({ error: 'Lead not found' });
      const { data: leadAssignment } = await db.from('platform_lead_assignments').select('*').eq('lead_id', lead.id).maybeSingle();

      if (platformContext.role?.key !== 'admin') {
        const managesTeam = leadAssignment && platformContext.managedTeams.some((team: any) => team.id === leadAssignment.team_id);
        const ownsLead = leadAssignment?.owner_platform_member_id === platformContext.platformMember.id;
        if (!managesTeam && !ownsLead) return res.status(403).json({ error: 'Lead fora do seu escopo.' });
      }

      const { data: { users }, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw usersError;
      let user = (users as any[]).find((candidate) => candidate.email?.toLowerCase() === lead.email.toLowerCase());
      if (!user) {
        const origin = process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get('host')}`;
        const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(lead.email, {
          redirectTo: `${String(origin).replace(/\/$/, '')}/#/auth/accept-invite`,
          data: { full_name: lead.name }
        });
        if (inviteError) throw inviteError;
        user = inviteData.user;
      }

      const baseSlug = lead.company.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'demo';
      const slug = `${baseSlug}-${lead.id.replace(/-/g, '').slice(0, 8)}`;
      let { data: tenant } = await db.from('tenants').select('*').eq('slug', slug).maybeSingle();
      if (!tenant) {
        const { data: provisionedTenantId, error: provisionError } = await db.rpc('provision_tenant', {
          p_name: lead.company,
          p_slug: slug,
          p_owner_user_id: user.id
        });
        if (provisionError) throw provisionError;
        const tenantResult = await db.from('tenants').select('*').eq('id', provisionedTenantId).single();
        if (tenantResult.error) throw tenantResult.error;
        tenant = tenantResult.data;
      }

      const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
      await db.from('tenants').update({ status: 'trial', settings: { ...(tenant.settings || {}), primaryColor, logoInitials, demo: true, demoExpiresAt: expiresAt } }).eq('id', tenant.id);
      await db.from('tenant_solutions').delete().eq('tenant_id', tenant.id);
      const { data: dbSolutions, error: solutionError } = await db.from('solutions').select('id,key').in('key', solutionIds);
      if (solutionError) throw solutionError;
      if (dbSolutions?.length) await db.from('tenant_solutions').insert(dbSolutions.map((solution: any) => ({ tenant_id: tenant.id, solution_id: solution.id, status: 'trial' })));

      if (leadAssignment) await db.from('platform_client_assignments').upsert({
        tenant_id: tenant.id, team_id: leadAssignment.team_id,
        owner_platform_member_id: leadAssignment.owner_platform_member_id,
        assigned_by_user_id: (req as any).user.id, assignment_type: 'commercial', status: 'active'
      }, { onConflict: 'tenant_id,team_id,assignment_type' });

      await db.from('marketing_leads').update({ status: 'contacted' }).eq('id', lead.id);
      await db.from('commercial_demos').upsert({
        lead_id: lead.id, tenant_id: tenant.id, team_id: leadAssignment?.team_id || null,
        owner_platform_member_id: leadAssignment?.owner_platform_member_id || null,
        status: 'active', starts_at: new Date().toISOString(), expires_at: expiresAt,
        approved_by_user_id: (req as any).user.id, approved_at: new Date().toISOString()
      }, { onConflict: 'lead_id' });
      await db.from('platform_audit_logs').insert({
        actor_user_id: (req as any).user.id, action: 'demo.released', entity_type: 'commercial_demos',
        entity_id: lead.id, team_id: leadAssignment?.team_id || null, severity: 'info',
        metadata: { tenant_id: tenant.id, expires_at: expiresAt, solution_keys: solutionIds }
      });

      res.json({ success: true, tenant: { ...tenant, status: 'trial' }, expiresAt });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/tenants/revoke-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      if (!platformContext.permissions.includes('platform.demos.manage') && platformContext.role?.key !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { tenantId } = req.body;
      const db = getSupabaseAdmin();
      const { data: assignment } = await db.from('platform_client_assignments').select('*').eq('tenant_id', tenantId).eq('assignment_type', 'commercial').maybeSingle();
      if (platformContext.role?.key !== 'admin') {
        const managesTeam = assignment && platformContext.managedTeams.some((team: any) => team.id === assignment.team_id);
        const ownsClient = assignment?.owner_platform_member_id === platformContext.platformMember.id;
        if (!managesTeam && !ownsClient) return res.status(403).json({ error: 'Demonstração fora do seu escopo.' });
      }
      // Update tenant status to suspended
      await db.from('tenants').update({ status: 'suspended' }).eq('id', tenantId);
      await db.from('commercial_demos').update({ status: 'revoked' }).eq('tenant_id', tenantId);
      await db.from('platform_audit_logs').insert({ actor_user_id: (req as any).user.id, action: 'demo.revoked', entity_type: 'commercial_demos', entity_id: tenantId, team_id: assignment?.team_id || null, severity: 'warning' });
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/consultants', requirePlatformAuth, async (_req, res) => {
    res.redirect(307, '/api/admin/staff');
  });

  app.get("/api/admin/contracts", requirePlatformAuth, async (req, res) => {
    res.redirect(307, '/api/admin/commercial/contracts');
  });

  
  app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/leads", createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/clients", createAdminClientsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin", createAdminControlPlaneRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin", createAdminOtherRouter(getSupabaseAdmin, requirePlatformAuth));

  const billingRouters = createBillingRouters(getSupabaseAdmin, requirePlatformAuth);
  app.use('/api/webhooks', billingRouters.publicRouter);
  app.use('/api/admin', billingRouters.adminRouter);
  app.use('/api/internal/billing', billingRouters.internalRouter);


  app.get("/api/admin/stats", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      const db = getSupabaseAdmin();
      const [leadAssignments, clientAssignments] = await Promise.all([
        db.from('platform_lead_assignments').select('*'), db.from('platform_client_assignments').select('*').eq('assignment_type', 'commercial'),
      ]);
      const scopedLeads = platformContext.role?.key === 'admin' ? leadAssignments.data || [] : (leadAssignments.data || []).filter((item: any) => canReadAssignedResource(platformContext, item, 'member_lead_visibility'));
      const scopedClients = platformContext.role?.key === 'admin' ? clientAssignments.data || [] : (clientAssignments.data || []).filter((item: any) => canReadAssignedResource(platformContext, item, 'member_client_visibility'));
      const leadIds = [...new Set(scopedLeads.map((item: any) => item.lead_id))];
      const tenantIds = [...new Set(scopedClients.map((item: any) => item.tenant_id))];
      let leadsQuery = db.from('marketing_leads').select('id,status');
      let demosQuery = db.from('commercial_demos').select('id,status,lead_id');
      let proposalsQuery = db.from('commercial_proposals').select('id,status,lead_id,amount_cents');
      let contractsQuery = db.from('commercial_contracts').select('id,status,tenant_id,amount_cents,cycle,team_id,owner_platform_member_id');
      let tenantsQuery = db.from('tenants').select('id,status,onboarding_status');
      if (platformContext.role?.key !== 'admin') {
        if (!leadIds.length && !tenantIds.length) return res.json({ clients: 0, leads: 0, demos: 0, teams: platformContext.teams.length, proposals: 0, contracts: 0, conversionRate: 0, onboarding: 0, subscriptions: {}, overdue: 0, mrrCents: 0, alerts: [], leadsByStatus: {}, recentActivity: [] });
        if (leadIds.length) { leadsQuery = leadsQuery.in('id', leadIds); demosQuery = demosQuery.in('lead_id', leadIds); proposalsQuery = proposalsQuery.in('lead_id', leadIds); } else { leadsQuery = leadsQuery.eq('id', randomUUID()); demosQuery = demosQuery.eq('id', randomUUID()); proposalsQuery = proposalsQuery.eq('id', randomUUID()); }
        if (tenantIds.length) tenantsQuery = tenantsQuery.in('id', tenantIds); else tenantsQuery = tenantsQuery.eq('id', randomUUID());
      }
      const [leads, demos, proposals, contractsResult, tenants, teams, subscriptions, overdue, recentActivity] = await Promise.all([
        leadsQuery, demosQuery, proposalsQuery, contractsQuery, tenantsQuery,
        db.from('platform_teams').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        db.from('billing_subscriptions').select('status,amount_cents,cycle,contract_id'),
        db.from('billing_payments').select('id,contract_id,status').eq('status', 'overdue'),
        db.from('commercial_activities').select('id,subject,activity_type,status,created_at,team_id,owner_platform_member_id').order('created_at', { ascending: false }).limit(10),
      ]);
      const contracts = platformContext.role?.key === 'admin' ? contractsResult.data || [] : (contractsResult.data || []).filter((item: any) => canReadAssignedResource(platformContext, item, 'member_client_visibility'));
      const contractIds = new Set(contracts.map((item: any) => item.id));
      const scopedSubscriptions = (subscriptions.data || []).filter((item: any) => platformContext.role?.key === 'admin' || contractIds.has(item.contract_id));
      const scopedOverdue = (overdue.data || []).filter((item: any) => platformContext.role?.key === 'admin' || contractIds.has(item.contract_id));
      const cycleDivisor: Record<string, number> = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12 };
      const activeSubscriptions = scopedSubscriptions.filter((item: any) => item.status === 'active');
      const mrrCents = Math.round(activeSubscriptions.reduce((sum: number, item: any) => sum + Number(item.amount_cents || 0) * (cycleDivisor[item.cycle] || 0), 0));
      const leadsByStatus = (leads.data || []).reduce((acc: any, item: any) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
      const subscriptionStates = scopedSubscriptions.reduce((acc: any, item: any) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
      const scopedRecent = platformContext.role?.key === 'admin' ? recentActivity.data || [] : (recentActivity.data || []).filter((item: any) => canReadAssignedResource(platformContext, item, 'member_lead_visibility'));
      const alerts = [scopedOverdue.length ? { type: 'overdue', count: scopedOverdue.length, label: 'Pagamentos vencidos' } : null, subscriptionStates.past_due ? { type: 'subscription', count: subscriptionStates.past_due, label: 'Assinaturas em atraso' } : null].filter(Boolean);
      res.json({
        clients: tenants.data?.length || 0, leads: leads.data?.length || 0, demos: demos.data?.length || 0,
        teams: platformContext.role?.key === 'admin' ? teams.count || 0 : platformContext.teams.length,
        proposals: proposals.data?.length || 0, contracts: contracts.length,
        conversionRate: leads.data?.length ? Math.round((contracts.length / leads.data.length) * 1000) / 10 : 0,
        onboarding: (tenants.data || []).filter((item: any) => item.onboarding_status === 'in_progress').length,
        subscriptions: subscriptionStates, overdue: scopedOverdue.length, mrrCents, alerts, leadsByStatus, recentActivity: scopedRecent,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  
  app.get("/api/public/tenants/resolve", async (req, res) => {
    try {
      const { slug, domain } = req.query;
      let tenant = null;
      
      if (slug) {
        const { data, error } = await getSupabaseAdmin()
          .from('tenants')
          .select('id, name, slug, status, settings')
          .eq('slug', slug)
          .in('status', ['active', 'trial'])
          .single();
        if (!error && data) tenant = data;
      } else if (domain) {
        const { data: td, error: e1 } = await getSupabaseAdmin()
          .from('tenant_domains')
          .select('tenant_id')
          .eq('hostname', domain)
          .single();
        if (!e1 && td) {
          const { data, error } = await getSupabaseAdmin()
            .from('tenants')
            .select('id, name, slug, status, settings')
            .eq('id', td.tenant_id)
            .in('status', ['active', 'trial'])
            .single();
          if (!error && data) tenant = data;
        }
      }
      
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      
      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  
  
  
  return app;
}

async function startServer() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
