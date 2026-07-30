import React from "react";
import { motion } from "motion/react";
import { Check, ShieldCheck, Users, Briefcase, ChevronRight, Clock } from "lucide-react";
import { Button } from "../ui/Button";
import { solutionsData } from "../../lib/solutions";

interface SolutionsSectionProps {
  onOpenDemo: (moduleName?: string) => void;
}

export function SolutionsSection({ onOpenDemo }: SolutionsSectionProps) {
  const getIcon = (id: string, className = "w-5 h-5") => {
    switch (id) {
      case "integrity": return <ShieldCheck className={className} />;
      case "people": return <Users className={className} />;
      case "talent": return <Briefcase className={className} />;
      default: return null;
    }
  };

  const activeSolutions = solutionsData.filter(s => s.status === "active");

  return (
    <div id="solucoes" className="bg-white scroll-mt-24">
      {/* Intro Header & Compact View */}
      <section className="py-16 md:py-24 border-b border-[#DDD8CF]/30 bg-[#FAF8F3]/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight mb-4"
            >
              Soluções corporativas
            </motion.h2>
          </div>
          
          {/* Compact View of the 3 Solutions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {activeSolutions.map((sol, index) => (
              <motion.div 
                key={sol.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.1 }}
                className="group relative p-6 sm:p-8 rounded-3xl bg-white border border-[#DDD8CF]/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)] transition-all duration-300"
              >
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: sol.bgColor, color: sol.color }}
                >
                  {getIcon(sol.id, "w-6 h-6")}
                </div>
                <h3 className="text-xl font-bold text-[#202322] mb-3">{sol.name}</h3>
                <p className="text-[13px] text-[#626866] leading-relaxed mb-6 h-10">
                  {sol.shortDescription}
                </p>
                <a 
                  href={sol.anchor}
                  className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors"
                  style={{ color: sol.color }}
                >
                  Saiba mais <ChevronRight className="w-3 h-3" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ordum Integridade - Detailed Section */}
      <section id="integridade" className="py-20 md:py-32 border-b border-[#DDD8CF]/30 overflow-hidden scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            
            {/* Text Content */}
            <motion.div 
              initial={{ opacity: 0, x: -30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.1 }}
              className="lg:col-span-5 flex flex-col"
            >
              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#3457D5] bg-[#E9EDFF] px-3 py-1.5 rounded-lg">
                  ORDUM INTEGRIDADE
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight mb-5 leading-tight">
                Canal 100% anônimo de denúncias.
              </h2>
              <p className="text-base sm:text-lg text-[#626866] leading-relaxed mb-8">
                Receba denúncias sem identificar o relator e acompanhe cada caso por um protocolo seguro.
              </p>
              
              <div className="space-y-4 mb-10">
                {[
                  "Denunciar anonimamente",
                  "Acompanhar por protocolo",
                  "Tratar casos em área restrita"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E9EDFF] text-[#3457D5] mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-[15px] text-[#353938] leading-snug">{item}</span>
                  </div>
                ))}
              </div>
              
              <div>
                <Button onClick={() => onOpenDemo("integrity")} size="lg" className="w-full sm:w-auto bg-[#3457D5] hover:bg-[#263F9F] text-white rounded-xl h-12 px-8 font-semibold shadow-sm">
                  Agendar demonstração
                </Button>
              </div>
            </motion.div>
            
            {/* Mockup */}
            <motion.div 
              initial={{ opacity: 0, x: 30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.1, delay: 0.2 }}
              className="lg:col-span-7"
            >
              <div className="relative w-full rounded-2xl bg-[#F8F9FA] border border-[#DDD8CF]/60 shadow-[0_20px_40px_-15px_rgba(52,87,213,0.15)] overflow-hidden">
                <div className="bg-[#FAF8F3] border-b border-[#DDD8CF]/60 px-4 py-3 flex items-center justify-between">
                   <div className="flex gap-1.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                   </div>
                   <div className="text-[10px] font-semibold text-[#626866] flex items-center gap-2">
                     <ShieldCheck className="w-3 h-3 text-[#3457D5]" />
                     Triagem de Relato
                   </div>
                </div>
                
                <div className="p-5 md:p-8 bg-white h-[380px] flex items-center justify-center">
                   <div className="w-full max-w-sm bg-[#FAF8F3] border border-[#DDD8CF]/60 rounded-xl p-5 shadow-sm relative">
                     <div className="absolute top-4 right-4">
                       <span className="px-2 py-1 bg-red-100 text-red-700 text-[9px] font-bold uppercase rounded">Alto Risco</span>
                     </div>
                     <h3 className="text-sm font-bold text-[#202322] mb-1">Protocolo #PROT-2026-89</h3>
                     <p className="text-[10px] text-[#626866] mb-4">Enviado em 24/10/2026 às 14:32</p>
                     
                     <div className="space-y-3">
                       <div className="p-3 bg-white border border-[#DDD8CF]/50 rounded-lg">
                          <p className="text-[11px] text-[#202322] font-semibold mb-1">Tipo de Desvio</p>
                          <p className="text-[11px] text-[#626866]">Assédio Moral</p>
                       </div>
                       <div className="p-3 bg-white border border-[#DDD8CF]/50 rounded-lg">
                          <p className="text-[11px] text-[#202322] font-semibold mb-1">Descrição</p>
                          <p className="text-[11px] text-[#626866] line-clamp-3">
                            Gostaria de relatar uma conduta inadequada do gerente do departamento comercial. 
                            Durante as reuniões semanais, ele costuma...
                          </p>
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Ordum Pessoas - Detailed Section */}
      <section id="pessoas" className="py-20 md:py-32 border-b border-[#DDD8CF]/30 bg-[#FAF8F3]/20 overflow-hidden scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            
            {/* Mockup Pessoas */}
            <motion.div 
              initial={{ opacity: 0, x: -30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.1, delay: 0.2 }}
              className="lg:col-span-7 order-2 lg:order-1"
            >
              <div className="relative w-full rounded-2xl bg-white border border-[#DDD8CF]/60 shadow-[0_20px_40px_-15px_rgba(22,137,122,0.15)] overflow-hidden">
                <div className="bg-[#FAF8F3] border-b border-[#DDD8CF]/60 px-4 py-3 flex items-center justify-between">
                   <div className="flex gap-1.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                   </div>
                   <div className="text-[10px] font-semibold text-[#626866] flex items-center gap-2">
                     <Users className="w-3 h-3 text-[#16897A]" />
                     Portal do Colaborador
                   </div>
                </div>
                
                <div className="p-5 md:p-6 bg-white h-[380px] flex flex-col">
                  {/* Mock Header inside app */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#DDD8CF]/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#E4F5F1] text-[#16897A] font-bold flex items-center justify-center border border-[#16897A]/20">
                        AB
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#202322]">Olá, Ana Beatriz</h4>
                        <p className="text-[10px] text-[#626866]">Analista</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                     <div className="bg-[#FAF8F3] border border-[#DDD8CF]/60 rounded-xl p-4 flex flex-col justify-between">
                        <div className="w-8 h-8 rounded-lg bg-white border border-[#DDD8CF] flex items-center justify-center text-[#202322] mb-2">
                           <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#202322]">Holerite Disponível</p>
                          <p className="text-[9px] text-[#626866]">Referência: Outubro/2023</p>
                        </div>
                     </div>
                     <div className="bg-[#FAF8F3] border border-[#DDD8CF]/60 rounded-xl p-4 flex flex-col justify-between">
                        <div className="w-8 h-8 rounded-lg bg-white border border-[#DDD8CF] flex items-center justify-center text-[#16897A] mb-2">
                           <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#202322]">Solicitar Férias</p>
                          <p className="text-[9px] text-[#626866]">Agende com seu gestor</p>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Text Content */}
            <motion.div 
              initial={{ opacity: 0, x: 30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.1 }}
              className="lg:col-span-5 order-1 lg:order-2 flex flex-col"
            >
              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#16897A] bg-[#E4F5F1] px-3 py-1.5 rounded-lg">
                  ORDUM PESSOAS
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight mb-5 leading-tight">
                O Portal do Colaborador.
              </h2>
              <p className="text-base sm:text-lg text-[#626866] leading-relaxed mb-8">
                Holerites, avisos, documentos, solicitações e contato com o RH em um só lugar.
              </p>
              
              <div className="space-y-4 mb-10">
                {[
                  "Consultar holerite",
                  "Acompanhar avisos e documentos",
                  "Solicitar atendimento ao RH"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E4F5F1] text-[#16897A] mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-[15px] text-[#353938] leading-snug">{item}</span>
                  </div>
                ))}
              </div>
              
              <div>
                <Button onClick={() => onOpenDemo("people")} size="lg" className="w-full sm:w-auto bg-[#16897A] hover:bg-[#10685D] text-white rounded-xl h-12 px-8 font-semibold shadow-sm">
                  Agendar demonstração
                </Button>
              </div>
            </motion.div>
            
          </div>
        </div>
      </section>

      {/* Ordum Talentos - Detailed Section */}
      <section id="talentos" className="py-20 md:py-32 border-b border-[#DDD8CF]/30 overflow-hidden scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            
            {/* Text Content */}
            <motion.div 
              initial={{ opacity: 0, x: -30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.1 }}
              className="lg:col-span-5 flex flex-col"
            >
              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D98C32] bg-[#FFF1DD] px-3 py-1.5 rounded-lg">
                  ORDUM TALENTOS
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight mb-5 leading-tight">
                Anuncie vagas e conduza o processo seletivo.
              </h2>
              <p className="text-base sm:text-lg text-[#626866] leading-relaxed mb-8">
                Publique oportunidades, receba currículos, aplique testes e acompanhe candidatos por etapas.
              </p>
              
              <div className="space-y-4 mb-10">
                {[
                  "Publicar vagas",
                  "Receber currículos e testes",
                  "Organizar o processo seletivo"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF1DD] text-[#D98C32] mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-[15px] text-[#353938] leading-snug">{item}</span>
                  </div>
                ))}
              </div>
              
              <div>
                <Button onClick={() => onOpenDemo("talent")} size="lg" className="w-full sm:w-auto bg-[#D98C32] hover:bg-[#AC6C24] text-white rounded-xl h-12 px-8 font-semibold shadow-sm">
                  Agendar demonstração
                </Button>
              </div>
            </motion.div>
            
            {/* Mockup Talentos */}
            <motion.div 
              initial={{ opacity: 0, x: 30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.1, delay: 0.2 }}
              className="lg:col-span-7"
            >
              <div className="relative w-full rounded-2xl bg-[#F8F9FA] border border-[#DDD8CF]/60 shadow-[0_20px_40px_-15px_rgba(217,140,50,0.15)] overflow-hidden">
                <div className="bg-[#FAF8F3] border-b border-[#DDD8CF]/60 px-4 py-3 flex items-center justify-between">
                   <div className="flex gap-1.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                     <div className="w-2.5 h-2.5 rounded-full bg-[#DDD8CF]" />
                   </div>
                   <div className="text-[10px] font-semibold text-[#626866] flex items-center gap-2">
                     <Briefcase className="w-3 h-3 text-[#D98C32]" />
                     Pipeline de Seleção
                   </div>
                </div>
                
                <div className="p-5 md:p-6 bg-[#FDFDFD] h-[380px] flex flex-col">
                   {/* Vaga Header */}
                   <div className="flex items-center justify-between mb-5">
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <h4 className="text-sm font-bold text-[#202322]">Desenvolvedor Front-end</h4>
                         <span className="text-[9px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Aberta</span>
                       </div>
                       <p className="text-[10px] text-[#626866]">Híbrido</p>
                     </div>
                   </div>
                   
                   {/* Fake Kanban */}
                   <div className="flex-1 flex gap-4 overflow-hidden pb-2 overflow-x-auto scrollbar-hide">
                      <div className="w-[180px] shrink-0 flex flex-col gap-3">
                         <div className="h-8 bg-[#FAF8F3] border border-[#DDD8CF]/60 rounded-lg px-3 flex items-center justify-between font-medium text-[11px] text-[#353938]">
                           <span>Triagem</span>
                           <span className="bg-white rounded px-1.5 text-[10px] shadow-sm">2</span>
                         </div>
                         <div className="bg-white border border-[#DDD8CF]/60 shadow-sm rounded-xl p-3">
                           <p className="text-[11px] font-bold text-[#202322] mb-1">Marcelo Souza</p>
                           <p className="text-[9px] text-[#626866]">React, TypeScript</p>
                         </div>
                         <div className="bg-white border border-[#DDD8CF]/60 shadow-sm rounded-xl p-3">
                           <p className="text-[11px] font-bold text-[#202322] mb-1">Camila Dias</p>
                           <p className="text-[9px] text-[#626866]">Vue, React</p>
                         </div>
                      </div>
                      
                      <div className="w-[180px] shrink-0 flex flex-col gap-3">
                         <div className="h-8 bg-[#FAF8F3] border border-[#DDD8CF]/60 rounded-lg px-3 flex items-center justify-between font-medium text-[11px] text-[#353938]">
                           <span>Entrevista</span>
                           <span className="bg-white rounded px-1.5 text-[10px] shadow-sm">1</span>
                         </div>
                         <div className="bg-white border-2 border-[#D98C32]/30 shadow-sm rounded-xl p-3">
                           <p className="text-[11px] font-bold text-[#202322] mb-1">Lucas Mendes</p>
                           <div className="flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-2 border border-amber-100 w-fit">
                             <Clock className="w-2.5 h-2.5" /> 14:00
                           </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

    </div>
  );
}
