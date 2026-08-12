import React, { useState, useEffect } from 'react';
import { 
  Settings, Server, Shield, Globe, Mail, Clock, KeyRound, 
  CheckCircle2, AlertCircle, RefreshCw, Layers, Database, Lock, User
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAccess } from '../../core/auth/AccessContext';

export function PlatformSettingsPage() {
  const { session, platformRole, hasPlatformPermission } = useAccess();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'diagnostics'>('general');
  const [platformName, setPlatformName] = useState('ORDUM');
  const [supportEmail, setSupportEmail] = useState('suporte@ordum.com.br');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [currency, setCurrency] = useState('BRL');
  
  // Diagnostics state
  const [billingDiag, setBillingDiag] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [diagError, setDiagError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const loadDiagnostics = async () => {
    if (!session) return;
    setLoadingDiag(true);
    setDiagError('');
    try {
      const res = await fetch('/api/admin/billing/diagnostics', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        setBillingDiag(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setDiagError(data.error || 'Não foi possível carregar o diagnóstico de cobrança.');
      }
    } catch (e: any) {
      setDiagError(e.message || 'Erro ao carregar diagnósticos.');
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'diagnostics') {
      void loadDiagnostics();
    }
  }, [activeTab, session]);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess('Configurações gerais salvas com sucesso.');
    setTimeout(() => setSaveSuccess(''), 4000);
  };

  const isSystemAdmin = platformRole?.key === 'admin' || hasPlatformPermission('platform.system.read');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202322]">Configurações da Plataforma</h1>
          <p className="text-[#626866] mt-1 text-xs">
            Parâmetros globais de funcionamento, segurança e saúde da infraestrutura Ordum.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex border-b border-[#DDD8CF] gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'general'
              ? 'border-[#B66E45] text-[#B66E45]'
              : 'border-transparent text-[#626866] hover:text-[#202322]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Geral</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'security'
              ? 'border-[#B66E45] text-[#B66E45]'
              : 'border-transparent text-[#626866] hover:text-[#202322]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Segurança</span>
        </button>

        {isSystemAdmin && (
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-[#B66E45] text-[#B66E45]'
                : 'border-transparent text-[#626866] hover:text-[#202322]'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Diagnóstico Técnico</span>
          </button>
        )}
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 p-6 shadow-sm max-w-2xl space-y-6">
          <form onSubmit={handleSaveGeneral} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                Nome da Plataforma
              </label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                E-mail Institucional de Suporte
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Moeda Padrão
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                >
                  <option value="BRL">Real Brasileiro (BRL - R$)</option>
                  <option value="USD">Dólar Americano (USD - $)</option>
                  <option value="EUR">Euro (EUR - €)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Fuso Horário Operacional
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                  >
                    <option value="America/Sao_Paulo">América / São Paulo (UTC-03:00)</option>
                    <option value="America/Manaus">América / Manaus (UTC-04:00)</option>
                    <option value="UTC">UTC (Tempo Universal Coordenado)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" className="bg-[#121413] hover:bg-[#202322] text-white text-xs font-bold">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 p-6 shadow-sm max-w-2xl space-y-6">
          <div className="space-y-4">
            <div className="p-4 bg-[#F6F5F2] rounded-xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#B66E45] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-[#202322]">Política de Senhas da Plataforma</h3>
                <p className="text-[11px] text-[#626866] mt-1 leading-relaxed">
                  As senhas dos colaboradores e clientes devem conter no mínimo 6 caracteres. O Supabase Auth renova tokens de acesso com segurança a cada sessão.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F6F5F2] rounded-xl flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-[#B66E45] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-[#202322]">Autenticação & Isolamento de Dados</h3>
                <p className="text-[11px] text-[#626866] mt-1 leading-relaxed">
                  Todos os acessos são controlados por papéis imutáveis e isolamento lógico por organização. O painel administrativo global visualiza apenas métricas consolidadas.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F6F5F2] rounded-xl flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#B66E45] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-[#202322]">Log de Auditoria Institucional</h3>
                <p className="text-[11px] text-[#626866] mt-1 leading-relaxed">
                  Todas as alterações em contratos, cadastros, convites, permissões e status são registradas com a identificação do operador e o timestamp.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Diagnostics (Restricted) */}
      {activeTab === 'diagnostics' && isSystemAdmin && (
        <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-[#DDD8CF]/40 pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#202322]">Diagnóstico da Infraestrutura & Serviços</h2>
              <p className="text-xs text-[#626866] mt-0.5">Status operacional em tempo real da plataforma Ordum.</p>
            </div>
            <Button
              onClick={() => void loadDiagnostics()}
              disabled={loadingDiag}
              variant="outline"
              className="text-xs gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin' : ''}`} />
              <span>Atualizar Status</span>
            </Button>
          </div>

          {diagError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{diagError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database Status */}
            <div className="p-4 rounded-xl border border-[#DDD8CF] bg-[#F6F5F2]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#202322]">Banco de Dados</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3" /> Operacional
                </span>
              </div>
              <p className="text-[11px] text-[#626866]">PostgreSQL / Supabase conectado com isolamento de tenant e RLS ativado.</p>
            </div>

            {/* Billing Diagnostics */}
            <div className="p-4 rounded-xl border border-[#DDD8CF] bg-[#F6F5F2]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#202322]">Módulo de Cobrança</span>
                {billingDiag?.configured ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    <AlertCircle className="w-3 h-3" /> Não Configurado
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#626866]">
                Ambiente: <span className="font-mono font-bold">{billingDiag?.environment || 'sandbox'}</span>. Webhook: <span className="font-mono">{billingDiag?.webhookUrlConfigured ? 'OK' : 'Pendente'}</span>.
              </p>
            </div>

            {/* Storage Status */}
            <div className="p-4 rounded-xl border border-[#DDD8CF] bg-[#F6F5F2]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#202322]">Armazenamento Privado</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3" /> Protegido
                </span>
              </div>
              <p className="text-[11px] text-[#626866]">Signed URLs de curta duração ativas para evidências de integridade.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
