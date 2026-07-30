const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const lastAppListenIndex = code.lastIndexOf('app.listen(PORT');
const codeBeforeListen = code.substring(0, lastAppListenIndex);
const resolveStartIndex = codeBeforeListen.lastIndexOf('app.get("/api/public/tenants/resolve"');

let cleanedCode = code.substring(0, resolveStartIndex) + `
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

  ` + code.substring(lastAppListenIndex);

fs.writeFileSync('server.ts', cleanedCode);
