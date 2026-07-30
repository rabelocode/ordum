const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `
  app.get("/api/admin/stats", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      
      const { count: clientsCount } = await getSupabaseAdmin()
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'suspended']);
        
      const { count: leadsCount } = await getSupabaseAdmin()
        .from('marketing_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
        
      const { count: demosCount } = await getSupabaseAdmin()
        .from('marketing_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
        
      const { count: teamsCount } = await getSupabaseAdmin()
        .from('platform_teams')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
        
      res.json({
        clients: clientsCount || 0,
        leads: leadsCount || 0,
        demos: demosCount || 0,
        teams: teamsCount || 0
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
`;

code = code.replace(/\/\/ Vite middleware for development/, newEndpoint + '\n  // Vite middleware for development');
fs.writeFileSync('server.ts', code);
