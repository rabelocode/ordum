const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = "await getSupabaseAdmin().from('marketing_leads').update({ status: 'approved' }).eq('id', lead.id);";

if (code.includes(target)) {
  const insert = `
      // Preserve lead assignment to client assignment
      const { data: leadAssignment } = await getSupabaseAdmin().from('platform_lead_assignments').select('*').eq('lead_id', lead.id).single();
      if (leadAssignment) {
        await getSupabaseAdmin().from('platform_client_assignments').insert({
          tenant_id: tenant.id,
          team_id: leadAssignment.team_id,
          owner_platform_member_id: leadAssignment.owner_platform_member_id,
          assigned_by: (req as any).platformContext?.platformMember?.id || null,
          status: 'active'
        });
      }
      `;
      
  code = code.replace(target, insert + '\n      ' + target);
  fs.writeFileSync('server.ts', code);
  console.log("Patched release-demo in server.ts");
}
