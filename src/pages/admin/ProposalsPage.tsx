import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Plus } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProposalsPage() {
  const { session } = useAccess();
  const { platformCan } = usePlatform();
  const [items, setItems] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ lead_id: '', plan_id: '', valid_until: '', notes: '' });

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...init?.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha na requisição.');
    return data;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [proposals, leadData, planData] = await Promise.all([
        request('/api/admin/commercial/proposals'), request('/api/admin/leads'), request('/api/admin/billing/plans'),
      ]);
      setItems(proposals); setLeads(leadData); setPlans(planData.filter((plan: any) => plan.active)); setError(null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar.'); }
  }, [request, session]);
  useEffect(() => { load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const lead = leads.find((candidate) => candidate.id === form.lead_id);
    const plan = plans.find((candidate) => candidate.id === form.plan_id);
    const price = plan?.billing_plan_prices?.find((candidate: any) => candidate.active);
    if (!lead || !plan || !price) return setError('Selecione lead e plano com preço.');
    try {
      await request('/api/admin/commercial/proposals', { method: 'POST', body: JSON.stringify({
        lead_id: lead.id, plan_id: plan.id, team_id: lead.assignment?.team_id,
        owner_platform_member_id: lead.assignment?.owner_platform_member_id,
        amount_cents: price.amount_cents, cycle: price.cycle, billing_type: price.billing_type,
        valid_until: form.valid_until || null, notes: form.notes,
      }) });
      setShow(false); setForm({ lead_id: '', plan_id: '', valid_until: '', notes: '' }); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar.'); }
  }

  async function approve(id: string) {
    if (!window.confirm('Aprovar esta proposta comercial?')) return;
    try { await request(`/api/admin/commercial/proposals/${id}/approve`, { method: 'POST', body: '{}' }); await load(); }
    catch (approveError) { setError(approveError instanceof Error ? approveError.message : 'Falha ao aprovar.'); }
  }

  async function createContract(id: string) {
    const taxId = window.prompt('CPF/CNPJ para o contrato (pode ser preenchido depois):', '');
    if (taxId === null) return;
    try {
      await request(`/api/admin/commercial/proposals/${id}/create-contract`, { method: 'POST', body: JSON.stringify({ customer_tax_id: taxId }) });
      window.location.hash = '#/admin/contratos';
    } catch (contractError) { setError(contractError instanceof Error ? contractError.message : 'Falha ao gerar contrato.'); }
  }

  return <div className="max-w-7xl mx-auto space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Propostas</h1><p className="text-sm text-gray-500 mt-1">Condições comerciais versionadas pelo plano aprovado.</p></div>{platformCan('platform.commercial.manage') && <button onClick={() => setShow(!show)} className="flex items-center gap-2 bg-[#B66E45] text-white rounded-xl px-4 py-2.5 text-sm font-bold"><Plus className="w-4 h-4" />Nova proposta</button>}</div>
    {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
    {show && <form onSubmit={submit} className="bg-white border rounded-2xl p-5 grid md:grid-cols-2 gap-4"><label className="text-sm">Lead<select required value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} className="mt-1 w-full border rounded-xl p-2.5"><option value="">Selecione</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.company} · {lead.name}</option>)}</select></label><label className="text-sm">Plano<select required value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} className="mt-1 w-full border rounded-xl p-2.5"><option value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} v{plan.version}</option>)}</select></label><label className="text-sm">Válida até<input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="mt-1 w-full border rounded-xl p-2.5" /></label><label className="text-sm">Observações<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full border rounded-xl p-2.5" /></label><div className="md:col-span-2 text-right"><button className="bg-[#202322] text-white rounded-xl px-4 py-2 text-sm font-bold">Enviar para aprovação</button></div></form>}
    {items.length === 0 ? <div className="bg-white border rounded-2xl p-12 text-center"><FileText className="w-10 h-10 mx-auto text-[#B66E45]" /><p className="font-semibold mt-3">Nenhuma proposta</p></div> : <div className="bg-white border rounded-2xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F6F5F2] text-left"><tr><th className="p-4">Proposta</th><th className="p-4">Lead</th><th className="p-4">Plano</th><th className="p-4">Valor</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-4 font-semibold">#{item.proposal_number}</td><td className="p-4">{item.marketing_leads?.company}</td><td className="p-4">{item.billing_plans?.name}</td><td className="p-4">{money.format(item.amount_cents / 100)}</td><td className="p-4">{item.status}</td><td className="p-4 text-right">{item.status === 'pending_approval' && platformCan('platform.commercial.approve') && <button onClick={() => approve(item.id)} className="inline-flex gap-1 items-center text-emerald-700 font-semibold"><CheckCircle2 className="w-4 h-4" />Aprovar</button>}{item.status === 'approved' && platformCan('platform.commercial.manage') && <button onClick={() => createContract(item.id)} className="text-[#B66E45] font-semibold">Gerar contrato</button>}</td></tr>)}</tbody></table></div>}
  </div>;
}

