import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileSignature, Plus, RefreshCw, Search, WalletCards, X, Loader2, Edit, AlertTriangle } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';
import { CONTRACT_STATUS_LABELS } from '../../domain/transitions';
import { isValidTaxId, maskTaxId } from '../../domain/cpf-cnpj';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ContractsPage() {
  const { session, hasPlatformPermission } = useAccess();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isActioning, setIsActioning] = useState(false);
  const [sandboxMockAvailable, setSandboxMockAvailable] = useState(false);

  // Approval Modal State
  const [approveModalContractId, setApproveModalContractId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState('');

  // Start Billing Modal State
  const [startBillingContractId, setStartBillingContractId] = useState<string | null>(null);
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().slice(0, 10));

  // Fiscal Edit Modal State
  const [fiscalModalContract, setFiscalModalContract] = useState<any | null>(null);
  const [fiscalForm, setFiscalForm] = useState({
    customer_tax_id: '',
    customer_phone: '',
    customer_name: '',
    customer_email: '',
  });

  const api = useCallback(async (path: string, init?: RequestInit) => {
    if (!session) throw new Error('Sessão ausente.');
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init?.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Erro ${response.status}`);
    return body;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const contractData = await api('/api/admin/commercial/contracts');
      setContracts(contractData);

      // Requisito 5: Carregar capability de diagnostics separadamente
      if (hasPlatformPermission('platform.billing.manage')) {
        const diag = await api('/api/admin/billing/diagnostics').catch(() => null);
        if (diag) setSandboxMockAvailable(Boolean(diag.sandboxMockAvailable));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar contratos.');
    } finally {
      setLoading(false);
    }
  }, [api, session, hasPlatformPermission]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => contracts.filter((contract) => {
    const text = `${contract.customer_name} ${contract.customer_email} ${contract.contract_number}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (statusFilter === 'all' || contract.status === statusFilter);
  }), [contracts, query, statusFilter]);

  async function handleApproveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!approveModalContractId || !approvalReason.trim()) return;
    setError(null);
    setNotice(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/commercial/contracts/${approveModalContractId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reason: approvalReason.trim() }),
      });
      setNotice('Contrato aprovado com sucesso.');
      setApproveModalContractId(null);
      setApprovalReason('');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Falha ao aprovar contrato.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleStartBillingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startBillingContractId || !nextDueDate) return;
    setError(null);
    setNotice(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/commercial/contracts/${startBillingContractId}/start-billing`, {
        method: 'POST',
        body: JSON.stringify({ next_due_date: nextDueDate }),
      });
      setNotice('Assinatura Sandbox criada. Acesso aguarda webhook financeiro.');
      setStartBillingContractId(null);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Falha ao iniciar cobrança.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleFiscalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fiscalModalContract) return;
    setError(null);
    setNotice(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/commercial/contracts/${fiscalModalContract.id}/fiscal`, {
        method: 'PATCH',
        body: JSON.stringify(fiscalForm),
      });
      setNotice('Dados fiscais do contrato atualizados com sucesso.');
      setFiscalModalContract(null);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Falha ao atualizar dados fiscais.');
    } finally {
      setIsActioning(false);
    }
  }

  async function mockSandboxPayment(id: string) {
    setError(null);
    setNotice(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/commercial/contracts/${id}/mock-sandbox-payment`, { method: 'POST' });
      setNotice('Pagamento Confirmado no Sandbox. Provisionamento inicializado.');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Falha no mock Sandbox.');
    } finally {
      setIsActioning(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#202322]">Contratos</h1>
          <p className="text-sm text-[#626866] mt-1">Aprovação comercial, cobrança e liberação auditável.</p>
        </div>
        {hasPlatformPermission('platform.commercial.manage') && (
          <a href="#/admin/propostas" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#A05C38] transition-colors">
            <Plus className="w-4 h-4" /> Nova proposta
          </a>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">{notice}</div>}

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/70 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#DDD8CF]/60 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <span className="sr-only">Buscar</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empresa, e-mail ou número"
              className="w-full rounded-xl border border-[#DDD8CF] pl-9 pr-3 py-2 text-sm"
            />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-[#DDD8CF] px-3 py-2 text-sm">
            <option value="all">Todos os status</option>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button onClick={load} aria-label="Atualizar" disabled={isActioning} className="rounded-xl border border-[#DDD8CF] p-2 text-gray-600 hover:bg-gray-50">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileSignature className="w-10 h-10 mx-auto text-[#B66E45] mb-3" />
            <p className="font-semibold text-[#202322]">Nenhum contrato encontrado</p>
            <p className="text-sm text-gray-500 mt-1">Contratos são gerados a partir de propostas aceitas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F6F5F2] text-left text-xs uppercase tracking-wide text-[#626866]">
                <tr>
                  <th className="px-5 py-3">Contrato / Cliente</th>
                  <th className="px-5 py-3">Dados Fiscais</th>
                  <th className="px-5 py-3">Plano / Valor</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/50">
                {filtered.map((contract) => {
                  const hasValidTaxId = Boolean(contract.customer_tax_id && isValidTaxId(contract.customer_tax_id));
                  const canEditFiscal = (contract.status === 'pending_approval' || contract.status === 'approved') &&
                    !contract.billing_subscriptions?.length;

                  return (
                    <tr key={contract.id}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#202322]">#{contract.contract_number} · {contract.customer_name}</div>
                        <div className="text-xs text-gray-500">{contract.customer_email}</div>
                      </td>
                      <td className="px-5 py-4">
                        {hasValidTaxId ? (
                          <div className="text-xs font-mono text-gray-700">{maskTaxId(contract.customer_tax_id)}</div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> CPF/CNPJ Ausente
                          </div>
                        )}
                        {canEditFiscal && hasPlatformPermission('platform.commercial.manage') && (
                          <button
                            onClick={() => {
                              setFiscalModalContract(contract);
                              setFiscalForm({
                                customer_tax_id: contract.customer_tax_id || '',
                                customer_phone: contract.customer_phone || '',
                                customer_name: contract.customer_name || '',
                                customer_email: contract.customer_email || '',
                              });
                            }}
                            className="mt-1 text-xs text-[#B66E45] hover:underline flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" /> Editar fiscal
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#202322]">{money.format(contract.amount_cents / 100)}</div>
                        <div className="text-xs text-gray-500">{contract.billing_plans?.name || 'Personalizado'} ({contract.cycle})</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#F1E5DD] px-2.5 py-1 text-xs font-semibold text-[#8B4E2F]">
                          {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                        </span>
                        {contract.tenant_billing_state?.access_status && (
                          <div className="text-xs text-gray-500 mt-1">Acesso: {contract.tenant_billing_state.access_status}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end flex-wrap gap-2">
                          {contract.status === 'pending_approval' && hasPlatformPermission('platform.commercial.approve') && (
                            <button
                              disabled={isActioning || !hasValidTaxId}
                              title={!hasValidTaxId ? "Preencha o CPF/CNPJ antes de aprovar" : ""}
                              onClick={() => { setApproveModalContractId(contract.id); setApprovalReason(''); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                            </button>
                          )}
                          {contract.status === 'approved' && hasPlatformPermission('platform.billing.manage') && (
                            <button
                              disabled={isActioning || !hasValidTaxId}
                              title={!hasValidTaxId ? "Preencha o CPF/CNPJ antes de iniciar cobrança" : ""}
                              onClick={() => setStartBillingContractId(contract.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#202322] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
                            >
                              <WalletCards className="w-3.5 h-3.5" /> Iniciar Sandbox
                            </button>
                          )}
                          {/* Requisito 5: Requer sandboxMockAvailable e permissão platform.billing.webhooks.manage */}
                          {contract.status === 'pending_payment' && sandboxMockAvailable && hasPlatformPermission('platform.billing.webhooks.manage') && (
                            <button
                              disabled={isActioning}
                              onClick={() => mockSandboxPayment(contract.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-100 text-orange-800 px-3 py-1.5 text-xs font-semibold hover:bg-orange-200 disabled:opacity-50"
                            >
                              Simular pagamento Sandbox
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Editar Dados Fiscais */}
      {fiscalModalContract && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleFiscalSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Dados Fiscais do Contrato</h3>
              <button type="button" onClick={() => setFiscalModalContract(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              CPF / CNPJ *
              <input
                required
                value={fiscalForm.customer_tax_id}
                onChange={e => setFiscalForm({ ...fiscalForm, customer_tax_id: e.target.value })}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm font-mono"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Nome / Razão Social
              <input
                value={fiscalForm.customer_name}
                onChange={e => setFiscalForm({ ...fiscalForm, customer_name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              E-mail Financeiro
              <input
                type="email"
                value={fiscalForm.customer_email}
                onChange={e => setFiscalForm({ ...fiscalForm, customer_email: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Telefone Comercial (com DDD)
              <input
                value={fiscalForm.customer_phone}
                onChange={e => setFiscalForm({ ...fiscalForm, customer_phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setFiscalModalContract(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !isValidTaxId(fiscalForm.customer_tax_id)} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Dados Fiscais'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Aprovação de Contrato */}
      {approveModalContractId && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleApproveSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Aprovar Contrato</h3>
              <button type="button" onClick={() => setApproveModalContractId(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Justificativa / Motivo da Aprovação *
              <textarea
                required
                rows={3}
                value={approvalReason}
                onChange={e => setApprovalReason(e.target.value)}
                placeholder="Informe a justificativa da aprovação do contrato..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setApproveModalContractId(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !approvalReason.trim()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Aprovação'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Iniciar Sandbox Billing */}
      {startBillingContractId && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleStartBillingSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Iniciar Billing Sandbox</h3>
              <button type="button" onClick={() => setStartBillingContractId(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">
              Esta ação criará a assinatura no Asaas Sandbox. O acesso só é liberado após confirmação do webhook de pagamento.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Data do Primeiro Vencimento (AAAA-MM-DD) *
              <input
                required
                type="date"
                value={nextDueDate}
                onChange={e => setNextDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setStartBillingContractId(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !nextDueDate} className="rounded-xl bg-[#202322] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iniciar Sandbox'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
