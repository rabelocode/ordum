// server.ts
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// src/server/adminLeadsRouter.ts
import { Router } from "express";
function createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth) {
  const router = Router();
  router.get("/", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin().from("marketing_leads").select("*, platform_lead_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name)))").order("created_at", { ascending: false });
      const isSales = platformContext.role.key === "sales";
      if (!platformContext.permissions.includes("platform.leads.read")) {
      }
      const { data, error } = await query;
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      let leads = data.map((l) => {
        const assignment = l.platform_lead_assignments?.[0];
        let owner = null;
        if (assignment?.platform_members?.user_id) {
          const u = usersData?.users?.find((u2) => u2.id === assignment.platform_members.user_id);
          if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
        }
        return { ...l, assignment, owner };
      });
      if (!platformContext.permissions.includes("platform.leads.read")) {
        const myTeamIds = platformContext.teams.map((t) => t.id);
        const myMemberId = platformContext.platformMember.id;
        leads = leads.filter((l) => {
          const a = l.assignment;
          if (!a) {
            return false;
          }
          if (a.owner_platform_member_id === myMemberId) return true;
          if (myTeamIds.includes(a.team_id)) {
            const team = platformContext.teams.find((t) => t.id === a.team_id);
            if (platformContext.managedTeams.some((t) => t.id === a.team_id)) return true;
            if (team?.member_lead_visibility === "team" || team?.member_lead_visibility === "all") return true;
          }
          return false;
        });
      }
      res.json(leads);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/assign", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const leadId = req.params.id;
      const { team_id, owner_platform_member_id } = req.body;
      if (!platformContext.permissions.includes("platform.leads.manage")) {
        const isManager = platformContext.managedTeams.some((t) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_lead_assignments").upsert({
        lead_id: leadId,
        team_id,
        owner_platform_member_id: owner_platform_member_id || null,
        assigned_by: platformContext.platformMember.id,
        status: "active"
      }, { onConflict: "lead_id" }).select().single();
      if (error) throw error;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "lead.assigned",
        entity_type: "platform_lead_assignments",
        entity_id: leadId,
        severity: "info",
        team_id
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/claim", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const leadId = req.params.id;
      const myMemberId = platformContext.platformMember.id;
      const { data: assignment, error: err1 } = await getSupabaseAdmin().from("platform_lead_assignments").select("*, platform_teams(allow_self_claim)").eq("lead_id", leadId).single();
      if (err1 || !assignment) return res.status(404).json({ error: "Lead assignment not found" });
      if (!assignment.platform_teams?.allow_self_claim) {
        return res.status(403).json({ error: "Self claim not allowed for this team" });
      }
      if (assignment.owner_platform_member_id) {
        return res.status(409).json({ error: "Lead already claimed" });
      }
      if (!platformContext.teams.some((t) => t.id === assignment.team_id)) {
        return res.status(403).json({ error: "You are not in this team" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_lead_assignments").update({ owner_platform_member_id: myMemberId, status: "active" }).eq("lead_id", leadId).is("owner_platform_member_id", null).select().single();
      if (error || !data) {
        return res.status(409).json({ error: "Failed to claim lead. It may have been claimed by someone else." });
      }
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "lead.claimed",
        entity_type: "platform_lead_assignments",
        entity_id: leadId,
        severity: "info",
        team_id: assignment.team_id
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// src/server/adminClientsRouter.ts
import { Router as Router2 } from "express";
function createAdminClientsRouter(getSupabaseAdmin, requirePlatformAuth) {
  const router = Router2();
  router.get("/", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const { data, error } = await getSupabaseAdmin().from("tenants").select("*, tenant_solutions(*), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))))").in("status", ["active", "suspended"]);
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      let clients = data.map((c) => {
        const assignment = c.platform_client_assignments?.[0];
        let owner = null;
        if (assignment?.platform_members?.user_id) {
          const u = usersData?.users?.find((u2) => u2.id === assignment.platform_members.user_id);
          if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
        }
        return { ...c, assignment, owner };
      });
      if (!platformContext.permissions.includes("platform.clients.read")) {
        const myTeamIds = platformContext.teams.map((t) => t.id);
        const myMemberId = platformContext.platformMember.id;
        clients = clients.filter((c) => {
          const a = c.assignment;
          if (!a) return false;
          if (a.owner_platform_member_id === myMemberId) return true;
          if (myTeamIds.includes(a.team_id)) {
            const team = platformContext.teams.find((t) => t.id === a.team_id);
            if (platformContext.managedTeams.some((t) => t.id === a.team_id)) return true;
            if (team?.member_client_visibility === "team" || team?.member_client_visibility === "all") return true;
          }
          return false;
        });
      }
      res.json(clients);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const { data, error } = await getSupabaseAdmin().from("tenants").select("*, tenant_solutions(solution_id, status, solutions(key)), platform_client_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name))))").eq("id", clientId).single();
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const assignment = data.platform_client_assignments?.[0];
      let owner = null;
      if (assignment?.platform_members?.user_id) {
        const u = usersData?.users?.find((u2) => u2.id === assignment.platform_members.user_id);
        if (u) owner = { email: u.email, name: u.user_metadata?.full_name };
      }
      if (!platformContext.permissions.includes("platform.clients.read")) {
        const myTeamIds = platformContext.teams.map((t) => t.id);
        const myMemberId = platformContext.platformMember.id;
        let canView = false;
        if (assignment && assignment.owner_platform_member_id === myMemberId) canView = true;
        else if (assignment && myTeamIds.includes(assignment.team_id)) {
          const team = platformContext.teams.find((t) => t.id === assignment.team_id);
          if (platformContext.managedTeams.some((t) => t.id === assignment.team_id)) canView = true;
          else if (team?.member_client_visibility === "team" || team?.member_client_visibility === "all") canView = true;
        }
        if (!canView) return res.status(403).json({ error: "Forbidden" });
      }
      res.json({ ...data, assignment, owner });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/assign", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const { team_id, owner_platform_member_id } = req.body;
      if (!platformContext.permissions.includes("platform.clients.manage")) {
        const isManager = platformContext.managedTeams.some((t) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_client_assignments").upsert({
        tenant_id: clientId,
        team_id,
        owner_platform_member_id: owner_platform_member_id || null,
        assigned_by: platformContext.platformMember.id,
        status: "active"
      }, { onConflict: "tenant_id" }).select().single();
      if (error) throw error;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "client.assigned",
        entity_type: "platform_client_assignments",
        entity_id: clientId,
        severity: "info",
        team_id
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.put("/:id/solutions", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const clientId = req.params.id;
      const { solutionKeys } = req.body;
      if (!platformContext.permissions.includes("platform.solutions.manage")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await getSupabaseAdmin().from("tenant_solutions").delete().eq("tenant_id", clientId);
      if (solutionKeys && solutionKeys.length > 0) {
        const { data: dbSolutions, error: sErr } = await getSupabaseAdmin().from("solutions").select("id, key").in("key", solutionKeys);
        if (sErr) throw sErr;
        if (dbSolutions && dbSolutions.length > 0) {
          const solutionsToInsert = dbSolutions.map((s) => ({
            tenant_id: clientId,
            solution_id: s.id,
            status: "contracted"
          }));
          await getSupabaseAdmin().from("tenant_solutions").insert(solutionsToInsert);
        }
      }
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "solution.updated",
        entity_type: "tenant_solutions",
        entity_id: clientId,
        severity: "info",
        metadata: { solutions: solutionKeys }
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// src/server/adminOtherRouter.ts
import { Router as Router3 } from "express";
function createAdminOtherRouter(getSupabaseAdmin, requirePlatformAuth) {
  const router = Router3();
  router.get("/staff", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.staff.read") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { data: members, error: memberErr } = await getSupabaseAdmin().from("platform_members").select(`
          *,
          platform_roles(*),
          platform_team_members(*, platform_teams(*))
        `);
      if (memberErr) throw memberErr;
      const { data: usersData, error: userErr } = await getSupabaseAdmin().auth.admin.listUsers();
      if (userErr) throw userErr;
      const result = members.map((m) => {
        const user = usersData.users.find((u) => u.id === m.user_id);
        const role = m.platform_roles;
        const teams = (m.platform_team_members || []).map((tm) => tm.platform_teams);
        return {
          ...m,
          user: user ? {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            last_sign_in_at: user.last_sign_in_at,
            created_at: user.created_at
          } : null,
          role,
          teams
        };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/staff", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const callerRoleKey = platformContext.role?.key;
      if (!platformContext.permissions.includes("platform.staff.manage") && callerRoleKey !== "admin") {
        if (callerRoleKey !== "manager") {
          return res.status(403).json({ error: "Forbidden: Insufficient permissions to invite staff." });
        }
      }
      const { email, role_key, relationship_type, team_ids } = req.body;
      if (!email || !role_key || !relationship_type) {
        return res.status(400).json({ error: "Campos obrigat\xF3rios: e-mail, fun\xE7\xE3o e v\xEDnculo." });
      }
      if (callerRoleKey === "manager" && role_key !== "sales") {
        return res.status(403).json({ error: "Gerentes s\xF3 podem convidar membros para a fun\xE7\xE3o Sales (Vendas)." });
      }
      let finalRelationshipType = relationship_type;
      if (role_key === "admin") {
        finalRelationshipType = "partner";
      }
      const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
      const redirectTo = `${origin}/#/auth/accept-invite`;
      const { data: roleData } = await getSupabaseAdmin().from("platform_roles").select("id").eq("key", role_key).single();
      let userId;
      const { data: inviteData, error: inviteErr } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(email, {
        redirectTo
      });
      if (inviteErr) {
        const { data: usersList } = await getSupabaseAdmin().auth.admin.listUsers();
        const existingUser = usersList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existingUser) {
          return res.status(400).json({ error: inviteErr.message || "Erro ao enviar convite por e-mail." });
        }
        userId = existingUser.id;
      } else {
        userId = inviteData.user.id;
      }
      let { data: member } = await getSupabaseAdmin().from("platform_members").select("*").eq("user_id", userId).maybeSingle();
      if (!member) {
        const { data: newMem, error: insMemErr } = await getSupabaseAdmin().from("platform_members").insert({
          user_id: userId,
          relationship_type: finalRelationshipType,
          role_id: roleData?.id || null,
          status: "invited"
        }).select().single();
        if (insMemErr) throw insMemErr;
        member = newMem;
      } else {
        await getSupabaseAdmin().from("platform_members").update({
          relationship_type: finalRelationshipType,
          role_id: roleData?.id || member.role_id
        }).eq("id", member.id);
      }
      if (Array.isArray(team_ids) && team_ids.length > 0) {
        for (const teamId of team_ids) {
          await getSupabaseAdmin().from("platform_team_members").upsert({
            team_id: teamId,
            platform_member_id: member.id,
            team_role: "member",
            status: "active"
          }, { onConflict: "team_id,platform_member_id" });
        }
      }
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "platform.member.invited",
        entity_type: "platform_members",
        entity_id: member.id,
        severity: "info",
        details: { email, role_key, relationship_type: finalRelationshipType }
      });
      res.json({ success: true, member });
    } catch (e) {
      console.error("Error in POST /api/admin/staff:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.patch("/staff/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.staff.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const memberId = req.params.id;
      const { role_key, relationship_type, team_ids } = req.body;
      const { data: targetMember, error: tgtErr } = await getSupabaseAdmin().from("platform_members").select("*, platform_roles(key)").eq("id", memberId).single();
      if (tgtErr || !targetMember) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado." });
      }
      const targetCurrentRole = targetMember.platform_roles?.key;
      if (targetCurrentRole === "admin" && role_key && role_key !== "admin") {
        const { data: adminRole } = await getSupabaseAdmin().from("platform_roles").select("id").eq("key", "admin").single();
        if (adminRole) {
          const { data: activeAdmins } = await getSupabaseAdmin().from("platform_members").select("id").eq("role_id", adminRole.id).eq("status", "active");
          if ((activeAdmins || []).length <= 1) {
            return res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel rebaixar a fun\xE7\xE3o do \xFAnico Admin ativo da plataforma." });
          }
        }
      }
      let finalRelationshipType = relationship_type || targetMember.relationship_type;
      if (role_key === "admin") {
        finalRelationshipType = "partner";
      }
      if (relationship_type && finalRelationshipType !== targetMember.relationship_type) {
        await getSupabaseAdmin().from("platform_members").update({ relationship_type: finalRelationshipType }).eq("id", memberId);
        await getSupabaseAdmin().from("platform_audit_logs").insert({
          actor_user_id: req.user.id,
          action: "platform.member.relationship_changed",
          entity_type: "platform_members",
          entity_id: memberId,
          severity: "info",
          details: { old: targetMember.relationship_type, new: finalRelationshipType }
        });
      }
      if (role_key && role_key !== targetCurrentRole) {
        const { data: roleData } = await getSupabaseAdmin().from("platform_roles").select("id").eq("key", role_key).single();
        if (roleData) {
          await getSupabaseAdmin().from("platform_members").update({ role_id: roleData.id }).eq("id", memberId);
          await getSupabaseAdmin().from("platform_audit_logs").insert({
            actor_user_id: req.user.id,
            action: "platform.member.role_changed",
            entity_type: "platform_members",
            entity_id: memberId,
            severity: "info",
            details: { old: targetCurrentRole, new: role_key }
          });
        }
      }
      if (Array.isArray(team_ids)) {
        await getSupabaseAdmin().from("platform_team_members").delete().eq("platform_member_id", memberId);
        for (const teamId of team_ids) {
          await getSupabaseAdmin().from("platform_team_members").insert({
            team_id: teamId,
            platform_member_id: memberId,
            team_role: "member",
            status: "active"
          });
        }
        await getSupabaseAdmin().from("platform_audit_logs").insert({
          actor_user_id: req.user.id,
          action: "platform.member.team_added",
          entity_type: "platform_members",
          entity_id: memberId,
          severity: "info",
          details: { team_ids }
        });
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Error in PATCH /api/admin/staff/:id:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/staff/:id/suspend", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.staff.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const memberId = req.params.id;
      const { data: targetMember } = await getSupabaseAdmin().from("platform_members").select("*, platform_roles(key)").eq("id", memberId).single();
      if (!targetMember) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado." });
      }
      const targetRole = targetMember.platform_roles?.key;
      if (targetRole === "admin" && targetMember.status === "active") {
        const { data: adminRole } = await getSupabaseAdmin().from("platform_roles").select("id").eq("key", "admin").single();
        if (adminRole) {
          const { data: activeAdmins } = await getSupabaseAdmin().from("platform_members").select("id").eq("role_id", adminRole.id).eq("status", "active");
          if ((activeAdmins || []).length <= 1) {
            return res.status(400).json({ error: "N\xE3o \xE9 poss\xEDvel suspender o \xFAnico Admin ativo do sistema." });
          }
        }
      }
      const { error: updErr } = await getSupabaseAdmin().from("platform_members").update({ status: "suspended" }).eq("id", memberId);
      if (updErr) throw updErr;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "platform.member.suspended",
        entity_type: "platform_members",
        entity_id: memberId,
        severity: "warning"
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error suspending member:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/staff/:id/reactivate", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.staff.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const memberId = req.params.id;
      const { error: updErr } = await getSupabaseAdmin().from("platform_members").update({ status: "active" }).eq("id", memberId);
      if (updErr) throw updErr;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "platform.member.reactivated",
        entity_type: "platform_members",
        entity_id: memberId,
        severity: "info"
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error reactivating member:", e);
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/audit", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin().from("platform_audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (!platformContext.permissions.includes("platform.audit.read") && platformContext.role?.key !== "admin") {
        if (!platformContext.permissions.includes("platform.audit.team.read")) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const teamIds = platformContext.managedTeams.map((t) => t.id);
        if (teamIds.length === 0) return res.json([]);
        query = query.in("team_id", teamIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const result = data.map((log) => {
        const user = usersData?.users?.find((u) => u.id === log.actor_user_id);
        return { ...log, actor_email: user?.email || "Sistema" };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/system/health", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.system.read") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_roles").select("id").limit(1);
      res.json({
        status: "operational",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        environment: process.env.NODE_ENV || "development",
        database: error ? "error" : "connected",
        auth: "connected",
        uptime: process.uptime()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// src/server/adminTeamsRouter.ts
import { Router as Router4 } from "express";
function createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth) {
  const router = Router4();
  router.get("/", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin().from("platform_teams").select("*").order("name");
      if (!platformContext.permissions.includes("platform.teams.read")) {
        const teamIds = platformContext.teams.map((t) => t.id);
        if (teamIds.length === 0) return res.json([]);
        query = query.in("id", teamIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.teams.manage")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { name, team_type, channel, description, member_lead_visibility, member_client_visibility, allow_self_claim } = req.body;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data, error } = await getSupabaseAdmin().from("platform_teams").insert({
        name,
        slug,
        team_type,
        channel,
        description,
        member_lead_visibility,
        member_client_visibility,
        allow_self_claim,
        status: "active",
        created_by: platformContext.platformMember.id
      }).select().single();
      if (error) throw error;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "team.created",
        entity_type: "platform_teams",
        entity_id: data.id,
        severity: "info"
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      if (!platformContext.permissions.includes("platform.teams.read")) {
        const isMember = platformContext.teams.some((t) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_teams").select("*").eq("id", teamId).single();
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.patch("/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      let isManager = false;
      if (!platformContext.permissions.includes("platform.teams.manage")) {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const updates = { ...req.body };
      delete updates.id;
      const { data, error } = await getSupabaseAdmin().from("platform_teams").update(updates).eq("id", teamId).select().single();
      if (error) throw error;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "team.updated",
        entity_type: "platform_teams",
        entity_id: data.id,
        severity: "info",
        team_id: teamId
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id/members", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      if (!platformContext.permissions.includes("platform.teams.read")) {
        const isMember = platformContext.teams.some((t) => t.id === teamId);
        if (!isMember) return res.status(403).json({ error: "Forbidden" });
      }
      const { data: teamMembers, error } = await getSupabaseAdmin().from("platform_team_members").select(`
          team_role,
          status,
          joined_at,
          platform_members (
            id,
            user_id,
            relationship_type,
            status,
            platform_roles ( key, name )
          )
        `).eq("team_id", teamId);
      if (error) throw error;
      const { data: usersData } = await getSupabaseAdmin().auth.admin.listUsers();
      const result = teamMembers.map((tm) => {
        const member = tm.platform_members;
        const user = usersData?.users?.find((u) => u.id === member.user_id);
        const role = member?.platform_roles;
        return {
          platform_member_id: member.id,
          team_role: tm.team_role,
          status: tm.status,
          joined_at: tm.joined_at,
          member_status: member.status,
          relationship_type: member.relationship_type,
          user: user ? { email: user.email, name: user.user_metadata?.full_name } : null,
          role
        };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/members", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const { platform_member_id, team_role } = req.body;
      let isManager = false;
      const hasGlobal = platformContext.permissions.includes("platform.teams.manage");
      if (!hasGlobal) {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
        const { data: tgtMember } = await getSupabaseAdmin().from("platform_members").select("platform_roles(key)").eq("id", platform_member_id).single();
        if (tgtMember?.platform_roles?.key !== "sales") {
          return res.status(403).json({ error: "Managers can only add Sales to their team" });
        }
        if (team_role === "manager") {
          return res.status(403).json({ error: "Managers cannot create other Managers" });
        }
      }
      const { data, error } = await getSupabaseAdmin().from("platform_team_members").upsert({
        team_id: teamId,
        platform_member_id,
        team_role,
        status: "active"
      }, { onConflict: "team_id,platform_member_id" }).select().single();
      if (error) throw error;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: team_role === "manager" ? "team.manager.added" : "team.member.added",
        entity_type: "platform_team_members",
        entity_id: platform_member_id,
        severity: "info",
        team_id: teamId
      });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.delete("/:id/members/:memberId", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      const teamId = req.params.id;
      const platform_member_id = req.params.memberId;
      let isManager = false;
      if (!platformContext.permissions.includes("platform.teams.manage")) {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const { error } = await getSupabaseAdmin().from("platform_team_members").delete().eq("team_id", teamId).eq("platform_member_id", platform_member_id);
      if (error) throw error;
      await getSupabaseAdmin().from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "team.member.removed",
        entity_type: "platform_team_members",
        entity_id: platform_member_id,
        severity: "info",
        team_id: teamId
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}

// server.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({ path: [".env.local", ".env"] });
async function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cors());
  let _supabaseAdmin = null;
  const getSupabaseAdmin = () => {
    if (!_supabaseAdmin) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
      if (!url || !key) {
        throw new Error("Missing Supabase credentials");
      }
      _supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    }
    return _supabaseAdmin;
  };
  const requirePlatformAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });
      const { data: platformMember, error: memberErr } = await getSupabaseAdmin().from("platform_members").select("*, platform_roles(*)").eq("user_id", user.id).maybeSingle();
      if (memberErr || !platformMember) {
        return res.status(403).json({ error: "Forbidden: Not a platform member" });
      }
      if (platformMember.status === "suspended") {
        return res.status(403).json({ error: "Seu acesso administrativo est\xE1 suspenso." });
      }
      const role = platformMember.platform_roles;
      if (!role) {
        return res.status(403).json({ error: "Forbidden: No platform role assigned" });
      }
      const { data: rolePerms } = await getSupabaseAdmin().from("platform_role_permissions").select("platform_permissions(key)").eq("role_id", role.id);
      const permissions = (rolePerms || []).map((rp) => rp.platform_permissions?.key).filter(Boolean);
      const { data: teamMemberships } = await getSupabaseAdmin().from("platform_team_members").select("*, platform_teams(*)").eq("platform_member_id", platformMember.id).eq("status", "active");
      const teams = (teamMemberships || []).map((tm) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm) => tm.team_role === "manager").map((tm) => tm.platform_teams);
      req.user = user;
      req.platformContext = {
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams
      };
      next();
    } catch (e) {
      console.error("requirePlatformAuth error:", e);
      return res.status(500).json({ error: "Configuration error on server" });
    }
  };
  app.get("/api/admin/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing authorization header" });
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user }, error: authErr } = await getSupabaseAdmin().auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Invalid session" });
      const { data: tenantMemberships } = await getSupabaseAdmin().from("memberships").select("*, tenants(*)").eq("user_id", user.id);
      const { data: platformMember } = await getSupabaseAdmin().from("platform_members").select("*, platform_roles(*)").eq("user_id", user.id).maybeSingle();
      if (!platformMember) {
        return res.json({
          user,
          isPlatformMember: false,
          isPlatformSuspended: false,
          tenantMemberships: tenantMemberships || []
        });
      }
      if (platformMember.status === "suspended") {
        return res.json({
          user,
          isPlatformMember: true,
          isPlatformSuspended: true,
          platformMember,
          tenantMemberships: tenantMemberships || [],
          error: "Seu acesso administrativo est\xE1 suspenso."
        });
      }
      const role = platformMember.platform_roles;
      const { data: rolePerms } = role ? await getSupabaseAdmin().from("platform_role_permissions").select("platform_permissions(key)").eq("role_id", role.id) : { data: [] };
      const permissions = (rolePerms || []).map((rp) => rp.platform_permissions?.key).filter(Boolean);
      const { data: teamMemberships } = await getSupabaseAdmin().from("platform_team_members").select("*, platform_teams(*)").eq("platform_member_id", platformMember.id).eq("status", "active");
      const teams = (teamMemberships || []).map((tm) => tm.platform_teams);
      const managedTeams = (teamMemberships || []).filter((tm) => tm.team_role === "manager").map((tm) => tm.platform_teams);
      return res.json({
        user,
        isPlatformMember: true,
        isPlatformSuspended: false,
        platformMember,
        role,
        relationshipType: platformMember.relationship_type,
        permissions,
        teams,
        managedTeams,
        tenantMemberships: tenantMemberships || []
      });
    } catch (e) {
      console.error("Error in /api/admin/me:", e);
      return res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/admin/tenants", requirePlatformAuth, async (req, res) => {
    try {
      const { data: leads, error: leadsErr } = await getSupabaseAdmin().from("marketing_leads").select("*");
      if (leadsErr) throw leadsErr;
      const { data: tenantsData, error: tenantsErr } = await getSupabaseAdmin().from("tenants").select(`
          *,
          tenant_solutions (*)
        `);
      if (tenantsErr) throw tenantsErr;
      const result = [];
      for (const lead of leads || []) {
        if (lead.status === "approved") continue;
        result.push({
          id: lead.id,
          slug: "",
          legalName: lead.company,
          displayName: lead.company,
          logoInitials: lead.company.substring(0, 2).toUpperCase(),
          primaryColor: "#353938",
          lifecycleStatus: lead.status === "new" ? "demo_requested" : "demo_requested",
          isFictionalDemo: false,
          solutionEntitlements: [],
          createdAt: lead.created_at,
          email: lead.email,
          contactName: lead.name
        });
      }
      for (const t of tenantsData || []) {
        const solutions = (t.tenant_solutions || []).map((ts) => ({
          solutionId: ts.solution_id,
          status: ts.status
        }));
        let status = t.status;
        if (status === "active") status = "demo_approved";
        const settings = t.settings || {};
        result.push({
          id: t.id,
          slug: t.slug,
          legalName: t.name,
          displayName: t.name,
          logoInitials: settings.logoInitials || t.name.substring(0, 2).toUpperCase(),
          primaryColor: settings.primaryColor || "#B66E45",
          lifecycleStatus: status,
          isFictionalDemo: false,
          solutionEntitlements: solutions,
          createdAt: t.created_at
        });
      }
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/admin/tenants/:id", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.tenants.read")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const tenantId = req.params.id;
      const { data, error } = await getSupabaseAdmin().from("tenants").select("*, tenant_solutions(*)").eq("id", tenantId).single();
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/admin/tenants/release-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { tenantId, solutionIds, primaryColor, logoInitials } = req.body;
      const { data: lead } = await getSupabaseAdmin().from("marketing_leads").select("*").eq("id", tenantId).single();
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      const slug = lead.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let { data: tenant } = await getSupabaseAdmin().from("tenants").select("*").eq("slug", slug).single();
      if (!tenant) {
        const { data: newTenant, error: tErr } = await getSupabaseAdmin().from("tenants").insert({
          name: lead.company,
          slug,
          status: "active",
          settings: { primaryColor, logoInitials }
        }).select().single();
        if (tErr) throw tErr;
        tenant = newTenant;
      }
      await getSupabaseAdmin().from("tenant_solutions").delete().eq("tenant_id", tenant.id);
      if (solutionIds && solutionIds.length > 0) {
        const { data: dbSolutions, error: sErr } = await getSupabaseAdmin().from("solutions").select("id, key").in("key", solutionIds);
        if (sErr) throw sErr;
        if (dbSolutions && dbSolutions.length > 0) {
          const solutionsToInsert = dbSolutions.map((s) => ({
            tenant_id: tenant.id,
            solution_id: s.id,
            status: "contracted"
          }));
          await getSupabaseAdmin().from("tenant_solutions").insert(solutionsToInsert);
        }
      }
      const { data: { users }, error: uErr } = await getSupabaseAdmin().auth.admin.listUsers();
      let user = users.find((u) => u.email === lead.email);
      if (!user) {
        const { data: inviteData, error: inviteErr } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(lead.email, {
          data: { full_name: lead.name }
        });
        if (inviteErr) throw inviteErr;
        user = inviteData.user;
      }
      let { data: membership, error: mErr } = await getSupabaseAdmin().from("memberships").select("*").eq("tenant_id", tenant.id).eq("user_id", user.id).single();
      if (!membership) {
        const { data: newMembership, error: mInsErr } = await getSupabaseAdmin().from("memberships").insert({
          tenant_id: tenant.id,
          user_id: user.id,
          status: "active"
        }).select().single();
        if (mInsErr) throw mInsErr;
        membership = newMembership;
      }
      const { data: role } = await getSupabaseAdmin().from("roles").select("id").eq("key", "tenant_admin").single();
      if (role) {
        const { data: existingRole } = await getSupabaseAdmin().from("membership_roles").select("*").eq("membership_id", membership.id).eq("role_id", role.id).single();
        if (!existingRole) {
          await getSupabaseAdmin().from("membership_roles").insert({
            membership_id: membership.id,
            role_id: role.id
          });
        }
      }
      const { data: leadAssignment } = await getSupabaseAdmin().from("platform_lead_assignments").select("*").eq("lead_id", lead.id).single();
      if (leadAssignment) {
        await getSupabaseAdmin().from("platform_client_assignments").insert({
          tenant_id: tenant.id,
          team_id: leadAssignment.team_id,
          owner_platform_member_id: leadAssignment.owner_platform_member_id,
          assigned_by: req.platformContext?.platformMember?.id || null,
          status: "active"
        });
      }
      await getSupabaseAdmin().from("marketing_leads").update({ status: "approved" }).eq("id", lead.id);
      res.json({ success: true, tenant });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/admin/tenants/revoke-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { tenantId } = req.body;
      await getSupabaseAdmin().from("tenants").update({ status: "suspended" }).eq("id", tenantId);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/admin/consultants", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.staff.read")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { data: members, error: memberErr } = await getSupabaseAdmin().from("platform_members").select("*, platform_member_roles(platform_roles(*))");
      if (memberErr) throw memberErr;
      const { data: usersData, error: userErr } = await getSupabaseAdmin().auth.admin.listUsers();
      if (userErr) throw userErr;
      const result = members.map((m) => {
        const user = usersData.users.find((u) => u.id === m.user_id);
        const role = m.platform_member_roles?.[0]?.platform_roles;
        return {
          ...m,
          user,
          role
        };
      });
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/admin/contracts", requirePlatformAuth, async (req, res) => {
    res.json([]);
  });
  app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/leads", createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/clients", createAdminClientsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin", createAdminOtherRouter(getSupabaseAdmin, requirePlatformAuth));
  app.get("/api/admin/stats", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      let clientsQuery = getSupabaseAdmin().from("platform_client_assignments").select("*", { count: "exact", head: true });
      let leadsQuery = getSupabaseAdmin().from("platform_lead_assignments").select("*, marketing_leads!inner(*)", { count: "exact", head: true }).eq("marketing_leads.status", "new");
      let demosQuery = getSupabaseAdmin().from("platform_lead_assignments").select("*, marketing_leads!inner(*)", { count: "exact", head: true }).eq("marketing_leads.status", "approved");
      if (!platformContext.permissions.includes("platform.leads.read")) {
        const teamIds = platformContext.teams.map((t) => t.id);
        if (teamIds.length === 0) {
          return res.json({ clients: 0, leads: 0, demos: 0, teams: 0 });
        }
        clientsQuery = clientsQuery.in("team_id", teamIds);
        leadsQuery = leadsQuery.in("team_id", teamIds);
        demosQuery = demosQuery.in("team_id", teamIds);
      }
      const [{ count: clientsCount }, { count: leadsCount }, { count: demosCount }, { count: teamsCount }] = await Promise.all([
        clientsQuery,
        leadsQuery,
        demosQuery,
        getSupabaseAdmin().from("platform_teams").select("*", { count: "exact", head: true }).eq("status", "active")
      ]);
      res.json({
        clients: clientsCount || 0,
        leads: leadsCount || 0,
        demos: demosCount || 0,
        teams: platformContext.permissions.includes("platform.teams.read") ? teamsCount || 0 : platformContext.teams.length
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/temp-slugs", async (req, res) => {
    try {
      const { data: tenants } = await getSupabaseAdmin().from("tenants").select("slug, name");
      const { data: users } = await getSupabaseAdmin().auth.admin.listUsers();
      res.json({ tenants, users: users?.users?.map((u) => ({ email: u.email })) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/public/tenants/resolve", async (req, res) => {
    try {
      const { slug, domain } = req.query;
      let tenant = null;
      if (slug) {
        const { data, error } = await getSupabaseAdmin().from("tenants").select("id, name, slug, status, settings").eq("slug", slug).eq("status", "active").single();
        if (!error && data) tenant = data;
      } else if (domain) {
        const { data: td, error: e1 } = await getSupabaseAdmin().from("tenant_domains").select("tenant_id").eq("domain", domain).single();
        if (!e1 && td) {
          const { data, error } = await getSupabaseAdmin().from("tenants").select("id, name, slug, status, settings").eq("id", td.tenant_id).eq("status", "active").single();
          if (!error && data) tenant = data;
        }
      }
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  return app;
}
async function startServer() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3e3);
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
}

// vercel-handler.ts
var appPromise = createApp();
async function handler(req, res) {
  const app = await appPromise;
  const path2 = typeof req.query.path === "string" ? req.query.path : "";
  if (path2) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string") query.append(key, item);
        });
      } else if (typeof value === "string") {
        query.set(key, value);
      }
    }
    req.url = `/api/${path2}${query.size ? `?${query}` : ""}`;
  }
  return app(req, res);
}
export {
  handler as default
};
