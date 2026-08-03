import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Calendar } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { marketingService } from "../../services/marketing";
import { solutionsData } from "../../lib/solutions";
import { captureAnalytics } from '../../lib/analytics';
import { captureClientException } from '../../lib/observability';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: string;
}

export function DemoModal({ isOpen, onClose, defaultModule = "all" }: DemoModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [module, setModule] = useState(defaultModule);
  const [submissionError, setSubmissionError] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setModule(defaultModule);
      setSubmitted(false);
      setIsSubmitting(false);
      setSubmissionError('');
      setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 10);
    }
  }, [isOpen, defaultModule]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await marketingService.submitLead({
        name,
        email,
        company,
        phone,
        interests: module === 'all' ? solutionsData.map(s => s.demoInterest) : [module],
        consent: true
      });
      captureAnalytics('demo_requested', { module, source: 'marketing_modal' });
      setSubmitted(true);
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 10);
    } catch (err) {
      captureClientException(err, { operation: 'demo_request' });
      setSubmissionError('Não foi possível enviar agora. Revise os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#151817]/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        role="dialog" 
        className="relative w-full max-w-lg rounded-2xl border border-[#DDD8CF] bg-white p-6 md:p-8 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-[#626866] hover:text-[#202322] rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#B66E45]"
        >
          <X className="w-5 h-5" />
        </button>
        
        {!submitted ? (
          <>
            <div className="mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3EEE4] text-[#B66E45] mb-4 shadow-sm">
                <Calendar className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[#202322]">
                Agende uma demonstração
              </h2>
              <p className="mt-2 text-sm text-[#626866]">
                Descubra como a Ordum pode organizar e centralizar os processos corporativos da sua empresa.
              </p>
            </div>
            
          <form onSubmit={handleSubmit} className="space-y-4">
            {submissionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submissionError}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lead-name" className="block text-[11px] font-bold text-[#202322] mb-1.5 uppercase tracking-wider">
                    Nome completo
                  </label>
                  <Input
                    id="lead-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    ref={initialFocusRef}
                  />
                </div>
                <div>
                  <label htmlFor="lead-email" className="block text-[11px] font-bold text-[#202322] mb-1.5 uppercase tracking-wider">
                    E-mail corporativo
                  </label>
                  <Input
                    id="lead-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@empresa.com.br"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lead-company" className="block text-[11px] font-bold text-[#202322] mb-1.5 uppercase tracking-wider">
                    Empresa
                  </label>
                  <Input
                    id="lead-company"
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label htmlFor="lead-phone" className="block text-[11px] font-bold text-[#202322] mb-1.5 uppercase tracking-wider">
                    Telefone
                  </label>
                  <Input
                    id="lead-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lead-module" className="block text-[11px] font-bold text-[#202322] mb-1.5 uppercase tracking-wider">
                  Área de maior interesse
                </label>
                <select
                  id="lead-module"
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="w-full rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#B66E45] focus:bg-white"
                >
                  <option value="all">Todas as soluções</option>
                  {solutionsData.map(sol => (
                    <option key={sol.id} value={sol.demoInterest}>{sol.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting} variant="default" className="w-full h-12 text-base shadow-sm">
                  {isSubmitting ? "Enviando..." : "Solicitar contato"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="py-8 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F8F2] text-[#16897A] shadow-sm border border-[#16897A]/20">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-[#202322] mb-3">
              Solicitação registrada com sucesso.
            </h2>
            <p className="text-sm text-[#626866] mb-8 max-w-[400px] mx-auto leading-relaxed">
              Nossa equipe entrará em contato em breve para apresentar a plataforma.
            </p>
            <Button ref={closeButtonRef} variant="default" onClick={handleReset} className="w-full h-12 shadow-sm">
              Voltar ao site
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
