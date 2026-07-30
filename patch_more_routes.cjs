const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const imports = [
  "import { createAdminLeadsRouter } from './src/server/adminLeadsRouter';",
  "import { createAdminClientsRouter } from './src/server/adminClientsRouter';",
  "import { createAdminOtherRouter } from './src/server/adminOtherRouter';"
];

let injectedImports = false;
for (const imp of imports) {
  if (!code.includes(imp)) {
    code = code.replace("import { createAdminTeamsRouter }", `${imp}\nimport { createAdminTeamsRouter }`);
    injectedImports = true;
  }
}

if (injectedImports) {
  const mountPoint = 'app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth));';
  if (code.includes(mountPoint)) {
    code = code.replace(mountPoint, mountPoint + '\n' +
      '  app.use("/api/admin/leads", createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth));\n' +
      '  app.use("/api/admin/clients", createAdminClientsRouter(getSupabaseAdmin, requirePlatformAuth));\n' +
      '  app.use("/api/admin", createAdminOtherRouter(getSupabaseAdmin, requirePlatformAuth));\n'
    );
    fs.writeFileSync('server.ts', code);
    console.log("More routes patched");
  }
}
