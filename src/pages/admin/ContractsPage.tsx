import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileSignature, Plus, RefreshCw, Search, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', pending_approval: 'Aguardando aprovação', approved: 'Aprovado',
  pending_payment: 'Aguardando pagamento', active: 'Ativo', past_due: 'Em atraso',
  suspended: 'Suspenso', cancelled: 'Cancelado', expired: 'Expirado',
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ContractsPage() {
  const { session } = useAuth();
  const { platformCan } = usePlatform();
  const [contracts, setContracts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<{ teams: any[]; solutions: any[] }>({ teams: [], solutions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ lead_id: '', plan_id: '', team_id: '', customer_tax_id: '', customer_phone: '' });

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
      const [contractData, leadData, planData, catalogData] = await Promise.all([
        api('/api/admin/commercial/contracts'), api('/api/admin/leads'),
        api('/api/admin/billing/plans'), api('/api/admin/commercial/catalog'),
      ]);
      setContracts(contractData);
      setLeads(leadData);
      setPlans(planData.filter((plan: any) => plan.active));
      setCatalog(catalogData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar contratos.');
    } finally {
      setLoading(false);
    }
  }, [api, session]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => contracts.filter((contract) => {
    const text = `${contract.customer_name} ${contract.customer_email} ${contract.contract_number}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'all' || contract.status === status);
  }), [contracts, query, status]);

  const selectedLead = leads.find((lead) => lead.id === form.lead_id);
  const selectedPlan = plans.find((plan) => plan.id === form.plan_id);
  const selectedPrice = selectedPlan?.billing_plan_prices?.find((price: any) => price.active);

  async function createContract(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedLead || !selectedPlan || !selectedPrice) return setError('Selecione lead e plano com preço ativo.');
    setSaving(true); setError(null); setNotice(null);
    try {
      await api('/api/admin/commercial/contracts', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLead.id,
          plan_id: selectedPlan.id,
          team_id: form.team_id || selectedLead.assignment?.team_id || null,
          owner_platform_member_id: selectedLead.assignment?.owner_platform_member_id || null,
          customer_name: selectedLead.company,
          customer_email: selectedLead.email,
          customer_tax_id: form.customer_tax_id,
          customer_phone: form.customer_phone || selectedLead.phone,
          owner_name: selectedLead.name,
          owner_email: selectedLead.email,
          amount_cents: selectedPrice.amount_cents,
          cycle: selectedPrice.cycle,
          billing_type: selectedPrice.billing_type,
          grace_days: selectedPlan.grace_days,
          solution_ids: selectedPlan.billing_plan_solutions.map((item: any) => item.solution_id),
        }),
      });
      setNotice('Contrato criado e enviado para aprovação. Nenhum tenant ou cobrança foi criado.');
      setShowForm(false);
      setForm({ lead_id: '', plan_id: '', team_id: '', customer_tax_id: '', customer_phone: '' });
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Falha ao criar contrato.'); }
    finally { setSaving(false); }
  }

  async function approve(id: string) {
    if (!window.confirm('Aprovar este contrato e suas condições comerciais?')) return;
    try {
      await api(`/api/admin/commercial/contracts/${id}/approve`, { method: 'POST' });
      setNotice('Contrato aprovado. A cobrança continua bloqueada até o início explícito no Sandbox.');
      await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Falha ao aprovar.'); }
  }

  async function startBilling(id: string) {
    const nextDueDate = window.prompt('Primeiro vencimento (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!nextDueDate) return;
    if (!window.confirm('Criar cliente e assinatura no Asaas Sandbox? Esta ação não usa produção.')) return;
    try {
      await api(`/api/admin/commercial/contracts/${id}/start-billing`, { method: 'POST', body: JSON.stringify({ next_due_date: nextDueDate }) });
      setNotice('Assinatura Sandbox criada. O acesso só será liberado após webhook financeiro confirmado.');
      await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Falha ao iniciar cobrança.'); }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-[#202322]">Contratos</h1><p className="text-sm text-[#626866] mt-1">Aprovação comercial, cobrança e liberação auditável.</p></div>
        {platformCan('platform.commercial.manage') && <a href="#/admin/propostas" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white"><Plus className="w-4 h-4" /> Nova proposta</a>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/70 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#DDD8CF]/60 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><span className="sr-only">Buscar</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar empresa, e-mail ou número" className="w-full rounded-xl border border-[#DDD8CF] pl-9 pr-3 py-2 text-sm" /></label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-[#DDD8CF] px-3 py-2 text-sm"><option value="all">Todos os status</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <button onClick={load} aria-label="Atualizar" className="rounded-xl border border-[#DDD8CF] p-2 text-gray-600"><RefreshCw className="w-5 h-5" /></button>
        </div>
        {loading ? <div className="p-12 text-center text-sm text-gray-500">Carregando contratos...</div> : filtered.length === 0 ? (
          <div className="p-12 text-center"><FileSignature className="w-10 h-10 mx-auto text-[#B66E45] mb-3" /><p className="font-semibold text-[#202322]">Nenhum contrato encontrado</p><p className="text-sm text-gray-500 mt-1">Crie um contrato a partir de um lead qualificado.</p></div>
        ) : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F6F5F2] text-left text-xs uppercase tracking-wide text-[#626866]"><tr><th className="px-5 py-3">Contrato</th><th className="px-5 py-3">Plano</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-[#DDD8CF]/50">{filtered.map((contract) => <tr key={contract.id}><td className="px-5 py-4"><div className="font-semibold text-[#202322]">#{contract.contract_number} · {contract.customer_name}</div><div className="text-xs text-gray-500">{contract.customer_email}</div></td><td className="px-5 py-4">{contract.billing_plans?.name || 'Personalizado'}</td><td className="px-5 py-4 font-semibold">{money.format(contract.amount_cents / 100)}<div className="text-xs font-normal text-gray-500">{contract.cycle}</div></td><td className="px-5 py-4"><span className="rounded-full bg-[#F1E5DD] px-2.5 py-1 text-xs font-semibold text-[#8B4E2F]">{STATUS_LABEL[contract.status] || contract.status}</span>{contract.tenant_billing_state?.access_status && <div className="text-xs text-gray-500 mt-1">Acesso: {contract.tenant_billing_state.access_status}</div>}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{contract.status === 'pending_approval' && platformCan('platform.commercial.approve') && <button onClick={() => approve(contract.id)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Aprovar</button>}{contract.status === 'approved' && platformCan('platform.billing.manage') && <button onClick={() => startBilling(contract.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#202322] px-3 py-1.5 text-xs font-semibold text-white"><WalletCards className="w-3.5 h-3.5" /> Iniciar Sandbox</button>}</div></td></tr>)}</tbody></table></div>}
      </div>

      {showForm && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"><form onSubmit={createContract} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-[#202322]">Novo contrato</h2><p className="text-xs text-gray-500">O tenant só nasce após pagamento confirmado.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar"><X className="w-5 h-5" /></button></div><label className="block text-sm font-medium">Lead<select required value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value, team_id: leads.find((lead) => lead.id === e.target.value)?.assignment?.team_id || '' })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5"><option value="">Selecione</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company} · {lead.name}</option>)}</select></label><label className="block text-sm font-medium">Plano e versão<select required value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5"><option value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} v{plan.version}{plan.billing_plan_prices?.[0] ? ` · ${money.format(plan.billing_plan_prices[0].amount_cents / 100)}` : ''}</option>)}</select></label><label className="block text-sm font-medium">Equipe<select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5"><option value="">Sem equipe</option>{catalog.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><div className="grid sm:grid-cols-2 gap-4"><label className="block text-sm font-medium">CPF/CNPJ<input value={form.customer_tax_id} onChange={(e) => setForm({ ...form, customer_tax_id: e.target.value })} placeholder="Obrigatório para cobrança" className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5" /></label><label className="block text-sm font-medium">Telefone<input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5" /></label></div>{selectedPlan && <div className="rounded-xl bg-[#F6F5F2] p-4 text-sm"><strong>{selectedPlan.name}</strong><div className="mt-1 text-gray-600">{selectedPlan.billing_plan_solutions.map((item: any) => item.solutions?.name).filter(Boolean).join(', ') || 'Sem soluções configuradas'}</div></div>}<div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-[#DDD8CF] px-4 py-2 text-sm">Cancelar</button><button disabled={saving} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Criar para aprovação'}</button></div></form></div>}
    </div>
  );
}
