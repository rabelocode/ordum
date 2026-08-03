import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { useTenant } from '../../core/auth/TenantProvider';
import { captureAnalytics } from '../../lib/analytics';
import { captureClientException } from '../../lib/observability';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/LoadingSkeletons';

type RequestType = { id: string; name: string; description: string | null };
type PeopleRequest = {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  people_request_types: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta', in_progress: 'Em andamento', waiting_user: 'Aguardando colaborador', resolved: 'Resolvida', cancelled: 'Cancelada',
};

export function PeopleModuleView({ tenant, user, onBack }: { tenant: { id: string }; user: UserProfile; onBack: () => void }) {
  const { activeMembership, hasPermission } = useTenant();
  const canCreate = hasPermission('people.requests.create');
  const canManage = hasPermission('people.requests.manage');
  const [types, setTypes] = useState<RequestType[]>([]);
  const [requests, setRequests] = useState<PeopleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ requestTypeId: '', subject: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [typeResult, requestResult] = await Promise.all([
        supabase.from('people_request_types').select('id,name,description').eq('tenant_id', tenant.id).eq('active', true).order('name'),
        supabase.from('people_requests').select('id,subject,description,status,created_at,resolved_at,people_request_types(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (typeResult.error) throw typeResult.error;
      if (requestResult.error) throw requestResult.error;
      setTypes((typeResult.data || []) as RequestType[]);
      setRequests((requestResult.data || []) as unknown as PeopleRequest[]);
      setForm((current) => ({ ...current, requestTypeId: current.requestTypeId || typeResult.data?.[0]?.id || '' }));
    } catch (caught) {
      captureClientException(caught, { operation: 'people_requests_load' });
      setError('Não foi possível carregar as solicitações autorizadas para este tenant.');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => { void load(); }, [load]);

  const createRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeMembership || !canCreate || !form.requestTypeId) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const { error: insertError } = await supabase.from('people_requests').insert({
        tenant_id: tenant.id,
        requester_membership_id: activeMembership.id,
        request_type_id: form.requestTypeId,
        subject: form.subject.trim(),
        description: form.description.trim() || null,
      });
      if (insertError) throw insertError;
      captureAnalytics('employee_request_created', { tenant_ref: tenant.id, module: 'people', status: 'open' });
      setForm((current) => ({ ...current, subject: '', description: '' }));
      setShowForm(false);
      setSuccess('Solicitação criada e disponível para acompanhamento.');
      await load();
    } catch (caught) {
      captureClientException(caught, { operation: 'people_request_create' });
      setError('A solicitação não foi criada. Revise os dados e tente novamente.');
    } finally { setSubmitting(false); }
  };

  const changeStatus = async (requestId: string, status: string) => {
    if (!canManage) return;
    setError(''); setSuccess('');
    const { error: updateError } = await supabase.from('people_requests').update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    }).eq('id', requestId).eq('tenant_id', tenant.id);
    if (updateError) {
      captureClientException(updateError, { operation: 'people_request_status' });
      setError('O status não pôde ser alterado.');
      return;
    }
    setSuccess('Status atualizado.');
    await load();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#626866] hover:text-[#202322]"><ArrowLeft className="h-4 w-4" /> Workspace</button>
      <section className="rounded-3xl border border-[#16897A]/30 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#16897A]">Ordum Pessoas</p><h1 className="mt-1 text-2xl font-black text-[#202322]">Solicitações internas</h1><p className="mt-1 text-sm text-[#626866]">Crie, consulte e acompanhe demandas no escopo autorizado.</p></div>
          {canCreate && <Button onClick={() => setShowForm((value) => !value)} disabled={!types.length}><Plus className="h-4 w-4" /> Nova solicitação</Button>}
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}

      {showForm && <form onSubmit={createRequest} className="grid gap-4 rounded-2xl border border-[#DDD8CF] bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">Tipo<select required value={form.requestTypeId} onChange={(event) => setForm({ ...form, requestTypeId: event.target.value })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] p-2.5">{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Assunto<input required maxLength={160} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5" /></label>
        <label className="text-sm font-semibold sm:col-span-2">Descrição<textarea rows={4} maxLength={3000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={submitting || !form.subject.trim()}>{submitting ? 'Salvando…' : 'Criar solicitação'}</Button></div>
      </form>}

      {loading ? <ListSkeleton rows={5} /> : requests.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#DDD8CF] bg-white p-10 text-center"><ClipboardList className="mx-auto h-10 w-10 text-[#16897A]" /><h2 className="mt-3 font-bold">Nenhuma solicitação neste escopo</h2><p className="mt-1 text-sm text-[#626866]">{types.length ? 'Crie a primeira solicitação quando precisar de atendimento interno.' : 'Um administrador precisa configurar ao menos um tipo de solicitação.'}</p></section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white">
          <div className="flex items-center justify-between border-b border-[#E8E3DB] p-4"><h2 className="text-sm font-extrabold">Solicitações visíveis</h2><button onClick={() => void load()} className="text-[#16897A]" aria-label="Atualizar solicitações"><RefreshCw className="h-4 w-4" /></button></div>
          <div className="divide-y divide-[#E8E3DB]">{requests.map((request) => <article key={request.id} className="p-4 sm:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex items-center gap-2"><h3 className="font-bold text-[#202322]">{request.subject}</h3>{request.status === 'resolved' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div><p className="mt-1 text-xs font-semibold text-[#16897A]">{request.people_request_types?.name || 'Solicitação'}</p>{request.description && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-[#626866]">{request.description}</p>}<p className="mt-2 text-xs text-[#888D8B]">Criada em {new Date(request.created_at).toLocaleString('pt-BR')}</p></div>{canManage ? <select aria-label={`Status de ${request.subject}`} value={request.status} onChange={(event) => void changeStatus(request.id, event.target.value)} className="h-10 rounded-xl border border-[#DDD8CF] px-3 text-sm"><option value="open">Aberta</option><option value="in_progress">Em andamento</option><option value="waiting_user">Aguardando colaborador</option><option value="resolved">Resolvida</option><option value="cancelled">Cancelada</option></select> : <span className="h-fit w-fit rounded-full bg-[#E4F5F1] px-3 py-1 text-xs font-bold text-[#10685D]">{STATUS_LABELS[request.status] || request.status}</span>}</div></article>)}</div>
        </section>
      )}
      <p className="text-xs text-[#888D8B]">Perfil atual: {user.role}. O banco aplica RLS em todas as consultas e mutações.</p>
    </div>
  );
}
