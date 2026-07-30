import React from "react";
import { Lock, FileCheck, Shield, Key } from "lucide-react";

export function SecuritySection() {
  const securityFeatures = [
    {
      icon: <Lock className="w-5 h-5 text-[#B66E45]" />,
      title: "Proteção de dados",
      desc: "Atenção às boas práticas de proteção de dados e desenvolvimento de software."
    },
    {
      icon: <Key className="w-5 h-5 text-[#B66E45]" />,
      title: "Controle de acesso",
      desc: "Autenticação em ambiente próprio com perfis de acesso quando configurados."
    },
    {
      icon: <Shield className="w-5 h-5 text-[#B66E45]" />,
      title: "Organização corporativa",
      desc: "Estrutura preparada para organização por empresa no mesmo ecossistema."
    },
    {
      icon: <FileCheck className="w-5 h-5 text-[#B66E45]" />,
      title: "Gestão de eventos",
      desc: "Histórico e status estruturados para acompanhamento operacional e visibilidade."
    }
  ];

  return (
    <section id="seguranca" className="scroll-mt-24 py-16 md:py-24 bg-[#FAF8F3] border-b border-[#DDD8CF]/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight">
            Estrutura para operar com controle.
          </h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityFeatures.map((feat, idx) => (
            <div key={idx} className="p-6 bg-white rounded-2xl border border-[#DDD8CF]/60 shadow-sm flex flex-col hover:border-[#B66E45]/30 transition-colors">
               <div className="mb-4 p-2.5 bg-[#F3EEE4] w-fit rounded-xl">{feat.icon}</div>
               <h3 className="text-base font-bold text-[#202322] mb-2">{feat.title}</h3>
               <p className="text-sm text-[#626866] leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
