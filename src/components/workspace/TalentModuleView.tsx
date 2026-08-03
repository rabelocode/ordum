import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, ExternalLink, Plus, RefreshCw, UsersRound } from 'lucide-react';
import { useTenant } from '../../core/auth/TenantProvider';
import { captureAnalytics } from '../../lib/analytics';
import { captureClientException } from '../../lib/observability';
import { supabase } from '../../lib/supabase';
import type { TenantInfo, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/LoadingSkeletons';

type CareerSite = { id: string; slug: string; title: string; published: boolean };
type Job = { id: string; title: string; description: string; status: string; slug: string; location: string | null; work_model: string | null; created_at: string };
type Stage = { id: string; job_id: string; name: string; position: number };
type Application = { id: string; job_id: string; current_stage_id: string | null; status: string; applied_at: string; talent_candidates: { full_name: string; email: string } | null; talent_jobs: { title: string } | null };

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

export function TalentModuleView({ tenant, user, onBack }: { tenant: TenantInfo; user: UserProfile; onBack: () => void }) {
  const { activeMembership, hasPermission } = useTenant();
  const canManageJobs = hasPermission('talents.jobs.manage');
  const canManageCandidates = hasPermission('talents.candidates.manage');
  const [site, setSite] = useState<CareerSite | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ title: '', description: '', requirements: '', location: '', workModel: 'hybrid', employmentType: 'CLT' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [siteResult, jobsResult] = await Promise.all([
        supabase.from('talent_career_sites').select('id,slug,title,published').eq('tenant_id', tenant.id).limit(1).maybeSingle(),
        supabase.from('talent_jobs').select('id,title,description,status,slug,location,work_model,created_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (siteResult.error) throw siteResult.error;
      if (jobsResult.error) throw jobsResult.error;
      const loadedJobs = (jobsResult.data || []) as Job[];
      setSite(siteResult.data as CareerSite | null);
      setJobs(loadedJobs);
      if (canManageCandidates && loadedJobs.length) {
        const jobIds = loadedJobs.map((job) => job.id);
        const [stageResult, applicationResult] = await Promise.all([
          supabase.from('talent_job_stages').select('id,job_id,name,position').in('job_id', jobIds).order('position'),
          supabase.from('talent_applications').select('id,job_id,current_stage_id,status,applied_at,talent_candidates(full_name,email),talent_jobs(title)').eq('tenant_id', tenant.id).order('applied_at', { ascending: false }).limit(100),
        ]);
        if (stageResult.error) throw stageResult.error;
        if (applicationResult.error) throw applicationResult.error;
        setStages((stageResult.data || []) as Stage[]);
        setApplications((applicationResult.data || []) as unknown as Application[]);
      } else { setStages([]); setApplications([]); }
    } catch (caught) {
      captureClientException(caught, { operation: 'talent_workspace_load' });
      setError('Não foi possível carregar vagas e candidaturas deste tenant.');
    } finally { setLoading(false); }
  }, [canManageCandidates, tenant.id]);

  useEffect(() => { void load(); }, [load]);

  const ensureCareerSite = async () => {
    if (site) return site;
    const newSite = { tenant_id: tenant.id, slug: `${slugify(tenant.slug || tenant.name)}-${tenant.id.slice(0, 8)}-carreiras`, title: `Carreiras — ${tenant.name}`, description: 'Oportunidades abertas', published: false };
    const { data, error: siteError } = await supabase.from('talent_career_sites').insert(newSite).select('id,slug,title,published').single();
    if (siteError) throw siteError;
    setSite(data as CareerSite);
    return data as CareerSite;
  };

  const createJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageJobs || !activeMembership) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const careerSite = await ensureCareerSite();
      const uniqueSlug = `${slugify(form.title)}-${crypto.randomUUID().slice(0, 8)}`;
      const { data, error: jobError } = await supabase.from('talent_jobs').insert({
        tenant_id: tenant.id, career_site_id: careerSite.id, created_by_membership_id: activeMembership.id,
        title: form.title.trim(), slug: uniqueSlug, description: form.description.trim(), requirements: form.requirements.trim() || null,
        location: form.location.trim() || null, work_model: form.workModel, employment_type: form.employmentType,
      }).select('id').single();
      if (jobError) throw jobError;
      const { error: stageError } = await supabase.from('talent_job_stages').insert([
        { job_id: data.id, name: 'Triagem', position: 0, stage_type: 'screening' },
        { job_id: data.id, name: 'Entrevista', position: 1, stage_type: 'interview' },
        { job_id: data.id, name: 'Decisão', position: 2, stage_type: 'decision' },
      ]);
      if (stageError) throw stageError;
      setForm({ title: '', description: '', requirements: '', location: '', workModel: 'hybrid', employmentType: 'CLT' });
      setShowForm(false); setSuccess('Vaga criada como rascunho.');
      await load();
    } catch (caught) {
      captureClientException(caught, { operation: 'talent_job_create' });
      setError('A vaga não foi criada por completo. Revise os dados e tente novamente.');
    } finally { setSubmitting(false); }
  };

  const publishJob = async (job: Job) => {
    if (!canManageJobs) return;
    setError(''); setSuccess('');
    try {
      const careerSite = await ensureCareerSite();
      const { error: siteError } = await supabase.from('talent_career_sites').update({ published: true }).eq('id', careerSite.id).eq('tenant_id', tenant.id);
      if (siteError) throw siteError;
      const { error: jobError } = await supabase.from('talent_jobs').update({ status: 'published', published_at: new Date().toISOString(), career_site_id: careerSite.id }).eq('id', job.id).eq('tenant_id', tenant.id);
      if (jobError) throw jobError;
      captureAnalytics('job_published', { tenant_ref: tenant.id, module: 'talent', status: 'published' });
      setSite({ ...careerSite, published: true }); setSuccess('Vaga publicada no portal de carreiras.'); await load();
    } catch (caught) { captureClientException(caught, { operation: 'talent_job_publish' }); setError('A vaga não pôde ser publicada.'); }
  };

  const moveApplication = async (application: Application, stageId: string) => {
    if (!canManageCandidates) return;
    const { error: updateError } = await supabase.from('talent_applications').update({ current_stage_id: stageId || null }).eq('id', application.id).eq('tenant_id', tenant.id);
    if (updateError) { captureClientException(updateError, { operation: 'talent_application_move' }); setError('A candidatura não pôde ser movimentada.'); return; }
    setSuccess('Candidato movimentado no processo.'); await load();
  };

  const stagesByJob = useMemo(() => new Map(jobs.map((job) => [job.id, stages.filter((stage) => stage.job_id === job.id)])), [jobs, stages]);

  return <div className="space-y-6 animate-in fade-in duration-200">
    <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#626866] hover:text-[#202322]"><ArrowLeft className="h-4 w-4" /> Workspace</button>
    <section className="rounded-3xl border border-[#D98C32]/35 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D98C32]">Ordum Talentos</p><h1 className="mt-1 text-2xl font-black">Vagas e candidatos</h1><p className="mt-1 text-sm text-[#626866]">Publicação e pipeline conectados ao Supabase com isolamento por tenant.</p></div><div className="flex flex-wrap gap-2">{site?.published && <Button variant="outline" onClick={() => { window.location.hash = `#/carreiras/${site.slug}`; }}><ExternalLink className="h-4 w-4" /> Ver portal</Button>}{canManageJobs && <Button onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> Nova vaga</Button>}</div></div></section>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}{success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}
    {showForm && <form onSubmit={createJob} className="grid gap-4 rounded-2xl border border-[#DDD8CF] bg-white p-5 sm:grid-cols-2"><label className="text-sm font-semibold">Título<input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold">Local<input maxLength={160} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold">Modelo<select value={form.workModel} onChange={(e) => setForm({ ...form, workModel: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5"><option value="onsite">Presencial</option><option value="hybrid">Híbrido</option><option value="remote">Remoto</option></select></label><label className="text-sm font-semibold">Contratação<input maxLength={80} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold sm:col-span-2">Descrição<textarea required rows={4} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold sm:col-span-2">Requisitos<textarea rows={3} maxLength={5000} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={submitting || !form.title.trim() || !form.description.trim()}>{submitting ? 'Salvando…' : 'Criar rascunho'}</Button></div></form>}
    {loading ? <ListSkeleton rows={5} /> : jobs.length === 0 ? <section className="rounded-2xl border border-dashed border-[#DDD8CF] bg-white p-10 text-center"><BriefcaseBusiness className="mx-auto h-10 w-10 text-[#D98C32]" /><h2 className="mt-3 font-bold">Nenhuma vaga criada</h2><p className="mt-1 text-sm text-[#626866]">Crie um rascunho e publique somente quando o conteúdo estiver pronto.</p></section> : <section className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white"><div className="flex justify-between border-b p-4"><h2 className="font-bold">Vagas</h2><button onClick={() => void load()} aria-label="Atualizar vagas"><RefreshCw className="h-4 w-4 text-[#D98C32]" /></button></div><div className="divide-y">{jobs.map((job) => <article key={job.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start"><div><h3 className="font-bold">{job.title}</h3><p className="mt-1 text-sm text-[#626866]">{job.location || 'Local a definir'} · {job.work_model || 'Modelo a definir'}</p><p className="mt-2 line-clamp-2 text-sm text-[#626866]">{job.description}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#FFF1DD] px-3 py-1 text-xs font-bold text-[#AC6C24]">{job.status}</span>{canManageJobs && job.status !== 'published' && <Button size="sm" onClick={() => void publishJob(job)}>Publicar</Button>}</div></article>)}</div></section>}
    {canManageCandidates && <section className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white"><div className="flex items-center gap-2 border-b p-4"><UsersRound className="h-5 w-5 text-[#D98C32]" /><h2 className="font-bold">Candidaturas recebidas</h2></div>{loading ? <ListSkeleton rows={4} /> : applications.length === 0 ? <p className="p-10 text-center text-sm text-[#626866]">Nenhuma candidatura recebida nas vagas deste tenant.</p> : <div className="divide-y">{applications.map((application) => <article key={application.id} className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><h3 className="font-bold">{application.talent_candidates?.full_name || 'Candidato'}</h3><p className="text-xs text-[#626866]">{application.talent_candidates?.email}</p></div><p className="text-sm">{application.talent_jobs?.title || 'Vaga'}</p><select aria-label={`Etapa de ${application.talent_candidates?.full_name || 'candidato'}`} value={application.current_stage_id || ''} onChange={(event) => void moveApplication(application, event.target.value)} className="rounded-xl border p-2 text-sm"><option value="">Sem etapa</option>{(stagesByJob.get(application.job_id) || []).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></article>)}</div>}</section>}
    <p className="text-xs text-[#888D8B]">Perfil atual: {user.role}. Dados de candidatos são exibidos somente com permissão específica.</p>
  </div>;
}
