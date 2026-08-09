import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { integrityApi } from "../integrityApi";

type Option = { id: string; name: string };
type Filters = { period: string; status: string; severity: string; category_id: string; unit_id: string; committee_id: string; owner_id: string };
const initialFilters: Filters = { period: "30", status: "", severity: "", category_id: "", unit_id: "", committee_id: "", owner_id: "" };

export function IntegrityDashboard({ tenantId, onOpenCases }: { tenantId: string; onOpenCases: () => void }) {
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState<Record<string, Option[]>>({ categories: [], units: [], committees: [], owners: [] });
  const [state, setState] = useState<{ data: any; loading: boolean; error: string }>({ data: null, loading: true, error: "" });
  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try {
      const query = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([key, value]) => key !== "period" && value)));
      if (filters.period) query.set("from", new Date(Date.now() - Number(filters.period) * 864e5).toISOString());
      const data = await integrityApi<any>(tenantId, `/dashboard?${query}`);
      setState({ data, loading: false, error: "" });
    } catch (error) {
      setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Falha ao carregar indicadores." });
    }
  }, [filters, tenantId]);
  useEffect(() => { integrityApi<any>(tenantId, "/filters").then(setOptions).catch(() => undefined); }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  if (state.loading && !state.data) return <DashboardSkeleton />;
  if (state.error && !state.data) return <Panel><ErrorNotice message={state.error} retry={load} /></Panel>;
  const data = state.data;
  const metrics = [
    ["Casos novos", data.received], ["Aguardando triagem", data.triage], ["Em investigação", data.investigation],
    ["SLA vencido", (data.first_response_overdue || 0) + (data.treatment_overdue || 0)], ["Próximos do SLA", data.sla_due_soon],
    ["Sem responsável", data.unassigned], ["Conflitos pendentes", data.conflicts_pending], ["Tarefas vencidas", data.tasks_overdue],
  ];
  return <Panel>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Cockpit operacional</h2><p className="mt-1 text-sm text-[#626866]">Indicadores reais, agregados e sem exposição de identidade.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={state.loading} onClick={load}><RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />Atualizar</Button><Button onClick={onOpenCases}>Abrir casos</Button></div>
    </div>
    <div className="mb-5 grid gap-2 rounded-2xl border border-[#DDD8CF] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <Select label="Período" value={filters.period} onChange={(period) => setFilters({ ...filters, period })} options={[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["365", "12 meses"]]} empty={false} />
      <Select label="Status" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={[["received", "Novo"], ["triage", "Triagem"], ["investigation", "Investigação"], ["closed", "Encerrado"]]} />
      <Select label="Severidade" value={filters.severity} onChange={(severity) => setFilters({ ...filters, severity })} options={[["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["critical", "Crítica"]]} />
      <OptionsSelect label="Categoria" value={filters.category_id} items={options.categories} onChange={(category_id) => setFilters({ ...filters, category_id })} />
      <OptionsSelect label="Unidade/setor" value={filters.unit_id} items={options.units} onChange={(unit_id) => setFilters({ ...filters, unit_id })} />
      <OptionsSelect label="Comitê" value={filters.committee_id} items={options.committees} onChange={(committee_id) => setFilters({ ...filters, committee_id })} />
      <OptionsSelect label="Responsável" value={filters.owner_id} items={options.owners} onChange={(owner_id) => setFilters({ ...filters, owner_id })} />
      <Button variant="outline" onClick={() => setFilters(initialFilters)}>Limpar filtros</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <Metric key={String(label)} label={String(label)} value={value as number | null} />)}</div>
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <Summary icon={<Clock />} label="Primeira ação média" value={data.average_first_action_hours == null ? "—" : `${data.average_first_action_hours}h`} />
      <Summary icon={<CheckCircle2 />} label="Conclusão média" value={data.average_resolution_hours == null ? "—" : `${data.average_resolution_hours}h`} />
      <Summary icon={<AlertTriangle />} label="Taxa de reabertura" value={data.reopen_rate == null ? "—" : `${data.reopen_rate}%`} />
      <Summary icon={<CheckCircle2 />} label="Encerrados" value={data.closed ?? "—"} />
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <Distribution title="Por categoria" rows={data.by_category} />
      <Distribution title="Por unidade/setor" rows={data.by_unit} />
      <Distribution title="Por severidade" rows={data.by_severity} />
    </div>
    <div className="mt-5 rounded-2xl border border-[#DDD8CF] bg-white p-5"><h3 className="font-bold">Evolução temporal</h3><div className="mt-4 flex h-36 items-end gap-1 overflow-x-auto" aria-label="Volume diário de casos">{(data.evolution || []).length ? data.evolution.map((row: any) => <div key={row.date} className="group flex min-w-5 flex-1 flex-col items-center justify-end"><span className="sr-only">{row.date}: {row.count}</span><div title={`${row.date}: ${row.count}`} className="w-full min-w-3 rounded-t bg-[#3457D5]" style={{ height: `${Math.max(6, row.count * 14)}px` }} /></div>) : <p className="self-center text-sm text-[#626866]">Ainda não há dados no período.</p>}</div></div>
    <p className="mt-4 text-right text-xs text-[#626866]">Atualizado em {new Date(data.updated_at).toLocaleString("pt-BR")}</p>
  </Panel>;
}

function Panel({ children }: { children: React.ReactNode }) { return <main className="mx-auto max-w-[1500px] p-4 sm:p-6">{children}</main>; }
function DashboardSkeleton() { return <Panel><Skeleton className="mb-5 h-28 rounded-2xl" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><Skeleton className="mt-5 h-52 rounded-2xl" /></Panel>; }
function ErrorNotice({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><p>{message}</p><Button className="mt-3" variant="outline" onClick={retry}>Tentar novamente</Button></div>; }
function Metric({ label, value }: { label: string; value: number | null }) { return <div className="rounded-2xl border border-[#DDD8CF] bg-white p-5"><div className="text-xs font-bold uppercase tracking-wider text-[#626866]">{label}</div><div className="mt-3 text-3xl font-bold">{value ?? "—"}</div></div>; }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="rounded-2xl border border-[#DDD8CF] bg-white p-4"><div className="flex items-center gap-2 text-[#3457D5]">{icon}<span className="text-sm font-medium text-[#626866]">{label}</span></div><div className="mt-2 text-2xl font-bold">{value}</div></div>; }
function Distribution({ title, rows = [] }: { title: string; rows?: Array<{ label: string; count: number }> }) { const max = Math.max(1, ...rows.map((row) => row.count)); return <div className="rounded-2xl border border-[#DDD8CF] bg-white p-5"><h3 className="font-bold">{title}</h3><div className="mt-4 space-y-3">{rows.length ? rows.slice(0, 8).map((row) => <div key={row.label}><div className="mb-1 flex justify-between text-sm"><span>{row.label}</span><strong>{row.count}</strong></div><div className="h-2 rounded bg-[#EEEAE3]"><div className="h-2 rounded bg-[#3457D5]" style={{ width: `${Math.max(4, row.count / max * 100)}%` }} /></div></div>) : <p className="text-sm text-[#626866]">Sem dados suficientes.</p>}</div></div>; }
function OptionsSelect({ label, value, items, onChange }: { label: string; value: string; items: Option[]; onChange: (value: string) => void }) { return <Select label={label} value={value} onChange={onChange} options={items.map((item) => [item.id, item.name])} />; }
function Select({ label, value, onChange, options, empty = true }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; empty?: boolean }) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 rounded-xl border border-[#DDD8CF] bg-white px-3 text-sm">{empty ? <option value="">{label}: todos</option> : null}{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>; }
