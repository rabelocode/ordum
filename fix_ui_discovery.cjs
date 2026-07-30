const fs = require('fs');

let page1 = fs.readFileSync('src/pages/public/TenantDiscoveryPage.tsx', 'utf8');
page1 = page1.replace(/const \{ data, error \} = await supabase\s*\.from\("tenants"\)\s*\.select\("slug"\)\s*\.eq\("slug", identifier\.trim\(\)\.toLowerCase\(\)\)\s*\.eq\("status", "active"\)\s*\.single\(\);/g, `
      const res = await fetch(\`/api/public/tenants/resolve?slug=\${identifier.trim().toLowerCase()}\`);
      if (!res.ok) {
        setError("Empresa não encontrada ou inativa.");
        return;
      }
      const data = await res.json();
      const error = null;
`);
fs.writeFileSync('src/pages/public/TenantDiscoveryPage.tsx', page1);

let page2 = fs.readFileSync('src/pages/public/TenantLoginPage.tsx', 'utf8');
page2 = page2.replace(/const \{ data, error \} = await supabase\s*\.from\("tenants"\)\s*\.select\("\*"\)\s*\.eq\("slug", slug\)\s*\.eq\("status", "active"\)\s*\.single\(\);/g, `
        const res = await fetch(\`/api/public/tenants/resolve?slug=\${slug}\`);
        if (!res.ok) {
          setError("Empresa não encontrada.");
          return;
        }
        const data = await res.json();
        const error = null;
`);
fs.writeFileSync('src/pages/public/TenantLoginPage.tsx', page2);
