const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newEndpoints = `
  app.get("/api/admin/teams", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      
      let query = getSupabaseAdmin().from('platform_teams').select('*').order('name');
      
      if (!platformContext.permissions.includes('platform.teams.read')) {
        const teamIds = platformContext.teams.map((t: any) => t.id);
        if (teamIds.length === 0) return res.json([]);
        query = query.in('id', teamIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/teams/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      const teamId = req.params.id;
      
      if (!platformContext.permissions.includes('platform.teams.read')) {
        const isMember = platformContext.teams.some((t: any) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data, error } = await getSupabaseAdmin().from('platform_teams').select('*').eq('id', teamId).single();
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  
`;

// Insert before the vite middleware setup
code = code.replace(/\/\/ Vite middleware for development/, newEndpoints + '\n  // Vite middleware for development');
fs.writeFileSync('server.ts', code);
