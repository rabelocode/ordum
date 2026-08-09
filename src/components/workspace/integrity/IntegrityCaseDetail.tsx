import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, UserPlus } from "lucide-react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Skeleton } from "../../ui/Skeleton";
import { integrityApi, integrityDownload, integrityFileApi, type ApiState } from "../integrityApi";
import { useIntegrityCasePermissions } from "./useIntegrityCasePermissions";
import { Card, ErrorState, Meta, Panel, Risk, TransitionButtons, statusLabel } from "./IntegrityUi";
import { CaseTasks } from "./CaseTasks";
import { CaseEvidence } from "./CaseEvidence";
import { CaseMessages } from "./CaseMessages";
import { CaseDecision } from "./CaseDecision";
import { CaseTimeline } from "./CaseTimeline";

export function IntegrityCaseDetail({ tenantId,caseId,permissions,onBack }: { tenantId:string; caseId:string; permissions:string[]; onBack:()=>void }) {
  const rights = useIntegrityCasePermissions(permissions);
  const canAssign = permissions.includes("integrity.cases.assign") || permissions.includes("integrity.cases.manage");
  const canManageEvidence = permissions.includes("integrity.evidence.manage");
  const canManageCollaborators = permissions.includes("integrity.investigators.manage") || permissions.includes("integrity.cases.manage");
  const canExportDossier = permissions.includes("integrity.dossier.export") || permissions.includes("integrity.case_report.export");
  const [state,setState] = useState<ApiState<any>>({ data:null,loading:true,error:"" });
  const [timeline,setTimeline] = useState<any[]>([]);
  const [messages,setMessages] = useState<any[]>([]);
  const [tasks,setTasks] = useState<any[]>([]);
  const [evidence,setEvidence] = useState<any[]>([]);
  const [members,setMembers] = useState<any[]>([]);
  const [collaborators,setCollaborators] = useState<any[]>([]);
  const [templates,setTemplates] = useState<any[]>([]);
  const [identity,setIdentity] = useState<any>(undefined);
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState("");
  const [reason,setReason] = useState("");
  const [assignee,setAssignee] = useState("");
  const [includeIdentity,setIncludeIdentity] = useState(false);
  const load = useCallback(async () => {
    setState((current) => ({ ...current,loading:true,error:"" }));
    try {
      const [detail,events,communication,taskData,evidenceData,memberData,collaboratorData,templateData] = await Promise.all([
        integrityApi<any>(tenantId,`/cases/${caseId}`), integrityApi<any>(tenantId,`/cases/${caseId}/timeline`), integrityApi<any>(tenantId,`/cases/${caseId}/messages`), integrityApi<any>(tenantId,`/cases/${caseId}/tasks`), integrityApi<any>(tenantId,`/cases/${caseId}/evidence`),
        canAssign || rights.canInvestigate || canManageCollaborators ? integrityApi<any>(tenantId,"/members") : Promise.resolve({ members:[] }),
        integrityApi<any>(tenantId,`/cases/${caseId}/collaborators`),
        permissions.includes("integrity.templates.read") || permissions.includes("integrity.templates.manage") ? integrityApi<any>(tenantId,"/settings/templates") : Promise.resolve({ templates:[] }),
      ]);
      setState({ data:detail.case,loading:false,error:"" }); setTimeline(events.events || []); setMessages(communication.messages || []); setTasks(taskData.tasks || []); setEvidence(evidenceData.evidence || []); setMembers(memberData.members || []); setCollaborators(collaboratorData.collaborators || []); setTemplates(templateData.templates || []);
    } catch (error:any) { setState({ data:null,loading:false,error:error.message }); }
  },[tenantId,caseId,canAssign,rights.canInvestigate,canManageCollaborators,permissions]);
  useEffect(() => { load(); },[load]);
  async function action(work:()=>Promise<unknown>,success:string) { setBusy(true); setFeedback(""); try { await work(); setFeedback(success); await load(); } catch (error:any) { setFeedback(error.message); } finally { setBusy(false); } }
  if (state.loading) return <Panel><Skeleton className="h-16 rounded-xl" /><div className="mt-5 grid gap-5 lg:grid-cols-3"><Skeleton className="h-[520px] rounded-2xl lg:col-span-2" /><Skeleton className="h-[520px] rounded-2xl" /></div></Panel>;
  if (state.error) return <Panel><button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" />Voltar</button><ErrorState message={state.error} /></Panel>;
  const item = state.data; const report = item.integrity_reports;
  const memberName = (id:string | null) => members.find((member) => member.id === id)?.name || null;
  const transition = (to_status:string) => action(() => integrityApi(tenantId,`/cases/${caseId}/transitions`,{ method:"POST",body:JSON.stringify({ to_status,reason:reason.trim() || undefined,lock_version:item.lock_version }) }),"Status atualizado.");
  return <div className="min-h-full bg-[#F6F5F2]">
    <header className="border-b bg-white px-4 py-4"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><button aria-label="Voltar" onClick={onBack}><ArrowLeft className="h-5 w-5" /></button><div><div className="font-mono text-sm font-bold text-[#3457D5]">{item.protocol}</div><h1 className="text-xl font-bold">{report.subject || "Caso de Integridade"}</h1></div></div><div className="flex flex-wrap items-center gap-2">{canExportDossier ? <><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includeIdentity} disabled={!rights.canReadIdentity || report.reporter_mode !== "identified"} onChange={(event) => setIncludeIdentity(event.target.checked)} />Incluir identidade autorizada</label><Button size="sm" variant="outline" disabled={busy} onClick={() => action(() => integrityDownload(tenantId,`/cases/${caseId}/dossier.pdf?include_identity=${includeIdentity}`,`integrity-${item.protocol}.pdf`),"Dossiê PDF exportado e auditado.")}><Download className="mr-2 h-4 w-4" />Dossiê PDF</Button></> : null}<Risk value={item.severity} /><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{statusLabel(item.status)}</span></div></div></header>
    <Panel>{feedback ? <div role="status" className={`mb-4 rounded-xl border p-3 text-sm ${feedback.toLowerCase().includes("não") || feedback.toLowerCase().includes("erro") ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50"}`}>{feedback}</div> : null}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]"><div className="space-y-5">
        <Card title="Denúncia original"><dl className="grid gap-3 sm:grid-cols-3"><Meta label="Categoria" value={item.integrity_categories?.name} /><Meta label="Unidade/setor" value={item.integrity_units?.name} /><Meta label="Data do fato" value={report.occurred_at ? new Date(report.occurred_at).toLocaleDateString("pt-BR") : "Não informada"} /></dl><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{report.description}</p>{report.reporter_mode === "identified" && rights.canReadIdentity ? <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">{identity === undefined ? <Button size="sm" variant="outline" disabled={busy} onClick={() => action(async () => { const result = await integrityApi<any>(tenantId,`/cases/${caseId}/identity`); setIdentity(result.identity || null); },"Identidade protegida consultada com autorização.")}>Consultar identidade protegida</Button> : identity ? <dl className="grid gap-2 sm:grid-cols-3"><Meta label="Nome" value={identity.name} /><Meta label="E-mail" value={identity.email} /><Meta label="Telefone" value={identity.phone} /></dl> : <p>Identidade não informada.</p>}</div> : null}</Card>
        <CaseTasks tasks={tasks} members={members} templates={templates} canManage={rights.canInvestigate} busy={busy} onCreate={async (value,form) => { await action(() => integrityApi(tenantId,`/cases/${caseId}/tasks`,{ method:"POST",body:JSON.stringify(value) }),"Tarefa criada."); form.reset(); }} onUpdate={(id,value) => action(() => integrityApi(tenantId,`/cases/${caseId}/tasks/${id}`,{ method:"PATCH",body:JSON.stringify(value) }),"Tarefa atualizada.")} />
        <CaseEvidence evidence={evidence} canManage={canManageEvidence} busy={busy} onUpload={(file,visible,description) => action(() => integrityFileApi(tenantId,`/cases/${caseId}/evidence`,file,{ "x-visible-to-reporter":String(visible),"x-file-description":description }),"Evidência enviada com checksum e auditoria.")} onDownload={(evidenceItem) => action(async () => { const result = await integrityApi<any>(tenantId,`/cases/${caseId}/evidence/${evidenceItem.id}/url`,{ method:"POST" }); window.open(result.url,"_blank","noopener,noreferrer"); },"URL segura liberada por 2 minutos.")} onDelete={(evidenceItem,deleteReason) => action(() => integrityApi(tenantId,`/cases/${caseId}/evidence/${evidenceItem.id}`,{ method:"DELETE",body:JSON.stringify({ reason:deleteReason }) }),"Evidência excluída e auditada.")} />
        <CaseMessages messages={messages} templates={templates} canWriteNote={rights.canWriteNote} canSendMessage={rights.canSendMessage} busy={busy} onSend={(body,visible) => action(() => integrityApi(tenantId,`/cases/${caseId}/messages`,{ method:"POST",body:JSON.stringify({ body,visible_to_reporter:visible }) }),visible ? "Mensagem enviada ao denunciante." : "Nota interna registrada.")} />
        <CaseDecision status={item.status} templates={templates} canRecommend={rights.canRecommend} canClose={rights.canClose} busy={busy} onRecommend={async (value,form) => { await action(() => integrityApi(tenantId,`/cases/${caseId}/recommendation`,{ method:"POST",body:JSON.stringify(value) }),"Recomendação registrada."); form.reset(); }} onDecide={(value) => action(() => integrityApi(tenantId,`/cases/${caseId}/decision`,{ method:"POST",body:JSON.stringify({ ...value,lock_version:item.lock_version }) }),"Decisão registrada e caso encerrado.")} />
      </div><aside className="space-y-5">
        <Card title="Tratamento"><Meta label="Responsável principal" value={memberName(item.owner_membership_id) || "Sem responsável"} /><Meta label="Comitê" value={item.integrity_committees?.name} /><Meta label="Primeira resposta" value={item.first_response_due_at ? new Date(item.first_response_due_at).toLocaleString("pt-BR") : "—"} /><Meta label="Tratamento" value={item.treatment_due_at ? new Date(item.treatment_due_at).toLocaleString("pt-BR") : "—"} />
          {canAssign ? <form onSubmit={async (event) => { event.preventDefault(); await action(() => integrityApi(tenantId,`/cases/${caseId}/assignments`,{ method:"POST",body:JSON.stringify({ membership_id:assignee,reason }) }),"Responsável principal atribuído."); setReason(""); }} className="space-y-2 border-t pt-3"><select required value={assignee} onChange={(event) => setAssignee(event.target.value)} className="w-full rounded-xl border p-2 text-sm"><option value="">Atribuir responsável</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><Input required minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da ação" /><Button variant="outline" disabled={busy || !assignee}>Atribuir</Button></form> : <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo para transição sensível" />}
          {(item.status === "closed" ? rights.canReopen : rights.canInvestigate) ? <div className="mt-4 grid gap-2"><TransitionButtons status={item.status} disabled={busy || (["closed"].includes(item.status) && reason.trim().length < 3)} onTransition={transition} /></div> : null}
        </Card>
        <Card title="Investigadores e participantes"><div className="space-y-2">{collaborators.filter((entry) => entry.active).map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-xl bg-[#F6F5F2] p-2 text-sm"><span><strong>{entry.name}</strong><small className="ml-2 text-gray-500">{entry.role === "investigator" ? "Investigador" : "Participante"}</small></span>{canManageCollaborators ? <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => action(() => integrityApi(tenantId,`/cases/${caseId}/collaborators/${entry.id}`,{ method:"DELETE",body:JSON.stringify({ reason }) }),"Participante removido.")}>Remover</Button> : null}</div>)}{!collaborators.some((entry) => entry.active) ? <p className="text-sm text-gray-500">Nenhum investigador adicional.</p> : null}</div>{canManageCollaborators ? <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await action(() => integrityApi(tenantId,`/cases/${caseId}/collaborators`,{ method:"POST",body:JSON.stringify({ membership_id:form.get("membership_id"),role:form.get("role"),reason }) }),"Investigador adicionado."); event.currentTarget.reset(); }} className="mt-3 space-y-2"><select name="membership_id" required className="w-full rounded-xl border p-2"><option value="">Selecionar membro</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><select name="role" className="w-full rounded-xl border p-2"><option value="investigator">Investigador</option><option value="participant">Participante</option></select><Button disabled={busy || reason.trim().length < 3}><UserPlus className="mr-2 h-4 w-4" />Adicionar</Button></form> : null}</Card>
        {canAssign ? <Card title="Conflito de interesse"><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await action(() => integrityApi(tenantId,`/cases/${caseId}/conflicts`,{ method:"POST",body:JSON.stringify({ membership_id:form.get("membership_id"),reason:form.get("conflict_reason") }) }),"Conflito registrado e acesso bloqueado."); event.currentTarget.reset(); }} className="space-y-2"><select name="membership_id" required className="w-full rounded-xl border p-2"><option value="">Pessoa impedida</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><Input name="conflict_reason" required minLength={3} placeholder="Motivo do impedimento" /><Button variant="outline" disabled={busy}>Registrar conflito</Button></form></Card> : null}
        <CaseTimeline events={timeline} />
      </aside></div>
    </Panel>
  </div>;
}
