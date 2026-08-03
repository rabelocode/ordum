import { useEffect, useState } from 'react';
import { ArrowLeft, Briefcase, Loader2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { captureClientException } from '../../lib/observability';
import type { ModuleId } from '../../types';
import { Button } from '../ui/Button';

const CONFIG: Record<ModuleId, { name: string; color: string; light: string; table: string; select: string; empty: string }> = {
  integrity: { name: 'Ordum Integridade', color: '#3457D5', light: '#E9EDFF', table: 'integrity_reports', select: 'id,protocol,status,risk_level,created_at', empty: 'Nenhum relato está visível para o seu escopo.' },
  people: { name: 'Ordum Pessoas', color: '#16897A', light: '#E4F5F1', table: 'people_requests', select: 'id,subject,status,created_at', empty: 'Nenhuma solicitação interna está visível para o seu escopo.' },
  talent: { name: 'Ordum Talentos', color: '#D98C32', light: '#FFF1DD', table: 'talent_jobs', select: 'id,title,status,published_at,created_at', empty: 'Nenhuma vaga está visível para o seu escopo.' },
};

function icon(module: ModuleId) {
  if (module === 'integrity') return <ShieldCheck className="h-7 w-7" />;
  if (module === 'people') return <Users className="h-7 w-7" />;
  return <Briefcase className="h-7 w-7" />;
}

function recordLabel(module: ModuleId, record: any) {
  if (module === 'integrity') return `Relato ${record.protocol}`;
  if (module === 'people') return record.subject;
  return record.title;
}

export function ModuleRecordsView({ module, tenantId, onBack }: { module: ModuleId; tenantId: string; onBack: () => void }) {
  const config = CONFIG[module];
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error: queryError } = await (supabase as any).from(config.table).select(config.select).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
      if (cancelled) return;
      if (queryError) {
        captureClientException(queryError, { operation: `${module}_records_list` });
        setError('Não foi possível carregar os registros autorizados.');
      } else {
        setRecords(data || []);
        setError('');
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [config.select, config.table, module, tenantId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#626866] transition-colors hover:text-[#202322]"><ArrowLeft className="h-4 w-4" /> Workspace</button>
      <section className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: `${config.color}55` }}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ color: config.color, backgroundColor: config.light }}>{icon(module)}</div>
          <div><h1 className="text-2xl font-black text-[#202322]">{config.name}</h1><p className="mt-1 text-sm text-[#626866]">Registros reais, limitados a 50 e filtrados no banco pelo tenant e pelas policies de RLS.</p></div>
        </div>
      </section>
      <section className="rounded-2xl border border-[#DDD8CF] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-extrabold uppercase tracking-wider text-[#353938]">Atividade operacional</h2><span className="text-xs text-[#626866]">{records.length} registro(s)</span></div>
        {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#626866]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando</div> : error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : records.length === 0 ? <p className="rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF8F3] p-8 text-center text-sm text-[#626866]">{config.empty}</p> : <div className="divide-y divide-[#E8E3DB]">{records.map((record) => <article key={record.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-[#202322]">{recordLabel(module, record)}</p><p className="text-xs text-[#626866]">Criado em {new Date(record.created_at).toLocaleString('pt-BR')}</p></div><span className="w-fit rounded-full bg-[#FAF8F3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#626866]">{record.status}</span></article>)}</div>}
        <div className="mt-5 border-t border-[#E8E3DB] pt-4"><Button variant="outline" onClick={onBack}>Voltar ao início</Button></div>
      </section>
    </div>
  );
}
