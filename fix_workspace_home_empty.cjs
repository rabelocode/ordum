const fs = require('fs');
let code = fs.readFileSync('src/components/workspace/WorkspaceHome.tsx', 'utf8');

code = code.replace(/\{\(\(\!roleKeys\.some[\s\S]*?enabledModules\.includes\("talent"\)\) && \(/, 
"{(!canViewIntegrity && !canViewPeople && !canViewTalent) && (");

fs.writeFileSync('src/components/workspace/WorkspaceHome.tsx', code);
