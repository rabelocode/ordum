const fs = require('fs');

function fix(file, permStr) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/const isAdmin = roleKeys\.includes.*?;\n/g, `const isAdmin = tenantCtx.hasPermission('${permStr}') || roleKeys.includes('TENANT_ADMIN');\n`);
  code = code.replace(/const isManager = roles\.includes.*?;\n/g, `const isManager = tenantCtx.hasPermission('people.request.manage_team') || roleKeys.includes('TENANT_ADMIN');\n`);
  fs.writeFileSync(file, code);
}

fix('src/components/workspace/IntegrityModuleView.tsx', 'integrity.case.triage');
fix('src/components/workspace/PeopleModuleView.tsx', 'people.communication.manage');
fix('src/components/workspace/TalentModuleView.tsx', 'talent.job.create');
