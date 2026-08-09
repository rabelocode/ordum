import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "../../ui/Button";
import { Card } from "./IntegrityUi";

export function CaseMessages({ messages, templates, canWriteNote, canSendMessage, busy, onSend }: { messages:any[]; templates:any[]; canWriteNote:boolean; canSendMessage:boolean; busy:boolean; onSend:(body:string,visible:boolean)=>Promise<void> }) {
  const [body,setBody] = useState("");
  const [visible,setVisible] = useState(false);
  const available = templates.filter((item) => item.active && ["reporter_message","information_request"].includes(item.template_type));
  return <Card title="Comunicação externa e notas internas">
    <div className="space-y-2">{messages.length === 0 ? <p className="text-sm text-gray-500">Nenhuma comunicação registrada.</p> : messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.visible_to_reporter ? "border border-blue-100 bg-blue-50" : "border border-amber-100 bg-amber-50"}`}><strong>{message.visible_to_reporter ? "Visível ao denunciante" : "Nota interna restrita"}</strong><p className="mt-1 whitespace-pre-wrap">{message.body}</p><small className="text-gray-500">{new Date(message.created_at).toLocaleString("pt-BR")}</small></div>)}</div>
    {canWriteNote || canSendMessage ? <form onSubmit={async (event) => { event.preventDefault(); await onSend(body,visible); setBody(""); }} className="mt-4 space-y-2">
      {available.length ? <select className="w-full rounded-xl border p-2 text-sm" value="" onChange={(event) => { const template = available.find((item) => item.id === event.target.value); if (template) setBody(template.body); }}><option value="">Aplicar template revisável</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}
      <textarea required minLength={2} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="w-full rounded-xl border p-3" placeholder={visible ? "Mensagem destinada ao denunciante" : "Nota interna — não será exibida no canal público"} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} disabled={!canSendMessage} />Enviar ao denunciante</label>
      <Button type="submit" disabled={busy || (visible ? !canSendMessage : !canWriteNote)}><MessageSquare className="mr-2 h-4 w-4" />Registrar</Button>
    </form> : null}
  </Card>;
}
