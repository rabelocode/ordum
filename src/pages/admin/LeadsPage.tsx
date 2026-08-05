import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { AssignLeadModal } from '../../components/admin/AssignLeadModal';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';

export function LeadsPage() {
  const { session } = useAccess();
  const [leads, setLeads] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const [assignModalLead, setAssignModalLead] = useState<any>(null);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...init?.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha na requisição.');
    return data;
  }, [session]);

  const load = useCallback(async (page = 1) => {
    if (!session) return; setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search); if (status) params.set('status', status); if (priority) params.set('priority', priority);
      const data = await api(`/api/admin/leads?${params}`); setLeads(data.items); setPagination(data.pagination);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar leads.'); } finally { setLoading(false); }
  }, [api, priority, search, session, status]);
  useEffect(() => { const timer = setTimeout(() => load(1), 250); return () => clearTimeout(timer); }, [load]);

  async function mutate(path: string, body?: unknown) { setError(null); setSuccess(null); try { await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); setSuccess('Operação concluída.'); await load(pagination.page); } catch (e) { setError(e instanceof Error ? e.message : 'Falha na operação.'); } }
  async function updateLead(id: string, updates: unknown) { setError(null); try { await api(`/api/admin/leads/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }); setSuccess('Lead atualizado.'); await load(pagination.page); } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao atualizar.'); } }
  async function addActivity(leadId: string) { const subject = window.prompt('Assunto da atividade'); if (!subject) return; await mutate(`/api/admin/commercial/leads/${leadId}/activities`, { activity_type: 'note', subject, status: 'completed' }); }
  async function scheduleDemo(leadId: string) { 
    const starts_at = window.prompt('Data e hora da demonstração (ISO ou reconhecida pelo navegador)', new Date(Date.now() + 86400000).toISOString().slice(0, 16)); 
    if (!starts_at) return; 
    const notes = window.prompt('Observações (opcional)', '');
    try {
      await api(`/api/admin/leads/${leadId}/demos`, {
        method: 'POST',
        body: JSON.stringify({ starts_at, notes })
      });
      setSuccess('Demonstração agendada com sucesso.');
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao agendar demonstração.');
    }
  }

  return <div className="max-w-7xl mx-auto space-y-5">
    <div><h1 className="text-3xl font-bold text-[#202322]">Leads comerciais</h1><p className="text-sm text-[#626866] mt-1">Funil, atribuições, histórico e demonstrações no escopo autorizado.</p></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}
    <div className="grid gap-3 sm:grid-cols-3 bg-white rounded-2xl border p-4"><label className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input aria-label="Buscar leads" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, e-mail ou empresa" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/></label><select aria-label="Filtrar status" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border px-3 text-sm"><option value="">Todos os status</option>{['new','contacted','qualified','approved','rejected','converted'].map(item=><option key={item}>{item}</option>)}</select><select aria-label="Filtrar prioridade" value={priority} onChange={e=>setPriority(e.target.value)} className="rounded-xl border px-3 text-sm"><option value="">Todas as prioridades</option>{['low','normal','high','urgent'].map(item=><option key={item}>{item}</option>)}</select></div>
    <div className="bg-white border rounded-2xl overflow-hidden">{loading?<ListSkeleton rows={7}/>:!leads.length?<div className="p-10 text-center text-sm text-gray-500">Nenhum lead encontrado.</div>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F6F5F2] text-left"><tr><th className="p-3">Contato</th><th className="p-3">Escopo</th><th className="p-3">Funil</th><th className="p-3">Prioridade</th><th className="p-3">Histórico</th><th className="p-3">Ações</th></tr></thead><tbody>{leads.map(lead=>{const assignment=lead.assignment;const canClaim=assignment&&!assignment.owner_platform_member_id&&assignment.platform_teams?.allow_self_claim;return <tr key={lead.id} className="border-t align-top"><td className="p-3"><strong>{lead.name}</strong><div className="text-gray-500">{lead.company}</div><div className="text-xs">{lead.email} · {lead.source}</div></td><td className="p-3">{assignment?.platform_teams?.name||'Não atribuído'}<div className="text-xs text-gray-500">{lead.owner?.name||lead.owner?.email||'Sem responsável'}</div></td><td className="p-3"><select aria-label={`Status de ${lead.name}`} value={lead.status} onChange={e=>updateLead(lead.id,{status:e.target.value})} className="rounded-lg border p-1.5">{['new','contacted','qualified','approved','rejected','converted'].map(item=><option key={item}>{item}</option>)}</select></td><td className="p-3"><select aria-label={`Prioridade de ${lead.name}`} value={lead.priority||'normal'} onChange={e=>updateLead(lead.id,{priority:e.target.value})} className="rounded-lg border p-1.5">{['low','normal','high','urgent'].map(item=><option key={item}>{item}</option>)}</select></td><td className="p-3 text-xs text-gray-600">{lead.commercial_activities?.length||0} atividades<br/>{lead.commercial_demos?.length||0} demos</td><td className="p-3"><div className="flex flex-wrap gap-2">{canClaim&&<button onClick={()=>mutate(`/api/admin/leads/${lead.id}/claim`)} className="rounded-lg bg-[#B66E45] px-2 py-1 text-xs text-white">Assumir</button>}<button onClick={()=>setAssignModalLead(lead)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs">Atribuir</button><button onClick={()=>addActivity(lead.id)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs">Atividade</button><button onClick={()=>scheduleDemo(lead.id)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs">Agendar demo</button></div></td></tr>})}</tbody></table></div>}</div>
    <div className="flex justify-between items-center text-sm"><span>{pagination.total} registros</span><div className="flex gap-2"><button disabled={pagination.page<=1} onClick={()=>load(pagination.page-1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Anterior</button><span className="px-2 py-1.5">{pagination.page}/{Math.max(1,pagination.totalPages)}</span><button disabled={pagination.page>=pagination.totalPages} onClick={()=>load(pagination.page+1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Próxima</button></div></div>
    {assignModalLead&&<AssignLeadModal isOpen onClose={()=>setAssignModalLead(null)} onSuccess={()=>{setAssignModalLead(null);load(pagination.page);}} leadId={assignModalLead.id} currentAssignment={assignModalLead.assignment}/>}
  </div>;
}
