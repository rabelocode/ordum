import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

const CONFIG = {
  onboarding: { eyebrow: 'Implantação', title: 'Onboarding', description: 'Checklists reais por cliente, responsáveis, prazos, dependências, evidências e progresso.', columns: [['Cliente','tenants.name'],['Status','status'],['Progresso','progress_percent'],['Prazo','due_at'],['Atualização','updated_at']] },
  success: { eyebrow: 'Relacionamento', title: 'Customer Success', description: 'Saúde transparente, riscos, plano de sucesso, expansão e renovação.', columns: [['Cliente','tenants.name'],['Status','status'],['Health score','health_score'],['Renovação','renewal_at'],['Próxima revisão','next_review_at']] },
  support: { eyebrow: 'Backoffice', title: 'Suporte interno', description: 'Chamados vinculados a tenants; não é a solução comercial Ordum Chamados.', columns: [['Chamado','ticket_number'],['Cliente','tenants.name'],['Assunto','subject'],['Severidade','severity'],['Status','status'],['SLA','sla_due_at']] },
  privacy: { eyebrow: 'LGPD operacional', title: 'Solicitações de titulares', description: 'Fila operacional com retenção, legal hold e trilha; sem alegação automática de conformidade jurídica.', columns: [['Solicitação','request_number'],['Tipo','request_type'],['Status','status'],['Prazo','due_at'],['Legal hold','legal_hold'],['Criada em','created_at']] },
  targets: { eyebrow: 'Receita', title: 'Metas e comissões', description: 'Metas configuráveis; comissões dependem de pagamento confirmado e aprovação auditada.', columns: [['Métrica','metric'],['Início','period_start'],['Fim','period_end'],['Meta financeira','target_cents'],['Meta em volume','target_count']] },
  operations: { eyebrow: 'Operação', title: 'Eventos e integrações', description: 'Fila, tentativas, correlation ID e erros sanitizados. Nenhum status de deploy é simulado.', columns: [['Origem','source'],['Evento','event_type'],['Status','status'],['Tentativas','attempts'],['Correlation ID','correlation_id'],['Criado em','created_at']] },
} as const;

export type ControlPlaneModule = keyof typeof CONFIG;

function read(item: any, path: string) { return path.split('.').reduce((value, key) => value?.[key], item); }
function present(value: any, path: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (path.endsWith('_cents')) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) / 100);
  if (path === 'progress_percent') return `${value}%`;
  if (path.includes('_at') || path.includes('period_') || path === 'renewal_at') return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: path.includes('_at') ? 'short' : undefined });
  return String(value).replaceAll('_', ' ');
}

export function ControlPlaneModulePage({ module }: { module: ControlPlaneModule }) {
  const config = CONFIG[module];
  const columns = config.columns as readonly (readonly [string, string])[];
  const { session } = useAuth();
  const [data, setData] = useState<any>({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!session) return;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (status) params.set('status', status);
    try {
      const response = await fetch(`/api/admin/control-plane/modules/${module}?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Falha ao carregar módulo.'); setData(body);
    } catch (caught: any) { setError(caught.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [session, module, page, status]);

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B66E45]">{config.eyebrow}</p><h1 className="mt-1 text-3xl font-black text-[#202322]">{config.title}</h1><p className="mt-1 max-w-3xl text-sm text-[#626866]">{config.description}</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202322] px-4 py-2 text-xs font-bold text-white"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Atualizar</button></div>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#DDD8CF] bg-white p-4"><label className="text-xs font-bold text-[#626866]">Status<input value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} placeholder="Todos" className="ml-2 rounded-lg border border-[#DDD8CF] px-3 py-2 text-sm font-normal"/></label><span className="ml-auto text-xs text-[#626866]">{data.pagination.total} registros no escopo</span></div>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-5 w-5 shrink-0"/>{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white"><div className="overflow-x-auto"><table className="min-w-full text-left"><thead className="bg-[#F6F5F2]"><tr>{columns.map(([label]) => <th key={label} className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-[#626866]">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#EEEAE3]">{loading && !data.items.length ? <tr><td colSpan={columns.length} className="p-10 text-center text-sm text-[#626866]">Carregando dados reais…</td></tr> : data.items.length === 0 ? <tr><td colSpan={columns.length} className="p-12 text-center"><div className="font-bold text-[#202322]">Nenhum registro neste escopo</div><div className="mt-1 text-sm text-[#626866]">O módulo está operacional; os registros aparecerão quando forem criados pelos fluxos correspondentes.</div></td></tr> : data.items.map((item: any, index: number) => <tr key={item.id || item.tenant_id || index} className="hover:bg-[#FCFBF9]">{columns.map(([, path]) => <td key={path} className="max-w-xs truncate px-4 py-3 text-sm text-[#353938]">{present(read(item, path), path)}</td>)}</tr>)}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-[#EEEAE3] px-4 py-3"><span className="text-xs text-[#626866]">Página {data.pagination.page} de {Math.max(1, data.pagination.totalPages)}</span><div className="flex gap-2"><button aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4"/></button><button aria-label="Próxima página" disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4"/></button></div></div>
    </div>
  </div>;
}
