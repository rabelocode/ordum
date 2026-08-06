import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Save, Ban, PlayCircle, X } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { AssignLeadModal } from '../../components/admin/AssignLeadModal';
import { DetailSkeleton } from '../../components/ui/LoadingSkeletons';

const TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'entitlements', label: 'Entitlements' },
  { id: 'solutions', label: 'Soluções' },
  { id: 'owners', label: 'Responsáveis' },
  { id: 'domains', label: 'Domínios' },
  { id: 'units', label: 'Unidades' },
  { id: 'users', label: 'Usuários' },
  { id: 'financial', label: 'Financeiro' },
  { id: 'audit', label: 'Auditoria' },
];

export function CompanyDetailPage({ tenantId }: { tenantId: string }) {
  const { session, hasPlatformPermission } = useAccess();
  const [tenant, setTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isActioning, setIsActioning] = useState(false);
  const [solutionKeys, setSolutionKeys] = useState<string[]>([]);
  const [entitlements, setEntitlements] = useState<any>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status Action Modal State
  const [statusModalAction, setStatusModalAction] = useState<'suspend' | 'reactivate' | null>(null);
  const [statusReason, setStatusReason] = useState('');

  async function loadTenant() {
    if (!session) return;
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTenant(data);
        if (data.tenant_solutions) {
          setSolutionKeys(data.tenant_solutions.map((s: any) => s.solutions?.key).filter(Boolean));
        }
        const entitlementResponse = await fetch(`/api/admin/control-plane/tenants/${tenantId}/entitlements`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (entitlementResponse.ok) setEntitlements(await entitlementResponse.json());
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Falha ao carregar dados do cliente.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar informações.');
    }
  }

  useEffect(() => {
    loadTenant();
  }, [session, tenantId]);

  const handleSaveSolutions = async () => {
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}/solutions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ solutionKeys })
      });
      if (response.ok) {
        setSuccess('Soluções atualizadas com sucesso!');
        await loadTenant();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Erro ao atualizar soluções.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na requisição.');
    } finally {
      setIsActioning(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalAction || !statusReason.trim()) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      const resp = await fetch(`/api/admin/clients/${tenantId}/${statusModalAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ reason: statusReason.trim() })
      });
      const resData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(resData.error || 'Erro ao processar alteração de status.');
      } else {
        setSuccess(`Cliente ${statusModalAction === 'suspend' ? 'suspenso' : 'reativado'} com sucesso!`);
        setStatusModalAction(null);
        setStatusReason('');
        await loadTenant();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na requisição.');
    } finally {
      setIsActioning(false);
    }
  };

  const toggleSolution = (key: string) => {
    if (solutionKeys.includes(key)) {
      setSolutionKeys(solutionKeys.filter(k => k !== key));
    } else {
      setSolutionKeys([...solutionKeys, key]);
    }
  };

  if (!tenant) return <DetailSkeleton />;
  const contracts = Array.isArray(tenant.commercial_contracts) ? tenant.commercial_contracts : tenant.commercial_contracts ? [tenant.commercial_contracts] : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <a href="#/admin/empresas" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </a>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 font-medium">{success}</div>}

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-[#DDD8CF]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

            <div className="flex flex-wrap gap-2">
              {tenant.status === 'active' && hasPlatformPermission('platform.clients.manage') && (
                <button
                  disabled={isActioning}
                  onClick={() => { setStatusModalAction('suspend'); setStatusReason(''); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  <Ban className="w-4 h-4" /> Suspender
                </button>
              )}
              {tenant.status === 'suspended' && hasPlatformPermission('platform.clients.manage') && (
                <button
                  disabled={isActioning}
                  onClick={() => { setStatusModalAction('reactivate'); setStatusReason(''); }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-xl hover:bg-emerald-200 disabled:opacity-50 transition-colors"
                >
                  <PlayCircle className="w-4 h-4" /> Reativar
                </button>
              )}
              <button
                disabled={isActioning}
                onClick={() => setIsAssignModalOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Transferir
              </button>
              <a
                href={`#/admin/operacoes?tenant=${tenant.id}`}
                className="px-4 py-2 bg-[#B66E45] text-white text-sm font-bold rounded-xl hover:bg-[#A05C38] transition-colors"
              >
                Abrir Onboarding
              </a>
            </div>
          </div>
        </div>

        <div className="flex border-b border-[#DDD8CF]/40 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id ? 'border-[#B66E45] text-[#202322]' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-[#DDD8CF]/40">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-bold text-gray-900 capitalize">{tenant.status}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-[#DDD8CF]/40">
                  <div className="text-sm text-gray-500">Lifecycle</div>
                  <div className="font-bold text-gray-900 capitalize">{tenant.lifecycle_status?.replaceAll('_', ' ') || 'não definido'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-[#DDD8CF]/40">
                  <div className="text-sm text-gray-500">Risco</div>
                  <div className="font-bold text-gray-900 capitalize">{tenant.risk_level || 'não avaliado'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-[#DDD8CF]/40">
                  <div className="text-sm text-gray-500">Criado em</div>
                  <div className="font-bold text-gray-900">{new Date(tenant.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'entitlements' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">Entitlement efetivo</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Resultado calculado no servidor a partir de contrato, versão do plano, assinatura, ativações e overrides temporários.
                </p>
              </div>
              {!entitlements ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">Nenhum entitlement calculável para este cliente.</div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">Tenant</div>
                      <strong>{entitlements.tenant_status || '—'}</strong>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">Contrato</div>
                      <strong>{entitlements.contract?.status || 'sem contrato'}</strong>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">Assinatura</div>
                      <strong>{entitlements.subscription?.status || 'sem assinatura'}</strong>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {entitlements.solutions?.length ? (
                      entitlements.solutions.map((item: any) => (
                        <div key={item.id} className="flex flex-col gap-2 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <strong>{item.name}</strong>
                            <div className="text-xs text-gray-500">{item.decision_reason}</div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                            {item.enabled ? 'Habilitado' : 'Bloqueado'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">Nenhuma solução contratada ou ativada.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'solutions' && (
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
                      disabled={!hasPlatformPermission('platform.solutions.manage') || isActioning}
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

              {hasPlatformPermission('platform.solutions.manage') && (
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSolutions}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#B66E45] rounded-xl hover:bg-[#a05e38] disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Atualizar Soluções
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'owners' && (
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

          {activeTab === 'domains' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Domínios</h2>
              {tenant.tenant_domains?.length ? (
                tenant.tenant_domains.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.hostname}</strong>
                    <div className="text-xs text-gray-500">{item.is_primary ? 'Principal' : 'Alternativo'} · {item.verified_at ? 'verificado' : 'pendente'}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Nenhum domínio cadastrado.</p>
              )}
            </div>
          )}

          {activeTab === 'units' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Unidades organizacionais</h2>
              <p className="text-xs text-gray-500">Representadas pela estrutura de departamentos do tenant.</p>
              {tenant.departments?.length ? (
                tenant.departments.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.name}</strong>
                    <div className="text-xs text-gray-500">{item.active ? 'Ativa' : 'Inativa'}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Nenhuma unidade cadastrada.</p>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Usuários e memberships</h2>
              {tenant.memberships?.length ? (
                tenant.memberships.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.employment_level}</strong>
                    <div className="text-xs text-gray-500">{item.status} · {item.user_id}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Nenhum usuário vinculado.</p>
              )}
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Contrato, assinatura e pagamentos</h2>
              <div className="rounded-xl bg-gray-50 border p-4">
                <div>Status de acesso: <strong>{tenant.tenant_billing_state?.access_status || 'sem cobrança'}</strong></div>
                <div className="text-sm text-gray-500">Pago até: {tenant.tenant_billing_state?.paid_through || '—'} · carência até: {tenant.tenant_billing_state?.grace_ends_at || '—'}</div>
              </div>
              {contracts.map((contract: any) => (
                <div key={contract.id} className="rounded-xl border p-4">
                  <strong>Contrato #{contract.contract_number} · {contract.status}</strong>
                  <div className="text-sm text-gray-500">
                    {Array.isArray(contract.billing_subscriptions) ? contract.billing_subscriptions.length : (contract.billing_subscriptions ? 1 : 0)} assinatura · {contract.billing_payments?.length || 0} pagamentos
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Auditoria do cliente</h2>
              {tenant.audit?.length ? (
                tenant.audit.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.action}</strong>
                    <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString('pt-BR')} · {item.severity}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Nenhum evento associado diretamente.</p>
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

      {/* Modal Suspender / Reativar Cliente */}
      {statusModalAction && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleStatusSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">
                {statusModalAction === 'suspend' ? 'Suspender Cliente' : 'Reativar Cliente'}
              </h3>
              <button type="button" onClick={() => setStatusModalAction(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">
              Cliente: <strong>{tenant.name}</strong> ({tenant.slug})
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Motivo da {statusModalAction === 'suspend' ? 'suspensão' : 'reativação'} *
              <textarea
                required
                rows={3}
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                placeholder="Informe o motivo da alteração de status do cliente (mínimo 5 caracteres)..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setStatusModalAction(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button
                disabled={isActioning || statusReason.trim().length < 5}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                  statusModalAction === 'suspend' ? 'bg-red-700' : 'bg-emerald-700'
                }`}
              >
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : statusModalAction === 'suspend' ? 'Confirmar Suspensão' : 'Confirmar Reativação'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
