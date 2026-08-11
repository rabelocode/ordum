import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, MessageSquareText, RefreshCw, Send, StickyNote, X } from "lucide-react";
import { useAccess } from "../../core/auth/AccessContext";
import { userFacingApiError, userFacingException } from "../../lib/userFacingError";
import { ListSkeleton } from "../ui/LoadingSkeletons";
import { ActionDialog } from "../ui/ActionDialog";

const FILTERS = [
  ["", "Todos"],
  ["open", "Novos"],
  ["in_progress", "Em atendimento"],
  ["waiting_customer", "Aguardando cliente"],
  ["resolved", "Resolvidos"],
] as const;

const NEXT_STATUS: Record<string, { value: string; label: string }> = {
  open: { value: "triage", label: "Iniciar triagem" },
  triage: { value: "in_progress", label: "Iniciar atendimento" },
  in_progress: { value: "waiting_customer", label: "Aguardar cliente" },
  waiting_customer: { value: "in_progress", label: "Retomar atendimento" },
  resolved: { value: "closed", label: "Encerrar chamado" },
};

export function SupportWorkspace() {
  const { session, hasPlatformPermission } = useAccess();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageKind, setMessageKind] = useState<"external_reply" | "internal_note">("external_reply");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [reason, setReason] = useState("");
  const canManage = hasPlatformPermission("platform.support.manage");

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        ...init?.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(userFacingApiError(body, response.status, "Não foi possível concluir esta ação."));
    return body;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (status) params.set("status", status);
      const body = await api(`/api/admin/control-plane/modules/support?${params}`);
      setItems(body.items || []);
    } catch (caught) {
      setError(userFacingException(caught, "Não foi possível carregar os chamados."));
    } finally {
      setLoading(false);
    }
  }, [api, session, status]);

  useEffect(() => { void load(); }, [load]);

  async function openTicket(id: string) {
    setDetailLoading(true);
    setError("");
    try {
      setSelected(await api(`/api/admin/control-plane/support/${id}`));
      setMessage("");
    } catch (caught) {
      setError(userFacingException(caught, "Não foi possível abrir o chamado."));
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !message.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/admin/control-plane/support/${selected.ticket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ kind: messageKind, body: message }),
      });
      setMessage("");
      await openTicket(selected.ticket.id);
      await load();
    } catch (caught) {
      setError(userFacingException(caught, "Não foi possível registrar a mensagem."));
    } finally {
      setSaving(false);
    }
  }

  async function transition() {
    const next = selected ? NEXT_STATUS[selected.ticket.status] : null;
    if (!selected || !next || !reason.trim()) return;
    setSaving(true);
    try {
      await api("/api/admin/control-plane/transition", {
        method: "POST",
        body: JSON.stringify({
          entityType: "support",
          entityId: selected.ticket.id,
          toStatus: next.value,
          reason,
          teamId: selected.ticket.team_id,
          tenantId: selected.ticket.tenant_id,
        }),
      });
      setTransitionOpen(false);
      setReason("");
      await openTicket(selected.ticket.id);
      await load();
    } catch (caught) {
      setError(userFacingException(caught, "Não foi possível atualizar o chamado."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#B66E45]">Operação</p>
          <h1 className="mt-1 text-3xl font-black">Suporte</h1>
          <p className="mt-1 text-sm text-[#626866]">Converse com o cliente, registre notas privadas e acompanhe cada atendimento.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b">
        {FILTERS.map(([value, label]) => (
          <button key={value} onClick={() => setStatus(value)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-bold ${status === value ? "border-[#B66E45]" : "border-transparent text-[#626866]"}`}>
            {label}
          </button>
        ))}
      </nav>

      {error ? <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div> : null}
      {loading ? <ListSkeleton rows={5} /> : items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <button key={item.id} onClick={() => void openTicket(item.id)} className="grid w-full gap-4 rounded-2xl border border-[#DDD8CF] bg-white p-5 text-left shadow-sm transition hover:border-[#B66E45]/60 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
              <div><div className="font-black">#{item.ticket_number} · {item.subject}</div><div className="mt-1 text-sm text-[#626866]">{item.tenants?.name || "Cliente"}</div></div>
              <Info label="Situação" value={supportStatus(item.status)} />
              <Info label="Prazo" value={dateLabel(item.sla_due_at)} />
              <span className="inline-flex items-center gap-1 text-sm font-bold text-[#B66E45]">Abrir <ArrowRight className="h-4 w-4" /></span>
            </button>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed bg-white p-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-3 font-black">Nenhum chamado nesta fila</h2><p className="mt-1 text-sm text-[#626866]">Quando um cliente precisar de ajuda, o atendimento aparecerá aqui.</p></section>
      )}

      {(selected || detailLoading) ? (
        <div className="fixed inset-0 z-[60] bg-black/45" role="dialog" aria-modal="true">
          <section className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#F6F5F2] shadow-2xl">
            {detailLoading && !selected ? <div className="p-8"><ListSkeleton rows={6} /></div> : selected ? <>
              <header className="border-b bg-white p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#B66E45]">Chamado #{selected.ticket.ticket_number}</p><h2 className="mt-1 text-2xl font-black">{selected.ticket.subject}</h2><p className="mt-1 text-sm text-[#626866]">{selected.ticket.tenants?.name} · {supportStatus(selected.ticket.status)}</p></div><button onClick={() => setSelected(null)} aria-label="Fechar chamado" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#EEEAE3] px-3 py-1.5 font-bold">{priorityLabel(selected.ticket.priority)}</span><span className="rounded-full bg-[#EEEAE3] px-3 py-1.5 font-bold">Prazo {dateLabel(selected.ticket.sla_due_at)}</span>{selected.ticket.owner_name ? <span className="rounded-full bg-[#EEEAE3] px-3 py-1.5 font-bold">{selected.ticket.owner_name}</span> : null}</div>
                {canManage && NEXT_STATUS[selected.ticket.status] ? <button onClick={() => setTransitionOpen(true)} className="mt-4 rounded-xl bg-[#202322] px-4 py-2.5 text-sm font-bold text-white">{NEXT_STATUS[selected.ticket.status].label}</button> : null}
              </header>
              <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
                <article className="rounded-2xl border bg-white p-5"><h3 className="font-black">Solicitação do cliente</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#404543]">{selected.ticket.description}</p></article>
                <section><h3 className="mb-3 font-black">Conversa e histórico</h3><div className="space-y-3">{selected.events.length ? selected.events.map((event: any) => <article key={event.id} className={`rounded-2xl border p-4 ${event.private ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-white"}`}><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#626866]">{event.private ? <StickyNote className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}{event.private ? "Nota interna" : "Mensagem ao cliente"}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{event.body}</p><p className="mt-2 text-xs text-[#777D7A]">{event.actor_name} · {dateLabel(event.created_at)}</p></article>) : <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-[#626866]">Ainda não há mensagens neste chamado.</div>}</div></section>
              </div>
              {canManage ? <form onSubmit={sendMessage} className="border-t bg-white p-5 sm:p-7"><div className="mb-3 flex gap-2"><button type="button" onClick={() => setMessageKind("external_reply")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${messageKind === "external_reply" ? "bg-blue-100 text-blue-800" : "bg-gray-100"}`}>Mensagem ao cliente</button><button type="button" onClick={() => setMessageKind("internal_note")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${messageKind === "internal_note" ? "bg-amber-100 text-amber-800" : "bg-gray-100"}`}>Nota interna</button></div><label className="sr-only" htmlFor="support-message">Mensagem</label><textarea id="support-message" required minLength={2} maxLength={4000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={messageKind === "external_reply" ? "Escreva uma resposta clara para o cliente..." : "Registre uma observação visível somente para a equipe Ordum..."} className="w-full rounded-xl border border-[#CFC9BF] p-3 text-sm"/><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-[#626866]">{messageKind === "external_reply" ? "Esta mensagem será visível ao cliente." : "Esta nota ficará somente no atendimento interno."}</p><button disabled={saving || message.trim().length < 2} className="inline-flex items-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar</button></div></form> : null}
            </> : null}
          </section>
        </div>
      ) : null}

      <ActionDialog open={transitionOpen} title={selected && NEXT_STATUS[selected.ticket.status] ? NEXT_STATUS[selected.ticket.status].label : "Atualizar chamado"} description="Registre por que o atendimento está mudando de etapa." label="Motivo" value={reason} onChange={setReason} onClose={() => setTransitionOpen(false)} onConfirm={transition} confirmLabel="Confirmar etapa" busy={saving} required />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs font-bold uppercase tracking-wide text-[#777D7A]">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>; }
function supportStatus(value?: string) { return ({ open: "Novo", triage: "Em triagem", in_progress: "Em atendimento", waiting_customer: "Aguardando cliente", resolved: "Resolvido", closed: "Encerrado", cancelled: "Cancelado" } as Record<string, string>)[value || ""] || "Em acompanhamento"; }
function priorityLabel(value?: string) { return ({ low: "Prioridade baixa", normal: "Prioridade normal", high: "Prioridade alta", urgent: "Urgente" } as Record<string, string>)[value || ""] || "Prioridade normal"; }
function dateLabel(value?: string) { return value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "A definir"; }
