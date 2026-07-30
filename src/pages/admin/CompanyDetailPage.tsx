import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { AssignLeadModal } from '../../components/admin/AssignLeadModal'; // We can reuse it for client assignment

export function CompanyDetailPage({ tenantId }: { tenantId: string }) {
  const { session } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSaving, setIsSaving] = useState(false);
  const [solutionKeys, setSolutionKeys] = useState<string[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  async function loadTenant() {
    if (!session) return;
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTenant(data);
        if (data.tenant_solutions) {
          setSolutionKeys(data.tenant_solutions.map((s: any) => s.solutions?.key).filter(Boolean));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadTenant();
  }, [session, tenantId]);

  const handleSaveSolutions = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}/solutions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ solutionKeys })
      });
      if (response.ok) {
        alert("Soluções atualizadas com sucesso!");
        loadTenant();
      } else {
        alert("Erro ao atualizar soluções.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSolution = (key: string) => {
    if (solutionKeys.includes(key)) {
      setSolutionKeys(solutionKeys.filter(k => k !== key));
    } else {
      setSolutionKeys([...solutionKeys, key]);
    }
  };

  if (!tenant) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <a href="#/admin/empresas" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-[#DDD8CF]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm"
                style={{ backgroundColor: tenant.settings?.primaryColor || '#353938' }}
              >
                {tenant.settings?.logoInitials || tenant.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#202322]">{tenant.name}</h1>
                <p className="text-[#626866] font-mono">{tenant.slug}</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsAssignModalOpen(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200"
            >
              Transferir / Atribuir
            </button>
          </div>
        </div>
        
        <div className="flex border-b border-[#DDD8CF]/40 overflow-x-auto">
          {["Visão Geral", "Soluções", "Responsáveis"].map(tab => {
            const tabId = tab.toLowerCase().replace(/[^a-z]/g, '');
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tabId ? 'border-[#B66E45] text-[#202322]' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>
        
        <div className="p-8">
          {activeTab === 'visoogeral' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-[#DDD8CF]/40">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-bold text-gray-900 capitalize">{tenant.status}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-[#DDD8CF]/40">
                  <div className="text-sm text-gray-500">Criado em</div>
                  <div className="font-bold text-gray-900">{new Date(tenant.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'solues' && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold">Soluções da Plataforma</h2>
              <div className="space-y-4">
                {[
                  { key: 'integrity', name: 'Canal de Integridade' },
                  { key: 'people', name: 'Pessoas e RH' },
                  { key: 'talent', name: 'Atração de Talentos' }
                ].map(sol => (
                  <label key={sol.key} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-[#B66E45] border-gray-300 rounded focus:ring-[#B66E45]"
                      checked={solutionKeys.includes(sol.key)}
                      onChange={() => toggleSolution(sol.key)}
                    />
                    <div>
                      <div className="font-medium text-[#202322]">{sol.name}</div>
                      <div className="text-xs text-[#626866]">{sol.key}</div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleSaveSolutions}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#B66E45] rounded-xl hover:bg-[#a05e38] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Atualizar Soluções
                </button>
              </div>
            </div>
          )}

          {activeTab === 'responsveis' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold">Responsável Comercial</h2>
              
              {tenant.assignment ? (
                <div className="p-6 bg-gray-50 rounded-2xl border border-[#DDD8CF]/40">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">Equipe</div>
                      <div className="text-lg font-bold text-[#202322]">{tenant.assignment.platform_teams?.name}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">Vendedor</div>
                      <div className="text-lg font-bold text-[#202322]">{tenant.owner?.name || tenant.owner?.email || 'Equipe (Sem dono específico)'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-[#DDD8CF] rounded-2xl text-gray-500">
                  Nenhum responsável comercial atribuído.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isAssignModalOpen && (
        <AssignLeadModal 
          isOpen={true} 
          onClose={() => setIsAssignModalOpen(false)}
          onSuccess={() => { setIsAssignModalOpen(false); loadTenant(); }}
          leadId={tenantId}
          currentAssignment={tenant.assignment}
          isClient={true}
        />
      )}
    </div>
  );
}
