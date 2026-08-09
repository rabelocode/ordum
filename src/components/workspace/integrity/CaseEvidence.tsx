import { useState } from "react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Card } from "./IntegrityUi";

export function CaseEvidence({ evidence, canManage, busy, onUpload, onDownload, onDelete }: { evidence:any[]; canManage:boolean; busy:boolean; onUpload:(file:File,visible:boolean,description:string)=>Promise<void>; onDownload:(item:any)=>Promise<void>; onDelete:(item:any,reason:string)=>Promise<void> }) {
  const [visible,setVisible] = useState(false);
  const [description,setDescription] = useState("");
  const [deleting,setDeleting] = useState<string | null>(null);
  const [reason,setReason] = useState("");
  return <Card title="Evidências e cadeia de custódia">
    {canManage ? <div className="rounded-xl border border-dashed p-4"><label className="block text-sm font-medium">Adicionar evidência<input type="file" disabled={busy} className="mt-2 block w-full text-sm" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; await onUpload(file,visible,description); event.target.value=""; setDescription(""); }} /></label><Input value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição da evidência (opcional)" className="mt-3" /><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />Disponibilizar ao denunciante</label></div> : null}
    <div className="mt-3 space-y-2">{evidence.length === 0 ? <p className="text-sm text-gray-500">Nenhuma evidência registrada.</p> : evidence.map((item) => <div key={item.id} className="rounded-xl bg-[#F6F5F2] p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><button type="button" onClick={() => onDownload(item)} className="text-left font-medium text-[#3457D5]">{item.files.original_name}</button><p className="text-xs text-gray-600">{item.files.mime_type} · {Math.ceil((item.files.size_bytes || 0)/1024)} KB · {new Date(item.created_at).toLocaleString("pt-BR")} · enviado por {item.uploader_name}</p>{item.description ? <p className="mt-1">{item.description}</p> : null}<p className="mt-1 break-all font-mono text-[11px] text-gray-500">SHA-256: {item.files.checksum_sha256 || "checksum legado indisponível"}</p></div>{canManage ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleting(item.id)}>Excluir</Button> : null}</div>
      {item.visible_to_reporter ? <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Visível ao denunciante</span> : null}
      {deleting === item.id ? <div className="mt-3 rounded-xl border border-red-200 bg-white p-3"><Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} placeholder="Motivo obrigatório" /><div className="mt-2 flex gap-2"><Button size="sm" disabled={busy || reason.trim().length < 3} onClick={async () => { await onDelete(item,reason); setDeleting(null); setReason(""); }}>Confirmar exclusão</Button><Button size="sm" variant="outline" onClick={() => { setDeleting(null); setReason(""); }}>Cancelar</Button></div></div> : null}
    </div>)}</div>
  </Card>;
}
