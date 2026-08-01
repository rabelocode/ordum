import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';

type Metrics = Record<string, number | string | boolean | null>;

const formatMoney = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value / 100);
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

const GROUPS = [
  { title: 'Funil comercial', source: 'commercial', items: [
    ['Leads recebidos', 'leads_received', 'count', '#/admin/leads'], ['Leads qualificados', 'leads_qualified', 'count', '#/admin/leads'],
    ['Demonstrações', 'demos', 'count', '#/admin/demos'], ['Propostas', 'proposals', 'count', '#/admin/propostas'],
    ['Contratos', 'contracts', 'count', '#/admin/contratos'], ['Conversão lead → contrato', 'lead_to_contract_percent', 'percent', '#/admin/contratos'],
    ['Tempo médio no funil', 'average_funnel_hours', 'hours', '#/admin/leads'],
  ]},
  { title: 'Clientes e retenção', source: 'tenant', items: [
    ['Em onboarding', 'onboarding_clients', 'count', '#/admin/onboarding'], ['Tenants ativos', 'active_tenants', 'count', '#/admin/empresas'],
    ['Suspensos', 'suspended_tenants', 'count', '#/admin/empresas'], ['Cancelados', 'cancelled_tenants', 'count', '#/admin/empresas'],
    ['Trials ativos', 'active_trials', 'count', '#/admin/empresas'], ['Trials próximos do vencimento', 'trials_expiring', 'count', '#/admin/empresas'],
    ['Churn da base observada', 'churn_percent', 'percent', '#/admin/customer-success'], ['Renovações próximas', 'renewals_due', 'count', '#/admin/customer-success'],
    ['Clientes em risco', 'at_risk_clients', 'count', '#/admin/customer-success'], ['Expansão', 'expansion_cents', 'money', '#/admin/customer-success'],
  ]},
  { title: 'Financeiro', source: 'financial', items: [
    ['MRR', 'mrr_cents', 'money', '#/admin/financeiro'], ['ARR', 'arr_cents', 'money', '#/admin/financeiro'],
    ['Receita recebida', 'received_cents', 'money', '#/admin/financeiro'], ['Receita pendente', 'pending_cents', 'money', '#/admin/financeiro'],
    ['Receita vencida', 'overdue_cents', 'money', '#/admin/financeiro'], ['Tenants inadimplentes', 'delinquent_tenants', 'count', '#/admin/financeiro'],
    ['Reembolsos', 'refund_count', 'count', '#/admin/financeiro'], ['Chargebacks', 'chargeback_count', 'count', '#/admin/financeiro'],
  ]},
  { title: 'Operação', source: 'operations', items: [
    ['Webhooks com falha', 'webhook_failures', 'count', '#/admin/operacoes'], ['Conciliações divergentes', 'reconciliation_divergences', 'count', '#/admin/operacoes'],
    ['Eventos operacionais falhos', 'operational_failures', 'count', '#/admin/operacoes'], ['Tarefas e SLAs vencidos', 'overdue_tasks', 'count', '#/admin/suporte'],
  ]},
] as const;

function metricValue(value: unknown, kind: string) {
  if (typeof value !== 'number') return '—';
  if (kind === 'money') return formatMoney(value);
  if (kind === 'percent') return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
  if (kind === 'hours') return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} h`;
  return formatNumber(value);
}

function Comparison({ current, previous }: { current: unknown; previous: unknown }) {
  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return <span className="text-[11px] text-[#777D7A]">Sem base anterior comparável</span>;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}><Icon className="h-3 w-3" />{Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. período anterior</span>;
}

export function AdminDashboard() {
  const { session } = useAuth();
  const { platformCan, platformRole } = usePlatform();
  const [payload, setPayload] = useState<{ current: Metrics | null; previous: Metrics | null; emptyReason?: string | null } | null>(null);
  const [filters, setFilters] = useState<any>({ teams: [], people: [], plans: [], solutions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30');
  const [team, setTeam] = useState('');
  const [owner, setOwner] = useState('');
  const [plan, setPlan] = useState('');

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.valueOf() - Number(period) * 86400000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period]);

  async function load() {
    if (!session) return;
    setLoading(true); setError('');
    const params = new URLSearchParams({ ...range });
    if (team) params.set('team', team);
    if (owner) params.set('owner', owner);
    if (plan) params.set('plan', plan);
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [metricsResponse, filtersResponse] = await Promise.all([
        fetch(`/api/admin/control-plane/metrics?${params}`, { headers }),
        filters.teams.length ? Promise.resolve(null) : fetch('/api/admin/control-plane/filters', { headers }),
      ]);
      if (!metricsResponse.ok) throw new Error((await metricsResponse.json()).error || 'Não foi possível carregar os indicadores.');
      setPayload(await metricsResponse.json());
      if (filtersResponse) {
        if (!filtersResponse.ok) throw new Error('Não foi possível carregar os filtros.');
        setFilters(await filtersResponse.json());
      }
    } catch (caught: any) { setError(caught.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [session, period, team, owner, plan]);

  async function exportClients() {
    if (!session) return;
    const response = await fetch('/api/admin/control-plane/export/clients', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!response.ok) { setError('A exportação não pôde ser concluída.'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'ordum-clientes.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  const current = payload?.current;
  const previous = payload?.previous;
  const alerts = current ? [
    ['critical', Number(current.webhook_failures || 0), 'Webhooks com falha', '#/admin/operacoes'],
    ['critical', Number(current.reconciliation_divergences || 0), 'Divergências de conciliação', '#/admin/operacoes'],
    ['warning', Number(current.overdue_tasks || 0), 'Tarefas ou SLAs vencidos', '#/admin/suporte'],
    ['warning', Number(current.at_risk_clients || 0), 'Clientes em risco', '#/admin/customer-success'],
    ['attention', Number(current.trials_expiring || 0), 'Trials próximos do vencimento', '#/admin/empresas'],
  ].filter(([, count]) => Number(count) > 0) : [];

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B66E45]">Central de comando</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#202322]">Operação Ordum</h1><p className="mt-1 text-sm text-[#626866]">Indicadores reais e escopados para {platformRole?.name || 'seu papel'}.</p></div>
      <div className="flex flex-wrap gap-2">
        {platformCan('platform.exports.execute') && <button onClick={exportClients} className="inline-flex items-center gap-2 rounded-xl border border-[#DDD8CF] bg-white px-3 py-2 text-xs font-bold"><Download className="h-4 w-4" />Exportar clientes</button>}
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#202322] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
      </div>
    </div>

    <div className="grid gap-3 rounded-2xl border border-[#DDD8CF] bg-white p-4 md:grid-cols-4">
      <label className="text-xs font-bold text-[#626866]">Período<select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDD8CF] bg-white p-2 text-sm text-[#202322]"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option></select></label>
      <label className="text-xs font-bold text-[#626866]">Equipe<select value={team} onChange={(e) => setTeam(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDD8CF] bg-white p-2 text-sm"><option value="">Todas permitidas</option>{filters.teams.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs font-bold text-[#626866]">Responsável<select value={owner} onChange={(e) => setOwner(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDD8CF] bg-white p-2 text-sm"><option value="">Todos permitidos</option>{filters.people.map((item: any) => <option key={item.id} value={item.id}>{item.platform_roles?.name || item.relationship_type} · {item.id.slice(0, 8)}</option>)}</select></label>
      <label className="text-xs font-bold text-[#626866]">Plano<select value={plan} onChange={(e) => setPlan(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDD8CF] bg-white p-2 text-sm"><option value="">Todos os planos</option>{filters.plans.map((item: any) => <option key={item.id} value={item.id}>{item.name} v{item.version}</option>)}</select></label>
    </div>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {alerts.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="mb-3 flex items-center gap-2 font-bold text-amber-950"><AlertTriangle className="h-5 w-5" />Alertas priorizados</div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{alerts.map(([priority, count, label, href]) => <a href={String(href)} key={String(label)} className="rounded-xl bg-white/80 p-3 text-sm"><span className="font-black text-[#202322]">{count}</span> <span>{label}</span><span className="ml-2 text-[10px] font-bold uppercase text-amber-800">{priority}</span></a>)}</div></div>}

    {loading && !current ? <div className="grid gap-4 md:grid-cols-3"><div className="h-36 animate-pulse rounded-2xl bg-white"/><div className="h-36 animate-pulse rounded-2xl bg-white"/><div className="h-36 animate-pulse rounded-2xl bg-white"/></div> : !current ? <div className="rounded-2xl border border-dashed border-[#C8C2B7] bg-white p-12 text-center"><h2 className="font-bold">Sem dados disponíveis</h2><p className="mt-2 text-sm text-[#626866]">{payload?.emptyReason || 'Os indicadores não puderam ser calculados para este escopo.'}</p></div> : <>
      {payload?.emptyReason && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">{payload.emptyReason} Métricas sem base aparecem como “—”; nenhum número foi estimado.</div>}
      {GROUPS.map((group) => <section key={group.title} className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#202322]">{group.title}</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{group.items.map(([label, key, kind, href]) => {
        const sourceAvailable = group.source === 'commercial' ? current.has_commercial_data : group.source === 'financial' ? current.has_financial_data : true;
        const value = sourceAvailable ? current[key] : null;
        return <a key={key} href={href} className="rounded-2xl border border-[#DDD8CF]/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B66E45]/60"><div className="text-xs font-bold uppercase tracking-wide text-[#777D7A]">{label}</div><div className="mt-2 text-2xl font-black text-[#202322]">{metricValue(value, kind)}</div><div className="mt-2"><Comparison current={value} previous={previous?.[key]} /></div></a>;
      })}</div></section>)}
      <p className="text-right text-xs text-[#777D7A]">Última atualização da base: {current.last_updated_at && current.last_updated_at !== '-infinity' ? new Date(String(current.last_updated_at)).toLocaleString('pt-BR') : 'nenhum registro disponível'}</p>
    </>}
  </div>;
}
