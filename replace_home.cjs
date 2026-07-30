const fs = require('fs');
let code = fs.readFileSync('src/components/workspace/WorkspaceHome.tsx', 'utf8');

// The logic should be based on permissions.
// hasPermission('integrity.indicator.view') or hasPermission('integrity.case.triage') or hasPermission('integrity.report.submit_public')
// Let's create helper boolean variables inside the component.

code = code.replace(/const roleKeys = roles.map\(\(r: any\) => r\.key\);/g, `const roleKeys = roles.map((r: any) => r.key);
  
  const canViewIntegrity = hasPermission('integrity.indicator.view') || hasPermission('integrity.case.triage') || hasPermission('integrity.case.view_assigned') || hasPermission('integrity.report.submit_public') || roleKeys.includes('TENANT_ADMIN');
  const canViewPeople = hasPermission('people.communication.view') || hasPermission('people.document.view_own') || hasPermission('people.payslip.view_own') || roleKeys.includes('TENANT_ADMIN');
  const canViewTalent = hasPermission('talent.job.publish') || hasPermission('talent.application.view') || hasPermission('talent.interview.manage') || roleKeys.includes('TENANT_ADMIN');
  
  const canManageIntegrity = hasPermission('integrity.case.triage') || hasPermission('integrity.case.assign') || roleKeys.includes('TENANT_ADMIN');
  const canManagePeople = hasPermission('people.communication.manage') || hasPermission('people.document.manage') || roleKeys.includes('TENANT_ADMIN');
  const canManageTalent = hasPermission('talent.job.create') || hasPermission('talent.assessment.manage') || roleKeys.includes('TENANT_ADMIN');
  
  const isExecutive = hasPermission('integrity.indicator.view') || roleKeys.includes('TENANT_ADMIN');
`);

code = code.replace(/\{\(roleKeys\.includes\("TENANT_ADMIN"\).*?&&\s*enabledModules\.includes\("integrity"\)\s*&& \(/g, '{(canViewIntegrity) && enabledModules.includes("integrity") && (');
code = code.replace(/\{\(roleKeys\.includes\("TENANT_ADMIN"\).*?&&\s*enabledModules\.includes\("people"\)\s*&& \(/g, '{(canViewPeople) && enabledModules.includes("people") && (');
code = code.replace(/\{\(roleKeys\.includes\("TENANT_ADMIN"\).*?&&\s*enabledModules\.includes\("talent"\)\s*&& \(/g, '{(canViewTalent) && enabledModules.includes("talent") && (');
code = code.replace(/\{\(roleKeys\.includes\("TENANT_ADMIN"\).*?&&\s*\(/g, '{(isExecutive) && (');

code = code.replace(/\{\(roleKeys\.some\(r => r\.startsWith\("INTEGRITY_"\)\).*?&&\s*enabledModules\.includes\("integrity"\)\s*&& \(/g, '{(canManageIntegrity) && enabledModules.includes("integrity") && (');
code = code.replace(/\{\(roleKeys\.includes\("PEOPLE_HR"\).*?&&\s*enabledModules\.includes\("people"\)\s*&& \(/g, '{(canManagePeople) && enabledModules.includes("people") && (');
code = code.replace(/\{\(roleKeys\.some\(r => r\.startsWith\("TALENT_"\)\).*?&&\s*enabledModules\.includes\("talent"\)\s*&& \(/g, '{(canManageTalent) && enabledModules.includes("talent") && (');

code = code.replace(/\{\(\(\!roleKeys\.some.*?\)\s*&&\s*\(\!roleKeys\.includes.*?\)\s*&&\s*\(\!roleKeys\.some.*?\)\s*&& \(/g, '{(!canManageIntegrity || !enabledModules.includes("integrity")) && (!canManagePeople || !enabledModules.includes("people")) && (!canManageTalent || !enabledModules.includes("talent")) && (');

code = code.replace(/\{\(roleKeys\.includes\("TENANT_ADMIN"\) \|\| roleKeys\.includes\("TENANT_ADMIN"\) \|\| roleKeys\.includes\("EXECUTIVE"\)\) && uncontractedModules\.length > 0 && \(/g, '{(isExecutive) && uncontractedModules.length > 0 && (');

fs.writeFileSync('src/components/workspace/WorkspaceHome.tsx', code);
