import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, CreditCard, RefreshCw, Search, WalletCards } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { ListSkeleton, MetricGridSkeleton } from '../../components/ui/LoadingSkeletons';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { userFacingApiError } from '../../lib/userFacingError';
import { billingViewFromHash, type BillingView } from './billingNavigation';

type View = BillingView;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents?: number | null) => currency.format((cents || 0) / 100);
const date = (value?: string | null) => value ? new Date(`${value}${value.length === 10 ? 'T12:00:00' : ''}`).toLocaleDateString('pt-BR') : 'A definir';
const subscriptionStatus: Record<string, string> = { active: 'Ativa', trial: 'Em período de teste', pending: 'Aguardando início', pending_payment: 'Pagamento pendente', overdue: 'Em atraso', past_due: 'Em atraso', grace: 'Em atraso', inactive: 'Suspensa', suspended: 'Suspensa', review: 'Em revisão', cancelled: 'Cancelada', deleted: 'Cancelada' };
const paymentStatus: Record<string, string> = { pending: 'A vencer', awaiting_payment: 'A vencer', received: 'Pago', confirmed: 'Pago', paid: 'Pago', overdue: 'Vencido', cancelled: 'Cancelado', deleted: 'Cancelado', failed: 'Falhou', refused: 'Falhou', refunded: 'Estornado', chargeback: 'Em contestação' };
const paymentMethod: Record<string, string> = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: 'A definir' };

export function BillingPage() {
  const { session, hasPlatformPermission: can } = useAccess();
  const [view, setView] = useState<View>(() => billingViewFromHash(window.location.hash));
  const [overview, setOverview] = useState<any>(null);
  const [records, setRecords] = useState<any>({ subscriptions: { items: [] }, payments: { items: [] } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<{ kind: 'subscription' | 'payment'; value: any } | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...init?.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(userFacingApiError(body, response.status, 'Não foi possível concluir esta ação. Tente novamente.'));
    return body;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      const tenant = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tenant');
      if (tenant) params.set('tenant', tenant);
      const [summary, rows] = await Promise.all([request('/api/admin/billing/overview'), request(`/api/admin/billing/records?${params}`)]);
      setOverview(summary); setRecords(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o Financeiro. Tente novamente.');
    } finally { setLoading(false); }
  }, [request, session]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const syncFromRoute = () => { setView(billingViewFromHash(window.location.hash)); setSelected(null); };
    window.addEventListener('hashchange', syncFromRoute);
    return () => window.removeEventListener('hashchange', syncFromRoute);
  }, []);

  const navigateView = useCallback((nextView: View) => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    params.set('view', nextView);
    const nextHash = `#/admin/financeiro?${params}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    else setView(nextView);
    setStatus(''); setQuery(''); setSelected(null);
  }, []);

  const subscriptions = useMemo(() => filterRecords(records.subscriptions?.items || [], query, status, 'subscription'), [records, query, status]);
  const payments = useMemo(() => filterRecords(records.payments?.items || [], query, status, 'payment'), [records, query, status]);
  const overdue = useMemo(() => (records.payments?.items || []).filter((item: any) => item.status === 'overdue').filter((item: any) => matchesQuery(item, query)), [records, query]);

  async function cancelSubscription() {
    if (!cancelId || cancelReason.trim().length < 5) return;
    setError(null);
    try {
      await request(`/api/admin/billing/subscriptions/${cancelId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: cancelReason.trim() }) });
      setSuccess('Renovação cancelada. O acesso atual foi preservado até o fim do período contratado.');
      setCancelId(null); setCancelReason(''); setSelected(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível cancelar a renovação.'); }
  }

  if (selected) return <>
    {error ? <div role="alert" className="mx-auto mb-4 flex max-w-5xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
    {success ? <div role="status" className="mx-auto mb-4 flex max-w-5xl items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{success}</span></div> : null}
    <BillingDetail item={selected.value} kind={selected.kind} canManage={can('platform.billing.manage')} providerAvailable={Boolean(overview?.configuration?.enabled && overview?.configuration?.configured)} onBack={() => setSelected(null)} onCancel={() => setCancelId(selected.value.id)} />
    <ActionDialog open={Boolean(cancelId)} title="Cancelar renovação" description={overview?.configuration?.enabled ? 'A assinatura será cancelada no Asaas Sandbox. O acesso atual será preservado até o fim do período contratado.' : 'A integração financeira está indisponível; nenhuma alteração externa será executada.'} label="Motivo" value={cancelReason} onChange={setCancelReason} required danger confirmLabel="Cancelar renovação" onClose={() => { setCancelId(null); setCancelReason(''); }} onConfirm={cancelSubscription} />
  </>;

  const tabs: [View, string][] = [['overview', 'Visão geral'], ['subscriptions', 'Assinaturas'], ['payments', 'Cobranças'], ['overdue', 'Inadimplência']];
  const viewTitle: Record<View, string> = { overview: 'Visão geral financeira', subscriptions: 'Assinaturas', payments: 'Cobranças', overdue: 'Inadimplência' };
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#B66E45]">Financeiro</p><h1 className="mt-1 text-3xl font-black text-[#202322]">{viewTitle[view]}</h1><p className="mt-1 text-sm text-[#626866]">Acompanhe contratos, cobranças e clientes que precisam de atenção.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD8CF] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
    </header>
    <nav aria-label="Áreas do Financeiro" className="flex gap-1 overflow-x-auto border-b border-[#DDD8CF]">
      {tabs.map(([key, label]) => <button key={key} onClick={() => navigateView(key)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${view === key ? 'border-[#B66E45] text-[#202322]' : 'border-transparent text-[#626866]'}`}>{label}</button>)}
      <a href="#/admin/planos" className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#626866]">Planos</a>
    </nav>
    {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
    {success ? <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{success}</span></div> : null}
    {loading ? view === 'overview' ? <MetricGridSkeleton count={4} /> : <ListSkeleton rows={6} /> : null}
    {!loading && view === 'overview' ? <FinancialOverview overview={overview} onNavigate={navigateView} /> : null}
    {!loading && view !== 'overview' ? <>
      <FinanceFilters view={view} query={query} status={status} onQuery={setQuery} onStatus={setStatus} />
      {view === 'subscriptions' ? <RecordList kind="subscription" items={subscriptions} onOpen={(value) => setSelected({ kind: 'subscription', value })} /> : null}
      {view === 'payments' ? <RecordList kind="payment" items={payments} onOpen={(value) => setSelected({ kind: 'payment', value })} /> : null}
      {view === 'overdue' ? <OverdueList items={overdue} onOpen={(value) => setSelected({ kind: 'payment', value })} /> : null}
    </> : null}
    <ActionDialog open={Boolean(cancelId)} title="Cancelar renovação" description={overview?.configuration?.enabled ? 'A assinatura será cancelada no Asaas Sandbox. O acesso atual será preservado até o fim do período contratado.' : 'A integração financeira está indisponível; nenhuma alteração externa será executada.'} label="Motivo" value={cancelReason} onChange={setCancelReason} required danger confirmLabel="Cancelar renovação" onClose={() => { setCancelId(null); setCancelReason(''); }} onConfirm={cancelSubscription} />
  </div>;
}

function FinancialOverview({ overview, onNavigate }: { overview: any; onNavigate: (view: View) => void }) {
  const metrics = overview?.metrics || {};
  const hasData = Boolean(overview?.hasFinancialData);
  const cards = [['MRR ativo', metrics.activeMrrCents], ['Receita prevista', metrics.expectedCents], ['Recebido no período', metrics.receivedCents], ['Em atraso', metrics.overdueCents]];
  const attention = overview?.attention || {};
  const actions = [
    { count: attention.overduePayments, label: 'cobranças vencidas', detail: 'Priorize os clientes com pagamento em atraso.', view: 'overdue' as View },
    { count: attention.contractsAwaitingStart, label: 'contratos aguardando início', detail: 'Revise contratos formalizados que ainda não iniciaram.', view: 'subscriptions' as View },
    { count: attention.subscriptionsWithSyncIssue, label: 'assinaturas precisam de revisão', detail: 'Há divergências ou falhas que exigem conferência.', view: 'subscriptions' as View },
  ].filter(item => Number(item.count) > 0);
  return <div className="space-y-8">
    {!overview?.configuration?.enabled ? <div className="flex gap-3 rounded-2xl bg-[#F3EEE8] p-4 text-sm text-[#5B4638]"><AlertCircle className="h-5 w-5 shrink-0" /><div><strong>A integração financeira está temporariamente indisponível.</strong><p className="mt-1">Os dados da Ordum continuam acessíveis. Ações externas permanecem bloqueadas com segurança.</p></div></div> : null}
    <section><h2 className="text-lg font-black">Visão do período</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <article key={String(label)} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DDD8CF]/70"><div className="text-sm text-[#626866]">{label}</div><div className="mt-2 text-2xl font-black text-[#202322]">{hasData ? money(Number(value || 0)) : '—'}</div></article>)}</div>{!hasData ? <p className="mt-3 text-sm text-[#626866]">Os indicadores aparecerão quando houver contratos, assinaturas ou cobranças no período.</p> : null}</section>
    <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div><h2 className="text-lg font-black">Precisa da sua atenção</h2><div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-[#DDD8CF]/70">{actions.length ? actions.map((item, index) => <button key={item.label} onClick={() => onNavigate(item.view)} className={`flex w-full items-center gap-4 p-5 text-left hover:bg-[#F8F6F2] ${index ? 'border-t border-[#EEEAE3]' : ''}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 font-black text-red-700">{item.count}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#202322]">{item.label}</strong><span className="text-sm text-[#626866]">{item.detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#B66E45]" /></button>) : <div className="p-8 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" /><h3 className="mt-3 font-black">Tudo certo por aqui</h3><p className="mt-1 text-sm text-[#626866]">Não há pendências financeiras que exijam ação neste momento.</p></div>}</div></div>
      <div className="rounded-2xl bg-[#202322] p-6 text-white"><WalletCards className="h-6 w-6 text-[#D99A72]" /><h2 className="mt-4 text-lg font-black">Operação financeira</h2><p className="mt-2 text-sm text-white/70">{overview?.counts?.activeSubscriptions || 0} assinaturas ativas e {overview?.counts?.overduePayments || 0} cobranças vencidas.</p><div className="mt-5 space-y-2"><button onClick={() => onNavigate('subscriptions')} className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-bold">Ver assinaturas <ArrowRight className="h-4 w-4" /></button><button onClick={() => onNavigate('payments')} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/5">Ver cobranças <ArrowRight className="h-4 w-4" /></button></div></div>
    </section>
  </div>;
}

function FinanceFilters({ view, query, status, onQuery, onStatus }: { view: View; query: string; status: string; onQuery: (value: string) => void; onStatus: (value: string) => void }) {
  const options = view === 'subscriptions' ? [['', 'Todas as situações'], ['active', 'Ativas'], ['trial', 'Em período de teste'], ['pending', 'Aguardando início'], ['overdue', 'Em atraso'], ['suspended', 'Suspensas'], ['cancelled', 'Canceladas']] : view === 'payments' ? [['', 'Todas as situações'], ['pending', 'A vencer'], ['received', 'Pagas'], ['overdue', 'Vencidas'], ['failed', 'Falhas'], ['cancelled', 'Canceladas']] : [];
  return <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Buscar cliente</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#777D7A]" /><input value={query} onChange={event => onQuery(event.target.value)} placeholder="Buscar cliente" className="w-full rounded-xl border border-[#DDD8CF] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#B66E45]" /></label>{options.length ? <select aria-label="Filtrar situação" value={status} onChange={event => onStatus(event.target.value)} className="rounded-xl border border-[#DDD8CF] bg-white px-4 py-3 text-sm">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : null}</div>;
}

function RecordList({ kind, items, onOpen }: { kind: 'subscription' | 'payment'; items: any[]; onOpen: (value: any) => void }) {
  if (!items.length) return <Empty kind={kind} />;
  const isSubscription = kind === 'subscription';
  return <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#DDD8CF]/70"><div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 bg-[#F6F5F2] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#777D7A] md:grid"><span>Cliente</span><span>{isSubscription ? 'Plano' : 'Vencimento'}</span><span>Valor</span><span>Situação</span><span /></div>{items.map((item, index) => { const displayStatus = isSubscription ? effectiveSubscriptionStatus(item) : item.status; return <button key={item.id} onClick={() => onOpen(item)} className={`grid w-full gap-3 p-5 text-left hover:bg-[#FAF9F7] md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-center ${index ? 'border-t border-[#EEEAE3]' : ''}`}><div><strong className="block text-[#202322]">{customerName(item)}</strong><span className="text-xs text-[#626866]">{isSubscription ? item.commercial_contracts?.contract_number ? `Contrato ${item.commercial_contracts.contract_number}` : 'Contrato vinculado' : item.commercial_contracts?.contract_number ? `Contrato ${item.commercial_contracts.contract_number}` : 'Cobrança recorrente'}</span></div><Cell mobileLabel={isSubscription ? 'Plano' : 'Vencimento'} value={isSubscription ? item.commercial_contracts?.billing_plans?.name || 'Plano contratado' : date(item.due_date)} /><Cell mobileLabel="Valor" value={money(item.amount_cents)} /><div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(displayStatus)}`}>{isSubscription ? subscriptionStatus[displayStatus] || 'Em acompanhamento' : paymentStatus[displayStatus] || 'Em acompanhamento'}</span></div><ArrowRight className="hidden h-4 w-4 text-[#B66E45] md:block" /></button>; })}</div>;
}

function OverdueList({ items, onOpen }: { items: any[]; onOpen: (value: any) => void }) {
  if (!items.length) return <section className="rounded-2xl bg-white p-10 text-center ring-1 ring-[#DDD8CF]/70"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-3 font-black">Nenhuma cobrança vencida</h2><p className="mt-1 text-sm text-[#626866]">Tudo certo por aqui. Não há cobranças em atraso neste momento.</p></section>;
  return <div className="space-y-3">{items.map(item => { const days = overdueDays(item.due_date); return <button key={item.id} onClick={() => onOpen(item)} className="grid w-full gap-4 rounded-2xl bg-white p-5 text-left ring-1 ring-[#DDD8CF]/70 hover:ring-[#B66E45] sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center"><div><strong className="block">{customerName(item)}</strong><span className="text-sm text-red-700">{days === 0 ? 'Venceu hoje' : `${days} ${days === 1 ? 'dia' : 'dias'} em atraso`}</span></div><Cell mobileLabel="Valor vencido" value={money(item.amount_cents)} /><Cell mobileLabel="Próxima ação" value="Revisar cobrança" /><span className="text-sm font-bold text-[#B66E45]">Abrir <ArrowRight className="ml-1 inline h-4 w-4" /></span></button>; })}</div>;
}

function BillingDetail({ item, kind, canManage, providerAvailable, onBack, onCancel }: { item: any; kind: 'subscription' | 'payment'; canManage: boolean; providerAvailable: boolean; onBack: () => void; onCancel: () => void }) {
  const isSubscription = kind === 'subscription';
  const displayStatus = isSubscription ? effectiveSubscriptionStatus(item) : item.status;
  const history = item.commercial_contracts?.billing_status_history || [];
  return <div className="mx-auto max-w-5xl space-y-6"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-[#626866]"><ArrowLeft className="h-4 w-4" />Voltar ao Financeiro</button><header className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#DDD8CF]/70 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#B66E45]">{isSubscription ? 'Assinatura' : 'Cobrança'}</p><h1 className="mt-1 text-3xl font-black">{customerName(item)}</h1><p className="mt-2 text-lg font-bold">{money(item.amount_cents)}{isSubscription ? ` / ${cycleLabel(item.cycle)}` : ''}</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusTone(displayStatus)}`}>{isSubscription ? subscriptionStatus[displayStatus] || 'Em acompanhamento' : paymentStatus[displayStatus] || 'Em acompanhamento'}</span></div>{isSubscription && canManage && !['cancelled', 'deleted'].includes(item.status) ? <button disabled={!providerAvailable} onClick={onCancel} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Cancelar renovação</button> : null}</header>{!providerAvailable && isSubscription ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">A integração financeira está temporariamente indisponível. Os dados da Ordum continuam acessíveis, mas ações externas estão bloqueadas.</div> : null}<div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]"><section className="rounded-2xl bg-white p-6 ring-1 ring-[#DDD8CF]/70"><h2 className="text-lg font-black">Resumo</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="Cliente" value={customerName(item)} /><Info label="Plano" value={item.commercial_contracts?.billing_plans?.name || 'Plano contratado'} /><Info label={isSubscription ? 'Próxima cobrança' : 'Vencimento'} value={date(isSubscription ? item.next_due_date : item.due_date)} /><Info label="Forma de cobrança" value={paymentMethod[item.billing_type || item.metadata?.billing_type] || 'A definir'} />{!isSubscription && ['received', 'confirmed', 'paid'].includes(item.status) ? <Info label="Pagamento" value={`Pago em ${date(item.received_at || item.confirmed_at)}`} /> : null}{!isSubscription && item.status === 'overdue' ? <Info label="Atraso" value={`${overdueDays(item.due_date)} dias`} /> : null}</dl>{!isSubscription && item.invoice_url ? <a href={item.invoice_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#202322] px-4 py-2.5 text-sm font-bold text-white">Abrir cobrança <ArrowRight className="h-4 w-4" /></a> : null}</section><aside className="rounded-2xl bg-white p-6 ring-1 ring-[#DDD8CF]/70"><h2 className="text-lg font-black">Histórico</h2>{history.length ? <ol className="mt-5 space-y-5">{history.map((event: any) => <li key={event.id} className="relative border-l border-[#DDD8CF] pl-5"><span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-[#B66E45]" /><div className="text-sm font-bold">{historyLabel(event)}</div><div className="mt-1 text-xs text-[#626866]">{new Date(event.created_at).toLocaleString('pt-BR')}</div></li>)}</ol> : <div className="mt-5 text-sm text-[#626866]">As movimentações financeiras aparecerão aqui.</div>}</aside></div></div>;
}

function Empty({ kind }: { kind: 'subscription' | 'payment' }) { return <section className="rounded-2xl bg-white p-10 text-center ring-1 ring-[#DDD8CF]/70"><CreditCard className="mx-auto h-10 w-10 text-[#B66E45]" /><h2 className="mt-3 font-black">{kind === 'subscription' ? 'Nenhuma assinatura encontrada' : 'Nenhuma cobrança encontrada'}</h2><p className="mt-1 text-sm text-[#626866]">{kind === 'subscription' ? 'As assinaturas aparecerão quando contratos forem formalizados e iniciados.' : 'As cobranças do período aparecerão aqui assim que forem geradas.'}</p></section>; }
function Cell({ mobileLabel, value }: { mobileLabel: string; value: string }) { return <div><span className="text-xs font-bold uppercase text-[#777D7A] md:hidden">{mobileLabel}</span><div className="mt-0.5 text-sm font-semibold text-[#202322] md:mt-0">{value}</div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-[#777D7A]">{label}</dt><dd className="mt-1 text-sm font-bold text-[#202322]">{value}</dd></div>; }
function customerName(item: any) { return item.billing_customers?.name || item.commercial_contracts?.customer_name || item.tenants?.name || 'Cliente'; }
function matchesQuery(item: any, query: string) { return !query.trim() || `${customerName(item)} ${item.commercial_contracts?.contract_number || ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')); }
function filterRecords(items: any[], query: string, status: string, kind: 'subscription' | 'payment') { return items.filter(item => matchesQuery(item, query)).filter(item => !status || (kind === 'subscription' ? effectiveSubscriptionStatus(item) === status : item.status === status || (status === 'received' && ['confirmed', 'paid'].includes(item.status)))); }
function effectiveSubscriptionStatus(item: any) { return item.tenants?.tenant_billing_state?.access_status || (item.status === 'past_due' ? 'overdue' : item.status === 'inactive' ? 'suspended' : item.status); }
function cycleLabel(value?: string) { return value === 'yearly' ? 'ano' : value === 'monthly' ? 'mês' : 'período'; }
function overdueDays(value?: string | null) { if (!value) return 0; const due = new Date(`${value}T12:00:00`).valueOf(); return Math.max(0, Math.floor((Date.now() - due) / 86400000)); }
function statusTone(status?: string) { if (['active', 'received', 'confirmed', 'paid'].includes(status || '')) return 'bg-emerald-100 text-emerald-800'; if (['overdue', 'grace', 'failed', 'refused', 'suspended'].includes(status || '')) return 'bg-red-100 text-red-800'; if (['cancelled', 'deleted'].includes(status || '')) return 'bg-gray-100 text-gray-700'; return 'bg-amber-100 text-amber-800'; }
function historyLabel(event: any) { const labels: Record<string, string> = { active: 'Assinatura ativada.', pending_payment: 'Pagamento aguardado.', overdue: 'Cobrança ficou em atraso.', grace: 'Período de regularização iniciado.', suspended: 'Acesso suspenso conforme a política financeira.', cancelled: 'Renovação cancelada.', received: 'Pagamento confirmado.', paid: 'Pagamento confirmado.' }; return labels[event.to_status] || 'Situação financeira atualizada.'; }
