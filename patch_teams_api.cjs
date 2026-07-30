const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Inject import
if (!code.includes('createAdminTeamsRouter')) {
  code = code.replace("import { createServer as createViteServer } from 'vite';", "import { createServer as createViteServer } from 'vite';\nimport { createAdminTeamsRouter } from './src/server/adminTeamsRouter';");
}

const teamsStart = code.indexOf('  app.get("/api/admin/teams",');
const statsStart = code.indexOf('  app.get("/api/admin/stats",');

if (teamsStart > -1 && statsStart > teamsStart) {
  const before = code.substring(0, teamsStart);
  const after = code.substring(statsStart);
  
  const inject = `  app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth));\n\n`;
  
  code = before + inject + after;
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts");
} else {
  console.log("Could not find boundaries");
}
