import React, { useState } from "react";
import { Factory, ShoppingBag, Briefcase, HeartPulse, Landmark, ArrowRight, Shield, RefreshCw } from "lucide-react";

export function SegmentsSection() {
  const [activeIdx, setActiveIdx] = useState(0);

  const segments = [
    {
      icon: <Factory className="w-5 h-5" />,
      title: "Indústria",
      challenge: "Turnover elevado de operários, conformidade técnica rigorosa e necessidade de comunicação direta e segura no chão de fábrica.",
      solution: "Canal de Integridade anônimo, canais de comunicados diretos em quiosques de produção e admissão rápida de novos funcionários."
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      title: "Varejo",
      challenge: "Alta rotatividade sazonal de funcionários, dispersão geográfica de lojas e necessidade de divulgar políticas internas em tempo real.",
      solution: "Portal de Pessoas otimizado para celulares, protocolo automático de leitura de novos comunicados e atração de talentos automatizada."
    },
    {
      icon: <Briefcase className="w-5 h-5" />,
      title: "Serviços",
      challenge: "Falta de histórico de solicitações, processos de compliance difusos e canais de ética expostos ou improvisados.",
      solution: "Sistema unificado de chamados e solicitações com comprovante digital, canal de ética com proteção de dados e histórico organizado."
    },
    {
      icon: <HeartPulse className="w-5 h-5" />,
      title: "Saúde",
      challenge: "Complexidade de escalas, necessidade de sigilo em denúncias e organização de certidões regulatórias.",
      solution: "Assinatura digital de termos, denúncias geridas por comitê e pasta digital corporativa organizada por equipes de plantão."
    },
    {
      icon: <Landmark className="w-5 h-5" />,
      title: "Financeiro",
      challenge: "Pressão de órgãos reguladores para auditorias frequentes, organização de dados e triagem técnica de profissionais.",
      solution: "Trilhas de registros de ações administrativas, etapas organizadas de processos seletivos e proteção no tratamento de dados confidenciais."
    },
  ];

  return (
    <section id="segmentos" className="py-12 md:py-16 bg-[#FAF8F3] border-b border-[#DDD8CF]/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#B66E45] border border-[#D2926D]/30 bg-[#B66E45]/5 px-2.5 py-1 rounded-md">
              Sua Empresa Segura
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#202322] tracking-tight mt-3">
              Estrutura para empresas que não podem mais depender de processos improvisados.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#626866] leading-relaxed max-w-sm lg:pt-6">
            A Ordum unifica a governança de integridade, recursos humanos e contratação em setores com altos desafios operacionais.
          </p>
        </div>

        {/* Interactive Segment Compact Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Side Bar tabs */}
          <div className="lg:col-span-5 flex flex-col gap-1.5 justify-center">
            {segments.map((seg, idx) => {
              const isActive = activeIdx === idx;
              return (
                <button
                  key={idx}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => setActiveIdx(idx)}
                  className={`flex items-center gap-3 w-full p-3.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-white border border-[#DDD8CF]/80 shadow-xs text-[#202322]"
                      : "hover:bg-[#F3EEE4]/50 border border-transparent text-[#626866]"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      isActive ? "bg-[#B66E45] text-white" : "bg-[#F3EEE4] text-[#B66E45]"
                    }`}
                  >
                    {seg.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold tracking-tight">{seg.title}</div>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-all ${
                      isActive ? "translate-x-0.5 opacity-100 text-[#B66E45]" : "opacity-0 -translate-x-1"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Details Card */}
          <div className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-[#DDD8CF]/80 bg-white p-6 sm:p-8 flex flex-col justify-between shadow-xs relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 h-28 w-28 bg-[#B66E45]/5 rounded-bl-full pointer-events-none" />
              
              <div className="space-y-6">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-[#626866]">
                    Desafio do Setor: {segments[activeIdx].title}
                  </span>
                  <p className="text-sm font-medium text-[#202322] mt-2 leading-relaxed">
                    "{segments[activeIdx].challenge}"
                  </p>
                </div>

                <div className="pt-5 border-t border-[#DDD8CF]/30">
                  <div className="flex items-center gap-2 text-[#B66E45] text-xs font-bold mb-2">
                    <Shield className="w-4 h-4 text-[#B66E45]" />
                    <span>Como a Ordum resolve:</span>
                  </div>
                  <p className="text-xs text-[#626866] leading-relaxed">
                    {segments[activeIdx].solution}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between text-[11px] font-bold text-[#B66E45] pt-3 border-t border-[#DDD8CF]/20">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-[#B66E45] animate-spin-slow" />
                  Solução Integridade & Solução Pessoas inclusos
                </span>
                <span className="underline cursor-pointer hover:text-[#202322]">
                  Conhecer detalhes do setor
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
