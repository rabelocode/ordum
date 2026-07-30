const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/if \(solutionIds && solutionIds\.length > 0\) \{[\s\S]*?await getSupabaseAdmin\(\)\.from\('tenant_solutions'\)\.insert\(solutionsToInsert\);\s*\}/, `if (solutionIds && solutionIds.length > 0) {
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
      }`);

fs.writeFileSync('server.ts', code);
