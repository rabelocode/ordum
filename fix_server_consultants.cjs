const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldConsultants = /app\.get\("\/api\/admin\/consultants", requirePlatformAuth, async \(req, res\) => \{[\s\S]*?\}\);/m;

const newConsultants = `  app.get("/api/admin/consultants", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req as any;
      if (!platformContext.permissions.includes('platform.staff.read')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { data: members, error: memberErr } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*, platform_member_roles(platform_roles(*))');
        
      if (memberErr) throw memberErr;
      
      const { data: usersData, error: userErr } = await getSupabaseAdmin().auth.admin.listUsers();
      if (userErr) throw userErr;
      
      const result = members.map((m: any) => {
        const user = usersData.users.find((u: any) => u.id === m.user_id);
        const role = m.platform_member_roles?.[0]?.platform_roles;
        return {
          ...m,
          user,
          role
        };
      });
      
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });`;

code = code.replace(oldConsultants, newConsultants);

fs.writeFileSync('server.ts', code);
