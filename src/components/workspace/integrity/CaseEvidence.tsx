import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Card } from "./IntegrityUi";

export function CaseEvidence({ evidence, canManage, busy, onUpload, onDownload, onDelete }: { evidence:any[]; canManage:boolean; busy:boolean; onUpload:(file:File,visible:boolean,description:string)=>Promise<void>; onDownload:(item:any)=>Promise<void>; onDelete:(item:any,reason:string)=>Promise<void> }) {
  const [visible,setVisible] = useState(false);
  const [description,setDescription] = useState("");
  const [deleting,setDeleting] = useState<string | null>(null);
  const [reason,setReason] = useState("");
  const [selected,setSelected] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = async () => { if (!selected) return; await onUpload(selected,visible,description); setSelected(null); setDescription(""); if(inputRef.current) inputRef.current.value=""; };
  return <Card title="Evidências e cadeia de custódia">
    {canManage ? <div className="rounded-xl border border-dashed border-[#AAB8E8] bg-[#F8FAFF] p-4"><button type="button" disabled={busy} onClick={()=>inputRef.current?.click()} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();setSelected(event.dataTransfer.files?.[0]||null);}} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl text-center transition hover:bg-white disabled:opacity-50"><FileUp className="mb-2 h-7 w-7 text-[#3457D5]"/><span className="font-bold">Arraste um arquivo ou selecione do dispositivo</span><span className="mt-1 text-xs text-[#626866]">O arquivo ficará protegido e vinculado somente a este caso.</span>{selected?<span className="mt-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#3457D5]">{selected.name}</span>:null}</button><input ref={inputRef} type="file" disabled={busy} className="sr-only" aria-label="Selecionar evidência" onChange={(event)=>setSelected(event.target.files?.[0]||null)}/><Input value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva por que este arquivo é relevante (opcional)" className="mt-3" /><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />Disponibilizar ao denunciante</label><Button disabled={busy||!selected} onClick={submit}>{busy?"Enviando…":"Adicionar evidência"}</Button></div></div> : null}
    <div className="mt-3 space-y-2">{evidence.length === 0 ? <p className="text-sm text-gray-500">Nenhuma evidência registrada.</p> : evidence.map((item) => <div key={item.id} className="rounded-xl bg-[#F6F5F2] p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><button type="button" onClick={() => onDownload(item)} className="text-left font-medium text-[#3457D5]">{item.files.original_name}</button><p className="text-xs text-gray-600">{fileTypeLabel(item.files.mime_type)} · {Math.ceil((item.files.size_bytes || 0)/1024)} KB · {new Date(item.created_at).toLocaleString("pt-BR")} · enviado por {item.uploader_name||"Equipe de Integridade"}</p>{item.description ? <p className="mt-1">{item.description}</p> : null}<details className="mt-2 text-xs text-gray-500"><summary className="cursor-pointer font-medium">Ver dados de verificação</summary><p className="mt-1 break-all font-mono text-[11px]">SHA-256: {item.files.checksum_sha256 || "Não disponível para este arquivo"}</p></details></div>{canManage ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleting(item.id)}>Excluir</Button> : null}</div>
      {item.visible_to_reporter ? <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Visível ao denunciante</span> : null}
      {deleting === item.id ? <div className="mt-3 rounded-xl border border-red-200 bg-white p-3"><Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} placeholder="Motivo obrigatório" /><div className="mt-2 flex gap-2"><Button size="sm" disabled={busy || reason.trim().length < 3} onClick={async () => { await onDelete(item,reason); setDeleting(null); setReason(""); }}>Confirmar exclusão</Button><Button size="sm" variant="outline" onClick={() => { setDeleting(null); setReason(""); }}>Cancelar</Button></div></div> : null}
    </div>)}</div>
  </Card>;
}

function fileTypeLabel(mime:string){if(mime?.startsWith("image/"))return "Imagem";if(mime?.startsWith("video/"))return "Vídeo";if(mime?.startsWith("audio/"))return "Áudio";if(mime==="application/pdf")return "Documento PDF";return "Documento";}
