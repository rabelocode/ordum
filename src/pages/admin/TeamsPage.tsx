import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Plus, ChevronRight } from 'lucide-react';
import { PlatformTeam } from '../../types/platform';
import { CreateTeamModal } from '../../components/admin/CreateTeamModal';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';

export function TeamsPage() {
  const { session } = useAuth();
  const [teams, setTeams] = useState<PlatformTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  async function loadTeams() {
    if (!session) return;
    try {
      const response = await fetch('/api/admin/teams', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (e) {
      console.error("Error loading teams:", e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeams();
  }, [session]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202322] tracking-tight">Equipes</h1>
          <p className="text-[#626866] mt-1">Gerencie as equipes de operação e vendas.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#121413] text-white rounded-xl font-medium hover:bg-[#202322] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Equipe</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#DDD8CF]/40 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : teams.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhuma equipe encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDD8CF]/40 bg-[#F6F5F2]/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Nome</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Canal</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/40">
                {teams.map(team => (
                  <tr key={team.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => window.location.hash = `#/admin/equipes/${team.id}`}>
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-bold uppercase">
                          {team.name.substring(0,2)}
                        </div>
                        <div>
                          <div className="font-bold text-[#202322]">{team.name}</div>
                          <div className="text-xs text-[#626866]">{team.description || "Sem descrição"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase tracking-wider">
                        {team.team_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-600 capitalize">{team.channel}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${team.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {team.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateTeamModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadTeams();
        }}
      />
    </div>
  );
}
