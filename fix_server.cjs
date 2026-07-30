const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/await getSupabaseAdmin\(\)\.from\('profiles'\)\.upsert\(\{[\s\S]*?\}\);/g, `// Profile is created automatically by on_auth_user_created trigger`);

fs.writeFileSync('server.ts', code);
