import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Plus, X, Loader2, Check } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { PROPOSAL_STATUS_LABELS } from '../../domain/transitions';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalsPage() {
  const { session, hasPlatformPermission } = useAccess();
  const [items, setItems] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Proposal Form State
  const [form, setForm] = useState<{
    lead_id: string;
    plan_id: string;
    cycle: string;
    billing_type: string;
    valid_until: string;
    notes: string;
    discount_cents: number;
    solution_ids: string[];
  }>({
    lead_id: '',
    plan_id: '',
    cycle: 'monthly',
    billing_type: 'CREDIT_CARD',
    valid_until: '',
    notes: '',
    discount_cents: 0,
    solution_ids: [],
  });

  // Action Modals
  const [approveModalProposalId, setApproveModalProposalId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  const [acceptModalProposalId, setAcceptModalProposalId] = useState<string | null>(null);
  const [acceptReason, setAcceptReason] = useState('');

  const [createContractProposalId, setCreateContractProposalId] = useState<string | null>(null);
  const [customerTaxId, setCustomerTaxId] = useState('');

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...init?.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha na requisição.');
    return data;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [proposals, leadData, planData] = await Promise.all([
        request('/api/admin/commercial/proposals'),
        request('/api/admin/leads'),
        request('/api/admin/billing/plans'),
      ]);
      setItems(proposals);
      setLeads(leadData);
      setPlans(planData.filter((plan: any) => plan.active));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar propostas.');
    } finally {
      setLoading(false);
    }
  }, [request, session]);

  useEffect(() => {
    load();
    const hash = window.location.hash;
    const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);
    const lead = params.get('lead');
    if (lead) {
      setForm(prev => ({ ...prev, lead_id: lead }));
      setShowForm(true);
    }
  }, [load]);

  const selectedPlan = plans.find((p) => p.id === form.plan_id);

  // Filter available price options for selected plan
  const activePrices = selectedPlan?.billing_plan_prices?.filter((p: any) => p.active) || [];
  const availableCycles: string[] = Array.from(new Set(activePrices.map((p: any) => String(p.cycle))));
  const availableBillingTypes: string[] = Array.from(new Set(
    activePrices
      .filter((p: any) => p.cycle === form.cycle)
      .map((p: any) => String(p.billing_type))
  ));

  // Active matched price
  const matchedPrice = activePrices.find(
    (p: any) => p.cycle === form.cycle && p.billing_type === form.billing_type
  );

  const calculatedSubtotal = matchedPrice ? matchedPrice.amount_cents : 0;
  const calculatedTotal = Math.max(0, calculatedSubtotal - (Number(form.discount_cents) || 0));

  // Handle plan change: pre-select first valid cycle and billing_type
  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    const validPrices = plan?.billing_plan_prices?.filter((p: any) => p.active) || [];
    const firstPrice = validPrices[0];

    const defaultSolutions = plan?.billing_plan_solutions?.map((item: any) => item.solution_id) || [];

    setForm(prev => ({
      ...prev,
      plan_id: planId,
      cycle: firstPrice ? firstPrice.cycle : 'monthly',
      billing_type: firstPrice ? firstPrice.billing_type : 'CREDIT_CARD',
      solution_ids: defaultSolutions,
    }));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const lead = leads.find((candidate) => candidate.id === form.lead_id);
    const plan = plans.find((candidate) => candidate.id === form.plan_id);
    if (!lead || !plan || !matchedPrice) {
      return setError('Selecione um lead e um plano com combinação válida de ciclo e tipo de cobrança.');
    }
    setIsActioning(true);
    try {
      await request('/api/admin/commercial/proposals', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: lead.id,
          plan_id: plan.id,
          team_id: lead.assignment?.team_id,
          owner_platform_member_id: lead.assignment?.owner_platform_member_id,
          cycle: form.cycle,
          billing_type: form.billing_type,
          solution_ids: form.solution_ids,
          valid_until: form.valid_until || null,
          notes: form.notes,
          discount_cents: Number(form.discount_cents) || 0,
        })
      });
      setSuccess('Proposta gerada com sucesso.');
      setShowForm(false);
      setForm({ lead_id: '', plan_id: '', cycle: 'monthly', billing_type: 'CREDIT_CARD', valid_until: '', notes: '', discount_cents: 0, solution_ids: [] });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar proposta.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleApproveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!approveModalProposalId || !approvalNotes.trim()) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await request(`/api/admin/commercial/proposals/${approveModalProposalId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approval_notes: approvalNotes.trim() })
      });
      setSuccess('Proposta aprovada com sucesso.');
      setApproveModalProposalId(null);
      setApprovalNotes('');
      await load();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Falha ao aprovar proposta.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleAcceptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptModalProposalId || !acceptReason.trim()) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await request(`/api/admin/commercial/proposals/${acceptModalProposalId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ reason: acceptReason.trim() })
      });
      setSuccess('Aceite registrado com sucesso.');
      setAcceptModalProposalId(null);
      setAcceptReason('');
      await load();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Falha ao registrar aceite.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleCreateContractSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createContractProposalId) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await request(`/api/admin/commercial/proposals/${createContractProposalId}/create-contract`, {
        method: 'POST',
        body: JSON.stringify({ customer_tax_id: customerTaxId.trim() || null })
      });
      setSuccess('Contrato gerado com sucesso.');
      setCreateContractProposalId(null);
      setCustomerTaxId('');
      window.location.hash = '#/admin/contratos';
    } catch (contractError) {
      setError(contractError instanceof Error ? contractError.message : 'Falha ao gerar contrato.');
    } finally {
      setIsActioning(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Propostas</h1>
          <p className="text-sm text-gray-500 mt-1">Condições comerciais versionadas pelo plano aprovado.</p>
        </div>
        {hasPlatformPermission('platform.commercial.manage') && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#B66E45] text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[#A05C38] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova proposta
          </button>
        )}
      </div>

      {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">{error}</div>}
      {success && <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 font-medium">{success}</div>}

      {showForm && (
        <form onSubmit={submit} className="bg-white border rounded-2xl p-6 grid md:grid-cols-2 gap-4 shadow-sm">
          <label className="text-sm font-medium">
            Lead *
            <select
              required
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
            >
              <option value="">Selecione o lead</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.company} · {lead.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Plano *
            <select
              required
              value={form.plan_id}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
            >
              <option value="">Selecione o plano</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name} v{plan.version}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Ciclo *
            <select
              required
              value={form.cycle}
              disabled={!selectedPlan}
              onChange={(e) => {
                const newCycle = e.target.value;
                const validTypes = activePrices.filter((p: any) => p.cycle === newCycle).map((p: any) => p.billing_type);
                setForm({
                  ...form,
                  cycle: newCycle,
                  billing_type: validTypes.includes(form.billing_type) ? form.billing_type : (validTypes[0] || 'CREDIT_CARD')
                });
              }}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
            >
              {availableCycles.length > 0 ? (
                availableCycles.map(c => <option key={c} value={c}>{c === 'monthly' ? 'Mensal' : c === 'yearly' ? 'Anual' : c}</option>)
              ) : (
                <option value="monthly">Mensal</option>
              )}
            </select>
          </label>

          <label className="text-sm font-medium">
            Forma de Pagamento *
            <select
              required
              value={form.billing_type}
              disabled={!selectedPlan}
              onChange={(e) => setForm({ ...form, billing_type: e.target.value })}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
            >
              {availableBillingTypes.length > 0 ? (
                availableBillingTypes.map(t => <option key={t} value={t}>{t === 'CREDIT_CARD' ? 'Cartão' : t === 'BOLETO' ? 'Boleto' : t === 'PIX' ? 'Pix' : t}</option>)
              ) : (
                <option value="CREDIT_CARD">Cartão</option>
              )}
            </select>
          </label>

          <label className="text-sm font-medium">
            Desconto Promocional (Centavos)
            <input
              type="number"
              min="0"
              value={form.discount_cents}
              onChange={(e) => setForm({ ...form, discount_cents: parseInt(e.target.value) || 0 })}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
            />
          </label>

          <label className="text-sm font-medium">
            Válida até
            <input
              type="date"
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
            />
          </label>

          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium">Módulos do Plano Selecionado</label>
            {selectedPlan?.billing_plan_solutions?.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedPlan.billing_plan_solutions.map((item: any) => (
                  <span key={item.solution_id} className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
                    <Check className="w-3.5 h-3.5" />
                    {item.solutions?.name || 'Módulo'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Nenhum módulo individual configurado neste plano.</p>
            )}
          </div>

          <label className="text-sm font-medium md:col-span-2">
            Observações
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full border rounded-xl p-2.5 text-sm"
              placeholder="Condições especiais, termos da proposta..."
            />
          </label>

          {matchedPrice && (
            <div className="md:col-span-2 rounded-xl bg-orange-50 border border-orange-200 p-4 flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-600">Preço base: </span>
                <strong>{money.format(calculatedSubtotal / 100)}</strong>
                {form.discount_cents > 0 && <span className="text-red-600 ml-2">(-{money.format(form.discount_cents / 100)})</span>}
              </div>
              <div className="text-lg font-bold text-[#B66E45]">
                Total: {money.format(calculatedTotal / 100)}
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm">
              Cancelar
            </button>
            <button disabled={isActioning} className="bg-[#202322] text-white rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50">
              {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar proposta'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Carregando propostas...</div>
      ) : items.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-[#B66E45]" />
          <p className="font-semibold mt-3">Nenhuma proposta cadastrada</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F6F5F2] text-left">
              <tr>
                <th className="p-4">Proposta</th>
                <th className="p-4">Lead</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-4 font-semibold">#{item.proposal_number}</td>
                  <td className="p-4">{item.marketing_leads?.company || 'Sem empresa'}</td>
                  <td className="p-4">{item.billing_plans?.name || '—'}</td>
                  <td className="p-4 font-semibold">{money.format(item.amount_cents / 100)}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-800">
                      {PROPOSAL_STATUS_LABELS[item.status] || item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-3">
                    {item.status === 'pending_approval' && hasPlatformPermission('platform.commercial.approve') && (
                      <button
                        disabled={isActioning}
                        onClick={() => { setApproveModalProposalId(item.id); setApprovalNotes(''); }}
                        className="inline-flex gap-1 items-center text-emerald-700 font-semibold text-xs hover:underline disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovar
                      </button>
                    )}
                    {item.status === 'approved' && hasPlatformPermission('platform.commercial.manage') && (
                      <button
                        disabled={isActioning}
                        onClick={() => { setAcceptModalProposalId(item.id); setAcceptReason(''); }}
                        className="text-[#B66E45] font-semibold text-xs hover:underline disabled:opacity-50"
                      >
                        Registrar Aceite
                      </button>
                    )}
                    {item.status === 'accepted' && hasPlatformPermission('platform.commercial.manage') && (
                      <button
                        disabled={isActioning}
                        onClick={() => { setCreateContractProposalId(item.id); setCustomerTaxId(''); }}
                        className="text-[#B66E45] font-semibold text-xs bg-orange-50 px-3 py-1.5 rounded-xl hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50"
                      >
                        Gerar contrato
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Aprovação de Proposta */}
      {approveModalProposalId && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleApproveSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Aprovar Proposta</h3>
              <button type="button" onClick={() => setApproveModalProposalId(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Justificativa / Notas da Aprovação *
              <textarea
                required
                rows={3}
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                placeholder="Informe a justificativa comercial da aprovação..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setApproveModalProposalId(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !approvalNotes.trim()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Aprovação'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Aceite da Proposta */}
      {acceptModalProposalId && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleAcceptSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Registrar Aceite da Proposta</h3>
              <button type="button" onClick={() => setAcceptModalProposalId(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Justificativa / Comprovante de Aceite *
              <textarea
                required
                rows={3}
                value={acceptReason}
                onChange={e => setAcceptReason(e.target.value)}
                placeholder="Informe a confirmação de aceite pelo cliente..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setAcceptModalProposalId(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !acceptReason.trim()} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Aceite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Gerar Contrato */}
      {createContractProposalId && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleCreateContractSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Gerar Contrato a partir de Proposta</h3>
              <button type="button" onClick={() => setCreateContractProposalId(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              CPF / CNPJ do Cliente (Opcional nesta etapa)
              <input
                value={customerTaxId}
                onChange={e => setCustomerTaxId(e.target.value)}
                placeholder="Informe o CPF/CNPJ ou deixe para preencher depois"
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setCreateContractProposalId(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar Contrato'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
