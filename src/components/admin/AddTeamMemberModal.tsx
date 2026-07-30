import React, { useState, useEffect } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

export function AddTeamMemberModal({ isOpen, onClose, onSuccess, teamId }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, teamId: string }) {
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    platform_member_id: "",
    team_role: "member"
  });

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/staff', { headers: { 'Authorization': `Bearer ${session?.access_token}` } })
        .then(res => res.json())
        .then(data => setStaff(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    }
  }, [isOpen, session]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/teams/${teamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao adicionar membro");
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#DDD8CF]/40">
          <h2 className="text-xl font-bold text-[#202322]">Adicionar Membro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          <form id="add-member-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#202322] mb-1">Selecione o Membro</label>
              <select 
                required
                className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                value={formData.platform_member_id}
                onChange={e => setFormData({...formData, platform_member_id: e.target.value})}
              >
                <option value="">Selecione...</option>
                {staff.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.user?.name || m.user?.email || 'Usuário'} - {m.role?.name} ({m.relationship_type})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#202322] mb-1">Função na Equipe</label>
              <select 
                className="w-full px-4 py-2 bg-white border border-[#DDD8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66E45]/20 focus:border-[#B66E45]"
                value={formData.team_role}
                onChange={e => setFormData({...formData, team_role: e.target.value})}
              >
                <option value="member">Membro (Sales/Rep)</option>
                <option value="manager">Gerente da Equipe</option>
              </select>
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
            form="add-member-form"
            disabled={isSubmitting || !formData.platform_member_id}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#121413] rounded-xl hover:bg-[#202322] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
