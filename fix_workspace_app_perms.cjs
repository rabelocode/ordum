const fs = require('fs');
let code = fs.readFileSync('src/pages/workspace/WorkspaceApp.tsx', 'utf8');

code = code.replace(/const roleKeys = roles\.map\(r => r\.key\);/g, `const { hasPermission } = useTenant();
  const roleKeys = roles.map(r => r.key);`);

code = code.replace(/const canAccessIntegrity = roleKeys\.some.*?;/g, `const canAccessIntegrity = hasPermission('integrity.indicator.view') || hasPermission('integrity.case.triage') || roleKeys.includes('tenant_admin');`);
code = code.replace(/const canAccessPeople = roleKeys\.some.*?;/g, `const canAccessPeople = hasPermission('people.communication.view') || hasPermission('people.payslip.view_own') || roleKeys.includes('tenant_admin');`);
code = code.replace(/const canAccessTalent = roleKeys\.some.*?;/g, `const canAccessTalent = hasPermission('talent.job.publish') || hasPermission('talent.application.view') || roleKeys.includes('tenant_admin');`);
code = code.replace(/const canAccessAdmin = roleKeys\.some.*?;/g, `const canAccessAdmin = roleKeys.includes('tenant_admin');`);
code = code.replace(/const canAccessExecutive = roleKeys\.some.*?;/g, `const canAccessExecutive = hasPermission('integrity.indicator.view') || roleKeys.includes('tenant_admin');`);

fs.writeFileSync('src/pages/workspace/WorkspaceApp.tsx', code);
