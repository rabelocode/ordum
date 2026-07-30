const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('const LeadsPage = lazy')) {
  code = code.replace(
    'const PlaceholderAdminPage = lazy(() => import("./pages/admin/PlaceholderAdminPage").then(m => ({ default: m.PlaceholderAdminPage })));',
    'const PlaceholderAdminPage = lazy(() => import("./pages/admin/PlaceholderAdminPage").then(m => ({ default: m.PlaceholderAdminPage })));\nconst LeadsPage = lazy(() => import("./pages/admin/LeadsPage").then(m => ({ default: m.LeadsPage })));\nconst AuditPage = lazy(() => import("./pages/admin/AuditPage").then(m => ({ default: m.AuditPage })));\nconst SystemHealthPage = lazy(() => import("./pages/admin/SystemHealthPage").then(m => ({ default: m.SystemHealthPage })));'
  );
}

if (code.includes('route === "/admin/leads" ||')) {
  code = code.replace(
    'route === "/admin/leads" ||',
    '' // remove it from PlaceholderAdminPage condition
  );
  
  code = code.replace(
    'route === "/admin/auditoria" ||',
    '' // remove it from PlaceholderAdminPage condition
  );
  
  code = code.replace(
    'route === "/admin/sistema" ||',
    '' // remove it from PlaceholderAdminPage condition
  );
  
  code = code.replace(
    '} else if (route === "/admin/contratos") {',
    '} else if (route === "/admin/leads") {\n        adminContent = <LeadsPage />;\n      } else if (route === "/admin/auditoria") {\n        adminContent = <AuditPage />;\n      } else if (route === "/admin/sistema") {\n        adminContent = <SystemHealthPage />;\n      } else if (route === "/admin/contratos") {'
  );
  
  fs.writeFileSync('src/App.tsx', code);
  console.log("App.tsx patched");
}
