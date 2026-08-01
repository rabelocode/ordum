import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createAdminLeadsRouter } from './src/server/adminLeadsRouter';
import { createAdminClientsRouter } from './src/server/adminClientsRouter';
import { createAdminOtherRouter } from './src/server/adminOtherRouter';
import { createAdminTeamsRouter } from './src/server/adminTeamsRouter';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config({ path: ['.env.local', '.env'] });

export async function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());

  let _supabaseAdmin: any = null;
  const getSupabaseAdmin = () => {
    if (!_supabaseAdmin) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      if (!url || !key) {
        throw new Error("Missing Supabase credentials");
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
    try {
      const { data: leads, error: leadsErr } = await getSupabaseAdmin().from('marketing_leads').select('*');
      if (leadsErr) throw leadsErr;

      const { data: tenantsData, error: tenantsErr } = await getSupabaseAdmin()
        .from('tenants')
        .select(`
          *,
          tenant_solutions (*)
        `);
      if (tenantsErr) throw tenantsErr;

      const result = [];
      
      for (const lead of (leads || [])) {
        if (lead.status === 'approved') continue;
        result.push({
          id: lead.id,
          slug: '',
          legalName: lead.company,
          displayName: lead.company,
          logoInitials: lead.company.substring(0, 2).toUpperCase(),
          primaryColor: '#353938',
          lifecycleStatus: lead.status === 'new' ? 'demo_requested' : 'demo_requested',
          isFictionalDemo: false,
          solutionEntitlements: [],
          createdAt: lead.created_at,
          email: lead.email,
          contactName: lead.name
        });
      }

      for (const t of (tenantsData || [])) {
        const solutions = (t.tenant_solutions || []).map((ts: any) => ({
          solutionId: ts.solution_id,
          status: ts.status
        }));
        
        let status = t.status;
        if (status === 'active') status = 'demo_approved';
        
        const settings = (t.settings as any) || {};
        result.push({
          id: t.id,
          slug: t.slug,
          legalName: t.name,
          displayName: t.name,
          logoInitials: settings.logoInitials || t.name.substring(0, 2).toUpperCase(),
          primaryColor: settings.primaryColor || '#B66E45',
          lifecycleStatus: status,
          isFictionalDemo: false,
          solutionEntitlements: solutions,
          createdAt: t.created_at
        });
      }

      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/tenants/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      if (!platformContext.permissions.includes('platform.tenants.read')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const tenantId = req.params.id;
      
      const { data, error } = await getSupabaseAdmin()
        .from('tenants')
        .select('*, tenant_solutions(*)')
        .eq('id', tenantId)
        .single();
        
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/tenants/release-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { tenantId, solutionIds, primaryColor, logoInitials } = req.body;
      
      const { data: lead } = await getSupabaseAdmin().from('marketing_leads').select('*').eq('id', tenantId).single();
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const slug = lead.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      let { data: tenant } = await getSupabaseAdmin().from('tenants').select('*').eq('slug', slug).single();
      
      if (!tenant) {
        const { data: newTenant, error: tErr } = await getSupabaseAdmin().from('tenants').insert({
          name: lead.company,
          slug: slug,
          status: 'active',
          settings: { primaryColor, logoInitials }
        }).select().single();
        if (tErr) throw tErr;
        tenant = newTenant;
      }

      await getSupabaseAdmin().from('tenant_solutions').delete().eq('tenant_id', tenant.id);
      
      if (solutionIds && solutionIds.length > 0) {
        // Fetch solutions by key to get their actual UUIDs
        const { data: dbSolutions, error: sErr } = await getSupabaseAdmin().from('solutions').select('id, key').in('key', solutionIds);
        if (sErr) throw sErr;
        
        if (dbSolutions && dbSolutions.length > 0) {
          const solutionsToInsert = dbSolutions.map((s: any) => ({
            tenant_id: tenant.id,
            solution_id: s.id,
            status: 'contracted'
          }));
          await getSupabaseAdmin().from('tenant_solutions').insert(solutionsToInsert);
        }
      }

      const { data: { users }, error: uErr } = await getSupabaseAdmin().auth.admin.listUsers();
      let user = (users as any[]).find(u => u.email === lead.email);
      
      if (!user) {
        const { data: inviteData, error: inviteErr } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(lead.email, {
          data: { full_name: lead.name }
        });
        if (inviteErr) throw inviteErr;
        user = inviteData.user;
        
        // Profile is created automatically by on_auth_user_created trigger
      }

            let { data: membership, error: mErr } = await getSupabaseAdmin().from('memberships').select('*').eq('tenant_id', tenant.id).eq('user_id', user.id).single();
      if (!membership) {
        const { data: newMembership, error: mInsErr } = await getSupabaseAdmin().from('memberships').insert({
          tenant_id: tenant.id,
          user_id: user.id,
          status: 'active'
        }).select().single();
        if (mInsErr) throw mInsErr;
        membership = newMembership;
      }
      
      const { data: role } = await getSupabaseAdmin().from('roles').select('id').eq('key', 'tenant_admin').single();
      if (role) {
                  const { data: existingRole } = await getSupabaseAdmin().from('membership_roles').select('*').eq('membership_id', membership.id).eq('role_id', role.id).single();
         if (!existingRole) {
           await getSupabaseAdmin().from('membership_roles').insert({
             membership_id: membership.id,
             role_id: role.id
           });
         }
      }

      
      // Preserve lead assignment to client assignment
      const { data: leadAssignment } = await getSupabaseAdmin().from('platform_lead_assignments').select('*').eq('lead_id', lead.id).single();
      if (leadAssignment) {
        await getSupabaseAdmin().from('platform_client_assignments').insert({
          tenant_id: tenant.id,
          team_id: leadAssignment.team_id,
          owner_platform_member_id: leadAssignment.owner_platform_member_id,
          assigned_by: (req as any).platformContext?.platformMember?.id || null,
          status: 'active'
        });
      }
      
      await getSupabaseAdmin().from('marketing_leads').update({ status: 'approved' }).eq('id', lead.id);

      res.json({ success: true, tenant });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/tenants/revoke-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { tenantId } = req.body;
      // Update tenant status to suspended
      await getSupabaseAdmin().from("tenants").update({ status: "suspended" }).eq("id", tenantId);
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

    app.get("/api/admin/consultants", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      if (!platformContext.permissions.includes('platform.staff.read')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data: members, error: memberErr } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*, platform_member_roles(platform_roles(*))');
        
      if (memberErr) throw memberErr;
      
      const { data: usersData, error: userErr } = await getSupabaseAdmin().auth.admin.listUsers();
      if (userErr) throw userErr;
      
      const result = members.map((m: any) => {
        const user = usersData.users.find((u: any) => u.id === m.user_id);
        const role = m.platform_member_roles?.[0]?.platform_roles;
        return {
          ...m,
          user,
          role
        };
      });
      
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/contracts", requirePlatformAuth, async (req, res) => {
    res.json([]);
  });

  
  app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/leads", createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/clients", createAdminClientsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin", createAdminOtherRouter(getSupabaseAdmin, requirePlatformAuth));


  app.get("/api/admin/stats", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      
      // Scoped counts
      let clientsQuery = getSupabaseAdmin().from('platform_client_assignments').select('*', { count: 'exact', head: true });
      let leadsQuery = getSupabaseAdmin().from('platform_lead_assignments').select('*, marketing_leads!inner(*)', { count: 'exact', head: true }).eq('marketing_leads.status', 'new');
      let demosQuery = getSupabaseAdmin().from('platform_lead_assignments').select('*, marketing_leads!inner(*)', { count: 'exact', head: true }).eq('marketing_leads.status', 'approved');
      
      if (!platformContext.permissions.includes('platform.leads.read')) {
        const teamIds = platformContext.teams.map((t: any) => t.id);
        if (teamIds.length === 0) {
           return res.json({ clients: 0, leads: 0, demos: 0, teams: 0 });
        }
        clientsQuery = clientsQuery.in('team_id', teamIds);
        leadsQuery = leadsQuery.in('team_id', teamIds);
        demosQuery = demosQuery.in('team_id', teamIds);
      }
      
      const [{ count: clientsCount }, { count: leadsCount }, { count: demosCount }, { count: teamsCount }] = await Promise.all([
        clientsQuery,
        leadsQuery,
        demosQuery,
        getSupabaseAdmin().from('platform_teams').select('*', { count: 'exact', head: true }).eq('status', 'active')
      ]);

      res.json({
        clients: clientsCount || 0,
        leads: leadsCount || 0,
        demos: demosCount || 0,
        teams: platformContext.permissions.includes('platform.teams.read') ? (teamsCount || 0) : platformContext.teams.length
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  
  app.get("/api/temp-slugs", async (req, res) => {
    try {
      const { data: tenants } = await getSupabaseAdmin().from('tenants').select('slug, name');
      const { data: users } = await getSupabaseAdmin().auth.admin.listUsers();
      res.json({ tenants, users: users?.users?.map(u => ({ email: u.email })) });
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
          .eq('status', 'active')
          .single();
        if (!error && data) tenant = data;
      } else if (domain) {
        const { data: td, error: e1 } = await getSupabaseAdmin()
          .from('tenant_domains')
          .select('tenant_id')
          .eq('domain', domain)
          .single();
        if (!e1 && td) {
          const { data, error } = await getSupabaseAdmin()
            .from('tenants')
            .select('id, name, slug, status, settings')
            .eq('id', td.tenant_id)
            .eq('status', 'active')
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
