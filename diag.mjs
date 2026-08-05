import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/SUPABASE_URL=(.+)/);
const keyMatch = env.match(/SUPABASE_SECRET_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.log("Missing credentials");
  process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function run() {
  // 1. Fetch OpenAPI spec
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const spec = await res.json();
  const tables = Object.keys(spec.definitions || {});
  
  // 2. Count RPCs
  const paths = Object.keys(spec.paths || {});
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  
  console.log("=== PROJECT DETAILS ===");
  console.log(`URL: ${url}`);
  console.log("=== TABLES ===");
  console.log(`Total API exposed tables/views: ${tables.length}`);
  
  // Specific multi-tenancy tables check
  const important = ['tenants', 'memberships', 'profiles', 'roles', 'permissions', 'platform_members', 'platform_roles', 'platform_permissions'];
  important.forEach(t => {
    if (tables.includes(t)) {
       const def = spec.definitions[t];
       const cols = Object.keys(def.properties || {});
       console.log(`Table: ${t}`);
       console.log(`Columns: ${cols.join(', ')}`);
    } else {
       console.log(`Table: ${t} - NOT EXPOSED OR MISSING`);
    }
  });

  console.log("\n=== RPCs ===");
  console.log(`Total RPCs exposed: ${rpcs.length}`);
  const importantRpcs = rpcs.filter(r => r.includes('integrity') || r.includes('tenant') || r.includes('platform'));
  importantRpcs.forEach(r => console.log(r));

  // 3. Let's do some row counting using HEAD requests for a few tables
  console.log("\n=== ROW COUNTS (Approx) ===");
  for (const t of ['tenants', 'memberships', 'profiles', 'platform_members']) {
    if (!tables.includes(t)) continue;
    const r = await fetch(`${url}/rest/v1/${t}?select=id`, {
      method: 'HEAD',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': 'count=exact' }
    });
    const contentRange = r.headers.get('content-range');
    console.log(`${t}: ${contentRange}`);
  }
}

run().catch(console.error);
