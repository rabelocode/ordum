import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { PlatformTeam } from '../../types/platform';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { AddTeamMemberModal } from '../../components/admin/AddTeamMemberModal';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';
import { DetailSkeleton } from '../../components/ui/LoadingSkeletons';

export function TeamDetailPage({ teamId }: { teamId: string }) {
  const { session } = useAuth();
  const { platformRole } = usePlatform();
  const [team, setTeam] = useState<PlatformTeam | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("VisoGeral");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});

  async function loadTeam() {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/teams/${teamId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeam(data);
        setFormData(data);
      }
      
      const mResp = await fetch(`/api/admin/teams/${teamId}/members`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (mResp.ok) {
        const mData = await mResp.json();
        setMembers(mData);
      }
    } catch (e) {
      console.error("Error loading team:", e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, [session, teamId]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        loadTeam();
      } else {
        alert("Erro ao salvar");
      }
    } catch (e) {
      alert("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remover este membro da equipe?")) return;
    try {
      const response = await fetch(`/api/admin/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (response.ok) loadTeam();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <DetailSkeleton />;
  if (!team) return <div className="p-8 text-center">Equipe não encontrada</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <a href="#/admin/equipes" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Equipes
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 shadow-sm overflow-hidden mb-8">
        <div className="p-8 border-b border-[#DDD8CF]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-xl text-gray-500 font-bold uppercase">
                {team.name.substring(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#202322]">{team.name}</h1>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${team.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {team.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <p className="text-[#626866] mt-1">{team.description}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex border-b border-[#DDD8CF]/40 overflow-x-auto">
          {["Visão Geral", "Membros", "Configurações"].map(tab => {
            const tabId = tab.replace(/[^a-zA-Z]/g, '');
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
          {activeTab === 'VisoGeral' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-[#DDD8CF]/40">
                <div className="text-sm font-medium text-gray-500 mb-2">Membros</div>
                <div className="text-3xl font-black text-[#202322]">{members.length}</div>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl border border-[#DDD8CF]/40">
                <div className="text-sm font-medium text-gray-500 mb-2">Self Claim</div>
                <div className="text-xl font-bold text-[#202322]">{team.allow_self_claim ? 'Ativado' : 'Desativado'}</div>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl border border-[#DDD8CF]/40">
                <div className="text-sm font-medium text-gray-500 mb-2">Canal</div>
                <div className="text-xl font-bold text-[#202322] capitalize">{team.channel}</div>
              </div>
            </div>
          )}

          {activeTab === 'Membros' && (
            <div>
              <div className="flex justify-end mb-6">
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#121413] text-white rounded-xl font-medium hover:bg-[#202322] transition-colors shadow-sm text-sm">
                  <Plus className="w-4 h-4" />
                  Adicionar Membro
                </button>
              </div>
              
              {members.length === 0 ? (
                <div className="text-center p-8 text-gray-500 border border-dashed border-[#DDD8CF] rounded-2xl">
                  Nenhum membro nesta equipe.
                </div>
              ) : (
                <div className="border border-[#DDD8CF]/40 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#DDD8CF]/40 bg-[#F6F5F2]/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="p-4 pl-6">Nome / Email</th>
                        <th className="p-4">Função na Equipe</th>
                        <th className="p-4">Cargo Global</th>
                        <th className="p-4">Vínculo</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDD8CF]/40">
                      {members.map(m => (
                        <tr key={m.platform_member_id} className="hover:bg-gray-50/50">
                          <td className="p-4 pl-6">
                            <div className="font-bold text-[#202322]">{m.user?.name || 'Sem nome'}</div>
                            <div className="text-xs text-[#626866]">{m.user?.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                              m.team_role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {m.team_role}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-gray-700">
                              {m.role?.name || 'Membro'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-gray-600 capitalize">{m.relationship_type}</span>
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <button 
                              onClick={() => handleRemoveMember(m.platform_member_id)}
                              className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Configuraes' && (
            <form onSubmit={handleSaveConfig} className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#202322] mb-1">Nome da Equipe</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                  disabled={platformRole?.key !== 'admin'}
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#202322] mb-1">Descrição</label>
                <textarea 
                  className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45] resize-none h-20"
                  value={formData.description || ''}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#202322] mb-1">Tipo</label>
                  <select 
                    className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                    disabled={platformRole?.key !== 'admin'}
                    value={formData.team_type || ''}
                    onChange={e => setFormData({...formData, team_type: e.target.value})}
                  >
                    <option value="sales">Vendas</option>
                    <option value="customer_success">Customer Success</option>
                    <option value="implementation">Implementação</option>
                    <option value="support">Suporte</option>
                    <option value="marketing">Marketing</option>
                    <option value="operations">Operações</option>
                    <option value="engineering">Engenharia</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#202322] mb-1">Canal</label>
                  <select 
                    className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                    disabled={platformRole?.key !== 'admin'}
                    value={formData.channel || ''}
                    onChange={e => setFormData({...formData, channel: e.target.value})}
                  >
                    <option value="internal">Interno</option>
                    <option value="external">Externo (Representantes)</option>
                    <option value="mixed">Misto</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-6 border-t border-[#DDD8CF]/40">
                <h3 className="font-bold text-[#202322] mb-4">Visibilidade & Permissões</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#202322] mb-1">Leads</label>
                    <select 
                      className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                      value={formData.member_lead_visibility || 'own'}
                      onChange={e => setFormData({...formData, member_lead_visibility: e.target.value})}
                    >
                      <option value="own">Somente os próprios leads</option>
                      <option value="team">Leads da equipe</option>
                      <option value="all">Todos os leads (Não recomendado)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#202322] mb-1">Clientes</label>
                    <select 
                      className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                      value={formData.member_client_visibility || 'own'}
                      onChange={e => setFormData({...formData, member_client_visibility: e.target.value})}
                    >
                      <option value="own">Somente os próprios clientes</option>
                      <option value="team">Clientes da equipe</option>
                      <option value="all">Todos os clientes (Não recomendado)</option>
                    </select>
                  </div>
                  
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-[#B66E45] border-gray-300 rounded focus:ring-[#B66E45]"
                      checked={formData.allow_self_claim || false}
                      onChange={e => setFormData({...formData, allow_self_claim: e.target.checked})}
                    />
                    <div>
                      <div className="font-medium text-[#202322]">Permitir "Self Claim"</div>
                      <div className="text-xs text-[#626866]">Membros podem assumir voluntariamente leads não atribuídos que chegam para esta equipe.</div>
                    </div>
                  </label>
                  <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium text-[#202322]">Alçada de proposta (centavos)<input disabled={platformRole?.key!=='admin'} type="number" min="0" value={formData.settings?.proposal_approval_limit_cents??''} onChange={e=>setFormData({...formData,settings:{...(formData.settings||{}),proposal_approval_limit_cents:e.target.value===''?null:Number(e.target.value)}})} className="mt-1 w-full px-4 py-2 border rounded-xl disabled:bg-gray-100"/><span className="block text-xs text-gray-500 mt-1">Vazio exige aprovação de admin.</span></label><label className="text-sm font-medium text-[#202322]">Alçada de contrato (centavos)<input disabled={platformRole?.key!=='admin'} type="number" min="0" value={formData.settings?.contract_approval_limit_cents??''} onChange={e=>setFormData({...formData,settings:{...(formData.settings||{}),contract_approval_limit_cents:e.target.value===''?null:Number(e.target.value)}})} className="mt-1 w-full px-4 py-2 border rounded-xl disabled:bg-gray-100"/><span className="block text-xs text-gray-500 mt-1">Vazio exige aprovação de admin.</span></label></div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-[#DDD8CF]/40 flex justify-end">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#B66E45] rounded-xl hover:bg-[#a05e38] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
      <AddTeamMemberModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); loadTeam(); }} teamId={teamId} />
    </div>
  );
}
