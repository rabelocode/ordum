import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

export function CreateTeamModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    team_type: "sales",
    channel: "internal",
    member_lead_visibility: "own",
    member_client_visibility: "own",
    allow_self_claim: false
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao criar equipe");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#DDD8CF]/40">
          <h2 className="text-xl font-bold text-[#202322]">Nova Equipe</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          <form id="create-team-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#202322] mb-1">Nome da Equipe</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#202322] mb-1">Descrição</label>
              <textarea 
                className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45] resize-none h-20"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#202322] mb-1">Tipo</label>
                <select 
                  className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                  value={formData.team_type}
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
                  value={formData.channel}
                  onChange={e => setFormData({...formData, channel: e.target.value})}
                >
                  <option value="internal">Interno</option>
                  <option value="external">Externo (Representantes)</option>
                  <option value="mixed">Misto</option>
                </select>
              </div>
            </div>
            
            <div className="pt-4 border-t border-[#DDD8CF]/40">
              <h3 className="font-bold text-[#202322] mb-4">Visibilidade & Permissões</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#202322] mb-1">Leads</label>
                  <select 
                    className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                    value={formData.member_lead_visibility}
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
                    value={formData.member_client_visibility}
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
                    checked={formData.allow_self_claim}
                    onChange={e => setFormData({...formData, allow_self_claim: e.target.checked})}
                  />
                  <div>
                    <div className="font-medium text-[#202322]">Permitir "Self Claim"</div>
                    <div className="text-xs text-[#626866]">Membros podem assumir voluntariamente leads não atribuídos que chegam para esta equipe.</div>
                  </div>
                </label>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-[#DDD8CF]/40 bg-gray-50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="create-team-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#121413] rounded-xl hover:bg-[#202322] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Equipe
          </button>
        </div>
      </div>
    </div>
  );
}
