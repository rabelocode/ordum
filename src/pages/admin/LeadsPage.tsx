import React, { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Calendar, FileText, ArrowRight, X, Loader2 } from 'lucide-react';
import { useAccess } from '../../core/auth/AccessContext';
import { AssignLeadModal } from '../../components/admin/AssignLeadModal';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';
import { getLeadNextStatuses, LEAD_STATUS_LABELS } from '../../domain/transitions';
import { userFacingApiError } from '../../lib/userFacingError';

export function LeadsPage() {
  const { session, platformRole, hasPlatformPermission } = useAccess();
  const canManageCommercial = platformRole?.key === 'admin' || hasPlatformPermission('platform.commercial.manage');
  const [leads, setLeads] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', company: '', team_id: '', source: 'indicação' });

  // Modals
  const [assignModalLead, setAssignModalLead] = useState<any>(null);
  const [transitionModal, setTransitionModal] = useState<{ lead: any; targetStatus: string } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  
  const [activityModalLead, setActivityModalLead] = useState<any>(null);
  const [activityForm, setActivityForm] = useState({ subject: '', description: '' });

  const [demoModalLead, setDemoModalLead] = useState<any>(null);
  const [demoForm, setDemoForm] = useState({ starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16), notes: '' });

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, ...init?.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(userFacingApiError(data,response.status,'Não foi possível atualizar este lead. Tente novamente.'));
    return data;
  }, [session]);

  const load = useCallback(async (page = 1) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      const data = await api(`/api/admin/leads?${params}`);
      setLeads(data.items);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }, [api, priority, search, session, status]);

  useEffect(() => {
    const timer = setTimeout(() => load(1), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!session) return;
    api('/api/admin/commercial/catalog').then((data) => setTeams(data.teams || [])).catch(() => setTeams([]));
  }, [api, session]);

  async function createLead(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setSuccess(null); setIsActioning(true);
    try {
      await api('/api/admin/leads', { method: 'POST', body: JSON.stringify(createForm) });
      setSuccess('Lead criado. Registre o primeiro contato para avançar.');
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', phone: '', company: '', team_id: teams[0]?.id || '', source: 'indicação' });
      await load(1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível criar o lead.'); }
    finally { setIsActioning(false); }
  }

  async function updatePriority(id: string, newPriority: string) {
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ priority: newPriority }) });
      setSuccess('Prioridade do lead atualizada.');
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar prioridade.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleTransitionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transitionModal || !transitionReason.trim()) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/leads/${transitionModal.lead.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ to_status: transitionModal.targetStatus, reason: transitionReason.trim() })
      });
      setSuccess(`Status do lead alterado para ${LEAD_STATUS_LABELS[transitionModal.targetStatus] || transitionModal.targetStatus}.`);
      setTransitionModal(null);
      setTransitionReason('');
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao alterar status do lead.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleActivitySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activityModalLead || !activityForm.subject.trim()) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/commercial/leads/${activityModalLead.id}/activities`, {
        method: 'POST',
        body: JSON.stringify({ activity_type: 'note', subject: activityForm.subject.trim(), description: activityForm.description.trim() || null, status: 'completed' })
      });
      setSuccess('Atividade registrada com sucesso.');
      setActivityModalLead(null);
      setActivityForm({ subject: '', description: '' });
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao registrar atividade.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!demoModalLead || !demoForm.starts_at) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/leads/${demoModalLead.id}/demos`, {
        method: 'POST',
        body: JSON.stringify({ starts_at: demoForm.starts_at, notes: demoForm.notes.trim() || null })
      });
      setSuccess('Demonstração agendada com sucesso.');
      setDemoModalLead(null);
      setDemoForm({ starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16), notes: '' });
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao agendar demonstração.');
    } finally {
      setIsActioning(false);
    }
  }

  async function claimLead(leadId: string) {
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      await api(`/api/admin/leads/${leadId}/claim`, { method: 'POST' });
      setSuccess('Lead assumido com sucesso.');
      await load(pagination.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao assumir lead.');
    } finally {
      setIsActioning(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#B66E45]">Comercial</p><h1 className="mt-1 text-3xl font-black text-[#202322]">Leads</h1>
        <p className="text-sm text-[#626866] mt-1">Do primeiro contato à proposta, com a próxima ação sempre visível.</p></div>
        {canManageCommercial ? <button onClick={() => { setCreateOpen(true); setCreateForm((value) => ({ ...value, team_id: value.team_id || teams[0]?.id || '' })); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4"/>Novo lead</button> : null}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-white p-4 text-xs font-bold text-[#626866] ring-1 ring-[#DDD8CF]/70">{["Lead","Contato","Demonstração","Qualificado","Proposta","Ganho ou perdido"].map((item,index)=><React.Fragment key={item}><span className="shrink-0 rounded-full bg-[#F6F5F2] px-3 py-1.5">{item}</span>{index<5?<ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#B66E45]"/>:null}</React.Fragment>)}</div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      <div className="grid gap-3 sm:grid-cols-3 bg-white rounded-2xl border p-4">
        <label className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            aria-label="Buscar leads"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nome, e-mail ou empresa"
            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
          />
        </label>
        <select aria-label="Filtrar status" value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border px-3 text-sm">
          <option value="">Todos os status</option>
          {['new', 'contacted', 'qualified', 'approved', 'rejected', 'converted'].map(item => (
            <option key={item} value={item}>{LEAD_STATUS_LABELS[item] || item}</option>
          ))}
        </select>
        <select aria-label="Filtrar prioridade" value={priority} onChange={e => setPriority(e.target.value)} className="rounded-xl border px-3 text-sm">
          <option value="">Todas as prioridades</option>
          {['low', 'normal', 'high', 'urgent'].map(item => (
            <option key={item} value={item}>{priorityLabel(item)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        {loading ? (
          <ListSkeleton rows={7} />
        ) : !leads.length ? (
          <div className="p-10 text-center"><p className="font-bold text-[#202322]">Nenhum lead por aqui</p><p className="mt-1 text-sm text-[#626866]">Cadastre uma oportunidade para iniciar o acompanhamento comercial.</p>{canManageCommercial?<button onClick={()=>setCreateOpen(true)} className="mt-4 rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white">Criar primeiro lead</button>:null}</div>
        ) : (
          <><div className="space-y-3 p-3 md:hidden">{leads.map(lead=>{const assignment=lead.assignment;const canClaim=assignment&&!assignment.owner_platform_member_id&&assignment.platform_teams?.allow_self_claim;const allowedNext=getLeadNextStatuses(lead.status);return <article key={lead.id} className="rounded-2xl border border-[#DDD8CF] p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black">{lead.name}</h2><p className="text-sm text-[#626866]">{lead.company||"Empresa não informada"}</p></div><span className="rounded-full bg-[#F6F5F2] px-2.5 py-1 text-xs font-bold">{LEAD_STATUS_LABELS[lead.status]||"Em andamento"}</span></div><p className="mt-3 text-xs text-[#626866]">Responsável: {lead.owner?.name||lead.owner?.email||"Não atribuído"}</p><div className="mt-4 flex flex-wrap gap-2">{canClaim?<button disabled={isActioning} onClick={()=>claimLead(lead.id)} className="rounded-lg bg-[#B66E45] px-3 py-2 text-xs font-bold text-white">Assumir</button>:null}<button disabled={isActioning} onClick={()=>setActivityModalLead(lead)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold">Registrar contato</button><button disabled={isActioning} onClick={()=>setDemoModalLead(lead)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold">Agendar demo</button><a href={`#/admin/propostas?lead=${lead.id}`} className="rounded-lg bg-orange-100 px-3 py-2 text-xs font-bold text-[#B66E45]">Criar proposta</a>{allowedNext[0]?<button disabled={isActioning} onClick={()=>{setTransitionModal({lead,targetStatus:allowedNext[0]});setTransitionReason("");}} className="rounded-lg border border-[#B66E45]/30 px-3 py-2 text-xs font-bold text-[#B66E45]">Avançar etapa</button>:null}</div></article>;})}</div><div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#F6F5F2] text-left">
                <tr>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Etapa atual</th>
                  <th className="p-3">Próxima etapa</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const assignment = lead.assignment;
                  const canClaim = assignment && !assignment.owner_platform_member_id && assignment.platform_teams?.allow_self_claim;
                  const allowedNext = getLeadNextStatuses(lead.status);

                  return (
                    <tr key={lead.id} className="border-t align-top">
                      <td className="p-3">
                        <strong>{lead.name}</strong>
                        <div className="text-gray-500">{lead.company}</div>
                        <div className="text-xs">{lead.email} · {lead.source}</div>
                      </td>
                      <td className="p-3">
                        {assignment?.platform_teams?.name || 'Não atribuído'}
                        <div className="text-xs text-gray-500">{lead.owner?.name || lead.owner?.email || 'Sem responsável'}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-block rounded-full bg-[#F6F5F2] px-2.5 py-1 text-xs font-bold text-[#202322]">
                          {LEAD_STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {allowedNext.length > 0 ? (
                            allowedNext.map(target => (
                              <button
                                key={target}
                                disabled={isActioning}
                                onClick={() => { setTransitionModal({ lead, targetStatus: target }); setTransitionReason(''); }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#B66E45]/30 bg-orange-50 px-2 py-1 text-xs font-semibold text-[#B66E45] hover:bg-orange-100 disabled:opacity-50 transition-colors"
                              >
                                <ArrowRight className="w-3 h-3" />
                                {LEAD_STATUS_LABELS[target] || target}
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">Estado final</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          aria-label={`Prioridade de ${lead.name}`}
                          value={lead.priority || 'normal'}
                          disabled={isActioning}
                          onChange={e => updatePriority(lead.id, e.target.value)}
                          className="rounded-lg border p-1.5 text-xs"
                        >
                          {['low', 'normal', 'high', 'urgent'].map(item => (
                            <option key={item} value={item}>{priorityLabel(item)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {canClaim && (
                            <button disabled={isActioning} onClick={() => claimLead(lead.id)} className="rounded-lg bg-[#B66E45] px-2 py-1 text-xs text-white hover:bg-[#A05C38]">
                              Assumir
                            </button>
                          )}
                          <button disabled={isActioning} onClick={() => setAssignModalLead(lead)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">
                            Atribuir
                          </button>
                          <button disabled={isActioning} onClick={() => setActivityModalLead(lead)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">
                            Registrar contato
                          </button>
                          <button disabled={isActioning} onClick={() => setDemoModalLead(lead)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">
                            Agendar demo
                          </button>
                          <a href={`#/admin/propostas?lead=${lead.id}`} className="rounded-lg bg-orange-100 px-2 py-1 text-xs font-semibold text-[#B66E45] hover:bg-orange-200">
                            Criar proposta
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></>
        )}
      </div>

      <div className="flex justify-between items-center text-sm">
        <span>{pagination.total} registros</span>
        <div className="flex gap-2">
          <button disabled={pagination.page <= 1 || isActioning} onClick={() => load(pagination.page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
            Anterior
          </button>
          <span className="px-2 py-1.5">{pagination.page}/{Math.max(1, pagination.totalPages)}</span>
          <button disabled={pagination.page >= pagination.totalPages || isActioning} onClick={() => load(pagination.page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">
            Próxima
          </button>
        </div>
      </div>

      {assignModalLead && (
        <AssignLeadModal
          isOpen
          onClose={() => setAssignModalLead(null)}
          onSuccess={() => { setAssignModalLead(null); load(pagination.page); }}
          leadId={assignModalLead.id}
          currentAssignment={assignModalLead.assignment}
        />
      )}

      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="new-lead-title"><form onSubmit={createLead} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="new-lead-title" className="text-xl font-black">Novo lead</h2><p className="mt-1 text-sm text-[#626866]">Registre somente os dados necessários para começar.</p></div><button type="button" aria-label="Fechar" onClick={()=>setCreateOpen(false)} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5"/></button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Contato<input required minLength={2} value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-normal" placeholder="Nome da pessoa"/></label><label className="text-sm font-bold">Empresa<input required minLength={2} value={createForm.company} onChange={e=>setCreateForm({...createForm,company:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-normal" placeholder="Nome da empresa"/></label><label className="text-sm font-bold">E-mail<input required type="email" value={createForm.email} onChange={e=>setCreateForm({...createForm,email:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-normal" placeholder="contato@empresa.com.br"/></label><label className="text-sm font-bold">Telefone<input value={createForm.phone} onChange={e=>setCreateForm({...createForm,phone:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-normal" placeholder="(11) 99999-9999"/></label><label className="text-sm font-bold sm:col-span-2">Equipe responsável<select required value={createForm.team_id} onChange={e=>setCreateForm({...createForm,team_id:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-normal"><option value="">Selecione</option>{teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label className="text-sm font-bold sm:col-span-2">Origem<select value={createForm.source} onChange={e=>setCreateForm({...createForm,source:e.target.value})} className="mt-1 w-full rounded-xl border p-2.5 font-normal"><option>indicação</option><option>site</option><option>evento</option><option>prospecção</option><option>parceria</option></select></label></div><div className="flex justify-end gap-3"><button type="button" onClick={()=>setCreateOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">Cancelar</button><button disabled={isActioning||!createForm.team_id} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isActioning?<Loader2 className="h-4 w-4 animate-spin"/>:'Criar lead'}</button></div></form></div>}

      {/* Modal Transição de Status do Lead */}
      {transitionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleTransitionSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Alterar etapa do lead</h3>
              <button type="button" onClick={() => setTransitionModal(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">
              Alterar status de <strong>{LEAD_STATUS_LABELS[transitionModal.lead.status] || transitionModal.lead.status}</strong> para <strong>{LEAD_STATUS_LABELS[transitionModal.targetStatus] || transitionModal.targetStatus}</strong>.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Motivo da alteração *
              <textarea
                required
                rows={3}
                value={transitionReason}
                onChange={e => setTransitionReason(e.target.value)}
                placeholder="Ex.: contato realizado e interesse confirmado"
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setTransitionModal(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !transitionReason.trim()} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar etapa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Registrar Atividade */}
      {activityModalLead && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleActivitySubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Registrar Atividade</h3>
              <button type="button" onClick={() => setActivityModalLead(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">Lead: {activityModalLead.name} ({activityModalLead.company})</p>
            <label className="block text-sm font-medium">
              Assunto *
              <input
                required
                value={activityForm.subject}
                onChange={e => setActivityForm({ ...activityForm, subject: e.target.value })}
                placeholder="Ex: Reunião inicial, Ligação telefônica"
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Descrição / Notas
              <textarea
                rows={3}
                value={activityForm.description}
                onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="Detalhes adicionais da interação..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setActivityModalLead(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !activityForm.subject.trim()} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Atividade'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Agendar Demo */}
      {demoModalLead && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form onSubmit={handleDemoSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">Agendar Demonstração</h3>
              <button type="button" onClick={() => setDemoModalLead(null)} aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">Lead: {demoModalLead.name} ({demoModalLead.company})</p>
            <label className="block text-sm font-medium">
              Data e Hora *
              <input
                required
                type="datetime-local"
                value={demoForm.starts_at}
                onChange={e => setDemoForm({ ...demoForm, starts_at: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Observações
              <textarea
                rows={3}
                value={demoForm.notes}
                onChange={e => setDemoForm({ ...demoForm, notes: e.target.value })}
                placeholder="Pauta da demonstração, participantes..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDemoModalLead(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancelar
              </button>
              <button disabled={isActioning || !demoForm.starts_at} className="rounded-xl bg-[#B66E45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Agendar Demo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function priorityLabel(value:string){return ({low:"Baixa",normal:"Normal",high:"Alta",urgent:"Urgente"} as Record<string,string>)[value]||"Normal";}
