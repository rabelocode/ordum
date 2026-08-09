import { Card, eventLabel, statusLabel } from "./IntegrityUi";

export function CaseTimeline({ events }: { events:any[] }) {
  return <Card title="Timeline auditável"><div className="max-h-[650px] space-y-4 overflow-auto pr-1">{events.length === 0 ? <p className="text-sm text-gray-500">Nenhum evento registrado.</p> : events.map((event) => <div key={event.id} className="border-l-2 border-blue-100 pl-3 text-sm"><strong>{eventLabel(event.event_type)}</strong><div className="text-xs font-medium text-[#626866]">{event.actor_name || "Sistema Ordum"}</div><div className="text-xs text-gray-500">{new Date(event.created_at).toLocaleString("pt-BR")}</div>{event.note ? <p className="mt-1 whitespace-pre-wrap">{event.note}</p> : null}{event.before_status || event.after_status ? <p className="mt-1 text-xs text-[#626866]">{event.before_status ? statusLabel(event.before_status) : "—"} → {event.after_status ? statusLabel(event.after_status) : "—"}</p> : null}</div>)}</div></Card>;
}
