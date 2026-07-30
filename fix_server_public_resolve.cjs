const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const publicEndpoint = `
  app.get("/api/public/tenants/resolve", async (req, res) => {
    try {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: "Missing slug" });
      
      const { data: tenant, error } = await getSupabaseAdmin()
        .from('tenants')
        .select('id, name, slug, status, settings')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();
        
      if (error || !tenant) return res.status(404).json({ error: "Tenant not found" });
      
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
`;

code = code.replace(/app\.listen\(PORT/, `${publicEndpoint}\n  app.listen(PORT`);
fs.writeFileSync('server.ts', code);
