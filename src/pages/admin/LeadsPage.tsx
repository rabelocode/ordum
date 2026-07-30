import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Search, Plus, Filter, LayoutGrid, CheckCircle, Clock, Check, X, ShieldAlert } from 'lucide-react';
import { AssignLeadModal } from '../../components/admin/AssignLeadModal';

export function LeadsPage() {
  const { session, user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assignModalLead, setAssignModalLead] = useState<any>(null);

  async function loadLeads() {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/leads', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [session]);

  const handleClaim = async (leadId: string) => {
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) {
        alert("Lead assumido com sucesso!");
        loadLeads();
      } else {
        const err = await response.json();
        alert(err.error || "Erro ao assumir lead");
      }
    } catch (e: any) {
      alert("Erro de comunicação");
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202322] tracking-tight">Leads Comerciais</h1>
          <p className="text-[#626866] mt-1">Gerencie leads, atribuições e self-claim.</p>
        </div>
      </div>

      <div className="bg-white border border-[#DDD8CF]/40 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Carregando leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum lead encontrado para seu escopo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDD8CF]/40 bg-[#F6F5F2]/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Nome / Empresa</th>
                  <th className="p-4">Email / Origem</th>
                  <th className="p-4">Equipe</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/40">
                {leads.map(lead => {
                  const assignment = lead.assignment;
                  const canClaim = assignment && !assignment.owner_platform_member_id && assignment.platform_teams?.allow_self_claim;
                  
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-[#202322]">{lead.name}</div>
                        <div className="text-xs text-[#626866]">{lead.company_name || 'Sem empresa'}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-[#202322]">{lead.email}</div>
                        <div className="text-xs text-[#626866]">{lead.source}</div>
                      </td>
                      <td className="p-4">
                        {assignment ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {assignment.platform_teams?.name || 'Equipe Desconhecida'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Não atribuído</span>
                        )}
                      </td>
                      <td className="p-4">
                        {lead.owner ? (
                          <div className="text-sm font-medium text-[#202322]">{lead.owner.name || lead.owner.email}</div>
                        ) : (
                          <span className="text-xs text-orange-500 font-medium">Disponível</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          lead.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {lead.status === 'approved' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {lead.status === 'approved' ? 'Demo Liberada' : 'Novo'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 flex items-center gap-2">
                        {canClaim && (
                          <button 
                            onClick={() => handleClaim(lead.id)}
                            className="px-3 py-1.5 bg-[#B66E45] text-white text-xs font-bold rounded-lg hover:bg-[#a05e38]"
                          >
                            Assumir
                          </button>
                        )}
                        <button 
                          onClick={() => setAssignModalLead(lead)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
                        >
                          Atribuir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {assignModalLead && (
        <AssignLeadModal 
          isOpen={true} 
          onClose={() => setAssignModalLead(null)}
          onSuccess={() => { setAssignModalLead(null); loadLeads(); }}
          leadId={assignModalLead.id}
          currentAssignment={assignModalLead.assignment}
        />
      )}
    </div>
  );
}
