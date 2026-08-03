import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';
import { captureAnalytics } from '../../lib/analytics';
import { captureClientException } from '../../lib/observability';
import { supabase } from '../../lib/supabase';

type PublicJob = { id: string; title: string; description: string; requirements: string | null; location: string | null; work_model: string | null; employment_type: string | null };
type CareerSite = { title: string; description: string | null; talent_jobs: PublicJob[] };

export function CareerSitePage({ slug }: { slug: string }) {
  const [site, setSite] = useState<CareerSite | null>(null);
  const [selectedJob, setSelectedJob] = useState<PublicJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const applicationStarted = useRef(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', linkedin: '', coverLetter: '', consent: false });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: queryError } = await supabase.from('talent_career_sites')
        .select('title,description,talent_jobs(id,title,description,requirements,location,work_model,employment_type)')
        .eq('slug', slug).eq('published', true).maybeSingle();
      if (cancelled) return;
      if (queryError) { captureClientException(queryError, { operation: 'career_site_load' }); setError('Não foi possível carregar este portal de carreiras.'); }
      else if (!data) setError('Portal de carreiras não encontrado ou ainda não publicado.');
      else setSite(data as unknown as CareerSite);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedJob || !form.consent) return;
    setSubmitting(true); setError('');
    try {
      const { error: rpcError } = await (supabase as any).rpc('submit_talent_application', {
        p_job_id: selectedJob.id, p_full_name: form.fullName.trim(), p_email: form.email.trim(), p_phone: form.phone.trim() || null,
        p_linkedin_url: form.linkedin.trim() || null, p_cover_letter: form.coverLetter.trim() || null, p_consent: form.consent,
      });
      if (rpcError) throw rpcError;
      captureAnalytics('application_submitted', { module: 'talent', status: 'submitted', source: 'career_site' });
      setSubmitted(true);
    } catch (caught) {
      captureClientException(caught, { operation: 'career_application_submit' });
      setError('A candidatura não foi enviada. Ela pode já existir para este e-mail e vaga; revise os dados ou tente novamente.');
    } finally { setSubmitting(false); }
  };

  const trackApplicationStarted = () => {
    if (applicationStarted.current) return;
    applicationStarted.current = true;
    captureAnalytics('application_started', { module: 'talent', source: 'career_site' });
  };

  if (loading) return <main className="min-h-screen bg-[#F6F5F2] p-5 sm:p-10"><div className="mx-auto max-w-5xl"><ListSkeleton rows={6} /></div></main>;

  return <main className="min-h-screen bg-[#F6F5F2] px-5 py-8 sm:py-12"><div className="mx-auto max-w-5xl space-y-6"><button onClick={() => { window.location.hash = '#/'; }} className="flex items-center gap-1 text-sm text-[#626866]"><ArrowLeft className="h-4 w-4" /> Voltar</button>{error && !site ? <section className="rounded-3xl border bg-white p-10 text-center"><h1 className="text-xl font-black">Portal indisponível</h1><p role="alert" className="mt-2 text-sm text-red-700">{error}</p></section> : site && <><header className="rounded-3xl bg-[#202322] p-7 text-white sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#D98C32]">Ordum Talentos</p><h1 className="mt-2 text-3xl font-black">{site.title}</h1><p className="mt-2 max-w-2xl text-sm text-white/70">{site.description || 'Conheça as oportunidades disponíveis e candidate-se com segurança.'}</p></header>{submitted ? <section className="rounded-3xl border bg-white p-10 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><h2 className="mt-4 text-2xl font-black">Candidatura recebida</h2><p className="mt-2 text-sm text-[#626866]">Seu cadastro entrou no processo seletivo. A empresa fará os próximos contatos pelos canais informados.</p></section> : selectedJob ? <section className="rounded-3xl border bg-white p-6 sm:p-8"><button onClick={() => { setSelectedJob(null); setError(''); }} className="text-sm text-[#D98C32]">← Ver todas as vagas</button><h2 className="mt-4 text-2xl font-black">{selectedJob.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-[#626866]">{selectedJob.description}</p>{selectedJob.requirements && <div className="mt-5"><h3 className="font-bold">Requisitos</h3><p className="mt-1 whitespace-pre-wrap text-sm text-[#626866]">{selectedJob.requirements}</p></div>}<form onSubmit={submit} onFocus={trackApplicationStarted} className="mt-7 grid gap-4 border-t pt-6 sm:grid-cols-2">{error && <p role="alert" className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="text-sm font-semibold">Nome completo<input required maxLength={160} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold">E-mail<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold">Telefone<input maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold">LinkedIn<input type="url" maxLength={500} value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="text-sm font-semibold sm:col-span-2">Apresentação<textarea rows={4} maxLength={3000} value={form.coverLetter} onChange={(e) => setForm({ ...form, coverLetter: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5" /></label><label className="flex gap-2 text-sm sm:col-span-2"><input required type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /><span>Autorizo o tratamento destes dados para este processo seletivo.</span></label><div className="sm:col-span-2"><Button type="submit" disabled={submitting || !form.consent}>{submitting ? 'Enviando…' : 'Enviar candidatura'}</Button></div></form></section> : <section className="grid gap-4 md:grid-cols-2">{site.talent_jobs.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center md:col-span-2"><BriefcaseBusiness className="mx-auto h-10 w-10 text-[#D98C32]" /><p className="mt-3 font-bold">Nenhuma vaga aberta agora</p></div> : site.talent_jobs.map((job) => <article key={job.id} className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-black">{job.title}</h2><p className="mt-2 flex items-center gap-1 text-sm text-[#626866]"><MapPin className="h-4 w-4" /> {job.location || 'Local a definir'} · {job.work_model || 'modelo a definir'}</p><p className="mt-4 line-clamp-3 text-sm text-[#626866]">{job.description}</p><Button className="mt-5" onClick={() => setSelectedJob(job)}>Ver vaga e candidatar</Button></article>)}</section>}</>}</div></main>;
}
