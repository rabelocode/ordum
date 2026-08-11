import React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "../../ui/Button";

export function Panel({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>;
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#DDD8CF] bg-white p-5"><h2 className="mb-4 font-bold">{title}</h2>{children}</section>;
}

export function Meta({ label, value }: { label: string; value?: string | null }) {
  return <div className="mb-3"><dt className="text-xs text-[#626866]">{label}</dt><dd className="font-medium">{value || "—"}</dd></div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700"><AlertTriangle className="mx-auto mb-3 h-7 w-7" />{message}</div>;
}

export function EmptyState({ title = "Nenhum caso encontrado", description = "Quando um relato for recebido, ele aparecerá aqui." }: { title?: string; description?: string }) {
  return <div className="rounded-2xl border-2 border-dashed border-[#DDD8CF] bg-white p-12 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-[#3457D5]" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-[#626866]">{description}</p></div>;
}

export function FilterSelect({ label, value, onChange, options, includeEmpty = true }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; includeEmpty?: boolean }) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 rounded-xl border border-[#DDD8CF] bg-white px-3 text-sm">{includeEmpty ? <option value="">{label}: todos</option> : null}{options.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select>;
}

export function Risk({ value }: { value: string }) {
  const classes = value === "critical" ? "bg-red-100 text-red-800" : value === "high" ? "bg-orange-100 text-orange-800" : value === "low" ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800";
  const label: Record<string,string> = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{label[value] || value}</span>;
}

export function TransitionButtons({ status, disabled, onTransition }: { status: string; disabled: boolean; onTransition: (status: string) => void }) {
  const transitions: Record<string,string[][]> = {
    received: [["triage","Iniciar triagem"]],
    triage: [["investigation","Iniciar investigação"],["waiting_information","Solicitar informação"]],
    investigation: [["waiting_information","Aguardar informação"],["decision","Registrar decisão"]],
    waiting_information: [["investigation","Retomar investigação"]],
    decision: [["closed","Encerrar caso"]], closed: [["reopened","Reabrir caso"]], reopened: [["triage","Nova triagem"]],
  };
  return <>{(transitions[status] || []).map(([key,label]) => <Button key={key} variant={key === "closed" ? "default" : "outline"} disabled={disabled} onClick={() => onTransition(key)}>{label}</Button>)}</>;
}

export function statusLabel(status: string) {
  return ({ received: "Novo", triage: "Em triagem", investigation: "Em investigação", waiting_information: "Aguardando informação", decision: "Em decisão", closed: "Encerrado", reopened: "Reaberto", archived: "Arquivado" } as Record<string,string>)[status] || status;
}

export function eventLabel(event: string) {
  return ({ report_received: "Relato recebido", status_changed: "Status alterado", assigned: "Responsável atribuído", collaborator_added: "Investigador adicionado", collaborator_removed: "Investigador removido", conflict_registered: "Conflito de interesse registrado", reporter_message_sent: "Mensagem enviada ao denunciante", reporter_message_received: "Mensagem recebida do denunciante", internal_note_added: "Nota interna registrada", evidence_added: "Evidência adicionada", evidence_downloaded: "Evidência acessada", evidence_deleted: "Evidência excluída", task_created: "Tarefa criada", task_updated: "Tarefa atualizada", task_completed: "Tarefa concluída", task_reopened: "Tarefa reaberta", decision_recommended: "Recomendação registrada", decision_recorded: "Decisão registrada", case_dossier_exported: "Dossiê PDF exportado" } as Record<string,string>)[event] || "Atualização registrada";
}
