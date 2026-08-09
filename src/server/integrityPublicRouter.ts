import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  integrityRateLimitKey,
  validateIntegrityEvidence,
} from "../domain/integrity-files";

const reportSchema = z.object({
  channel_slug: z.string().trim().min(2).max(80),
  category_slug: z.string().trim().min(1).max(80),
  reporter_mode: z.enum(["anonymous", "identified"]),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(20000),
  occurred_at: z.string().date().nullable().optional(),
  unit_id: z.string().uuid().nullable().optional(),
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
      const result = await getSupabaseAdmin().rpc("get_integrity_channel", {
        p_channel_slug: req.params.slug,
      });
      if (result.error || !result.data)
        return res
          .status(404)
          .json({ error: "Canal não encontrado, pausado ou indisponível." });
      return res.json({ channel: result.data });
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
      const result = await getSupabaseAdmin().rpc(
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
      return res.json({
        tracking: { ...result.data, attachments: attachments.data || [] },
      });
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
      const result = await getSupabaseAdmin().rpc(
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
        metadata: { attachment_id: attachment.data.id, source: "reporter" },
      });
      return res.status(201).json({ id: attachment.data.id });
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
      return res.json({ url: signed.data.signedUrl, expires_in: 120 });
    }),
  );
  return router;
}
