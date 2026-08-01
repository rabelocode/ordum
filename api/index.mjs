// server.ts
import express from "express";
import path from "path";

// src/server/adminLeadsRouter.ts
import { Router } from "express";

// src/server/authorization.ts
function isGlobalAdmin(context) {
  return context.platformMember?.status !== "suspended" && context.role?.key === "admin";
}
function canReadAssignedResource(context, assignment, visibilityField) {
  if (context.platformMember?.status === "suspended") return false;
  if (isGlobalAdmin(context)) return true;
  if (!assignment?.team_id) return false;
  if (assignment.owner_platform_member_id === context.platformMember.id) return true;
  if (context.managedTeams.some((team2) => team2.id === assignment.team_id)) return true;
  const team = context.teams.find((candidate) => candidate.id === assignment.team_id);
  return team?.[visibilityField] === "team" || team?.[visibilityField] === "all";
}

// src/server/adminLeadsRouter.ts
function createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth) {
  const router = Router();
  router.get("/", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      let query = getSupabaseAdmin().from("marketing_leads").select("*, platform_lead_assignments(*, platform_teams(name), platform_members(user_id, platform_roles(key, name)))").order("created_at", { ascending: false });
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
      if (platformContext.role?.key !== "admin") {
        leads = leads.filter((lead) => canReadAssignedResource(platformContext, lead.assignment, "member_lead_visibility"));
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
      if (platformContext.role?.key !== "admin") {
        const isManager = platformContext.managedTeams.some((t) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_lead_assignments").upsert({
        lead_id: leadId,
        team_id,
        owner_platform_member_id: owner_platform_member_id || null,
        assigned_by_user_id: req.user.id
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
      const { data, error } = await getSupabaseAdmin().from("platform_lead_assignments").update({ owner_platform_member_id: myMemberId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("lead_id", leadId).is("owner_platform_member_id", null).select().single();
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
      if (platformContext.role?.key !== "admin") {
        clients = clients.filter((client) => canReadAssignedResource(platformContext, client.assignment, "member_client_visibility"));
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
      if (platformContext.role?.key !== "admin") {
        if (!canReadAssignedResource(platformContext, assignment, "member_client_visibility")) return res.status(403).json({ error: "Forbidden" });
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
      if (platformContext.role?.key !== "admin") {
        const isManager = platformContext.managedTeams.some((t) => t.id === team_id);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await getSupabaseAdmin().from("platform_client_assignments").upsert({
        tenant_id: clientId,
        team_id,
        owner_platform_member_id: owner_platform_member_id || null,
        assigned_by_user_id: req.user.id,
        assignment_type: "commercial",
        status: "active"
      }, { onConflict: "tenant_id,team_id,assignment_type" }).select().single();
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
            status: "active"
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

// src/server/billing/config.ts
var SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
function getBillingConfig(env = process.env) {
  const enabled = env.BILLING_ENABLED === "true";
  const provider = env.BILLING_PROVIDER || "asaas";
  const environment = env.ASAAS_ENV || "sandbox";
  const baseUrl = (env.ASAAS_BASE_URL || SANDBOX_URL).replace(/\/$/, "");
  const apiKey = env.ASAAS_API_KEY?.trim();
  const webhookToken = env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (provider !== "asaas") throw new Error(`Provedor de cobran\xE7a n\xE3o suportado: ${provider}`);
  if (environment !== "sandbox") throw new Error("Cobran\xE7a em produ\xE7\xE3o permanece bloqueada at\xE9 homologa\xE7\xE3o e autoriza\xE7\xE3o expl\xEDcita.");
  if (baseUrl !== SANDBOX_URL) throw new Error("ASAAS_BASE_URL n\xE3o corresponde ao ambiente Sandbox.");
  if (apiKey && !apiKey.startsWith("$aact_hmlg_")) throw new Error("A chave configurada n\xE3o parece ser uma chave Asaas Sandbox.");
  if (enabled && (!apiKey || !webhookToken)) throw new Error("Billing habilitado sem ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.");
  return {
    enabled,
    provider: "asaas",
    environment: "sandbox",
    baseUrl,
    apiKey,
    webhookToken,
    webhookUrl: env.ASAAS_WEBHOOK_URL?.trim(),
    userAgent: env.ASAAS_USER_AGENT?.trim() || "Ordum"
  };
}
function publicBillingHealth(env = process.env) {
  try {
    const config = getBillingConfig(env);
    return {
      provider: config.provider,
      environment: config.environment,
      enabled: config.enabled,
      configured: Boolean(config.apiKey && config.webhookToken),
      webhookUrlConfigured: Boolean(config.webhookUrl)
    };
  } catch (error) {
    return {
      provider: "asaas",
      environment: env.ASAAS_ENV || "sandbox",
      enabled: env.BILLING_ENABLED === "true",
      configured: false,
      webhookUrlConfigured: Boolean(env.ASAAS_WEBHOOK_URL),
      error: error instanceof Error ? error.message : "Configura\xE7\xE3o inv\xE1lida"
    };
  }
}

// src/server/adminOtherRouter.ts
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
      let result = members.map((m) => {
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
      if (platformContext.role?.key !== "admin") {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team) => team.id));
        result = result.filter((member) => member.user_id === req.user.id || member.role?.key === "sales" && member.platform_team_members?.some((membership) => managedTeamIds.has(membership.team_id)));
      }
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
      if (callerRoleKey === "manager") {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team) => team.id));
        if (!Array.isArray(team_ids) || team_ids.length === 0 || team_ids.some((teamId) => !managedTeamIds.has(teamId))) {
          return res.status(403).json({ error: "Gerentes s\xF3 podem convidar Sales para equipes que gerenciam." });
        }
      }
      let finalRelationshipType = relationship_type;
      if (role_key === "admin") {
        finalRelationshipType = "partner";
      }
      const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
      const redirectTo = `${origin}/#/auth/accept-invite`;
      const { data: roleData } = await getSupabaseAdmin().from("platform_roles").select("id").eq("key", role_key).single();
      if (!roleData) return res.status(400).json({ error: "Fun\xE7\xE3o interna inv\xE1lida." });
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
        metadata: { email, role_key, relationship_type: finalRelationshipType }
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
      const callerRoleKey = platformContext.role?.key;
      const isManager = callerRoleKey === "manager";
      if (!platformContext.permissions.includes("platform.staff.manage") && callerRoleKey !== "admin" && !isManager) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const memberId = req.params.id;
      const { role_key, relationship_type, team_ids } = req.body;
      const { data: targetMember, error: tgtErr } = await getSupabaseAdmin().from("platform_members").select("*, platform_roles(key)").eq("id", memberId).single();
      if (tgtErr || !targetMember) {
        return res.status(404).json({ error: "Membro n\xE3o encontrado." });
      }
      if (targetMember.user_id === req.user.id && role_key && role_key !== targetMember.platform_roles?.key) {
        return res.status(403).json({ error: "Ningu\xE9m pode alterar a pr\xF3pria fun\xE7\xE3o global." });
      }
      if (isManager) {
        const managedTeamIds = new Set(platformContext.managedTeams.map((team) => team.id));
        const { data: targetTeams } = await getSupabaseAdmin().from("platform_team_members").select("team_id").eq("platform_member_id", memberId).eq("status", "active");
        const inScope = (targetTeams || []).some((team) => managedTeamIds.has(team.team_id));
        const requestedTeamsAreScoped = !Array.isArray(team_ids) || team_ids.length > 0 && team_ids.every((teamId) => managedTeamIds.has(teamId));
        if (targetMember.platform_roles?.key !== "sales" || role_key && role_key !== "sales" || !inScope || !requestedTeamsAreScoped) {
          return res.status(403).json({ error: "Gerentes s\xF3 podem administrar vendedores das pr\xF3prias equipes." });
        }
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
          metadata: { old: targetMember.relationship_type, new: finalRelationshipType }
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
            metadata: { old: targetCurrentRole, new: role_key }
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
          metadata: { team_ids }
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
      if (platformContext.role?.key !== "admin") {
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
        billing: publicBillingHealth(),
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
      if (platformContext.role?.key !== "admin") {
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
      if (platformContext.role?.key !== "admin" || !platformContext.permissions.includes("platform.teams.create")) {
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
      if (platformContext.role?.key !== "admin") {
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
      if (platformContext.role?.key !== "admin") {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
      }
      const allowedFields = isManager ? ["description", "member_lead_visibility", "member_client_visibility", "allow_self_claim"] : ["name", "description", "team_type", "channel", "status", "member_lead_visibility", "member_client_visibility", "allow_self_claim", "settings"];
      const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });
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
      if (platformContext.role?.key !== "admin") {
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
      const hasGlobal = platformContext.role?.key === "admin";
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
      if (platformContext.role?.key !== "admin") {
        isManager = platformContext.managedTeams.some((t) => t.id === teamId);
        if (!isManager) return res.status(403).json({ error: "Forbidden" });
        const { data: target } = await getSupabaseAdmin().from("platform_team_members").select("team_role, platform_members(platform_roles(key))").eq("team_id", teamId).eq("platform_member_id", platform_member_id).maybeSingle();
        if (target?.team_role === "manager" || target?.platform_members?.platform_roles?.key !== "sales") {
          return res.status(403).json({ error: "Managers can only remove Sales members from their team" });
        }
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

// src/server/billing/router.ts
import { timingSafeEqual } from "node:crypto";
import { Router as Router5 } from "express";

// src/server/billing/asaas.ts
var CYCLE_MAP = {
  weekly: "WEEKLY",
  biweekly: "BIWEEKLY",
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  semiannual: "SEMIANNUALLY",
  yearly: "YEARLY"
};
var AsaasBillingProvider = class {
  constructor(config) {
    this.config = config;
    if (!config.enabled || !config.apiKey) throw new Error("Integra\xE7\xE3o Asaas Sandbox n\xE3o est\xE1 habilitada.");
  }
  async request(path2, init) {
    const response = await fetch(`${this.config.baseUrl}${path2}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.config.userAgent,
        access_token: this.config.apiKey,
        ...init?.headers
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const description = Array.isArray(body?.errors) ? body.errors.map((item) => item.description).filter(Boolean).join("; ") : "";
      throw new Error(`Asaas respondeu ${response.status}${description ? `: ${description}` : ""}`);
    }
    return body;
  }
  createCustomer(input) {
    return this.request("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        mobilePhone: input.mobilePhone,
        externalReference: input.externalReference,
        notificationDisabled: false
      })
    });
  }
  async findCustomerByExternalReference(externalReference) {
    const result = await this.request(`/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
    return Array.isArray(result.data) ? result.data[0] || null : null;
  }
  createSubscription(input) {
    return this.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: input.customerId,
        billingType: input.billingType,
        cycle: CYCLE_MAP[input.cycle],
        value: input.amountCents / 100,
        nextDueDate: input.nextDueDate,
        externalReference: input.externalReference,
        description: input.description
      })
    });
  }
  async findSubscriptionByExternalReference(externalReference) {
    const result = await this.request(`/subscriptions?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
    return Array.isArray(result.data) ? result.data[0] || null : null;
  }
  getPayment(id) {
    return this.request(`/payments/${encodeURIComponent(id)}`);
  }
  getSubscription(id) {
    return this.request(`/subscriptions/${encodeURIComponent(id)}`);
  }
};

// src/server/billing/domain.ts
var SUPPORTED_ASAAS_EVENTS = /* @__PURE__ */ new Set([
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_DUNNING_RECEIVED",
  "PAYMENT_DUNNING_REQUESTED",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED"
]);
var PAYMENT_STATUS = {
  PAYMENT_CREATED: "pending",
  PAYMENT_UPDATED: "pending",
  PAYMENT_CONFIRMED: "confirmed",
  PAYMENT_RECEIVED: "received",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "refused",
  PAYMENT_DELETED: "deleted",
  PAYMENT_RESTORED: "restored",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_PARTIALLY_REFUNDED: "partially_refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
  PAYMENT_CHARGEBACK_DISPUTE: "chargeback",
  AWAITING_CHARGEBACK_REVERSAL: "chargeback",
  PAYMENT_DUNNING_RECEIVED: "received",
  PAYMENT_DUNNING_REQUESTED: "overdue"
};
function normalizePaymentStatus(eventType, providerStatus) {
  return PAYMENT_STATUS[eventType] ?? normalizeProviderPaymentStatus(providerStatus);
}
function normalizeProviderPaymentStatus(providerStatus) {
  const status = providerStatus?.toUpperCase();
  if (status === "CONFIRMED") return "confirmed";
  if (status === "RECEIVED" || status === "RECEIVED_IN_CASH") return "received";
  if (status === "OVERDUE" || status === "DUNNING_REQUESTED") return "overdue";
  if (status === "REFUNDED") return "refunded";
  if (status === "REFUND_REQUESTED") return "pending";
  if (status === "PARTIALLY_REFUNDED") return "partially_refunded";
  if (status === "CHARGEBACK_REQUESTED" || status === "CHARGEBACK_DISPUTE") return "chargeback";
  if (status === "DELETED") return "deleted";
  return "pending";
}
function preserveSettledPaymentStatus(existingStatus, incomingStatus) {
  if (existingStatus && ["confirmed", "received"].includes(existingStatus) && ["pending", "overdue", "refused", "restored"].includes(incomingStatus)) return existingStatus;
  return incomingStatus;
}
function accessTransitionForPaymentStatus(status) {
  if (status === "confirmed" || status === "received") return "active";
  if (status === "overdue") return "grace";
  if (status === "chargeback" || status === "refunded") return "review";
  return null;
}
function asUtcDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function isoDate(value) {
  return value.toISOString().slice(0, 10);
}
function addCycle(start, cycle) {
  const result = new Date(start);
  if (cycle === "weekly") result.setUTCDate(result.getUTCDate() + 7);
  if (cycle === "biweekly") result.setUTCDate(result.getUTCDate() + 14);
  if (cycle === "monthly") result.setUTCMonth(result.getUTCMonth() + 1);
  if (cycle === "quarterly") result.setUTCMonth(result.getUTCMonth() + 3);
  if (cycle === "semiannual") result.setUTCMonth(result.getUTCMonth() + 6);
  if (cycle === "yearly") result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
}
function paidPeriod(dueDate, cycle, currentPaidThrough) {
  const due = asUtcDate(dueDate);
  const existingEnd = currentPaidThrough ? asUtcDate(currentPaidThrough) : null;
  const start = existingEnd && existingEnd >= due ? new Date(existingEnd.getTime() + 864e5) : due;
  const exclusiveEnd = addCycle(start, cycle);
  const end = new Date(exclusiveEnd.getTime() - 864e5);
  return { startsOn: isoDate(start), endsOn: isoDate(end) };
}
function addGracePeriod(dueDate, graceDays) {
  const value = asUtcDate(dueDate);
  value.setUTCDate(value.getUTCDate() + Math.max(0, graceDays));
  return value.toISOString();
}
function centsFromProvider(value) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}
function safeProviderMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value;
  const allowed = ["description", "billingType", "cycle", "installmentCount", "deleted", "anticipated"];
  return Object.fromEntries(allowed.filter((key) => key in source).map((key) => [key, source[key]]));
}

// src/server/billing/router.ts
function hasPermission(context, permission) {
  return context.role?.key === "admin" || context.permissions.includes(permission);
}
function webhookTokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
function cleanError(error) {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  return message.replace(/\$aact_[A-Za-z0-9_\-]+/g, "[REDACTED]").slice(0, 500);
}
function slugDate(value) {
  return value?.slice(0, 10) || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function ensureOwnerUser(db, contract) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1e3 });
  if (error) throw error;
  const existing = data.users.find((user) => user.email?.toLowerCase() === contract.owner_email.toLowerCase());
  if (existing) return existing;
  const baseUrl = process.env.APP_URL || "https://ordum-ordum.vercel.app";
  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(contract.owner_email, {
    redirectTo: `${baseUrl.replace(/\/$/, "")}/#/auth/accept-invite`,
    data: { full_name: contract.owner_name || contract.customer_name }
  });
  if (inviteError) throw inviteError;
  return invited.user;
}
async function resolveContract(db, payment, subscriptionId) {
  if (subscriptionId) {
    const { data: subscription } = await db.from("billing_subscriptions").select("*, commercial_contracts(*)").eq("provider_subscription_id", subscriptionId).maybeSingle();
    if (subscription?.commercial_contracts) return { contract: subscription.commercial_contracts, subscription };
  }
  const externalReference = payment?.externalReference;
  if (externalReference) {
    const { data: contract } = await db.from("commercial_contracts").select("*").eq("external_reference", externalReference).maybeSingle();
    if (contract) return { contract, subscription: null };
  }
  return { contract: null, subscription: null };
}
async function processPaymentEvent(db, eventRow, payload) {
  const payment = payload.payment;
  if (!payment?.id) return "ignored";
  const { contract, subscription } = await resolveContract(db, payment, payment.subscription);
  const providerStatus = payment.status ? String(payment.status) : void 0;
  let normalizedStatus = normalizePaymentStatus(payload.event, providerStatus);
  const { data: existingPayment } = await db.from("billing_payments").select("*").eq("provider_payment_id", payment.id).maybeSingle();
  normalizedStatus = preserveSettledPaymentStatus(existingPayment?.status, normalizedStatus);
  const dueDate = slugDate(payment.dueDate);
  let startsOn = existingPayment?.paid_period_starts_on ?? null;
  let endsOn = existingPayment?.paid_period_ends_on ?? null;
  if (contract && ["confirmed", "received"].includes(normalizedStatus) && !existingPayment?.paid_period_ends_on) {
    const currentState = contract.tenant_id ? (await db.from("tenant_billing_state").select("paid_through").eq("tenant_id", contract.tenant_id).maybeSingle()).data : null;
    const period = paidPeriod(dueDate, contract.cycle, currentState?.paid_through);
    startsOn = period.startsOn;
    endsOn = period.endsOn;
  }
  const paymentValues = {
    provider: "asaas",
    provider_payment_id: payment.id,
    subscription_id: subscription?.id ?? existingPayment?.subscription_id ?? null,
    contract_id: contract?.id ?? existingPayment?.contract_id ?? null,
    tenant_id: contract?.tenant_id ?? existingPayment?.tenant_id ?? null,
    external_reference: payment.externalReference || existingPayment?.external_reference || null,
    status: normalizedStatus,
    provider_status: providerStatus || null,
    amount_cents: centsFromProvider(payment.value),
    net_amount_cents: payment.netValue == null ? null : centsFromProvider(payment.netValue),
    due_date: dueDate,
    confirmed_at: normalizedStatus === "confirmed" ? payment.confirmedDate || payment.clientPaymentDate || (/* @__PURE__ */ new Date()).toISOString() : existingPayment?.confirmed_at ?? null,
    received_at: normalizedStatus === "received" ? payment.paymentDate || payment.clientPaymentDate || (/* @__PURE__ */ new Date()).toISOString() : existingPayment?.received_at ?? null,
    paid_period_starts_on: startsOn,
    paid_period_ends_on: endsOn,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    metadata: safeProviderMetadata(payment)
  };
  const { data: savedPayment, error: paymentError } = await db.from("billing_payments").upsert(paymentValues, { onConflict: "provider,provider_payment_id" }).select().single();
  if (paymentError) throw paymentError;
  if (!contract) return "ignored";
  const accessStatus = accessTransitionForPaymentStatus(normalizedStatus);
  if (accessStatus === "active") {
    const owner = await ensureOwnerUser(db, contract);
    const { data: tenantId, error: provisionError } = await db.rpc("provision_paid_contract", {
      p_contract_id: contract.id,
      p_payment_id: savedPayment.id,
      p_owner_user_id: owner.id,
      p_actor_user_id: null
    });
    if (provisionError) throw provisionError;
    await db.from("billing_payments").update({ tenant_id: tenantId }).eq("id", savedPayment.id);
  } else if (accessStatus === "grace" && contract.tenant_id) {
    const graceEndsAt = addGracePeriod(dueDate, contract.grace_days);
    await db.from("tenant_billing_state").upsert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      subscription_id: subscription?.id ?? null,
      access_status: "grace",
      grace_ends_at: graceEndsAt,
      last_payment_id: savedPayment.id
    }, { onConflict: "tenant_id" });
    await db.from("commercial_contracts").update({ status: "past_due" }).eq("id", contract.id);
    await db.from("billing_status_history").insert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      payment_id: savedPayment.id,
      webhook_event_id: eventRow.id,
      from_status: contract.status,
      to_status: "grace",
      reason: "payment_overdue"
    });
  } else if (accessStatus === "review" && contract.tenant_id) {
    await db.from("tenant_billing_state").upsert({
      tenant_id: contract.tenant_id,
      contract_id: contract.id,
      access_status: "review",
      suspended_at: (/* @__PURE__ */ new Date()).toISOString(),
      suspension_reason: normalizedStatus,
      last_payment_id: savedPayment.id
    }, { onConflict: "tenant_id" });
    await db.from("tenants").update({ status: "suspended" }).eq("id", contract.tenant_id);
    await db.from("commercial_contracts").update({ status: "suspended" }).eq("id", contract.id);
  }
  return "processed";
}
async function processSubscriptionEvent(db, payload) {
  const subscription = payload.subscription;
  if (!subscription?.id) return "ignored";
  const { data: local } = await db.from("billing_subscriptions").select("*").eq("provider_subscription_id", subscription.id).maybeSingle();
  if (!local) return "ignored";
  const status = payload.event === "SUBSCRIPTION_DELETED" ? "deleted" : payload.event === "SUBSCRIPTION_INACTIVATED" ? "inactive" : String(subscription.status || "").toUpperCase() === "ACTIVE" ? "active" : local.status;
  const { error } = await db.from("billing_subscriptions").update({
    status,
    provider_status: subscription.status || null,
    next_due_date: subscription.nextDueDate || local.next_due_date,
    metadata: safeProviderMetadata(subscription)
  }).eq("id", local.id);
  if (error) throw error;
  return "processed";
}
async function processStoredEvent(db, eventRow) {
  const payload = eventRow.payload;
  if (!SUPPORTED_ASAAS_EVENTS.has(eventRow.event_type)) return "ignored";
  if (eventRow.event_type.startsWith("PAYMENT_") || eventRow.event_type.startsWith("AWAITING_")) {
    return processPaymentEvent(db, eventRow, payload);
  }
  if (eventRow.event_type.startsWith("SUBSCRIPTION_")) return processSubscriptionEvent(db, payload);
  return "ignored";
}
function createBillingRouters(getSupabaseAdmin, requirePlatformAuth) {
  const publicRouter = Router5();
  const adminRouter = Router5();
  const internalRouter = Router5();
  publicRouter.post("/asaas", async (req, res) => {
    const db = getSupabaseAdmin();
    let config;
    try {
      config = getBillingConfig();
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
    if (!config.enabled) return res.status(503).json({ error: "Cobran\xE7a desabilitada." });
    if (!webhookTokenMatches(req.header("asaas-access-token"), config.webhookToken)) {
      return res.status(401).json({ error: "Webhook n\xE3o autorizado." });
    }
    const payload = req.body;
    if (!payload || typeof payload !== "object" || !payload.id || !payload.event) {
      return res.status(400).json({ error: "Evento inv\xE1lido." });
    }
    const insert = await db.from("billing_webhook_events").insert({
      provider: "asaas",
      provider_event_id: String(payload.id),
      event_type: String(payload.event),
      occurred_at: payload.dateCreated || null,
      payload,
      status: "received"
    }).select().single();
    let eventRow = insert.data;
    if (insert.error?.code === "23505") {
      const existing = await db.from("billing_webhook_events").select("*").eq("provider", "asaas").eq("provider_event_id", String(payload.id)).single();
      if (existing.error) return res.status(500).json({ error: "Falha ao recuperar evento persistido." });
      if (["processed", "ignored", "processing"].includes(existing.data.status)) {
        return res.status(200).json({ received: true, duplicate: true, status: existing.data.status });
      }
      eventRow = existing.data;
    } else if (insert.error) {
      return res.status(500).json({ error: "Falha ao persistir evento." });
    }
    try {
      await db.from("billing_webhook_events").update({
        status: "processing",
        attempts: (eventRow.attempts || 0) + 1,
        last_error: null
      }).eq("id", eventRow.id);
      const status = await processStoredEvent(db, { ...eventRow, payload, event_type: String(payload.event) });
      await db.from("billing_webhook_events").update({
        status,
        processed_at: (/* @__PURE__ */ new Date()).toISOString(),
        last_error: null
      }).eq("id", eventRow.id);
      return res.status(200).json({ received: true, status });
    } catch (error) {
      await db.from("billing_webhook_events").update({ status: "failed", last_error: cleanError(error) }).eq("id", eventRow.id);
      return res.status(500).json({ error: "Evento persistido, mas o processamento falhou." });
    }
  });
  adminRouter.get("/billing/overview", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.billing.read")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin();
    const [plans, subscriptions, overdue, failures, lastWebhook, lastReconciliation] = await Promise.all([
      db.from("billing_plans").select("*", { count: "exact", head: true }).eq("active", true),
      db.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      db.from("billing_payments").select("*", { count: "exact", head: true }).eq("status", "overdue"),
      db.from("billing_webhook_events").select("*", { count: "exact", head: true }).eq("status", "failed"),
      db.from("billing_webhook_events").select("event_type,status,received_at").order("received_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("billing_reconciliation_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    return res.json({
      configuration: publicBillingHealth(),
      counts: { plans: plans.count || 0, activeSubscriptions: subscriptions.count || 0, overduePayments: overdue.count || 0, failedWebhooks: failures.count || 0 },
      lastWebhook: lastWebhook.data || null,
      lastReconciliation: lastReconciliation.data || null
    });
  });
  adminRouter.get("/billing/plans", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.billing.read")) return res.status(403).json({ error: "Forbidden" });
    const { data, error } = await getSupabaseAdmin().from("billing_plans").select("*, billing_plan_prices(*), billing_plan_solutions(*, solutions(id,key,name))").order("code").order("version", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });
  adminRouter.post("/billing/plans", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.billing.manage")) return res.status(403).json({ error: "Forbidden" });
    const { code, name, description, trial_days, grace_days, limits, amount_cents, cycle, billing_type, solution_ids } = req.body;
    if (!code || !name) return res.status(400).json({ error: "C\xF3digo e nome s\xE3o obrigat\xF3rios." });
    const db = getSupabaseAdmin();
    const { data: latest } = await db.from("billing_plans").select("version").eq("code", code).order("version", { ascending: false }).limit(1).maybeSingle();
    await db.from("billing_plans").update({ active: false, archived_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("code", code).eq("active", true);
    const { data, error } = await db.from("billing_plans").insert({
      code,
      version: (latest?.version || 0) + 1,
      name,
      description: description || null,
      trial_days: Number(trial_days || 0),
      grace_days: Number(grace_days ?? 5),
      limits: limits || {},
      created_by_user_id: req.user.id
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    if (amount_cents !== void 0) {
      const { error: priceError } = await db.from("billing_plan_prices").insert({
        plan_id: data.id,
        amount_cents: Number(amount_cents),
        cycle: cycle || "monthly",
        billing_type: billing_type || "UNDEFINED"
      });
      if (priceError) return res.status(400).json({ error: priceError.message });
    }
    if (Array.isArray(solution_ids) && solution_ids.length) {
      const { error: solutionError } = await db.from("billing_plan_solutions").insert(
        solution_ids.map((solutionId) => ({ plan_id: data.id, solution_id: solutionId }))
      );
      if (solutionError) return res.status(400).json({ error: solutionError.message });
    }
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.plan.created", entity_type: "billing_plans", entity_id: data.id, severity: "info" });
    return res.status(201).json(data);
  });
  adminRouter.get("/commercial/catalog", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.read")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin();
    const [solutions, teams] = await Promise.all([
      db.from("solutions").select("id,key,name").order("name"),
      db.from("platform_teams").select("id,name,status").eq("status", "active").order("name")
    ]);
    if (solutions.error || teams.error) return res.status(500).json({ error: solutions.error?.message || teams.error?.message });
    const scopedTeams = req.platformContext.role.key === "admin" ? teams.data : teams.data.filter((team) => req.platformContext.teams.some((own) => own.id === team.id));
    return res.json({ solutions: solutions.data, teams: scopedTeams });
  });
  adminRouter.get("/commercial/demos", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.read")) return res.status(403).json({ error: "Forbidden" });
    let query = getSupabaseAdmin().from("commercial_demos").select("*, marketing_leads(id,name,email,company,status), platform_teams(id,name)").order("created_at", { ascending: false });
    if (req.platformContext.role.key !== "admin") {
      const teamIds = req.platformContext.teams.map((team) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });
  adminRouter.post("/commercial/leads/:leadId/activities", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.manage")) return res.status(403).json({ error: "Forbidden" });
    const { activity_type, subject, description, scheduled_at, status } = req.body;
    if (!activity_type || !subject) return res.status(400).json({ error: "Tipo e assunto s\xE3o obrigat\xF3rios." });
    const db = getSupabaseAdmin();
    const { data: assignment } = await db.from("platform_lead_assignments").select("*").eq("lead_id", req.params.leadId).maybeSingle();
    if (req.platformContext.role.key !== "admin" && (!assignment || !req.platformContext.teams.some((team) => team.id === assignment.team_id))) {
      return res.status(403).json({ error: "Lead fora do seu escopo." });
    }
    const { data, error } = await db.from("commercial_activities").insert({
      lead_id: req.params.leadId,
      team_id: assignment?.team_id || null,
      owner_platform_member_id: assignment?.owner_platform_member_id || req.platformContext.platformMember.id,
      activity_type,
      subject,
      description: description || null,
      scheduled_at: scheduled_at || null,
      status: status || "planned",
      completed_at: status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null,
      created_by_user_id: req.user.id
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });
  adminRouter.get("/commercial/proposals", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.read")) return res.status(403).json({ error: "Forbidden" });
    let query = getSupabaseAdmin().from("commercial_proposals").select("*, marketing_leads(id,name,email,company), billing_plans(id,name,code,version)").order("created_at", { ascending: false });
    if (req.platformContext.role.key !== "admin") {
      const teamIds = req.platformContext.teams.map((team) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });
  adminRouter.post("/commercial/proposals", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.manage")) return res.status(403).json({ error: "Forbidden" });
    const input = req.body;
    if (!input.lead_id || !input.plan_id || !Number.isInteger(Number(input.amount_cents))) return res.status(400).json({ error: "Lead, plano e valor s\xE3o obrigat\xF3rios." });
    if (req.platformContext.role.key !== "admin" && (!input.team_id || !req.platformContext.teams.some((team) => team.id === input.team_id))) {
      return res.status(403).json({ error: "Equipe fora do seu escopo." });
    }
    const { data, error } = await getSupabaseAdmin().from("commercial_proposals").insert({
      lead_id: input.lead_id,
      plan_id: input.plan_id,
      team_id: input.team_id || null,
      owner_platform_member_id: input.owner_platform_member_id || req.platformContext.platformMember.id,
      status: "pending_approval",
      amount_cents: Number(input.amount_cents),
      cycle: input.cycle,
      billing_type: input.billing_type || "UNDEFINED",
      valid_until: input.valid_until || null,
      discount_cents: Number(input.discount_cents || 0),
      notes: input.notes || null,
      created_by_user_id: req.user.id
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await getSupabaseAdmin().from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.proposal.created", entity_type: "commercial_proposals", entity_id: data.id, team_id: data.team_id, severity: "info" });
    return res.status(201).json(data);
  });
  adminRouter.post("/commercial/proposals/:id/approve", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.approve")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin();
    const { data: proposal, error: readError } = await db.from("commercial_proposals").select("*").eq("id", req.params.id).single();
    if (readError) return res.status(404).json({ error: "Proposta n\xE3o encontrada." });
    if (req.platformContext.role.key !== "admin" && !req.platformContext.managedTeams.some((team) => team.id === proposal.team_id)) {
      return res.status(403).json({ error: "Proposta fora da sua al\xE7ada." });
    }
    const { data, error } = await db.from("commercial_proposals").update({
      status: "approved",
      approved_by_user_id: req.user.id,
      approved_at: (/* @__PURE__ */ new Date()).toISOString(),
      approval_notes: req.body.approval_notes || null
    }).eq("id", proposal.id).eq("status", "pending_approval").select().single();
    if (error) return res.status(409).json({ error: error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.proposal.approved", entity_type: "commercial_proposals", entity_id: proposal.id, team_id: proposal.team_id, severity: "info" });
    return res.json(data);
  });
  adminRouter.post("/commercial/proposals/:id/create-contract", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.manage")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin();
    const { data: proposal, error } = await db.from("commercial_proposals").select("*, marketing_leads(*), billing_plans(*)").eq("id", req.params.id).single();
    if (error || !proposal) return res.status(404).json({ error: "Proposta n\xE3o encontrada." });
    if (proposal.status !== "approved") return res.status(409).json({ error: "A proposta precisa estar aprovada." });
    if (req.platformContext.role.key !== "admin" && !req.platformContext.teams.some((team) => team.id === proposal.team_id)) {
      return res.status(403).json({ error: "Proposta fora do seu escopo." });
    }
    const lead = proposal.marketing_leads;
    const { data: contract, error: contractError } = await db.from("commercial_contracts").insert({
      proposal_id: proposal.id,
      lead_id: proposal.lead_id,
      plan_id: proposal.plan_id,
      team_id: proposal.team_id,
      owner_platform_member_id: proposal.owner_platform_member_id,
      customer_name: lead.company,
      customer_email: lead.email,
      customer_tax_id: req.body.customer_tax_id || null,
      customer_phone: req.body.customer_phone || lead.phone,
      owner_name: lead.name,
      owner_email: lead.email,
      status: "pending_approval",
      amount_cents: proposal.amount_cents,
      currency: proposal.currency,
      cycle: proposal.cycle,
      billing_type: proposal.billing_type || "UNDEFINED",
      grace_days: proposal.billing_plans?.grace_days ?? 5,
      created_by_user_id: req.user.id
    }).select().single();
    if (contractError) return res.status(contractError.code === "23505" ? 409 : 400).json({ error: contractError.code === "23505" ? "Esta proposta j\xE1 possui contrato." : contractError.message });
    const { data: planSolutions } = await db.from("billing_plan_solutions").select("solution_id,limits").eq("plan_id", proposal.plan_id);
    if (planSolutions?.length) await db.from("commercial_contract_items").insert(planSolutions.map((item) => ({ contract_id: contract.id, solution_id: item.solution_id, limits: item.limits })));
    await db.from("commercial_proposals").update({ status: "accepted" }).eq("id", proposal.id);
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.contract.created_from_proposal", entity_type: "commercial_contracts", entity_id: contract.id, team_id: proposal.team_id, severity: "info", metadata: { proposal_id: proposal.id } });
    return res.status(201).json(contract);
  });
  adminRouter.get("/commercial/contracts", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.read")) return res.status(403).json({ error: "Forbidden" });
    let query = getSupabaseAdmin().from("commercial_contracts").select("*, billing_plans(name,code,version), commercial_contract_items(*, solutions(id,key,name)), billing_subscriptions(id,status,provider_subscription_id), tenant_billing_state(access_status,paid_through,grace_ends_at)").order("created_at", { ascending: false });
    if (req.platformContext.role.key !== "admin") {
      const teamIds = req.platformContext.teams.map((team) => team.id);
      if (!teamIds.length) return res.json([]);
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });
  adminRouter.post("/commercial/contracts", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.manage")) return res.status(403).json({ error: "Forbidden" });
    return res.status(405).json({ error: "Crie o contrato a partir de uma proposta aprovada." });
  });
  adminRouter.post("/commercial/contracts/:id/approve", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.commercial.approve")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin();
    const { data: contract, error: readError } = await db.from("commercial_contracts").select("*").eq("id", req.params.id).single();
    if (readError) return res.status(404).json({ error: "Contrato n\xE3o encontrado." });
    if (req.platformContext.role.key !== "admin" && !req.platformContext.managedTeams.some((team) => team.id === contract.team_id)) {
      return res.status(403).json({ error: "Contrato fora da sua al\xE7ada." });
    }
    const { data, error } = await db.from("commercial_contracts").update({ status: "approved", approved_by_user_id: req.user.id, approved_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", contract.id).in("status", ["draft", "pending_approval"]).select().single();
    if (error) return res.status(409).json({ error: error.message });
    await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "commercial.contract.approved", entity_type: "commercial_contracts", entity_id: contract.id, team_id: contract.team_id, severity: "info" });
    return res.json(data);
  });
  adminRouter.post("/commercial/contracts/:id/start-billing", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.billing.manage")) return res.status(403).json({ error: "Forbidden" });
    try {
      const config = getBillingConfig();
      const provider = new AsaasBillingProvider(config);
      const db = getSupabaseAdmin();
      const { data: contract, error } = await db.from("commercial_contracts").select("*").eq("id", req.params.id).single();
      if (error || !contract) return res.status(404).json({ error: "Contrato n\xE3o encontrado." });
      if (contract.status !== "approved") return res.status(409).json({ error: "O contrato precisa estar aprovado." });
      if (!contract.customer_tax_id) return res.status(400).json({ error: "CPF/CNPJ \xE9 obrigat\xF3rio para criar o cliente no Asaas." });
      let { data: customer } = await db.from("billing_customers").select("*").eq("contract_id", contract.id).maybeSingle();
      if (!customer) {
        const remote = await provider.findCustomerByExternalReference(contract.external_reference) || await provider.createCustomer({ name: contract.customer_name, email: contract.customer_email, cpfCnpj: contract.customer_tax_id, mobilePhone: contract.customer_phone, externalReference: contract.external_reference });
        const saved = await db.from("billing_customers").insert({
          contract_id: contract.id,
          lead_id: contract.lead_id,
          provider_customer_id: remote.id,
          external_reference: contract.external_reference,
          name: contract.customer_name,
          email: contract.customer_email,
          tax_id_last4: contract.customer_tax_id.replace(/\D/g, "").slice(-4),
          provider_status: "ACTIVE"
        }).select().single();
        if (saved.error) throw saved.error;
        customer = saved.data;
      }
      const nextDueDate = req.body.next_due_date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate || "")) return res.status(400).json({ error: "next_due_date deve usar YYYY-MM-DD." });
      const { data: existingSubscription } = await db.from("billing_subscriptions").select("*").eq("contract_id", contract.id).maybeSingle();
      if (existingSubscription) return res.status(200).json(existingSubscription);
      const remoteSubscription = await provider.findSubscriptionByExternalReference(contract.external_reference) || await provider.createSubscription({
        customerId: customer.provider_customer_id,
        billingType: contract.billing_type,
        cycle: contract.cycle,
        amountCents: contract.amount_cents,
        nextDueDate,
        externalReference: contract.external_reference,
        description: `Contrato Ordum #${contract.contract_number}`
      });
      const savedSubscription = await db.from("billing_subscriptions").insert({
        contract_id: contract.id,
        customer_id: customer.id,
        provider_subscription_id: remoteSubscription.id,
        external_reference: contract.external_reference,
        status: "pending",
        provider_status: remoteSubscription.status || null,
        cycle: contract.cycle,
        billing_type: contract.billing_type,
        amount_cents: contract.amount_cents,
        next_due_date: nextDueDate
      }).select().single();
      if (savedSubscription.error) throw savedSubscription.error;
      await db.from("commercial_contracts").update({ status: "pending_payment" }).eq("id", contract.id);
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "billing.subscription.created", entity_type: "billing_subscriptions", entity_id: savedSubscription.data.id, team_id: contract.team_id, severity: "info" });
      return res.status(201).json(savedSubscription.data);
    } catch (error) {
      return res.status(503).json({ error: cleanError(error) });
    }
  });
  adminRouter.get("/billing/webhooks", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.billing.webhooks.manage")) return res.status(403).json({ error: "Forbidden" });
    const status = typeof req.query.status === "string" ? req.query.status : null;
    let query = getSupabaseAdmin().from("billing_webhook_events").select("id,provider_event_id,event_type,status,received_at,processed_at,attempts,last_error,correlation_id").order("received_at", { ascending: false }).limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });
  adminRouter.post("/billing/webhooks/:id/reprocess", requirePlatformAuth, async (req, res) => {
    if (!hasPermission(req.platformContext, "platform.billing.webhooks.manage")) return res.status(403).json({ error: "Forbidden" });
    const db = getSupabaseAdmin();
    const { data: eventRow, error } = await db.from("billing_webhook_events").select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ error: "Evento n\xE3o encontrado." });
    try {
      await db.from("billing_webhook_events").update({ status: "processing", attempts: eventRow.attempts + 1, last_error: null }).eq("id", eventRow.id);
      const status = await processStoredEvent(db, eventRow);
      await db.from("billing_webhook_events").update({ status, processed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", eventRow.id);
      return res.json({ success: true, status });
    } catch (reprocessError) {
      const message = cleanError(reprocessError);
      await db.from("billing_webhook_events").update({ status: "failed", last_error: message }).eq("id", eventRow.id);
      return res.status(500).json({ error: message });
    }
  });
  internalRouter.get("/reconcile", async (req, res) => {
    if (!webhookTokenMatches(req.header("authorization")?.replace(/^Bearer\s+/i, ""), process.env.CRON_SECRET)) return res.status(401).json({ error: "Unauthorized" });
    const db = getSupabaseAdmin();
    const run = await db.from("billing_reconciliation_runs").insert({ provider: "asaas", status: "running" }).select().single();
    if (run.error) return res.status(500).json({ error: "N\xE3o foi poss\xEDvel iniciar a concilia\xE7\xE3o." });
    try {
      const config = getBillingConfig();
      if (!config.enabled) {
        await db.from("billing_reconciliation_runs").update({ status: "completed", completed_at: (/* @__PURE__ */ new Date()).toISOString(), summary: { skipped: "billing_disabled" } }).eq("id", run.data.id);
        return res.json({ skipped: true, reason: "billing_disabled" });
      }
      const provider = new AsaasBillingProvider(config);
      const { data: subscriptions, error } = await db.from("billing_subscriptions").select("*").in("status", ["pending", "active", "past_due"]);
      if (error) throw error;
      let divergences = 0;
      let errors = 0;
      for (const subscription of subscriptions || []) {
        try {
          const remote = await provider.getSubscription(subscription.provider_subscription_id);
          if (remote.status && remote.status !== subscription.provider_status) {
            divergences += 1;
            await db.from("billing_subscriptions").update({ provider_status: remote.status }).eq("id", subscription.id);
          }
        } catch {
          errors += 1;
        }
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data: expiredGrace } = await db.from("tenant_billing_state").select("tenant_id,contract_id,access_status").eq("access_status", "grace").lt("grace_ends_at", now);
      for (const state of expiredGrace || []) {
        await db.from("tenant_billing_state").update({ access_status: "suspended", suspended_at: now, suspension_reason: "grace_expired" }).eq("tenant_id", state.tenant_id);
        await db.from("tenants").update({ status: "suspended" }).eq("id", state.tenant_id);
        await db.from("commercial_contracts").update({ status: "suspended" }).eq("id", state.contract_id);
      }
      const status = errors ? "completed_with_errors" : "completed";
      await db.from("billing_reconciliation_runs").update({ status, completed_at: now, checked_count: subscriptions?.length || 0, divergence_count: divergences, corrected_count: divergences, error_count: errors, summary: { graceSuspensions: expiredGrace?.length || 0 } }).eq("id", run.data.id);
      return res.json({ status, checked: subscriptions?.length || 0, divergences, errors, graceSuspensions: expiredGrace?.length || 0 });
    } catch (error) {
      await db.from("billing_reconciliation_runs").update({ status: "failed", completed_at: (/* @__PURE__ */ new Date()).toISOString(), error_count: 1, summary: { error: cleanError(error) } }).eq("id", run.data.id);
      return res.status(500).json({ error: "Falha na concilia\xE7\xE3o." });
    }
  });
  return { publicRouter, adminRouter, internalRouter };
}

// server.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config({ path: [".env.local", ".env"] });
async function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "512kb" }));
  app.use(cors());
  let _supabaseAdmin = null;
  const getSupabaseAdmin = () => {
    if (!_supabaseAdmin) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!url || !key) {
        throw new Error("Missing server-side Supabase credentials");
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
      if (!permissions.includes("platform.access") && role.key !== "admin") {
        return res.status(403).json({ error: "Forbidden: platform.access is required" });
      }
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
    res.redirect(307, "/api/admin/clients");
  });
  app.get("/api/admin/tenants/:id", requirePlatformAuth, async (req, res) => {
    res.redirect(307, `/api/admin/clients/${encodeURIComponent(req.params.id)}`);
  });
  app.post("/api/admin/tenants/release-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.demos.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { tenantId, solutionIds, primaryColor, logoInitials } = req.body;
      if (!Array.isArray(solutionIds) || solutionIds.length === 0) return res.status(400).json({ error: "Selecione ao menos uma solu\xE7\xE3o para o trial." });
      const db = getSupabaseAdmin();
      const { data: lead, error: leadError } = await db.from("marketing_leads").select("*").eq("id", tenantId).single();
      if (leadError || !lead) return res.status(404).json({ error: "Lead not found" });
      const { data: leadAssignment } = await db.from("platform_lead_assignments").select("*").eq("lead_id", lead.id).maybeSingle();
      if (platformContext.role?.key !== "admin") {
        const managesTeam = leadAssignment && platformContext.managedTeams.some((team) => team.id === leadAssignment.team_id);
        const ownsLead = leadAssignment?.owner_platform_member_id === platformContext.platformMember.id;
        if (!managesTeam && !ownsLead) return res.status(403).json({ error: "Lead fora do seu escopo." });
      }
      const { data: { users }, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1e3 });
      if (usersError) throw usersError;
      let user = users.find((candidate) => candidate.email?.toLowerCase() === lead.email.toLowerCase());
      if (!user) {
        const origin = process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get("host")}`;
        const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(lead.email, {
          redirectTo: `${String(origin).replace(/\/$/, "")}/#/auth/accept-invite`,
          data: { full_name: lead.name }
        });
        if (inviteError) throw inviteError;
        user = inviteData.user;
      }
      const baseSlug = lead.company.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "demo";
      const slug = `${baseSlug}-${lead.id.replace(/-/g, "").slice(0, 8)}`;
      let { data: tenant } = await db.from("tenants").select("*").eq("slug", slug).maybeSingle();
      if (!tenant) {
        const { data: provisionedTenantId, error: provisionError } = await db.rpc("provision_tenant", {
          p_name: lead.company,
          p_slug: slug,
          p_owner_user_id: user.id
        });
        if (provisionError) throw provisionError;
        const tenantResult = await db.from("tenants").select("*").eq("id", provisionedTenantId).single();
        if (tenantResult.error) throw tenantResult.error;
        tenant = tenantResult.data;
      }
      const expiresAt = new Date(Date.now() + 14 * 864e5).toISOString();
      await db.from("tenants").update({ status: "trial", settings: { ...tenant.settings || {}, primaryColor, logoInitials, demo: true, demoExpiresAt: expiresAt } }).eq("id", tenant.id);
      await db.from("tenant_solutions").delete().eq("tenant_id", tenant.id);
      const { data: dbSolutions, error: solutionError } = await db.from("solutions").select("id,key").in("key", solutionIds);
      if (solutionError) throw solutionError;
      if (dbSolutions?.length) await db.from("tenant_solutions").insert(dbSolutions.map((solution) => ({ tenant_id: tenant.id, solution_id: solution.id, status: "trial" })));
      if (leadAssignment) await db.from("platform_client_assignments").upsert({
        tenant_id: tenant.id,
        team_id: leadAssignment.team_id,
        owner_platform_member_id: leadAssignment.owner_platform_member_id,
        assigned_by_user_id: req.user.id,
        assignment_type: "commercial",
        status: "active"
      }, { onConflict: "tenant_id,team_id,assignment_type" });
      await db.from("marketing_leads").update({ status: "contacted" }).eq("id", lead.id);
      await db.from("commercial_demos").upsert({
        lead_id: lead.id,
        tenant_id: tenant.id,
        team_id: leadAssignment?.team_id || null,
        owner_platform_member_id: leadAssignment?.owner_platform_member_id || null,
        status: "active",
        starts_at: (/* @__PURE__ */ new Date()).toISOString(),
        expires_at: expiresAt,
        approved_by_user_id: req.user.id,
        approved_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { onConflict: "lead_id" });
      await db.from("platform_audit_logs").insert({
        actor_user_id: req.user.id,
        action: "demo.released",
        entity_type: "commercial_demos",
        entity_id: lead.id,
        team_id: leadAssignment?.team_id || null,
        severity: "info",
        metadata: { tenant_id: tenant.id, expires_at: expiresAt, solution_keys: solutionIds }
      });
      res.json({ success: true, tenant: { ...tenant, status: "trial" }, expiresAt });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/admin/tenants/revoke-demo", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      if (!platformContext.permissions.includes("platform.demos.manage") && platformContext.role?.key !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { tenantId } = req.body;
      const db = getSupabaseAdmin();
      const { data: assignment } = await db.from("platform_client_assignments").select("*").eq("tenant_id", tenantId).eq("assignment_type", "commercial").maybeSingle();
      if (platformContext.role?.key !== "admin") {
        const managesTeam = assignment && platformContext.managedTeams.some((team) => team.id === assignment.team_id);
        const ownsClient = assignment?.owner_platform_member_id === platformContext.platformMember.id;
        if (!managesTeam && !ownsClient) return res.status(403).json({ error: "Demonstra\xE7\xE3o fora do seu escopo." });
      }
      await db.from("tenants").update({ status: "suspended" }).eq("id", tenantId);
      await db.from("commercial_demos").update({ status: "revoked" }).eq("tenant_id", tenantId);
      await db.from("platform_audit_logs").insert({ actor_user_id: req.user.id, action: "demo.revoked", entity_type: "commercial_demos", entity_id: tenantId, team_id: assignment?.team_id || null, severity: "warning" });
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/admin/consultants", requirePlatformAuth, async (_req, res) => {
    res.redirect(307, "/api/admin/staff");
  });
  app.get("/api/admin/contracts", requirePlatformAuth, async (req, res) => {
    res.redirect(307, "/api/admin/commercial/contracts");
  });
  app.use("/api/admin/teams", createAdminTeamsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/leads", createAdminLeadsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin/clients", createAdminClientsRouter(getSupabaseAdmin, requirePlatformAuth));
  app.use("/api/admin", createAdminOtherRouter(getSupabaseAdmin, requirePlatformAuth));
  const billingRouters = createBillingRouters(getSupabaseAdmin, requirePlatformAuth);
  app.use("/api/webhooks", billingRouters.publicRouter);
  app.use("/api/admin", billingRouters.adminRouter);
  app.use("/api/internal/billing", billingRouters.internalRouter);
  app.get("/api/admin/stats", requirePlatformAuth, async (req, res) => {
    try {
      const { platformContext } = req;
      let clientsQuery = getSupabaseAdmin().from("platform_client_assignments").select("*", { count: "exact", head: true });
      let leadsQuery = getSupabaseAdmin().from("platform_lead_assignments").select("*, marketing_leads!inner(*)", { count: "exact", head: true }).eq("marketing_leads.status", "new");
      let demosQuery = getSupabaseAdmin().from("commercial_demos").select("*", { count: "exact", head: true }).in("status", ["requested", "scheduled", "approved", "active"]);
      if (platformContext.role?.key !== "admin") {
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
        teams: platformContext.role?.key === "admin" ? teamsCount || 0 : platformContext.teams.length
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/public/tenants/resolve", async (req, res) => {
    try {
      const { slug, domain } = req.query;
      let tenant = null;
      if (slug) {
        const { data, error } = await getSupabaseAdmin().from("tenants").select("id, name, slug, status, settings").eq("slug", slug).in("status", ["active", "trial"]).single();
        if (!error && data) tenant = data;
      } else if (domain) {
        const { data: td, error: e1 } = await getSupabaseAdmin().from("tenant_domains").select("tenant_id").eq("hostname", domain).single();
        if (!e1 && td) {
          const { data, error } = await getSupabaseAdmin().from("tenants").select("id, name, slug, status, settings").eq("id", td.tenant_id).in("status", ["active", "trial"]).single();
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
    const { createServer: createViteServer } = await import("vite");
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
