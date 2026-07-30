const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AssignLeadModal.tsx', 'utf8');

if (!code.includes('isClient')) {
  code = code.replace("leadId, currentAssignment }: any", "leadId, currentAssignment, isClient }: any");
  code = code.replace("fetch(`/api/admin/leads/${leadId}/assign`", "fetch(isClient ? `/api/admin/clients/${leadId}/assign` : `/api/admin/leads/${leadId}/assign`");
  code = code.replace("Erro ao atribuir lead", "Erro ao atribuir");
  fs.writeFileSync('src/components/admin/AssignLeadModal.tsx', code);
  console.log("Patched AssignLeadModal");
}
