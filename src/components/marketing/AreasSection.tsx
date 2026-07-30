import React from "react";
import { motion } from "motion/react";
import { Building2, Shield, Users, Briefcase, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

export function AreasSection() {
  const areas = [
    {
      title: "Recursos Humanos",
      description: "Centralize comunicados, distribuição de holerites e protocolos de leitura de documentos normativos.",
      icon: <Users className="w-5 h-5 text-[#16897A]" />,
      bgColor: "bg-[#E4F5F1]"
    },
    {
      title: "Compliance & Jurídico",
      description: "Gerencie o Canal de Denúncias garantindo sigilo, rastreabilidade e conformidade com a LGPD.",
      icon: <Shield className="w-5 h-5 text-[#3457D5]" />,
      bgColor: "bg-[#E9EDFF]"
    },
    {
      title: "Aquisição de Talentos",
      description: "Estruture sua página de carreiras e automatize a triagem no funil de candidatos.",
      icon: <Briefcase className="w-5 h-5 text-[#D98C32]" />,
      bgColor: "bg-[#FFF1DD]"
    },
    {
      title: "Alta Gestão",
      description: "Tenha visão consolidada dos riscos, turnover e andamento das vagas em um único painel.",
      icon: <Building2 className="w-5 h-5 text-[#B66E45]" />,
      bgColor: "bg-[#F6EBE5]"
    }
  ];

  return (
    <section id="areas" className="py-24 bg-white border-b border-[#DDD8CF]/30 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="max-w-xl"
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight mb-6">
              Uma plataforma unificada,<br />
              <span className="text-[#B66E45]">múltiplos benefícios</span>
            </h2>
            <p className="text-lg text-[#626866] mb-8 leading-relaxed">
              Elimine o custo e a complexidade de manter diferentes sistemas departamentais. 
              A Ordum centraliza processos operacionais para diferentes áreas da sua empresa com segurança e conformidade nativas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-[#202322]">100%</span>
                <span className="text-xs font-bold text-[#626866] uppercase tracking-wider mt-1">Conformidade LGPD</span>
              </div>
              <div className="hidden sm:block w-px bg-[#DDD8CF] mx-4"></div>
              <div className="flex flex-col">
                <span className="text-3xl font-black text-[#202322]">Único</span>
                <span className="text-xs font-bold text-[#626866] uppercase tracking-wider mt-1">Portal do Colaborador</span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {areas.map((area, index) => (
              <motion.div
                key={area.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl border border-[#DDD8CF]/60 bg-[#FAF8F3]/50 hover:bg-white hover:shadow-md transition-all duration-300 group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${area.bgColor}`}>
                  {area.icon}
                </div>
                <h3 className="text-[15px] font-bold text-[#202322] mb-2 group-hover:text-[#B66E45] transition-colors">
                  {area.title}
                </h3>
                <p className="text-xs text-[#626866] leading-relaxed">
                  {area.description}
                </p>
              </motion.div>
            ))}
          </div>
          
        </div>
      </div>
    </section>
  );
}
