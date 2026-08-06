import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, AlertTriangle, ShieldCheck, Mail, Clock, Filter, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase'; // Assuming standard auth helper or access token

export function IntegrityModuleView({ tenant, onBack }: { tenant: { id: string }; user: unknown; onBack: () => void }) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  
  if (selectedCaseId) {
    return <IntegrityCaseDetail caseId={selectedCaseId} onBack={() => setSelectedCaseId(null)} />;
  }
  
  return <IntegrityCaseList tenantId={tenant.id} onBack={onBack} onSelectCase={setSelectedCaseId} />;
}

function useApi(path: string, options?: RequestInit) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const execute = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const res = await fetch(`/api/workspace/integrity${path}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options?.headers || {})
        }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Erro na requisição');
      setData(resData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    execute();
  }, [path]);

  return { data, loading, error, refetch: execute };
}

function IntegrityCaseList({ tenantId, onBack, onSelectCase }: { tenantId: string, onBack: () => void, onSelectCase: (id: string) => void }) {
  const [filters, setFilters] = useState({ status: '', risk_level: '', days_open_min: '' });
  
  const query = new URLSearchParams();
  if (filters.status) query.append('status', filters.status);
  if (filters.risk_level) query.append('risk_level', filters.risk_level);
  if (filters.days_open_min) query.append('days_open_min', filters.days_open_min);

  const { data, loading, error } = useApi(`/cases?${query.toString()}`, { headers: { 'x-tenant-id': tenantId } });

  const calculateDaysOpen = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 bg-white dark:bg-slate-950">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <h2 className="font-medium">Gestão de Casos (Integridade)</h2>
        </div>
      </div>
      
      <div className="p-4 flex gap-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
         <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="px-3 py-1.5 border rounded text-sm bg-transparent dark:border-slate-700">
            <option value="">Status: Todos</option>
            <option value="received">Recebido</option>
            <option value="triage">Em Triagem</option>
            <option value="in_review">Em Análise</option>
            <option value="resolved">Resolvido</option>
         </select>
         <select value={filters.risk_level} onChange={e => setFilters({ ...filters, risk_level: e.target.value })} className="px-3 py-1.5 border rounded text-sm bg-transparent dark:border-slate-700">
            <option value="">Risco: Todos</option>
            <option value="low">Baixo</option>
            <option value="medium">Médio</option>
            <option value="high">Alto</option>
            <option value="critical">Crítico</option>
         </select>
         <select value={filters.days_open_min} onChange={e => setFilters({ ...filters, days_open_min: e.target.value })} className="px-3 py-1.5 border rounded text-sm bg-transparent dark:border-slate-700">
            <option value="">Tempo em aberto: Indiferente</option>
            <option value="7">Aberto há +7 dias</option>
            <option value="30">Aberto há +30 dias</option>
         </select>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && <div className="text-slate-500 text-sm">Carregando painel de integridade...</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        
        {data?.cases && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3">Protocolo</th>
                  <th className="px-6 py-3">Idade</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Severidade</th>
                  <th className="px-6 py-3">Categoria</th>
                  <th className="px-6 py-3">Responsáveis</th>
                </tr>
              </thead>
              <tbody>
                {data.cases.map((c: any) => (
                  <tr key={c.id} onClick={() => onSelectCase(c.id)} className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer">
                    <td className="px-6 py-4 font-mono font-medium text-indigo-500">{c.protocol}</td>
                    <td className="px-6 py-4">{calculateDaysOpen(c.created_at)} dias</td>
                    <td className="px-6 py-4 capitalize">{c.status}</td>
                    <td className="px-6 py-4 capitalize">{c.risk_level || '-'}</td>
                    <td className="px-6 py-4">{c.integrity_categories?.name || '-'}</td>
                    <td className="px-6 py-4">{c.integrity_case_assignments?.length || 0}</td>
                  </tr>
                ))}
                {data.cases.length === 0 && (
                   <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhum caso encontrado para os filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrityCaseDetail({ caseId, onBack }: { caseId: string, onBack: () => void }) {
   return (
       <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
         <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 bg-white dark:bg-slate-950">
            <div className="flex items-center gap-3">
               <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"><ArrowLeft className="w-4 h-4" /></button>
               <h2 className="font-medium">Detalhes do Caso</h2>
            </div>
         </div>
         {/* Stub para manter simples e direto */}
         <div className="p-8">
            <h1 className="text-xl font-bold mb-4">Caso #{caseId.split('-')[0]}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">Esta view orquestra Metadata, Timeline (Eventos) e Chat anônimo de mensagens.</p>
            
            <div className="p-4 rounded border border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700/50">
                Painel detalhado acurado com os stubs transacionais:
                <ul className="list-disc pl-5 mt-2 text-sm opacity-80">
                    <li>Visualização de relatórios (via /api/workspace/integrity/cases/:id)</li>
                    <li>Timeline Audit events (via /api/workspace/integrity/cases/:id/events)</li>
                    <li>Canal de mensagens (via /api/workspace/integrity/cases/:id/messages)</li>
                    <li>Designação (via /api/workspace/integrity/cases/:id/assignments)</li>
                </ul>
            </div>
         </div>
       </div>
   );
}
