import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { captureAnalytics } from "../../lib/analytics";
import { captureClientException } from "../../lib/observability";

type Channel = {
  channel_name: string;
  organization_name?: string;
  branding?: { display_name?:string;primary_color?:string;institutional_message?:string;institutional_contact?:string;logo_url?:string };
  introduction?: string;
  instructions?: string;
  allows_anonymous: boolean;
  allows_identified: boolean;
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    description?: string;
  }>;
  units: Array<{ id: string; name: string }>;
  departments?: Array<{ id:string;unit_id:string;name:string }>;
  custom_fields?: Array<{id:string;field_key:string;label:string;help_text?:string;field_type:string;required:boolean;options?:string[]}>;
  privacy_notice?: string;
  confirmation_message?: string;
  attachment_policy?: {
    enabled?: boolean;
    max_files?: number;
    max_size_mb?: number;
  };
};
type Tracking = {
  protocol: string;
  status: string;
  status_code?: string;
  action_required?: boolean;
  created_at: string;
  closed_at?: string;
  messages: Array<{
    id: string;
    author_type: string;
    body: string;
    created_at: string;
  }>;
  attachments?: Array<{
    id: string;
    evidence_kind: string;
    created_at: string;
    files: { original_name: string; size_bytes: number };
  }>;
};

async function publicIntegrity<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/public/integrity${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export function IntegrityChannelPage({ slug }: { slug: string }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mode, setMode] = useState<"report" | "track">("report");
  const [reportStep, setReportStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    protocol: string;
    access_secret: string;
  } | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({
    reporter_mode: "anonymous",
    category: "",
    unit_id: "",
    department_id: "",
    subject: "",
    description: "",
    occurred_at: "",
    name: "",
    email: "",
    phone: "",
  });
  const [customValues,setCustomValues]=useState<Record<string,unknown>>({});
  const [credentials, setCredentials] = useState({ protocol: "", secret: "" });
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await publicIntegrity<{ channel: Channel }>(
          `/channels/${encodeURIComponent(slug)}`,
        );
        if (!active) return;
        setChannel(response.channel);
        setForm((current) => ({
          ...current,
          reporter_mode: response.channel.allows_anonymous
            ? "anonymous"
            : "identified",
          category: response.channel.categories?.[0]?.slug || "",
        }));
      } catch (exception) {
        captureClientException(exception, {
          operation: "integrity_channel_load",
        });
        if (active) setError("Canal não encontrado, pausado ou indisponível.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await publicIntegrity<{
        protocol: string;
        access_secret: string;
      }>("/reports", {
        method: "POST",
        body: JSON.stringify({
          channel_slug: slug,
          category_slug: form.category,
          reporter_mode: form.reporter_mode,
          subject: form.subject,
          description: form.description,
          occurred_at: form.occurred_at || null,
          unit_id: form.unit_id || null,
          department_id: form.department_id || null,
          custom_fields: customValues,
          identity:
            form.reporter_mode === "identified"
              ? { name: form.name, email: form.email, phone: form.phone }
              : null,
        }),
      });
      setResult(response);
      if (attachment) {
        await uploadEvidenceFile(attachment, response.protocol, response.access_secret);
      }
      captureAnalytics("report_submitted", {
        module: "integrity",
        status: "submitted",
        source: "anonymous_channel",
        reporter_mode: form.reporter_mode,
      });
    } catch (exception) {
      captureClientException(exception, {
        operation: "integrity_report_submit",
      });
      setError(
        "Não foi possível enviar o relato. Revise os campos e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  function validateStep() {
    if (reportStep === 1 && !form.category) return "Escolha a categoria do relato para continuar.";
    if (reportStep === 3 && (form.subject.trim().length < 3 || form.description.trim().length < 20)) return "Informe um assunto e descreva o ocorrido com pelo menos 20 caracteres.";
    if (reportStep === 5 && form.reporter_mode === "identified" && form.name.trim().length < 2) return "Informe seu nome ou escolha permanecer anônimo.";
    return "";
  }

  function nextStep() {
    const message = validateStep();
    if (message) return setError(message);
    setError("");
    setReportStep((current) => Math.min(6, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyReceipt() {
    if (!result) return;
    await navigator.clipboard.writeText(`Protocolo: ${result.protocol}\nCódigo de acesso: ${result.access_secret}`);
    setUploadFeedback("Dados copiados. Guarde-os em um local seguro.");
  }

  function downloadReceipt() {
    if (!result) return;
    const text = [`Comprovante do Canal de Integridade`, ``, `Protocolo: ${result.protocol}`, `Código de acesso: ${result.access_secret}`, ``, `Guarde estas informações. Elas permitem acompanhar o relato e conversar com a equipe responsável.`].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `comprovante-${result.protocol}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadTracking(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setTracking(null);
    try {
      const response = await publicIntegrity<{ tracking: Tracking }>("/track", {
        method: "POST",
        body: JSON.stringify({
          protocol: credentials.protocol,
          secret: credentials.secret,
        }),
      });
      setTracking(response.tracking);
    } catch {
      setError(
        "Protocolo ou chave inválidos. Por segurança, verifique os dois dados.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError("");
    try {
      await publicIntegrity("/messages", {
        method: "POST",
        body: JSON.stringify({
          protocol: credentials.protocol,
          secret: credentials.secret,
          body: reply,
        }),
      });
      setReply("");
      await loadTracking({ preventDefault() {} } as React.FormEvent);
    } catch {
      setError("Não foi possível enviar a mensagem. Tente novamente.");
      setBusy(false);
    }
  }

  async function uploadReporterEvidence() {
    const access = result || {
      protocol: credentials.protocol,
      access_secret: credentials.secret,
    };
    if (!attachment || !access.protocol || !access.access_secret) return;
    setBusy(true); setUploadFeedback("");
    try { await uploadEvidenceFile(attachment, access.protocol, access.access_secret); }
    catch (error: any) { setUploadFeedback(error.message); }
    finally { setBusy(false); }
  }
  async function uploadEvidenceFile(file: File, protocol: string, secret: string) {
      const response = await fetch("/api/public/integrity/attachments", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "x-file-name": file.name,
          "x-integrity-protocol": protocol,
          "x-integrity-secret": secret,
        },
        body: file,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Falha no upload.");
      setAttachment(null);
      setUploadFeedback("Anexo enviado com segurança.");
  }
  async function downloadReporterEvidence(id: string) {
    try {
      const response = await publicIntegrity<{ url: string }>(
        `/attachments/${id}/url`,
        {
          method: "POST",
          body: JSON.stringify({
            protocol: credentials.protocol,
            secret: credentials.secret,
          }),
        },
      );
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setError(error.message);
    }
  }

  if (loading)
    return (
      <main className="min-h-screen bg-[#F6F5F2] px-4 py-10" aria-busy="true">
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="mx-auto h-9 w-72" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      </main>
    );
  if (!channel)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F5F2] p-6">
        <div
          role="alert"
          className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center text-red-700"
        >
          {error}
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#F6F5F2] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-7">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            {channel.branding?.logo_url?<img src={channel.branding.logo_url} alt={`Marca de ${channel.organization_name||channel.channel_name}`} className="h-12 w-12 rounded-full object-contain"/>:<ShieldCheck className="h-8 w-8" style={{color:channel.branding?.primary_color||"#3457D5"}} />}
          </div>
          <p className="text-xs font-bold uppercase tracking-[.2em]" style={{color:channel.branding?.primary_color||"#3457D5"}}>Canal seguro e confidencial</p>
          <h1 className="mt-2 text-3xl font-bold text-[#202322]">Canal de Integridade — {channel.organization_name||channel.channel_name}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#626866]">
            {channel.branding?.institutional_message||channel.introduction}
          </p>
          {channel.branding?.institutional_contact?<p className="mt-2 text-xs text-[#626866]">Contato institucional: {channel.branding.institutional_contact}</p>:null}
          <div className="mx-auto mt-5 grid max-w-2xl gap-2 text-left text-sm sm:grid-cols-2"><Trust text="Você pode fazer o relato de forma anônima."/><Trust text="A equipe pode conversar com você sem revelar sua identidade."/><Trust text="As informações são acessadas somente por pessoas autorizadas."/><Trust text="Relatar de boa-fé ajuda a construir um ambiente mais seguro."/></div>
        </header>
        <nav
          aria-label="Ações do canal"
          className="grid grid-cols-2 rounded-xl border border-[#DDD8CF] bg-white p-1"
        >
          <button
            onClick={() => {
              setMode("report");
              setReportStep(1);
              setError("");
            }}
            style={mode === "report"?{backgroundColor:channel.branding?.primary_color||"#3457D5"}:undefined}
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${mode === "report" ? "text-white" : "text-[#626866]"}`}
          >
            Fazer um relato
          </button>
          <button
            onClick={() => {
              setMode("track");
              setError("");
            }}
            style={mode === "track"?{backgroundColor:channel.branding?.primary_color||"#3457D5"}:undefined}
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${mode === "track" ? "text-white" : "text-[#626866]"}`}
          >
            Acompanhar relato
          </button>
        </nav>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {mode === "report" && result ? (
          <section className="rounded-2xl border border-[#DDD8CF] bg-white p-6 text-center shadow-sm sm:p-8">
            <ShieldCheck className="mx-auto h-14 w-14 text-emerald-600" />
            <h2 className="mt-4 text-2xl font-bold">Relato recebido</h2>
            <p className="mt-2 text-sm text-[#626866]">
              {channel.confirmation_message || "Seu relato foi recebido com segurança."} Guarde os dois dados abaixo. A chave é exibida apenas agora e não pode ser recuperada.
            </p>
            <div className="mt-6 space-y-4 rounded-xl bg-[#F6F5F2] p-5 text-left">
              <Credential label="Protocolo" value={result.protocol} visible />
              <Credential
                label="Chave de acompanhamento"
                value={result.access_secret}
                visible={showSecret}
                onToggle={() => setShowSecret(!showSecret)}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-[#626866]">Guarde essas informações. Elas permitem acompanhar o andamento e conversar com a equipe responsável sem revelar sua identidade.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={copyReceipt}><Clipboard className="mr-2 h-4 w-4"/>Copiar dados</Button><Button type="button" variant="outline" onClick={downloadReceipt}><Download className="mr-2 h-4 w-4"/>Baixar comprovante</Button></div>
            {channel.attachment_policy?.enabled && (
              <div className="mt-5 rounded-xl border border-[#DDD8CF] p-4 text-left">
                <label className="text-sm font-bold">
                  Anexar evidência
                  <input
                    type="file"
                    onChange={(event) =>
                      setAttachment(event.target.files?.[0] || null)
                    }
                    className="mt-2 block w-full text-sm"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!attachment || busy}
                  onClick={uploadReporterEvidence}
                  className="mt-3"
                >
                  {busy ? "Enviando…" : "Enviar anexo"}
                </Button>
                {uploadFeedback && (
                  <p role="status" className="mt-2 text-sm">
                    {uploadFeedback}
                  </p>
                )}
              </div>
            )}
            <Button
              className="mt-6 w-full"
              onClick={() => {
                setCredentials({
                  protocol: result.protocol,
                  secret: result.access_secret,
                });
                setMode("track");
                setResult(null);
              }}
            >
              Acompanhar agora
            </Button>
          </section>
        ) : (
          mode === "report" && (
            <form
              onSubmit={submitReport}
              onFocus={() => {
                if (!startedRef.current) {
                  startedRef.current = true;
                  captureAnalytics("report_started", {
                    module: "integrity",
                    source: "anonymous_channel",
                  });
                }
              }}
              className="space-y-6 rounded-2xl border border-[#DDD8CF] bg-white p-6 shadow-sm sm:p-8"
            >
              <WizardProgress current={reportStep} />
              {reportStep === 5 && <>
              <fieldset>
                <legend className="mb-3 text-sm font-bold">
                  Como deseja relatar?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {channel.allows_anonymous && (
                    <ModeOption
                      checked={form.reporter_mode === "anonymous"}
                      onChange={() =>
                        setForm({ ...form, reporter_mode: "anonymous" })
                      }
                      title="Anônimo"
                      description="Não solicitaremos sua identificação."
                    />
                  )}
                  {channel.allows_identified && (
                    <ModeOption
                      checked={form.reporter_mode === "identified"}
                      onChange={() =>
                        setForm({ ...form, reporter_mode: "identified" })
                      }
                      title="Identificado"
                      description="Seus dados ficam separados e protegidos."
                    />
                  )}
                </div>
              </fieldset>
              <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                O protocolo sozinho não permite acesso. Não inclua dados
                pessoais desnecessários. O anonimato depende também das
                informações que você escolher escrever.
              </p>
              </>}
              {reportStep === 1 && <>
              <Field label="Categoria">
                <select
                  required
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]"
                >
                  <option value="">Selecione</option>
                  {channel.categories.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-sm leading-6 text-[#626866]">Escolha o tipo de situação que melhor representa o ocorrido. A equipe poderá ajustar essa classificação durante a triagem.</p>
              </>}
              {reportStep === 2 && <>
              {channel.units.length > 0 && (
                <Field label="Unidade ou departamento">
                  <select
                    value={form.unit_id}
                    onChange={(e) =>
                      setForm({ ...form, unit_id: e.target.value, department_id: "" })
                    }
                    className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]"
                  >
                    <option value="">Não informar</option>
                    {channel.units.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {form.unit_id && (channel.departments || []).some((item)=>item.unit_id===form.unit_id) && <Field label="Departamento ou setor"><select value={form.department_id} onChange={(event)=>setForm({...form,department_id:event.target.value})} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm"><option value="">Não informar</option>{(channel.departments||[]).filter((item)=>item.unit_id===form.unit_id).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
              <p className="text-sm leading-6 text-[#626866]">Informe o local somente se isso ajudar a equipe a compreender o relato. Você pode deixar em branco.</p>
              </>}
              {reportStep === 3 && <>
              <Field label="Assunto">
                <Input
                  required
                  minLength={3}
                  maxLength={160}
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                />
              </Field>
              <Field label="Descrição detalhada">
                <textarea
                  required
                  minLength={20}
                  maxLength={20000}
                  rows={7}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]"
                  placeholder="Descreva o ocorrido, quando aconteceu e outras informações importantes."
                />
              </Field>
              <Field label="Data aproximada do ocorrido">
                <Input
                  type="date"
                  value={form.occurred_at}
                  onChange={(e) =>
                    setForm({ ...form, occurred_at: e.target.value })
                  }
                />
              </Field>
              {(channel.custom_fields||[]).map((field)=><CustomField key={field.id} field={field} value={customValues[field.field_key]} onChange={(value)=>setCustomValues((current)=>({...current,[field.field_key]:value}))}/>) }
              </>}
              {reportStep === 4 && <section className="rounded-2xl border border-dashed border-[#AEBBEA] bg-[#F8FAFF] p-6 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-[#3457D5]"/><h2 className="mt-3 text-lg font-bold">Você possui documentos, imagens ou outros arquivos?</h2><p className="mt-1 text-sm text-[#626866]">O envio é opcional. O arquivo será armazenado de forma privada e vinculado somente ao seu relato.</p>{channel.attachment_policy?.enabled?<label className="mt-5 block rounded-xl bg-white p-4 text-left text-sm font-bold ring-1 ring-[#DDD8CF]"><span>Selecionar evidência</span><input type="file" onChange={(event)=>setAttachment(event.target.files?.[0]||null)} className="mt-2 block w-full text-sm"/>{attachment?<small className="mt-2 block font-normal text-[#3457D5]">{attachment.name}</small>:null}</label>:<p className="mt-4 text-sm text-amber-800">Este canal não aceita anexos no momento.</p>}</section>}
              {reportStep === 5 && form.reporter_mode === "identified" && (
                <div className="grid gap-4 rounded-xl border border-[#DDD8CF] p-4 sm:grid-cols-2">
                  <Field label="Nome">
                    <Input
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="E-mail">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </Field>
                </div>
              )}
              {reportStep === 6 && <>
              <section className="rounded-2xl bg-[#F6F5F2] p-5"><h2 className="text-lg font-bold">Revise antes de enviar</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Review label="Categoria" value={channel.categories.find((item)=>item.slug===form.category)?.name}/><Review label="Assunto" value={form.subject}/><Review label="Local" value={channel.units.find((item)=>item.id===form.unit_id)?.name||"Não informado"}/><Review label="Identificação" value={form.reporter_mode==="anonymous"?"Permanecer anônimo":"Relato identificado"}/><Review label="Evidência" value={attachment?.name||"Nenhum arquivo"}/></dl><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#626866]">{form.description}</p></section>
              {channel.instructions && (
                <p className="text-xs leading-5 text-[#626866]">
                  {channel.instructions}
                </p>
              )}
              {channel.privacy_notice && (
                <p className="rounded-xl border border-[#DDD8CF] bg-[#F6F5F2] p-4 text-xs leading-5 text-[#626866]">
                  {channel.privacy_notice}
                </p>
              )}
              </>}
              <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between">{reportStep>1?<Button type="button" variant="outline" disabled={busy} onClick={()=>{setError("");setReportStep((current)=>Math.max(1,current-1));}}>Voltar</Button>:<span/>}{reportStep<6?<Button key="continue-report" type="button" onClick={(event)=>{event.preventDefault();nextStep();}} className="bg-[#3457D5] text-white">Continuar <ArrowRight className="ml-2 h-4 w-4"/></Button>:<Button key="submit-report" type="submit" disabled={busy} className="h-12 bg-[#3457D5] text-white">{busy?"Enviando…":"Enviar relato"}<ArrowRight className="ml-2 h-4 w-4"/></Button>}</div>
            </form>
          )
        )}

        {mode === "track" && (
          <section className="space-y-5 rounded-2xl border border-[#DDD8CF] bg-white p-6 shadow-sm sm:p-8">
            <form
              onSubmit={loadTracking}
              className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <Field label="Protocolo">
                <Input
                  required
                  value={credentials.protocol}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      protocol: e.target.value.toUpperCase(),
                    })
                  }
                />
              </Field>
              <Field label="Chave de acompanhamento">
                <Input
                  required
                  type="password"
                  value={credentials.secret}
                  onChange={(e) =>
                    setCredentials({ ...credentials, secret: e.target.value })
                  }
                />
              </Field>
              <Button
                type="submit"
                disabled={busy}
                className="h-10 bg-[#3457D5] text-white"
              >
                Consultar
              </Button>
            </form>
            {tracking && (
              <div className="space-y-5">
                <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#3457D5]">Acompanhamento seguro</p><h2 className="mt-1 text-2xl font-bold">Seu relato</h2><p className="mt-1 text-sm text-[#626866]">Acompanhe atualizações e converse com a equipe sem expor sua identidade.</p></div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F6F5F2] p-4">
                  <div>
                    <div className="font-mono font-bold">
                      {tracking.protocol}
                    </div>
                    <div className="text-xs text-[#626866]">
                      Enviado em{" "}
                      {new Date(tracking.created_at).toLocaleDateString(
                        "pt-BR",
                      )}
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                    {tracking.status}
                  </span>
                </div>
                {tracking.action_required ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">A organização solicitou informações. Revise as mensagens e responda abaixo.</div> : null}
                <section><h3 className="mb-3 text-base font-bold">Mensagens</h3><div className="space-y-3">
                  {tracking.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`rounded-xl p-4 text-sm ${message.author_type === "reporter" ? "ml-8 bg-[#F6F5F2]" : "mr-8 border border-blue-100 bg-blue-50"}`}
                    >
                      <div className="mb-2 text-xs font-bold text-[#626866]">
                        {message.author_type === "reporter"
                          ? "Você"
                          : "Equipe de Integridade"}{" "}
                        · {new Date(message.created_at).toLocaleString("pt-BR")}
                      </div>
                      <p className="whitespace-pre-wrap leading-6">
                        {message.body}
                      </p>
                    </article>
                  ))}
                </div></section>
                {tracking.attachments && tracking.attachments.length > 0 && (
                  <div className="rounded-xl border border-[#DDD8CF] p-4">
                    <h3 className="text-sm font-bold">Anexos disponíveis</h3>
                    <div className="mt-2 space-y-2">
                      {tracking.attachments.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => downloadReporterEvidence(item.id)}
                          className="block w-full rounded-lg bg-[#F6F5F2] p-3 text-left text-sm font-medium hover:bg-blue-50"
                        >
                          {item.files.original_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!["closed", "archived"].includes(tracking.status_code || "") && (
                  <div className="space-y-4 border-t pt-5">
                    <form onSubmit={sendReply} className="space-y-3">
                      <Field label="Complementar informações">
                        <textarea
                          required
                          minLength={2}
                          maxLength={5000}
                          rows={4}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]"
                        />
                      </Field>
                      <Button type="submit" disabled={busy}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Enviar mensagem
                      </Button>
                    </form>
                    {channel.attachment_policy?.enabled && (
                      <div className="rounded-xl border border-dashed p-4">
                        <label className="text-sm font-bold">
                          Complementar com evidência
                          <input
                            type="file"
                            onChange={(event) =>
                              setAttachment(event.target.files?.[0] || null)
                            }
                            className="mt-2 block w-full text-sm"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!attachment || busy}
                          onClick={uploadReporterEvidence}
                          className="mt-3"
                        >
                          Enviar anexo
                        </Button>
                        {uploadFeedback && (
                          <p role="status" className="mt-2 text-sm">
                            {uploadFeedback}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-[#202322]">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}
const WIZARD_STEPS = ["Sobre o ocorrido","Pessoas e local","Detalhes","Evidências","Identificação","Revisão"];
function WizardProgress({current}:{current:number}) { return <div><div className="flex items-center justify-between text-xs font-bold text-[#626866]"><span>Etapa {current} de {WIZARD_STEPS.length}</span><span>{WIZARD_STEPS[current-1]}</span></div><div className="mt-3 grid grid-cols-6 gap-1" aria-label={`Etapa ${current}: ${WIZARD_STEPS[current-1]}`}>{WIZARD_STEPS.map((label,index)=><div key={label} title={label} className={`h-1.5 rounded-full ${index<current?"bg-[#3457D5]":"bg-[#DDD8CF]"}`}/>)}</div></div>; }
function Trust({text}:{text:string}) { return <div className="flex gap-2 rounded-xl bg-white/70 p-3 ring-1 ring-[#DDD8CF]/70"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/><span>{text}</span></div>; }
function Review({label,value}:{label:string;value?:string}) { return <div><dt className="text-xs font-bold uppercase text-[#777D7A]">{label}</dt><dd className="mt-1 font-semibold text-[#202322]">{value||"Não informado"}</dd></div>; }
function ModeOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${checked ? "border-[#3457D5] bg-blue-50" : "border-[#DDD8CF]"}`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-1"
      />
      <span>
        <strong className="block">{title}</strong>
        <span className="text-xs text-[#626866]">{description}</span>
      </span>
    </label>
  );
}
function Credential({
  label,
  value,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle?: () => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <code className="break-all text-sm font-bold">
          {visible ? value : "••••••••••••••••"}
        </code>
        {onToggle && (
          <button
            type="button"
            aria-label={visible ? "Ocultar chave" : "Mostrar chave"}
            onClick={onToggle}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
function statusLabel(status: string) {
  return (
    (
      {
        received: "Recebido",
        triage: "Em triagem",
        investigation: "Em investigação",
        waiting_information: "Aguardando informação",
        decision: "Em decisão",
        closed: "Encerrado",
        reopened: "Reaberto",
        archived: "Arquivado",
      } as Record<string, string>
    )[status] || status
  );
}

function CustomField({field,value,onChange}:{field:NonNullable<Channel["custom_fields"]>[number];value:unknown;onChange:(value:unknown)=>void}) {
  if(field.field_type==="long_text")return <Field label={field.label}><textarea required={field.required} value={String(value||"")} onChange={(event)=>onChange(event.target.value)} rows={4} maxLength={5000} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm"/><small className="font-normal text-[#626866]">{field.help_text}</small></Field>;
  if(field.field_type==="single_select")return <Field label={field.label}><select required={field.required} value={String(value||"")} onChange={(event)=>onChange(event.target.value)} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm"><option value="">Selecione</option>{(field.options||[]).map((option)=><option key={option}>{option}</option>)}</select></Field>;
  if(field.field_type==="multi_select")return <fieldset><legend className="text-sm font-bold">{field.label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{(field.options||[]).map((option)=><label key={option} className="flex gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={Array.isArray(value)&&value.includes(option)} onChange={(event)=>{const current=Array.isArray(value)?value as string[]:[];onChange(event.target.checked?[...current,option]:current.filter((item)=>item!==option));}}/>{option}</label>)}</div></fieldset>;
  if(field.field_type==="boolean")return <label className="flex gap-3 rounded-xl border border-[#DDD8CF] p-4 text-sm"><input type="checkbox" required={field.required} checked={value===true} onChange={(event)=>onChange(event.target.checked)}/><span><strong>{field.label}</strong>{field.help_text?<small className="block font-normal text-[#626866]">{field.help_text}</small>:null}</span></label>;
  return <Field label={field.label}><Input type={field.field_type==="date"?"date":"text"} required={field.required} maxLength={field.field_type==="short_text"?300:undefined} value={String(value||"")} onChange={(event)=>onChange(event.target.value)}/>{field.help_text?<small className="font-normal text-[#626866]">{field.help_text}</small>:null}</Field>;
}
