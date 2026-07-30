const fs = require('fs');
let code = fs.readFileSync('src/server/adminClientsRouter.ts', 'utf8');

if (!code.includes('router.get(\'/:id\',')) {
  const mountPoint = "  // POST /api/admin/clients/:id/assign";
  const getById = `
  // GET /api/admin/clients/:id
  router.get('/:id', requirePlatformAuth, async (req: any, res: any) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      
      const { data, error } = await getSupabaseAdmin()
        .from('tenants')
        .select('*, tenant_solutions(solution_id, status, solutions(key)), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_member_roles(platform_roles(key, name))))')
        .eq('id', clientId)
        .single();
        
      if (error) throw error;
      
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const assignment = data.platform_client_assignments?.[0];
      let owner = null;
      if (assignment?.platform_members?.user_id) {
        const u = usersData?.users?.find((u: any) => u.id === assignment.platform_members.user_id);
        if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
      }
      
      // Checking permissions (similar to list)
      if (!platformContext.permissions.includes('platform.clients.read')) {
        const myTeamIds = platformContext.teams.map((t: any) => t.id);
        const myMemberId = platformContext.platformMember.id;
        let canView = false;
        
        if (assignment && assignment.owner_platform_member_id === myMemberId) canView = true;
        else if (assignment && myTeamIds.includes(assignment.team_id)) {
           const team = platformContext.teams.find((t: any) => t.id === assignment.team_id);
           if (platformContext.managedTeams.some((t: any) => t.id === assignment.team_id)) canView = true;
           else if (team?.member_client_visibility === 'team' || team?.member_client_visibility === 'all') canView = true;
        }
        
        if (!canView) return res.status(403).json({ error: 'Forbidden' });
      }
      
      res.json({ ...data, assignment, owner });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });\n\n`;
  code = code.replace(mountPoint, getById + mountPoint);
  fs.writeFileSync('src/server/adminClientsRouter.ts', code);
  console.log("Patched adminClientsRouter.ts");
}
