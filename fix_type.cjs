const fs = require('fs');
let file = fs.readFileSync('src/core/tenant/TenantTypes.ts', 'utf8');
file = file.replace(/  \| "TENANT_OWNER"/g, '');
fs.writeFileSync('src/core/tenant/TenantTypes.ts', file);
