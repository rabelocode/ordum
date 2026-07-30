const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStats = `
      const { count: clientsCount } = await getSupabaseAdmin()
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'suspended']);
        
      const { count: leadsCount } = await getSupabaseAdmin()
        .from('marketing_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
        
      const { count: demosCount } = await getSupabaseAdmin()
        .from('marketing_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
        
      const { count: teamsCount } = await getSupabaseAdmin()
        .from('platform_teams')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
        
      res.json({
        clients: clientsCount || 0,
        leads: leadsCount || 0,
        demos: demosCount || 0,
        teams: teamsCount || 0
      });
`;

const scopedStats = `
      // Scoped counts
      let clientsQuery = getSupabaseAdmin().from('platform_client_assignments').select('*', { count: 'exact', head: true });
      let leadsQuery = getSupabaseAdmin().from('platform_lead_assignments').select('*, marketing_leads!inner(*)', { count: 'exact', head: true }).eq('marketing_leads.status', 'new');
      let demosQuery = getSupabaseAdmin().from('platform_lead_assignments').select('*, marketing_leads!inner(*)', { count: 'exact', head: true }).eq('marketing_leads.status', 'approved');
      
      if (!platformContext.permissions.includes('platform.leads.read')) {
        const teamIds = platformContext.teams.map((t: any) => t.id);
        if (teamIds.length === 0) {
           return res.json({ clients: 0, leads: 0, demos: 0, teams: 0 });
        }
        clientsQuery = clientsQuery.in('team_id', teamIds);
        leadsQuery = leadsQuery.in('team_id', teamIds);
        demosQuery = demosQuery.in('team_id', teamIds);
      }
      
      const [{ count: clientsCount }, { count: leadsCount }, { count: demosCount }, { count: teamsCount }] = await Promise.all([
        clientsQuery,
        leadsQuery,
        demosQuery,
        getSupabaseAdmin().from('platform_teams').select('*', { count: 'exact', head: true }).eq('status', 'active')
      ]);

      res.json({
        clients: clientsCount || 0,
        leads: leadsCount || 0,
        demos: demosCount || 0,
        teams: platformContext.permissions.includes('platform.teams.read') ? (teamsCount || 0) : platformContext.teams.length
      });
`;

code = code.replace(targetStats, scopedStats);
fs.writeFileSync('server.ts', code);
console.log("Patched stats endpoint");
