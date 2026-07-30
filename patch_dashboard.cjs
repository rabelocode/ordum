const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminDashboard.tsx', 'utf8');

code = code.replace("Leads Ativos", "Novos Leads");
code = code.replace("Demonstrações", "Leads Aprovados");

fs.writeFileSync('src/pages/admin/AdminDashboard.tsx', code);
console.log("Patched AdminDashboard");
