const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const requireAdminRegex = /const requireAdmin = async \([\s\S]*?next\(\);\s*\};/;

const newAuthCode = `  const requirePlatformAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });

    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });

      // Fetch platform context
      const { data: platformMember, error: memberErr } = await getSupabaseAdmin()
        .from('platform_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
        
      if (memberErr || !platformMember) {
        return res.status(403).json({ error: "Forbidden: Not a platform member" });
      }

      const { data: memberRoleData } = await getSupabaseAdmin()
        .from('platform_member_roles')
        .select('platform_roles(*)')
        .eq('platform_member_id', platformMember.id)
        .single();
        
      const role = memberRoleData?.platform_roles;

      if (!role) {
        return res.status(403).json({ error: "Forbidden: No platform role assigned" });
      }
      
      const { data: rolePerms } = await getSupabaseAdmin()
        .from('platform_role_permissions')
        .select('platform_permissions(key)')
        .eq('role_id', role.id);
        
      const permissions = (rolePerms || []).map((rp: any) => rp.platform_permissions.key);
      
      const { data: teamMemberships } = await getSupabaseAdmin()
        .from('platform_team_members')
        .select('*, platform_teams(*)')
        .eq('platform_member_id', platformMember.id)
        .eq('status', 'active');
        
      const teams = (teamMemberships || []).map((tm: any) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm: any) => tm.team_role === 'manager').map((tm: any) => tm.platform_teams);
      
      (req as any).user = user;
      (req as any).platformContext = {
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams
      };
      next();
    } catch (e: any) {
      console.error('requirePlatformAuth error:', e);
      return res.status(500).json({ error: "Configuration error on server" });
    }
  };
  
  app.get("/api/admin/me", requirePlatformAuth, async (req, res) => {
    const { user, platformContext } = req as any;
    res.json({
      user,
      ...platformContext
    });
  });
`;

code = code.replace(requireAdminRegex, newAuthCode);
code = code.replace(/requireAdmin,/g, 'requirePlatformAuth,');

fs.writeFileSync('server.ts', code);
