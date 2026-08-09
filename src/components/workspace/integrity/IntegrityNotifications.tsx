import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "../../ui/Button";
import { integrityApi } from "../integrityApi";

export function IntegrityNotifications({ tenantId, enabled, onOpenCase }: { tenantId:string; enabled:boolean; onOpenCase:(id:string)=>void }) {
  const [open,setOpen] = useState(false); const [items,setItems] = useState<any[]>([]); const [unread,setUnread] = useState(0); const [error,setError] = useState("");
  const load = async () => { if (!enabled) return; try { const data = await integrityApi<any>(tenantId,"/notifications"); setItems(data.notifications || []); setUnread(data.unread || 0); setError(""); } catch (failure:any) { setError(failure.message); } };
  useEffect(() => { load(); },[tenantId,enabled]);
  if (!enabled) return null;
  return <div className="relative"><Button size="sm" variant="outline" aria-label="Notificações do Integridade" onClick={() => { setOpen(!open); if (!open) load(); }}><Bell className="h-4 w-4" />{unread ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unread}</span> : null}</Button>{open ? <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-2xl border border-[#DDD8CF] bg-white p-3 shadow-xl"><div className="mb-2 flex items-center justify-between"><strong>Notificações internas</strong><button className="text-xs text-[#3457D5]" onClick={load}>Atualizar</button></div>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : items.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">Nenhuma notificação.</p> : <div className="max-h-96 space-y-2 overflow-auto">{items.map((item) => <button key={item.id} className={`w-full rounded-xl p-3 text-left text-sm ${item.read_at ? "bg-gray-50" : "bg-blue-50"}`} onClick={async () => { if (!item.read_at) { await integrityApi(tenantId,`/notifications/${item.id}/read`,{ method:"PATCH" }); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry,read_at:new Date().toISOString() } : entry)); setUnread((value) => Math.max(value-1,0)); } if (item.case_id) { onOpenCase(item.case_id); setOpen(false); } }}><strong>{item.title}</strong><div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString("pt-BR")}</div></button>)}</div>}</div> : null}</div>;
}
