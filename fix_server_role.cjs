const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/await getSupabaseAdmin\(\)\.from\('membership_roles'\)\.insert\(\{[\s\S]*?\}\);/,
`         const { data: existingRole } = await getSupabaseAdmin().from('membership_roles').select('*').eq('membership_id', membership.id).eq('role_id', role.id).single();
         if (!existingRole) {
           await getSupabaseAdmin().from('membership_roles').insert({
             membership_id: membership.id,
             role_id: role.id
           });
         }`);

fs.writeFileSync('server.ts', code);
