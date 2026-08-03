import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Server, Database, ShieldCheck, WalletCards } from 'lucide-react';
import { MetricGridSkeleton } from '../../components/ui/LoadingSkeletons';

export function SystemHealthPage() {
  const { session } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      if (!session) return;
      try {
        const response = await fetch('/api/admin/system/health', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setHealth(data);
        }
      } catch (e) {
        console.error("Error loading system health:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadHealth();
  }, [session]);

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202322] tracking-tight">Saúde do Sistema</h1>
          <p className="text-[#626866] mt-1">Status operacional da plataforma e conexões técnicas.</p>
        </div>
      </div>

      {isLoading ? (
        <MetricGridSkeleton count={4} />
      ) : !health ? (
        <div className="bg-white border border-[#DDD8CF]/40 rounded-2xl p-8 text-center text-red-500 shadow-sm">
          Falha ao carregar informações do sistema.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#202322]">Servidor (API)</h3>
                <div className={`text-sm font-medium ${health.status === 'operational' ? 'text-green-600' : 'text-red-600'}`}>
                  {health.status === 'operational' ? 'Operacional' : 'Com falhas'}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500 space-y-2 mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between">
                <span>Ambiente:</span>
                <span className="font-medium text-gray-900 capitalize">{health.environment}</span>
              </div>
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-medium text-gray-900">{formatUptime(health.uptime)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#202322]">Banco de Dados</h3>
                <div className={`text-sm font-medium ${health.database?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                  {health.database?.status === 'connected' ? 'Conectado (Supabase)' : 'Desconectado'}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500 space-y-2 mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between">
                <span>Latência:</span>
                <span className="font-medium text-gray-900">{health.database?.latencyMs ?? '—'} ms</span>
              </div>
              <div className="flex justify-between">
                <span>Fila financeira:</span>
                <span className="font-medium text-gray-900">{health.webhook?.queued ?? '—'} evento(s)</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#202322]">Autenticação</h3>
                <div className={`text-sm font-medium ${health.auth?.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                  {health.auth?.status === 'connected' ? 'Serviço ativo' : 'Fora do ar'}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-500 space-y-2 mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between">
                <span>Latência da consulta:</span>
                <span className="font-medium text-gray-900">{health.auth?.latencyMs ?? '—'} ms</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm"><h3 className="font-bold text-[#202322]">Deploy e conciliação</h3><div className="text-sm text-gray-500 space-y-2 mt-4 pt-4 border-t"><div className="flex justify-between gap-3"><span>Commit:</span><span className="font-mono text-gray-900">{health.deploy?.commitSha?.slice(0,8)||'local'}</span></div><div className="flex justify-between gap-3"><span>Região:</span><span className="text-gray-900">{health.deploy?.region||'local'}</span></div><div><span>Última conciliação:</span><p className="text-gray-900 mt-1">{health.reconciliation?`${health.reconciliation.status} · ${new Date(health.reconciliation.started_at).toLocaleString('pt-BR')}`:'não executada'}</p></div></div></div>

          <div className="bg-white p-6 rounded-2xl border border-[#DDD8CF]/40 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-50 text-[#B66E45] rounded-xl flex items-center justify-center"><WalletCards className="w-6 h-6" /></div>
              <div><h3 className="font-bold text-[#202322]">Asaas</h3><div className={`text-sm font-medium ${health.billing?.enabled ? 'text-green-600' : 'text-amber-700'}`}>{health.billing?.enabled ? 'Sandbox habilitado' : 'Desabilitado com segurança'}</div></div>
            </div>
            <div className="text-sm text-gray-500 space-y-2 mt-4 pt-4 border-t border-gray-100"><div className="flex justify-between"><span>Ambiente:</span><span className="font-medium text-gray-900">{health.billing?.environment || 'sandbox'}</span></div><div className="flex justify-between"><span>Segredos:</span><span className="font-medium text-gray-900">{health.billing?.configured ? 'Configurados' : 'Pendentes'}</span></div></div>
          </div>
        </div>
      )}
    </div>
  );
}
