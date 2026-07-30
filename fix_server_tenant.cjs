const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `  app.get("/api/admin/tenants/:id", requirePlatformAuth, async (req, res) => {
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

  app.post("/api/admin/tenants/release-demo"`;

code = code.replace(/  app\.post\("\/api\/admin\/tenants\/release-demo"/, newEndpoint);

fs.writeFileSync('server.ts', code);
