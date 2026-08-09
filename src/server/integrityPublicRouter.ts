import express from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  integrityRateLimitKey,
  validateIntegrityEvidence,
} from "../domain/integrity-files";
import { publicIntegrityStatus, validateIntegrityCustomValues } from "../domain/integrity-phase4g";

const reportSchema = z.object({
  channel_slug: z.string().trim().min(2).max(80),
  category_slug: z.string().trim().min(1).max(80),
  reporter_mode: z.enum(["anonymous", "identified"]),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(20000),
  occurred_at: z.string().date().nullable().optional(),
  unit_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
  identity: z
    .object({
      name: z.string().trim().min(2).max(160),
      email: z.string().email().max(254).optional().or(z.literal("")),
      phone: z.string().trim().max(30).optional(),
    })
    .nullable()
    .optional(),
});
const credentialsSchema = z.object({
  protocol: z.string().trim().min(8).max(64),
  secret: z.string().min(24).max(256),
});
const messageSchema = credentialsSchema.extend({
  body: z.string().trim().min(2).max(5000),
});

export function createIntegrityPublicRouter(getSupabaseAdmin: () => any) {
  const router = express.Router();
  const asyncHandler =
    (fn: express.RequestHandler): express.RequestHandler =>
    (req, res, next) =>
      Promise.resolve(fn(req, res, next)).catch(next);
  const address = (req: express.Request) =>
    String(req.headers["x-forwarded-for"] || req.ip || "unknown")
      .split(",")[0]
      .trim();
  const rateSecret = () =>
    process.env.INTEGRITY_RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  async function rate(
    req: express.Request,
    res: express.Response,
    action: "submit" | "track" | "message" | "upload",
    limit: number,
    seconds: number,
    scope = "",
  ) {
    const key = integrityRateLimitKey(
      rateSecret(),
      action,
      address(req),
      scope.toUpperCase().slice(0, 64),
    );
    const result = await getSupabaseAdmin().rpc(
      "check_integrity_public_rate_limit",
      {
        p_key_hash: key,
        p_action: action,
        p_limit: limit,
        p_window_seconds: seconds,
      },
    );
    if (result.error) {
      res
        .status(503)
        .json({ error: "Proteção do canal temporariamente indisponível." });
      return false;
    }
    const value = result.data;
    res.setHeader("x-ratelimit-remaining", String(value.remaining));
    if (!value.allowed) {
      res.setHeader("retry-after", String(value.retry_after_seconds));
      res.status(429).json({
        error: "Muitas tentativas. Aguarde antes de tentar novamente.",
      });
      return false;
    }
    return true;
  }

  router.get(
    "/channels/:slug",
    asyncHandler(async (req, res) => {
      const db = getSupabaseAdmin();
      const result = await db.rpc("get_integrity_channel", {
        p_channel_slug: req.params.slug,
      });
      if (result.error || !result.data)
        return res
          .status(404)
          .json({ error: "Canal não encontrado, pausado ou indisponível." });
      const channelRow = await db.from("integrity_channels").select("id,tenant_id,privacy_notice,confirmation_message").eq("public_slug",req.params.slug).eq("active",true).maybeSingle();
      if(channelRow.error||!channelRow.data)return res.status(404).json({error:"Canal não encontrado, pausado ou indisponível."});
      const [departments,fields]=await Promise.all([
        db.from("integrity_departments").select("id,unit_id,name").eq("tenant_id",channelRow.data.tenant_id).eq("active",true).order("name"),
        db.from("integrity_custom_fields").select("id,field_key,label,help_text,field_type,required,options,sort_order").eq("tenant_id",channelRow.data.tenant_id).or(`channel_id.eq.${channelRow.data.id},channel_id.is.null`).eq("active",true).order("sort_order"),
      ]);
      if(departments.error||fields.error)return res.status(503).json({error:"Configuração do canal temporariamente indisponível."});
      return res.json({ channel: {...result.data,privacy_notice:channelRow.data.privacy_notice,confirmation_message:channelRow.data.confirmation_message,departments:departments.data||[],custom_fields:fields.data||[]} });
    }),
  );

  router.post(
    "/reports",
    asyncHandler(async (req, res) => {
      if (
        !(await rate(req, res, "submit", 5, 3600, req.body?.channel_slug || ""))
      )
        return;
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Revise os campos do relato." });
      const value = parsed.data;
      const db=getSupabaseAdmin();
      const channel=await db.from("integrity_channels").select("id,tenant_id").eq("public_slug",value.channel_slug).eq("active",true).maybeSingle();
      if(channel.error||!channel.data)return res.status(404).json({error:"Canal não encontrado, pausado ou indisponível."});
      const fields=await db.from("integrity_custom_fields").select("id,field_key,label,field_type,required,options").eq("tenant_id",channel.data.tenant_id).or(`channel_id.eq.${channel.data.id},channel_id.is.null`).eq("active",true);
      if(fields.error)return res.status(503).json({error:"Não foi possível validar o formulário."});
      const custom=validateIntegrityCustomValues(fields.data||[],value.custom_fields);
      if(!custom.valid)return res.status(400).json({error:custom.error});
      if(value.department_id){const department=await db.from("integrity_departments").select("id").eq("id",value.department_id).eq("tenant_id",channel.data.tenant_id).eq("unit_id",value.unit_id).eq("active",true).maybeSingle();if(!department.data)return res.status(400).json({error:"Selecione um setor válido para a unidade."});}
      const result = await db.rpc(
        "submit_integrity_report_v2",
        {
          p_channel_slug: value.channel_slug,
          p_category_slug: value.category_slug,
          p_reporter_mode: value.reporter_mode,
          p_subject: value.subject,
          p_description: value.description,
          p_occurred_at: value.occurred_at || null,
          p_unit_id: value.unit_id || null,
          p_identity: value.identity || null,
        },
      );
      if (result.error || !result.data)
        return res
          .status(400)
          .json({ error: "Não foi possível registrar o relato." });
      const report=await db.from("integrity_reports").select("id").eq("tenant_id",channel.data.tenant_id).eq("protocol",result.data.protocol).maybeSingle();
      if(!report.data)return res.status(500).json({error:"O relato foi recebido, mas a configuração adicional não pôde ser concluída."});
      const caseResult=await db.from("integrity_cases").select("id,category_id,unit_id,severity,status,report_id").eq("report_id",report.data.id).single();
      if(caseResult.error)return res.status(500).json({error:"O relato foi recebido, mas o caso não pôde ser preparado."});
      if(value.department_id){await db.from("integrity_reports").update({department_id:value.department_id}).eq("id",report.data.id);await db.from("integrity_cases").update({department_id:value.department_id}).eq("id",caseResult.data.id);}
      if(custom.rows.length){const saved=await db.from("integrity_report_custom_values").insert(custom.rows.map(row=>({...row,tenant_id:channel.data.tenant_id,report_id:report.data.id})));if(saved.error)return res.status(500).json({error:"O relato foi recebido, mas os campos adicionais não puderam ser registrados."});}
      const rules=await db.from("integrity_routing_rules").select("*").eq("tenant_id",channel.data.tenant_id).eq("active",true).eq("status","active").order("priority");
      const mode=value.reporter_mode; const matching=(rules.data||[]).filter((rule:any)=>(!rule.category_id||rule.category_id===caseResult.data.category_id)&&(!rule.unit_id||rule.unit_id===value.unit_id)&&(!rule.department_id||rule.department_id===value.department_id)&&(!rule.severity||rule.severity===caseResult.data.severity)&&(!rule.reporter_mode||rule.reporter_mode===mode)&&rule.requires_conflict!==true).sort((a:any,b:any)=>Number(a.is_fallback)-Number(b.is_fallback)||a.priority-b.priority);
      const rule=matching[0];
      if(rule){const update:any={};if(rule.assignee_membership_id)update.owner_membership_id=rule.assignee_membership_id;if(rule.committee_id)update.committee_id=rule.committee_id;if(rule.target_priority)update.priority=rule.target_priority;if(rule.target_sla_hours)update.treatment_due_at=new Date(Date.now()+rule.target_sla_hours*3600000).toISOString();await db.from("integrity_cases").update(update).eq("id",caseResult.data.id);const collaborators=await db.from("integrity_routing_rule_collaborators").select("membership_id").eq("rule_id",rule.id);if(collaborators.data?.length)await db.from("integrity_case_collaborators").upsert(collaborators.data.map((item:any)=>({tenant_id:channel.data.tenant_id,case_id:caseResult.data.id,membership_id:item.membership_id,role:"investigator",added_by_membership_id:null})),{onConflict:"case_id,membership_id"});await db.from("integrity_case_events").insert({report_id:report.data.id,case_id:caseResult.data.id,event_type:"routing_applied",metadata:{rule_id:rule.id,reason:{category:Boolean(rule.category_id),unit:Boolean(rule.unit_id),department:Boolean(rule.department_id),severity:Boolean(rule.severity),reporter_mode:Boolean(rule.reporter_mode),fallback:Boolean(rule.is_fallback)},actions:{committee:Boolean(rule.committee_id),assignee:Boolean(rule.assignee_membership_id),priority:rule.target_priority||null,sla_hours:rule.target_sla_hours||null,collaborators:(collaborators.data||[]).length}}});}
      return res.status(201).json(result.data);
    }),
  );

  router.post(
    "/track",
    asyncHandler(async (req, res) => {
      const parsed = credentialsSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Protocolo ou chave inválidos." });
      if (!(await rate(req, res, "track", 20, 900, parsed.data.protocol)))
        return;
      const result = await getSupabaseAdmin().rpc("read_integrity_report_v2", {
        p_protocol: parsed.data.protocol,
        p_access_secret: parsed.data.secret,
      });
      if (result.error || !result.data)
        return res.status(404).json({ error: "Protocolo ou chave inválidos." });
      const authorized = await getSupabaseAdmin().rpc(
        "authorize_integrity_reporter",
        {
          p_protocol: parsed.data.protocol,
          p_access_secret: parsed.data.secret,
        },
      );
      const access = authorized.data?.[0];
      const attachments = access
        ? await getSupabaseAdmin()
            .from("integrity_attachments")
            .select(
              "id,evidence_kind,description,created_at,files!inner(original_name,mime_type,size_bytes)",
            )
            .eq("case_id", access.case_id)
            .eq("visible_to_reporter", true)
            .is("deleted_at", null)
            .order("created_at")
        : { data: [] };
      const source=result.data as any;
      const messages=(source.messages||[]).map((message:any)=>({id:message.id,author_type:message.author_type,body:message.body,created_at:message.created_at}));
      const lastOrganization=[...messages].reverse().find((item:any)=>item.author_type!=="reporter");
      const lastReporter=[...messages].reverse().find((item:any)=>item.author_type==="reporter");
      return res.json({ tracking: {protocol:source.protocol,status:publicIntegrityStatus(source.status),status_code:source.status==="waiting_information"?"action_required":source.status,created_at:source.created_at,closed_at:source.closed_at||null,action_required:Boolean(source.status==="waiting_information"||(lastOrganization&&(!lastReporter||new Date(lastOrganization.created_at)>new Date(lastReporter.created_at)))),messages,attachments:attachments.data||[]} });
    }),
  );

  router.post(
    "/messages",
    asyncHandler(async (req, res) => {
      const parsed = messageSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Mensagem inválida." });
      if (!(await rate(req, res, "message", 10, 900, parsed.data.protocol)))
        return;
      const db = getSupabaseAdmin();
      const authorization = await db.rpc("authorize_integrity_reporter", {
        p_protocol: parsed.data.protocol,
        p_access_secret: parsed.data.secret,
      });
      const access = authorization.data?.[0];
      if (authorization.error || !access)
        return res
          .status(404)
          .json({ error: "Não foi possível validar o acompanhamento." });
      const settings = await db
        .from("integrity_settings")
        .select("communication_policy")
        .eq("tenant_id", access.tenant_id)
        .maybeSingle();
      if (settings.error)
        return res.status(500).json({
          error: "Não foi possível validar a política de comunicação.",
        });
      if (settings.data?.communication_policy?.allow_reporter_messages === false)
        return res.status(403).json({
          error: "O envio de novas mensagens está desativado neste canal.",
        });
      const result = await db.rpc(
        "post_integrity_reporter_message",
        {
          p_protocol: parsed.data.protocol,
          p_access_secret: parsed.data.secret,
          p_body: parsed.data.body,
        },
      );
      if (result.error)
        return res
          .status(404)
          .json({ error: "Não foi possível validar o acompanhamento." });
      await db.from("integrity_case_events").insert({
        report_id: access.report_id,
        case_id: access.case_id,
        event_type: "reporter_message_received",
        metadata: { source: "reporter" },
      });
      return res.status(201).json({ sent: true });
    }),
  );

  router.post(
    "/attachments",
    express.raw({ type: () => true, limit: "10mb" }),
    asyncHandler(async (req, res) => {
      const parsed = credentialsSchema.safeParse({
        protocol: req.header("x-integrity-protocol"),
        secret: req.header("x-integrity-secret"),
      });
      if (!parsed.success || !Buffer.isBuffer(req.body))
        return res
          .status(400)
          .json({ error: "Credenciais ou arquivo inválidos." });
      if (!(await rate(req, res, "upload", 10, 3600, parsed.data.protocol)))
        return;
      const db = getSupabaseAdmin();
      const authorization = await db.rpc("authorize_integrity_reporter", {
        p_protocol: parsed.data.protocol,
        p_access_secret: parsed.data.secret,
      });
      const access = authorization.data?.[0];
      if (
        authorization.error ||
        !access ||
        ["closed", "archived"].includes(access.status)
      )
        return res
          .status(404)
          .json({ error: "Não foi possível validar o acompanhamento." });
      const settings = await db
        .from("integrity_settings")
        .select("attachment_policy")
        .eq("tenant_id", access.tenant_id)
        .single();
      const policy = settings.data?.attachment_policy || {};
      if (!policy.enabled)
        return res
          .status(403)
          .json({ error: "Este canal não permite anexos do denunciante." });
      const maxFiles = Math.min(Number(policy.max_files) || 3, 10);
      const count = await db
        .from("integrity_attachments")
        .select("id", { count: "exact", head: true })
        .eq("case_id", access.case_id)
        .eq("uploaded_by_type", "reporter")
        .is("deleted_at", null);
      if ((count.count || 0) >= maxFiles)
        return res.status(409).json({ error: "Limite de anexos atingido." });
      const maxBytes = Math.min(
        (Number(policy.max_size_mb) || 5) * 1048576,
        10485760,
      );
      const mime = String(req.header("content-type") || "")
        .split(";")[0]
        .toLowerCase();
      const checked = validateIntegrityEvidence(
        req.body,
        mime,
        req.header("x-file-name") || "",
        maxBytes,
      );
      if (checked.valid === false)
        return res.status(415).json({ error: checked.error });
      const checksum = createHash("sha256").update(req.body).digest("hex");
      const objectPath = `${access.tenant_id}/${access.case_id}/${randomUUID()}`;
      const uploaded = await db.storage
        .from("ordum-integrity")
        .upload(objectPath, req.body, { contentType: mime, upsert: false });
      if (uploaded.error)
        return res
          .status(500)
          .json({ error: "Não foi possível armazenar o anexo." });
      const file = await db
        .from("files")
        .insert({
          tenant_id: access.tenant_id,
          case_id: access.case_id,
          bucket: "ordum-integrity",
          object_path: objectPath,
          original_name: checked.safeName,
          mime_type: mime,
          size_bytes: req.body.length,
          sensitivity: "restricted",
          validation_status: "validated",
          checksum_sha256: checksum,
        })
        .select("id")
        .single();
      if (file.error) {
        await db.storage.from("ordum-integrity").remove([objectPath]);
        return res
          .status(500)
          .json({ error: "Não foi possível registrar o anexo." });
      }
      const attachment = await db
        .from("integrity_attachments")
        .insert({
          report_id: access.report_id,
          case_id: access.case_id,
          file_id: file.data.id,
          uploaded_by_type: "reporter",
          visible_to_reporter: true,
          evidence_kind: checked.kind,
        })
        .select("id")
        .single();
      if (attachment.error) {
        await db.storage.from("ordum-integrity").remove([objectPath]);
        await db.from("files").delete().eq("id", file.data.id);
        return res
          .status(500)
          .json({ error: "Não foi possível vincular o anexo." });
      }
      await db.from("integrity_case_events").insert({
        report_id: access.report_id,
        case_id: access.case_id,
        event_type: "evidence_added",
        metadata: { attachment_id: attachment.data.id, source: "reporter", checksum_sha256: checksum, size_bytes: req.body.length },
      });
      return res.status(201).json({ id: attachment.data.id, checksum_sha256: checksum });
    }),
  );

  router.post(
    "/attachments/:id/url",
    asyncHandler(async (req, res) => {
      const parsed = credentialsSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Credenciais inválidas." });
      if (!(await rate(req, res, "track", 20, 900, parsed.data.protocol)))
        return;
      const db = getSupabaseAdmin();
      const authorization = await db.rpc("authorize_integrity_reporter", {
        p_protocol: parsed.data.protocol,
        p_access_secret: parsed.data.secret,
      });
      const access = authorization.data?.[0];
      if (!access)
        return res
          .status(404)
          .json({ error: "Não foi possível validar o acompanhamento." });
      const evidence = await db
        .from("integrity_attachments")
        .select("files!inner(bucket,object_path)")
        .eq("id", req.params.id)
        .eq("case_id", access.case_id)
        .eq("visible_to_reporter", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (!evidence.data)
        return res.status(404).json({ error: "Anexo não encontrado." });
      const file = (evidence.data as any).files;
      const signed = await db.storage
        .from(file.bucket)
        .createSignedUrl(file.object_path, 120);
      if (signed.error)
        return res
          .status(500)
          .json({ error: "Não foi possível liberar o anexo." });
      const event = await db.from("integrity_case_events").insert({
        report_id: access.report_id,
        case_id: access.case_id,
        event_type: "evidence_downloaded",
        metadata: { attachment_id: req.params.id, source: "reporter", expires_in: 120 },
      });
      if (event.error) return res.status(500).json({ error: "O download não pôde ser auditado." });
      return res.json({ url: signed.data.signedUrl, expires_in: 120 });
    }),
  );
  return router;
}
