import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, MessageSquare, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { captureAnalytics } from '../../lib/analytics';
import { captureClientException } from '../../lib/observability';

type Channel = {
  channel_name: string; introduction?: string; instructions?: string; allows_anonymous: boolean; allows_identified: boolean;
  categories: Array<{ id: string; slug: string; name: string; description?: string }>;
  units: Array<{ id: string; name: string }>;
};
type Tracking = { protocol: string; status: string; created_at: string; closed_at?: string; messages: Array<{ id: string; author_type: string; body: string; created_at: string }> };

export function IntegrityChannelPage({ slug }: { slug: string }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [mode, setMode] = useState<'report' | 'track'>('report');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ protocol: string; access_secret: string } | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({ reporter_mode: 'anonymous', category: '', unit_id: '', subject: '', description: '', occurred_at: '', name: '', email: '', phone: '' });
  const [credentials, setCredentials] = useState({ protocol: '', secret: '' });
  const [reply, setReply] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await (supabase as any).rpc('get_integrity_channel', { p_channel_slug: slug });
        if (response.error) throw response.error;
        if (!response.data) throw new Error('not_found');
        if (!active) return;
        setChannel(response.data);
        setForm((current) => ({ ...current, reporter_mode: response.data.allows_anonymous ? 'anonymous' : 'identified', category: response.data.categories?.[0]?.slug || '' }));
      } catch (exception) {
        captureClientException(exception, { operation: 'integrity_channel_load' });
        if (active) setError('Canal não encontrado, pausado ou indisponível.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [slug]);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await (supabase as any).rpc('submit_integrity_report_v2', {
        p_channel_slug: slug, p_category_slug: form.category, p_reporter_mode: form.reporter_mode,
        p_subject: form.subject, p_description: form.description, p_occurred_at: form.occurred_at || null,
        p_unit_id: form.unit_id || null, p_identity: form.reporter_mode === 'identified' ? { name: form.name, email: form.email, phone: form.phone } : null,
      });
      if (response.error || !response.data) throw response.error || new Error('empty_response');
      setResult(response.data);
      captureAnalytics('report_submitted', { module: 'integrity', status: 'submitted', source: 'anonymous_channel', reporter_mode: form.reporter_mode });
    } catch (exception) {
      captureClientException(exception, { operation: 'integrity_report_submit' });
      setError('Não foi possível enviar o relato. Revise os campos e tente novamente.');
    } finally { setBusy(false); }
  }

  async function loadTracking(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setTracking(null);
    try {
      const response = await (supabase as any).rpc('read_integrity_report_v2', { p_protocol: credentials.protocol, p_access_secret: credentials.secret });
      if (response.error || !response.data) throw response.error || new Error('invalid_credentials');
      setTracking(response.data);
    } catch {
      setError('Protocolo ou chave inválidos. Por segurança, verifique os dois dados.');
    } finally { setBusy(false); }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault(); if (!reply.trim()) return; setBusy(true); setError('');
    try {
      const response = await (supabase as any).rpc('post_integrity_reporter_message', { p_protocol: credentials.protocol, p_access_secret: credentials.secret, p_body: reply });
      if (response.error) throw response.error;
      setReply('');
      await loadTracking({ preventDefault() {} } as React.FormEvent);
    } catch { setError('Não foi possível enviar a mensagem. Tente novamente.'); setBusy(false); }
  }

  if (loading) return <main className="min-h-screen bg-[#F6F5F2] px-4 py-10" aria-busy="true"><div className="mx-auto max-w-3xl space-y-6"><Skeleton className="mx-auto h-16 w-16 rounded-full" /><Skeleton className="mx-auto h-9 w-72" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-[420px] w-full rounded-2xl" /></div></main>;
  if (!channel) return <main className="flex min-h-screen items-center justify-center bg-[#F6F5F2] p-6"><div role="alert" className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center text-red-700">{error}</div></main>;

  return <main className="min-h-screen bg-[#F6F5F2] px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm"><ShieldCheck className="h-8 w-8 text-[#3457D5]" /></div><h1 className="text-3xl font-bold text-[#202322]">{channel.channel_name}</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#626866]">{channel.introduction}</p></header>
      <nav aria-label="Ações do canal" className="grid grid-cols-2 rounded-xl border border-[#DDD8CF] bg-white p-1">
        <button onClick={() => { setMode('report'); setError(''); }} className={`rounded-lg px-4 py-3 text-sm font-semibold ${mode === 'report' ? 'bg-[#3457D5] text-white' : 'text-[#626866]'}`}>Fazer um relato</button>
        <button onClick={() => { setMode('track'); setError(''); }} className={`rounded-lg px-4 py-3 text-sm font-semibold ${mode === 'track' ? 'bg-[#3457D5] text-white' : 'text-[#626866]'}`}>Acompanhar relato</button>
      </nav>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {mode === 'report' && result ? <section className="rounded-2xl border border-[#DDD8CF] bg-white p-6 text-center shadow-sm sm:p-8"><ShieldCheck className="mx-auto h-14 w-14 text-emerald-600" /><h2 className="mt-4 text-2xl font-bold">Relato recebido</h2><p className="mt-2 text-sm text-[#626866]">Guarde os dois dados abaixo. A chave é exibida apenas agora e não pode ser recuperada.</p><div className="mt-6 space-y-4 rounded-xl bg-[#F6F5F2] p-5 text-left"><Credential label="Protocolo" value={result.protocol} visible /><Credential label="Chave de acompanhamento" value={result.access_secret} visible={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div><Button className="mt-6 w-full" onClick={() => { setCredentials({ protocol: result.protocol, secret: result.access_secret }); setMode('track'); setResult(null); }}>Acompanhar agora</Button></section> : mode === 'report' && <form onSubmit={submitReport} onFocus={() => { if (!startedRef.current) { startedRef.current = true; captureAnalytics('report_started', { module: 'integrity', source: 'anonymous_channel' }); } }} className="space-y-6 rounded-2xl border border-[#DDD8CF] bg-white p-6 shadow-sm sm:p-8">
        <fieldset><legend className="mb-3 text-sm font-bold">Como deseja relatar?</legend><div className="grid gap-3 sm:grid-cols-2">{channel.allows_anonymous && <ModeOption checked={form.reporter_mode === 'anonymous'} onChange={() => setForm({ ...form, reporter_mode: 'anonymous' })} title="Anônimo" description="Não solicitaremos sua identificação." />}{channel.allows_identified && <ModeOption checked={form.reporter_mode === 'identified'} onChange={() => setForm({ ...form, reporter_mode: 'identified' })} title="Identificado" description="Seus dados ficam separados e protegidos." />}</div></fieldset>
        <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">O protocolo sozinho não permite acesso. Não inclua dados pessoais desnecessários. O anonimato depende também das informações que você escolher escrever.</p>
        <Field label="Categoria"><select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]"><option value="">Selecione</option>{channel.categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></Field>
        {channel.units.length > 0 && <Field label="Unidade ou departamento"><select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]"><option value="">Não informar</option>{channel.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
        <Field label="Assunto"><Input required minLength={3} maxLength={160} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
        <Field label="Descrição detalhada"><textarea required minLength={20} maxLength={20000} rows={7} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]" placeholder="Descreva o ocorrido, quando aconteceu e outras informações importantes." /></Field>
        <Field label="Data aproximada do ocorrido"><Input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></Field>
        {form.reporter_mode === 'identified' && <div className="grid gap-4 rounded-xl border border-[#DDD8CF] p-4 sm:grid-cols-2"><Field label="Nome"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div>}
        {channel.instructions && <p className="text-xs leading-5 text-[#626866]">{channel.instructions}</p>}
        <Button type="submit" disabled={busy} className="h-12 w-full bg-[#3457D5] text-white">{busy ? 'Enviando…' : 'Enviar relato'} <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </form>}

      {mode === 'track' && <section className="space-y-5 rounded-2xl border border-[#DDD8CF] bg-white p-6 shadow-sm sm:p-8"><form onSubmit={loadTracking} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field label="Protocolo"><Input required value={credentials.protocol} onChange={(e) => setCredentials({ ...credentials, protocol: e.target.value.toUpperCase() })} /></Field><Field label="Chave de acompanhamento"><Input required type="password" value={credentials.secret} onChange={(e) => setCredentials({ ...credentials, secret: e.target.value })} /></Field><Button type="submit" disabled={busy} className="h-10 bg-[#3457D5] text-white">Consultar</Button></form>{tracking && <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F6F5F2] p-4"><div><div className="font-mono font-bold">{tracking.protocol}</div><div className="text-xs text-[#626866]">Enviado em {new Date(tracking.created_at).toLocaleDateString('pt-BR')}</div></div><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{statusLabel(tracking.status)}</span></div><div className="space-y-3">{tracking.messages.map((message) => <article key={message.id} className={`rounded-xl p-4 text-sm ${message.author_type === 'reporter' ? 'ml-8 bg-[#F6F5F2]' : 'mr-8 border border-blue-100 bg-blue-50'}`}><div className="mb-2 text-xs font-bold text-[#626866]">{message.author_type === 'reporter' ? 'Você' : 'Comitê responsável'} · {new Date(message.created_at).toLocaleString('pt-BR')}</div><p className="whitespace-pre-wrap leading-6">{message.body}</p></article>)}</div>{!['closed', 'archived'].includes(tracking.status) && <form onSubmit={sendReply} className="space-y-3 border-t pt-5"><Field label="Complementar informações"><textarea required minLength={2} maxLength={5000} rows={4} value={reply} onChange={(e) => setReply(e.target.value)} className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3457D5]" /></Field><Button type="submit" disabled={busy}><MessageSquare className="mr-2 h-4 w-4" />Enviar mensagem</Button></form>}</div>}</section>}
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-[#202322]">{label}<div className="mt-2">{children}</div></label>; }
function ModeOption({ checked, onChange, title, description }: { checked: boolean; onChange: () => void; title: string; description: string }) { return <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${checked ? 'border-[#3457D5] bg-blue-50' : 'border-[#DDD8CF]'}`}><input type="radio" checked={checked} onChange={onChange} className="mt-1" /><span><strong className="block">{title}</strong><span className="text-xs text-[#626866]">{description}</span></span></label>; }
function Credential({ label, value, visible, onToggle }: { label: string; value: string; visible: boolean; onToggle?: () => void }) { return <div><div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div><div className="mt-1 flex items-center justify-between gap-3"><code className="break-all text-sm font-bold">{visible ? value : '••••••••••••••••'}</code>{onToggle && <button type="button" aria-label={visible ? 'Ocultar chave' : 'Mostrar chave'} onClick={onToggle}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}</div></div>; }
function statusLabel(status: string) { return ({ received: 'Recebido', triage: 'Em triagem', investigation: 'Em investigação', waiting_information: 'Aguardando informação', decision: 'Em decisão', closed: 'Encerrado', reopened: 'Reaberto', archived: 'Arquivado' } as Record<string, string>)[status] || status; }
