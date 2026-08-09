import { useCallback, useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Skeleton } from "../../ui/Skeleton";
import { integrityApi, integrityDownload, type ApiState } from "../integrityApi";
import { EmptyState, ErrorState, FilterSelect, Panel, Risk, statusLabel } from "./IntegrityUi";

function dueAt(item: any) {
  return [!item.first_action_at && item.first_response_due_at,item.treatment_due_at].filter(Boolean).sort()[0] || item.sla_due_at || null;
}

export function IntegrityCasesList({ tenantId, canExport, onSelect }: { tenantId: string; canExport: boolean; onSelect: (id: string) => void }) {
  const initial = new URLSearchParams(window.location.search);
  const [filters,setFilters] = useState(() => ({ search: initial.get("ic_search") || "", status: initial.get("ic_status") || "", severity: initial.get("ic_severity") || "", sla: initial.get("ic_sla") || "", category_id: initial.get("ic_category") || "", unit_id: initial.get("ic_unit") || "", committee_id: initial.get("ic_committee") || "", owner_id: initial.get("ic_owner") || "", order: initial.get("ic_order") || "created_at", direction: initial.get("ic_direction") || "desc" }));
  const [page,setPage] = useState(1);
  const [options,setOptions] = useState<any>({ categories: [], units: [], committees: [], owners: [] });
  const [exporting,setExporting] = useState(false);
  const [state,setState] = useState<ApiState<any>>({ data: null, loading: true, error: "" });
  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    const query = new URLSearchParams({ page: String(page), limit: "25", ...Object.fromEntries(Object.entries(filters).filter(([,value]) => value)) });
    integrityApi<any>(tenantId,`/cases?${query}`).then((data) => setState({ data,loading:false,error:"" })).catch((error) => setState({ data:null,loading:false,error:error.message }));
  },[tenantId,page,filters]);
  useEffect(() => { integrityApi<any>(tenantId,"/filters").then(setOptions).catch(() => undefined); },[tenantId]);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of [...url.searchParams.keys()]) if (key.startsWith("ic_")) url.searchParams.delete(key);
    Object.entries(filters).forEach(([key,value]) => { const defaults: Record<string,string> = { order:"created_at",direction:"desc" }; if (value && value !== defaults[key]) url.searchParams.set(`ic_${key.replace("_id","")}`,value); });
    window.history.replaceState({},"",url);
  },[filters]);
  useEffect(load,[load]);
  const update = (key: string,value: string) => { setPage(1); setFilters((current) => ({ ...current,[key]:value })); };
  const clear = () => { setPage(1); setFilters({ search:"",status:"",severity:"",sla:"",category_id:"",unit_id:"",committee_id:"",owner_id:"",order:"created_at",direction:"desc" }); };
  const exportCases = async () => { setExporting(true); try { const query = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,value]) => value))); await integrityDownload(tenantId,`/cases/export.csv?${query}`,"casos-integridade.csv"); } finally { setExporting(false); } };
  return <Panel>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Caixa de casos</h2><p className="mt-1 text-sm text-[#626866]">Pesquisa, prioridade, risco e prazo em uma única fila.</p></div><div className="flex gap-2"><Button variant="outline" onClick={clear}>Limpar filtros</Button>{canExport ? <Button variant="outline" disabled={exporting} onClick={exportCases}><Download className="mr-2 h-4 w-4" />{exporting ? "Exportando..." : "Exportar CSV"}</Button> : null}</div></div>
    <div className="mb-5 grid gap-3 rounded-2xl border border-[#DDD8CF] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input aria-label="Buscar protocolo ou assunto" className="pl-9" placeholder="Buscar" value={filters.search} onChange={(event) => update("search",event.target.value)} /></label>
      <FilterSelect label="Status" value={filters.status} onChange={(value) => update("status",value)} options={[["received","Novo"],["triage","Triagem"],["investigation","Investigação"],["waiting_information","Aguardando"],["decision","Decisão"],["closed","Encerrado"]]} />
      <FilterSelect label="Severidade" value={filters.severity} onChange={(value) => update("severity",value)} options={[["low","Baixa"],["medium","Média"],["high","Alta"],["critical","Crítica"]]} />
      <FilterSelect label="SLA" value={filters.sla} onChange={(value) => update("sla",value)} options={[["due_soon","Próximas 24h"],["overdue","Vencido"]]} />
      <FilterSelect label="Categoria" value={filters.category_id} onChange={(value) => update("category_id",value)} options={options.categories.map((item:any) => [item.id,item.name])} />
      <FilterSelect label="Unidade/setor" value={filters.unit_id} onChange={(value) => update("unit_id",value)} options={options.units.map((item:any) => [item.id,item.name])} />
      <FilterSelect label="Comitê" value={filters.committee_id} onChange={(value) => update("committee_id",value)} options={options.committees.map((item:any) => [item.id,item.name])} />
      <FilterSelect label="Responsável" value={filters.owner_id} onChange={(value) => update("owner_id",value)} options={options.owners.map((item:any) => [item.id,item.name])} />
      <FilterSelect label="Ordenar" value={filters.order} onChange={(value) => update("order",value)} options={[["created_at","Mais recentes"],["updated_at","Atualizados"],["severity","Severidade"],["treatment_due_at","Prazo"]]} />
      <FilterSelect label="Direção" value={filters.direction} onChange={(value) => update("direction",value)} options={[["desc","Decrescente"],["asc","Crescente"]]} includeEmpty={false} />
    </div>
    {state.loading ? <div className="space-y-3">{Array.from({length:7}).map((_,index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</div> : state.error ? <ErrorState message={state.error} /> : !state.data?.cases?.length ? <EmptyState /> : <>
      <div className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#F6F5F2] text-xs uppercase tracking-wide text-[#626866]"><tr><th className="px-5 py-3">Protocolo</th><th>Assunto</th><th>Status</th><th>Severidade</th><th>Categoria</th><th>Unidade</th><th>Responsável / comitê</th><th>SLA</th></tr></thead><tbody>{state.data.cases.map((item:any) => { const due = dueAt(item); const overdue = due && new Date(due) < new Date() && !["closed","archived"].includes(item.status); return <tr key={item.id} tabIndex={0} onClick={() => onSelect(item.id)} onKeyDown={(event) => event.key === "Enter" && onSelect(item.id)} className="cursor-pointer border-t border-[#EEEAE3] hover:bg-blue-50/40 focus:bg-blue-50"><td className="px-5 py-4 font-mono font-bold text-[#3457D5]">{item.protocol}</td><td className="max-w-[240px] truncate">{item.integrity_reports?.subject || "Sem assunto"}</td><td>{statusLabel(item.status)}</td><td><Risk value={item.severity} /></td><td>{item.integrity_categories?.name || "—"}</td><td>{item.integrity_units?.name || "—"}</td><td>{item.owner_name || item.integrity_committees?.name || "Sem responsável"}</td><td className={overdue ? "font-bold text-red-700" : ""}>{due ? new Date(due).toLocaleDateString("pt-BR") : "—"}</td></tr>; })}</tbody></table></div></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span>{state.data.total} caso(s)</span><div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page-1)}>Anterior</Button><Button variant="outline" disabled={page >= state.data.total_pages} onClick={() => setPage(page+1)}>Próxima</Button></div></div>
    </>}
  </Panel>;
}
