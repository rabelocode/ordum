import React, { useState, useEffect } from "react";
import { ArrowRight, ShieldCheck, Users, Briefcase, Activity, CheckCircle2, Lock, MousePointer2 } from "lucide-react";
import { Button } from "../ui/Button";
import { motion, AnimatePresence } from "motion/react";

interface HeroSectionProps {
  onOpenDemo: () => void;
  onNavigateLogin: () => void;
}

export function HeroSection({ onOpenDemo, onNavigateLogin }: HeroSectionProps) {
  const [activeModule, setActiveModule] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveModule((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="plataforma" className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden bg-[#FAF8F3] scroll-mt-24">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#DDD8CF]/80 shadow-sm mb-6"
            >
              <span className="flex h-2 w-2 rounded-full bg-[#1F8A63] animate-pulse" />
              <span className="text-xs font-bold text-[#626866] uppercase tracking-wider">Tecnologia para Gestão Corporativa</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#202322] tracking-tight leading-[1.1]"
            >
              Integridade, pessoas e talentos. Cada processo no lugar certo.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-base sm:text-lg text-[#626866] leading-relaxed max-w-xl"
            >
              Canal 100% anônimo de denúncias, Portal do Colaborador e recrutamento em uma plataforma corporativa modular.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-4"
            >
              <Button onClick={onOpenDemo} size="lg" className="h-12 px-8 text-sm gap-2 w-full sm:w-auto bg-[#B66E45] hover:bg-[#A05D38] text-white rounded-xl shadow-md">
                Agendar uma demonstração <ArrowRight className="w-4 h-4" />
              </Button>
              <a href="#solucoes" className="inline-flex items-center justify-center h-12 px-8 text-sm w-full sm:w-auto rounded-xl border border-[#DDD8CF] bg-white text-[#202322] hover:bg-[#F3EEE4] font-semibold transition-colors">
                Conhecer as soluções
              </a>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 flex items-center gap-4 text-xs text-[#626866] font-medium"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-1.5 font-bold">
                  Comece por uma solução. Amplie quando sua operação precisar.
                </div>
                <button onClick={onNavigateLogin} className="text-[#B66E45] hover:underline text-left">
                  Já utiliza a Ordum? Acessar ambiente
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Visual Mockup */}
          <motion.div 
             initial={{ opacity: 0, scale: 0.95, x: 20 }}
             animate={{ opacity: 1, scale: 1, x: 0 }}
             transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.2 }}
             className="relative lg:ml-auto w-full max-w-[500px]"
          >
            {/* The Mockup Frame */}
            <div className="rounded-2xl bg-white border border-[#DDD8CF]/80 shadow-2xl overflow-hidden relative">
              {/* Browser Header */}
              <div className="bg-[#FAF8F3] border-b border-[#DDD8CF]/40 p-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E5E0D8]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E5E0D8]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E5E0D8]" />
                </div>
                <div className="mx-auto bg-white border border-[#DDD8CF]/60 rounded-md py-1 px-24 text-[9px] text-[#626866] flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  clientex.ordum.com.br
                </div>
              </div>

              {/* Mockup Body */}
              <div className="flex h-[320px]">
                {/* Sidebar */}
                <div className="w-[60px] sm:w-[140px] bg-[#121413] p-2 flex flex-col gap-2">
                   <div className="w-full h-8 bg-white/10 rounded-lg mb-4" />
                   <div className={`w-full h-8 rounded-lg transition-colors ${activeModule === 0 ? "bg-[#3457D5]" : "bg-white/5"}`} />
                   <div className={`w-full h-8 rounded-lg transition-colors ${activeModule === 1 ? "bg-[#16897A]" : "bg-white/5"}`} />
                   <div className={`w-full h-8 rounded-lg transition-colors ${activeModule === 2 ? "bg-[#D98C32]" : "bg-white/5"}`} />
                </div>
                {/* Main Content Area */}
                <div className="flex-1 bg-[#FAF8F3] p-4 flex flex-col gap-3">
                   <div className="w-32 h-4 bg-gray-200 rounded" />
                   
                   <div className="grid grid-cols-3 gap-2">
                     <motion.div 
                       animate={{ scale: activeModule === 0 ? 1.05 : 1, borderColor: activeModule === 0 ? "#3457D5" : "#e5e7eb" }}
                       className="h-16 bg-white rounded-lg border shadow-sm p-2 flex flex-col justify-between"
                     >
                       <ShieldCheck className={`w-4 h-4 ${activeModule === 0 ? "text-[#3457D5]" : "text-gray-400"}`} />
                       <div className="w-full h-2 bg-gray-100 rounded mt-2" />
                     </motion.div>
                     <motion.div 
                       animate={{ scale: activeModule === 1 ? 1.05 : 1, borderColor: activeModule === 1 ? "#16897A" : "#e5e7eb" }}
                       className="h-16 bg-white rounded-lg border shadow-sm p-2 flex flex-col justify-between"
                     >
                       <Users className={`w-4 h-4 ${activeModule === 1 ? "text-[#16897A]" : "text-gray-400"}`} />
                       <div className="w-full h-2 bg-gray-100 rounded mt-2" />
                     </motion.div>
                     <motion.div 
                       animate={{ scale: activeModule === 2 ? 1.05 : 1, borderColor: activeModule === 2 ? "#D98C32" : "#e5e7eb" }}
                       className="h-16 bg-white rounded-lg border shadow-sm p-2 flex flex-col justify-between"
                     >
                       <Briefcase className={`w-4 h-4 ${activeModule === 2 ? "text-[#D98C32]" : "text-gray-400"}`} />
                       <div className="w-full h-2 bg-gray-100 rounded mt-2" />
                     </motion.div>
                   </div>

                   <div className="flex-1 bg-white border border-[#DDD8CF]/40 rounded-lg p-3 space-y-2 relative overflow-hidden">
                      <div className="w-24 h-3 bg-gray-200 rounded mb-2" />
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={`activity-${activeModule}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="h-8 bg-gray-50 rounded border border-gray-100 flex items-center px-2 gap-2"
                        >
                           <div className={`w-2 h-2 rounded-full ${activeModule === 0 ? "bg-[#3457D5]" : activeModule === 1 ? "bg-[#16897A]" : "bg-[#D98C32]"}`} />
                           <div className="w-32 h-2 bg-gray-200 rounded" />
                        </motion.div>
                      </AnimatePresence>
                      <div className="h-8 bg-gray-50 rounded border border-gray-100 flex items-center px-2 gap-2">
                           <div className="w-2 h-2 rounded-full bg-gray-300" />
                           <div className="w-24 h-2 bg-gray-200 rounded" />
                      </div>
                   </div>
                </div>
              </div>

              {/* Demonstrative Cursor */}
              <motion.div 
                className="absolute z-50 text-gray-800"
                animate={{ 
                  x: [100, 200, 280, 100], 
                  y: [120, 100, 140, 120], 
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <MousePointer2 className="w-5 h-5 fill-white stroke-black stroke-2 drop-shadow-md" />
              </motion.div>

            </div>

            {/* Branded Floating Metric Badges */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-4 -right-4 hidden xl:flex items-center gap-2 rounded-xl border border-[#DDD8CF]/80 bg-white px-3 py-2 shadow-lg z-10"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E9EDFF] text-[#3457D5]">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold text-[#202322]">3 soluções contratadas</span>
                <span className="text-[8px] text-[#626866] mt-0.5">Interface demonstrativa</span>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-4 -left-4 hidden xl:flex items-center gap-2.5 rounded-xl border border-[#DDD8CF]/80 bg-white px-3 py-2 shadow-lg z-10"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#E8F8F2] text-[#1F8A63]">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-bold text-[#202322]">Um único ambiente</span>
                <span className="text-[8px] text-[#626866] mt-0.5">Para todas as soluções</span>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
