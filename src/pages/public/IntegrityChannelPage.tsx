import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { captureAnalytics } from '../../lib/analytics';
import { captureClientException } from '../../lib/observability';
import { Skeleton } from '../../components/ui/Skeleton';

interface Category {
  category_slug: string;
  category_name: string;
}

export function IntegrityChannelPage({ slug }: { slug: string }) {
  const [channelName, setChannelName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState<{ protocol: string; access_secret: string } | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    async function loadForm() {
      try {
        const { data, error } = await (supabase as any).rpc('get_integrity_form', { p_channel_slug: slug } as any);
        if (error) throw error;
        if (!data || data.length === 0) {
          setError("Canal não encontrado ou inativo.");
          return;
        }
        setChannelName(data[0].channel_name);
        setCategories(data);
        if (data.length > 0) setSelectedCategory(data[0].category_slug);
      } catch (err) {
        captureClientException(err, { operation: 'integrity_form_load' });
        setError("Erro ao carregar o canal de integridade.");
      } finally {
        setIsLoading(false);
      }
    }
    loadForm();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError('');
    try {
      const { data, error } = await (supabase as any).rpc('submit_integrity_report', {
        p_channel_slug: slug,
        p_category_slug: selectedCategory,
        p_description: description,
        p_occurred_at: occurredAt || null
      } as any);

      if (error) throw error;
      captureAnalytics('report_submitted', { module: 'integrity', status: 'submitted', source: 'anonymous_channel' });
      setReportResult(data);
    } catch (err) {
      captureClientException(err, { operation: 'integrity_report_submit' });
      setSubmissionError('Não foi possível enviar o relato agora. Nenhum protocolo foi criado; tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <main className="min-h-screen bg-[#F6F5F2] px-4 py-12" aria-busy="true"><div className="mx-auto max-w-2xl space-y-8"><div className="flex flex-col items-center gap-3"><Skeleton className="h-16 w-16 rounded-full" /><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-4 w-48" /></div><div className="space-y-6 rounded-2xl border border-[#DDD8CF] bg-white p-6 sm:p-8"><Skeleton className="h-10 w-full" /><Skeleton className="h-36 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /></div></div></main>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-center"><p className="text-red-500 font-bold">{error}</p></div>;
  }

  if (reportResult) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-lg w-full text-center">
          <ShieldCheck className="w-16 h-16 text-[#1F8A63] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#202322] mb-2">Relato Enviado com Sucesso</h2>
          <p className="text-sm text-[#626866] mb-6">Guarde suas credenciais de acesso em um local seguro. Elas não poderão ser recuperadas se você perdê-las.</p>
          
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left space-y-4 mb-6">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Protocolo</p>
              <p className="font-mono text-[#202322] font-bold text-lg">{reportResult.protocol}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Chave de Acesso (Segredo)</p>
              <p className="font-mono text-[#202322] font-bold text-lg break-all">{reportResult.access_secret}</p>
            </div>
          </div>

          <Button onClick={() => window.location.hash = "#/"} className="w-full">
            Voltar para o site
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F2] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm mb-4">
            <ShieldCheck className="w-8 h-8 text-[#3457D5]" />
          </div>
          <h1 className="text-3xl font-bold text-[#202322] mb-2">{channelName}</h1>
          <p className="text-gray-500">Canal de Denúncias e Relatos</p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#DDD8CF]/60">
          <form onSubmit={handleSubmit} className="space-y-6" onFocus={() => {
            if (startedRef.current) return;
            startedRef.current = true;
            captureAnalytics('report_started', { module: 'integrity', source: 'anonymous_channel' });
          }}>
            {submissionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submissionError}</p>}
            <div>
              <label className="block text-sm font-bold text-[#202322] mb-2">Categoria do Relato</label>
              <select 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3457D5] focus:bg-white"
              >
                {categories.map(c => (
                  <option key={c.category_slug} value={c.category_slug}>{c.category_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#202322] mb-2">Descrição detalhada</label>
              <textarea 
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={6}
                placeholder="Descreva o ocorrido com o máximo de detalhes possível..."
                className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3457D5] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#202322] mb-2">Data do Ocorrido (Aproximada)</label>
              <Input 
                type="date" 
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
                required
              />
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-[#3457D5] hover:bg-[#3457D5]/90 text-white shadow-sm">
                {isSubmitting ? "Enviando..." : "Enviar Relato Anonimamente"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
