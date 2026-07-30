const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminDashboard.tsx', 'utf8');

const newCode = `import React, { useState, useEffect } from 'react';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';
import { useAuth } from '../../core/auth/AuthProvider';
import { Users, Building, Activity, ShieldCheck, Box, UserPlus, FileText } from 'lucide-react';

export function AdminDashboard() {
  const { platformRole, memberTeams, managedTeams } = usePlatform();
  const { session } = useAuth();
  const [stats, setStats] = useState({ clients: '-', leads: '-', demos: '-', teams: '-' });

  useEffect(() => {
    async function loadStats() {
      if (!session) return;
      try {
        const response = await fetch('/api/admin/stats', {
          headers: { 'Authorization': \`Bearer \${session.access_token}\` }
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadStats();
  }, [session]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#202322] tracking-tight">
          Olá, {platformRole?.name || 'Administrador'}
        </h1>
        <p className="text-[#626866] mt-2">
          {platformRole?.key === 'admin' 
            ? 'Bem-vindo ao painel de controle global da plataforma ORDUM.'
            : 'Bem-vindo ao seu painel de controle da ORDUM.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Building className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Clientes</div>
          <div className="text-3xl font-black text-[#202322]">{stats.clients}</div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Leads Ativos</div>
          <div className="text-3xl font-black text-[#202322]">{stats.leads}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Demonstrações</div>
          <div className="text-3xl font-black text-[#202322]">{stats.demos}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <Box className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Equipes Ativas</div>
          <div className="text-3xl font-black text-[#202322]">
            {platformRole?.key === 'admin' ? stats.teams : managedTeams.length + memberTeams.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#202322] mb-6">Atividade Recente</h2>
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhuma atividade registrada hoje.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-[#202322] mb-6">Minhas Equipes</h2>
          {memberTeams.length === 0 && managedTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p>Você não faz parte de nenhuma equipe.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...managedTeams, ...memberTeams].filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i).map(team => (
                <div key={team.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-bold text-gray-500 border border-gray-200 uppercase">
                      {team.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-[#202322]">{team.name}</div>
                      <div className="text-xs text-gray-500 uppercase">{team.team_type}</div>
                    </div>
                  </div>
                  <a href={\`#/admin/equipes/\${team.id}\`} className="text-sm font-medium text-[#B66E45] hover:underline">
                    Ver detalhes
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/admin/AdminDashboard.tsx', newCode);
