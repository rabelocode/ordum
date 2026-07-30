import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, ShieldCheck, Users, Briefcase, MousePointer2, CheckCircle2 } from "lucide-react";

export function ProductTourSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const steps = [
    {
      id: "access",
      title: "1. Acesso personalizado",
      desc: "Autenticação em um ambiente com a identidade da sua empresa.",
      icon: <LayoutDashboard className="w-4 h-4" />
    },
    {
      id: "unified",
      title: "2. Ambiente unificado",
      desc: "Visualize as soluções contratadas, pendências e atalhos em uma única tela.",
      icon: <Users className="w-4 h-4" />
    },
    {
      id: "module",
      title: "3. Solução necessária",
      desc: "Acesse rapidamente a solução que precisa, sem trocar de plataforma.",
      icon: <ShieldCheck className="w-4 h-4" />
    },
    {
      id: "track",
      title: "4. Acompanhe atividades",
      desc: "Gerencie chamados, documentos e indicadores no seu workspace.",
      icon: <Briefcase className="w-4 h-4" />
    }
  ];

  // Auto-advance
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <section className="py-16 md:py-24 bg-white border-t border-[#DDD8CF]/60 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[#B66E45] bg-[#B66E45]/10 px-3 py-1 rounded-full">
            VEJA A ORDUM EM AÇÃO
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#202322] mt-3">
            Como a Ordum organiza a operação.
          </h2>
          <p className="text-base text-[#626866] mt-2">
            Acompanhe o fluxo de um gestor dentro de um único ambiente de trabalho.
          </p>
        </motion.div>

        <div 
          className="flex flex-col lg:flex-row gap-8 items-start"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left Column: Steps */}
          <div className="w-full lg:w-1/3 flex flex-col gap-2">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(idx)}
                className={`text-left p-4 rounded-xl transition-all duration-300 relative ${
                  activeStep === idx 
                    ? "bg-[#FAF8F3] border border-[#DDD8CF]/80 shadow-sm" 
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                {activeStep === idx && (
                  <motion.div 
                    layoutId="activeStep" 
                    className="absolute inset-0 rounded-xl border-2 border-[#B66E45]/20 pointer-events-none"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                    activeStep === idx ? "bg-[#B66E45] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {step.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${activeStep === idx ? "text-[#202322]" : "text-gray-600"}`}>
                      {step.title}
                    </h3>
                    <AnimatePresence>
                      {activeStep === idx && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-[#626866] mt-1.5 leading-relaxed pr-2">
                            {step.desc}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right Column: Visualizer */}
          <div className="w-full lg:w-2/3 relative h-[400px] sm:h-[450px] lg:h-[500px] bg-[#FAF8F3] rounded-2xl border border-[#DDD8CF]/80 shadow-inner overflow-hidden flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.97 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-2xl"
              >
                {activeStep === 0 && <MockupLogin />}
                {activeStep === 1 && <MockupWorkspace />}
                {activeStep === 2 && <MockupModuleSelection />}
                {activeStep === 3 && <MockupDashboard />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// Sub-components for Mockups
function MockupLogin() {
  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-lg border border-[#DDD8CF]/60 overflow-hidden">
      <div className="p-6 text-center border-b border-[#DDD8CF]/40 bg-[#FAF8F3]">
        <div className="w-12 h-12 bg-gray-200 rounded-lg mx-auto mb-3 flex items-center justify-center">
          <span className="font-bold text-gray-500">CX</span>
        </div>
        <h3 className="font-bold text-sm text-[#202322]">ClienteX Login</h3>
        <p className="text-[10px] text-gray-500 mt-1">Ambiente demonstrativo</p>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-2 w-16 bg-gray-200 rounded" />
          <div className="h-9 w-full bg-gray-50 border border-gray-200 rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-12 bg-gray-200 rounded" />
          <div className="h-9 w-full bg-gray-50 border border-gray-200 rounded-lg" />
        </div>
        <div className="pt-2">
          <div className="h-10 w-full bg-[#B66E45] rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-white">Acessar Workspace</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupWorkspace() {
  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-[#DDD8CF]/60 overflow-hidden flex h-[320px]">
      <div className="w-16 sm:w-48 bg-[#121413] border-r border-[#DDD8CF]/70 flex flex-col p-3">
        <div className="h-8 w-8 sm:w-full bg-white/10 rounded-lg mb-6" />
        <div className="space-y-2 flex-1">
          <div className="h-8 w-full bg-white/20 rounded-lg" />
          <div className="h-8 w-full bg-white/5 rounded-lg" />
          <div className="h-8 w-full bg-white/5 rounded-lg" />
        </div>
        <div className="h-8 w-full bg-white/10 rounded-lg mt-auto" />
      </div>
      <div className="flex-1 p-4 sm:p-6 bg-[#FAF8F3]">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
        <div className="h-6 w-48 bg-gray-300 rounded mb-6" />
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="h-24 bg-white rounded-xl border border-[#3457D5]/20 shadow-sm" />
          <div className="h-24 bg-white rounded-xl border border-[#16897A]/20 shadow-sm" />
          <div className="h-24 bg-white rounded-xl border border-[#D98C32]/20 shadow-sm" />
        </div>
        
        <div className="h-32 bg-white rounded-xl border border-[#DDD8CF]/60 shadow-sm" />
      </div>
    </div>
  );
}

function MockupModuleSelection() {
  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-[#DDD8CF]/60 overflow-hidden flex h-[320px] relative">
       <div className="w-16 sm:w-48 bg-[#121413] border-r border-[#DDD8CF]/70 flex flex-col p-3">
        <div className="h-8 w-8 sm:w-full bg-white/10 rounded-lg mb-6" />
        <div className="space-y-2 flex-1">
          <div className="h-8 w-full bg-white/5 rounded-lg" />
          <div className="h-8 w-full bg-[#3457D5] rounded-lg flex items-center px-2 shadow-sm">
            <span className="hidden sm:block text-[10px] font-bold text-white ml-2">Integridade</span>
          </div>
          <div className="h-8 w-full bg-white/5 rounded-lg" />
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-6 bg-white relative">
        <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
        <div className="h-6 w-40 bg-[#3457D5]/20 rounded mb-6" />
        
        <div className="space-y-3">
          <div className="h-12 w-full bg-gray-50 rounded-lg border border-gray-100" />
          <div className="h-12 w-full bg-gray-50 rounded-lg border border-gray-100" />
          <div className="h-12 w-full bg-gray-50 rounded-lg border border-gray-100" />
        </div>

        {/* Demonstrative Cursor */}
        <motion.div 
          className="absolute z-50 text-gray-800"
          initial={{ x: 0, y: 100, opacity: 0 }}
          animate={{ x: 40, y: 30, opacity: 1, scale: [1, 0.9, 1] }}
          transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
        >
          <MousePointer2 className="w-5 h-5 fill-white stroke-black stroke-2" />
        </motion.div>
      </div>
    </div>
  );
}

function MockupDashboard() {
  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-[#DDD8CF]/60 overflow-hidden flex flex-col h-[320px]">
      <div className="h-12 border-b border-[#DDD8CF]/40 flex items-center px-4 justify-between bg-[#FAF8F3]">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-[#B66E45]/20 rounded-md" />
        </div>
      </div>
      <div className="flex-1 p-4 flex gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-32 bg-gray-50 rounded-xl border border-gray-100" />
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
             <CheckCircle2 className="w-3 h-3 text-[#1F8A63]" />
             Relatório atualizado na demonstração
          </div>
        </div>
        <div className="w-1/3 space-y-3">
           <div className="h-16 bg-[#FEF6E8] rounded-xl border border-[#C98224]/20" />
           <div className="h-16 bg-[#E8F8F2] rounded-xl border border-[#1F8A63]/20" />
        </div>
      </div>
    </div>
  );
}
