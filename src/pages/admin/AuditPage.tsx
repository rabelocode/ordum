import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Search } from 'lucide-react';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';

export function AuditPage() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1); const [totalPages,setTotalPages]=useState(1); const [action,setAction]=useState(''); const [severity,setSeverity]=useState('');

  useEffect(() => {
    async function loadAudit() {
      if (!session) return;
      try {
        const params=new URLSearchParams({page:String(page),pageSize:'25'});if(action)params.set('action',action);if(severity)params.set('severity',severity);
        const response = await fetch(`/api/admin/audit?${params}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLogs(data.items); setTotalPages(Math.max(1,data.pagination.totalPages));
        }
      } catch (e) {
        console.error("Error loading audit:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadAudit();
  }, [session,page,action,severity]);

  const severityColor = (sev: string) => {
    switch (sev) {
      case 'info': return 'bg-blue-100 text-blue-700';
      case 'warning': return 'bg-orange-100 text-orange-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202322] tracking-tight">Auditoria</h1>
          <p className="text-[#626866] mt-1">Histórico de ações e eventos da plataforma.</p>
        </div>
      </div>

      <div className="mb-4 grid sm:grid-cols-2 gap-3 bg-white border rounded-2xl p-4"><label className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input aria-label="Filtrar ação" value={action} onChange={event=>{setPage(1);setAction(event.target.value)}} placeholder="Filtrar por ação" className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm"/></label><select aria-label="Filtrar severidade" value={severity} onChange={event=>{setPage(1);setSeverity(event.target.value)}} className="border rounded-xl px-3 text-sm"><option value="">Todas as severidades</option><option value="info">info</option><option value="warning">warning</option><option value="error">error</option></select></div>

      <div className="bg-white border border-[#DDD8CF]/40 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={7} />
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum evento encontrado no seu escopo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDD8CF]/40 bg-[#F6F5F2]/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Data/Hora</th>
                  <th className="p-4">Ação</th>
                  <th className="p-4">Usuário (Ator)</th>
                  <th className="p-4">Entidade</th>
                  <th className="p-4">Severidade</th>
                  <th className="p-4">Correlação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/40">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="text-sm font-medium text-[#202322]">{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-[#626866]">{new Date(log.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-bold text-[#202322]">{log.action}</span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-[#202322]">{log.actor_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-gray-700">{log.entity_type}</div>
                      <div className="text-xs text-gray-500 font-mono">{log.entity_id?.substring(0,8)}...</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${severityColor(log.severity)}`}>
                        {log.severity || 'info'}
                      </span>
                    </td>
                    <td className="p-4"><button onClick={()=>window.alert(JSON.stringify({request_id:log.request_id,ip:log.ip_address,user_agent:log.user_agent,metadata:log.metadata},null,2))} className="font-mono text-xs text-[#B66E45]">{log.request_id?.slice(0,8)||'detalhes'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="border rounded-lg px-3 py-1 disabled:opacity-40">Anterior</button><span className="text-sm p-1">{page}/{totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className="border rounded-lg px-3 py-1 disabled:opacity-40">Próxima</button></div>
    </div>
  );
}
