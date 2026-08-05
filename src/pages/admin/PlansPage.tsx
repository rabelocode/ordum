import React, { useCallback, useEffect, useState } from 'react';
import { Layers3, Plus } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';
import { MetricGridSkeleton } from '../../components/ui/LoadingSkeletons';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function PlansPage() {
  const { session } = useAccess();
  const { platformCan } = usePlatform();
  const [plans, setPlans] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', amount: '', cycle: 'monthly', billing_type: 'UNDEFINED', grace_days: '5', trial_days: '0', limits: '{}', solution_limits: '{}', solution_ids: [] as string[] });

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...init?.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha na requisição.');
    return data;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null);
    try {
      const [planData, catalog] = await Promise.all([request('/api/admin/billing/plans'), request('/api/admin/commercial/catalog')]);
      setPlans(planData); setSolutions(catalog.solutions);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar planos.'); }
    finally { setLoading(false); }
  }, [request, session]);

  useEffect(() => { load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    try {
      const limits=JSON.parse(form.limits||'{}');const solution_limits=JSON.parse(form.solution_limits||'{}');
      await request('/api/admin/billing/plans', { method: 'POST', body: JSON.stringify({
        code: form.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: form.name, description: form.description,
        amount_cents: Math.round(Number(form.amount.replace(',', '.')) * 100), cycle: form.cycle,
        billing_type: form.billing_type, grace_days: Number(form.grace_days), trial_days: Number(form.trial_days), limits, solution_limits, solution_ids: form.solution_ids,
      }) });
      setShowForm(false); setForm({ code: '', name: '', description: '', amount: '', cycle: 'monthly', billing_type: 'UNDEFINED', grace_days: '5', trial_days: '0', limits:'{}',solution_limits:'{}', solution_ids: [] }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao salvar plano.'); }
  }

  return <div className="max-w-7xl mx-auto space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold text-[#202322]">Planos e preços</h1><p className="text-sm text-[#626866] mt-1">Catálogo versionado; valores em centavos no banco.</p></div>{platformCan('platform.billing.manage') && <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white"><Plus className="w-4 h-4" /> Nova versão</button>}</div>{error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}{showForm && <form onSubmit={submit} className="bg-white rounded-2xl border border-[#DDD8CF] p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><label className="text-sm">Código<input required value={form.code} onChange={(e) => setForm({...form,code:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm">Nome<input required value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm">Preço em BRL<input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({...form,amount:e.target.value})} placeholder="199,90" className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm">Ciclo<select value={form.cycle} onChange={(e) => setForm({...form,cycle:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5"><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="yearly">Anual</option></select></label><label className="text-sm">Forma de cobrança<select value={form.billing_type} onChange={e=>setForm({...form,billing_type:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5"><option value="UNDEFINED">Definida pelo cliente</option><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option></select></label><label className="text-sm">Carência (dias)<input type="number" min="0" value={form.grace_days} onChange={(e) => setForm({...form,grace_days:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm">Trial (dias)<input type="number" min="0" value={form.trial_days} onChange={(e) => setForm({...form,trial_days:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5" /></label><fieldset className="sm:col-span-2"><legend className="text-sm">Soluções incluídas</legend><div className="mt-2 flex flex-wrap gap-3">{solutions.map((solution) => <label key={solution.id} className="text-sm flex gap-2"><input type="checkbox" checked={form.solution_ids.includes(solution.id)} onChange={(e) => setForm({...form,solution_ids:e.target.checked?[...form.solution_ids,solution.id]:form.solution_ids.filter(id=>id!==solution.id)})} />{solution.name}</label>)}</div></fieldset><label className="sm:col-span-2 text-sm">Limites globais (JSON)<textarea value={form.limits} onChange={e=>setForm({...form,limits:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-mono"/></label><label className="sm:col-span-2 text-sm">Limites por solução (JSON por ID)<textarea value={form.solution_limits} onChange={e=>setForm({...form,solution_limits:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-mono"/></label><label className="sm:col-span-2 lg:col-span-4 text-sm">Descrição<textarea value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5" /></label><div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button className="rounded-xl bg-[#202322] px-4 py-2 text-sm font-bold text-white">Salvar versão</button></div></form>}{loading ? <MetricGridSkeleton count={3} /> : plans.length===0 ? <div className="bg-white rounded-2xl border p-12 text-center"><Layers3 className="w-10 h-10 mx-auto text-[#B66E45]"/><p className="mt-3 font-semibold">Nenhum plano cadastrado</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{plans.map((plan) => <article key={plan.id} className={`bg-white rounded-2xl border p-5 ${plan.active?'border-[#B66E45]/40':'border-[#DDD8CF] opacity-65'}`}><div className="flex justify-between gap-3"><div><div className="text-xs uppercase tracking-widest text-[#B66E45]">{plan.code} · v{plan.version}</div><h2 className="text-xl font-bold text-[#202322] mt-1">{plan.name}</h2></div><span className="text-xs font-semibold">{plan.active?'Ativo':'Arquivado'}</span></div><p className="text-sm text-gray-500 mt-2 min-h-10">{plan.description || 'Sem descrição.'}</p><div className="mt-4 text-2xl font-black">{plan.billing_plan_prices?.[0] ? money.format(plan.billing_plan_prices[0].amount_cents/100) : 'Sem preço'}</div><div className="text-xs text-gray-500">{plan.billing_plan_prices?.[0]?.cycle || '—'} · {plan.billing_plan_prices?.[0]?.billing_type||'—'} · carência {plan.grace_days} dias</div><div className="mt-4 pt-4 border-t text-sm text-gray-600">{plan.billing_plan_solutions?.map((item:any)=>item.solutions?.name).filter(Boolean).join(' · ') || 'Sem soluções'}</div><pre className="mt-3 text-[10px] bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(plan.limits||{})}</pre></article>)}</div>}</div>;
}

