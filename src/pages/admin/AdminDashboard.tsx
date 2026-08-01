import React, { useState, useEffect } from 'react';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';
import { useAuth } from '../../core/auth/AuthProvider';
import { Users, Building, Activity, Box, FileText, WalletCards, AlertTriangle } from 'lucide-react';

export function AdminDashboard() {
  const { platformRole, memberTeams, managedTeams } = usePlatform();
  const { session } = useAuth();
  const [stats, setStats] = useState<any>({ clients: '-', leads: '-', demos: '-', teams: '-', proposals: '-', contracts: '-', conversionRate: 0, onboarding: 0, overdue: 0, mrrCents: 0, alerts: [], leadsByStatus: {}, recentActivity: [] });

  useEffect(() => {
    async function loadStats() {
      if (!session) return;
      try {
        const response = await fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
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
        {[['Propostas',stats.proposals,FileText],['Contratos',stats.contracts,FileText],['Conversão',`${stats.conversionRate}%`,Activity],['MRR confirmado',new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((stats.mrrCents||0)/100),WalletCards]].map(([label,value,Icon]:any)=><div key={label} className="bg-white p-5 rounded-2xl border"><Icon className="w-5 h-5 text-[#B66E45]"/><div className="text-xs text-gray-500 uppercase font-bold mt-3">{label}</div><div className="text-2xl font-black mt-1">{value}</div></div>)}
      </div>

      {(stats.alerts?.length>0||stats.onboarding>0)&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2"><AlertTriangle className="w-5 h-5 text-amber-700"/><div><strong>Alertas operacionais</strong><p className="text-sm mt-1">{stats.onboarding} clientes em implantação{stats.alerts.map((alert:any)=>` · ${alert.count} ${alert.label.toLowerCase()}`).join('')}</p></div></div></div>}

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
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Novos Leads</div>
          <div className="text-3xl font-black text-[#202322]">{stats.leads}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Leads Aprovados</div>
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
          {stats.recentActivity?.length===0?<div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhuma atividade registrada hoje.</p>
          </div>:<div className="space-y-3">{stats.recentActivity.map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3"><strong className="text-sm">{item.subject}</strong><div className="text-xs text-gray-500">{item.activity_type} · {item.status} · {new Date(item.created_at).toLocaleString('pt-BR')}</div></div>)}</div>}
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
                  <a href={`#/admin/equipes/${team.id}`} className="text-sm font-medium text-[#B66E45] hover:underline">
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
