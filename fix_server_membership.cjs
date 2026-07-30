const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const \{ data: membership, error: mErr \} = await getSupabaseAdmin\(\)\.from\('memberships'\)\.insert\(\{[\s\S]*?\}\)\.select\(\)\.single\(\);\s*if \(mErr\) throw mErr;/, 
`      let { data: membership, error: mErr } = await getSupabaseAdmin().from('memberships').select('*').eq('tenant_id', tenant.id).eq('user_id', user.id).single();
      if (!membership) {
        const { data: newMembership, error: mInsErr } = await getSupabaseAdmin().from('memberships').insert({
          tenant_id: tenant.id,
          user_id: user.id,
          status: 'active'
        }).select().single();
        if (mInsErr) throw mInsErr;
        membership = newMembership;
      }`);

fs.writeFileSync('server.ts', code);
