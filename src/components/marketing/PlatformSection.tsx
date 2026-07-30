import React, { useState } from "react";
import { ShieldCheck, Users, Briefcase, Activity, CheckCircle2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function PlatformSection() {
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);

  return (
    <section id="plataforma" className="scroll-mt-24 py-16 md:py-24 bg-[#121413] text-white overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#B66E45]/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
          >
            Comece pelo que sua empresa precisa. Conecte novas soluções no mesmo ecossistema.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-base md:text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto"
          >
            Integridade, Pessoas e Talentos funcionam como produtos próprios dentro de um único ambiente corporativo. Menos sistemas, acessos e informações fragmentadas para administrar.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Benefits & Tabs */}
          <div className="lg:col-span-5 space-y-10">
            <div className="space-y-4">
               {[
                 "Uma credencial para acessar as soluções contratadas.",
                 "Navegação consistente entre diferentes operações.",
                 "Pendências e informações organizadas em um único ambiente.",
                 "Implantação modular, sem contratar tudo de uma vez."
               ].map((item, idx) => (
                 <div key={idx} className="flex items-start gap-3">
                   <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white mt-0.5">
                     <CheckCircle2 className="w-3.5 h-3.5" />
                   </div>
                   <span className="text-sm text-gray-300 leading-tight">{item}</span>
                 </div>
               ))}
            </div>

            {/* Accessible Tabs */}
            <div 
              role="tablist" 
              aria-label="Soluções da Plataforma"
              className="flex flex-col gap-3"
            >
              <button
                role="tab"
                aria-selected={activeTab === 0}
                aria-controls="panel-0"
                id="tab-0"
                tabIndex={activeTab === 0 ? 0 : -1}
                onClick={() => setActiveTab(0)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121413] ${
                  activeTab === 0 
                  ? "bg-white/10 border-[#3457D5] shadow-[0_0_15px_rgba(52,87,213,0.15)]" 
                  : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className={`w-5 h-5 ${activeTab === 0 ? "text-[#3457D5]" : "text-gray-400"}`} />
                  <span className={`font-bold ${activeTab === 0 ? "text-white" : "text-gray-400"}`}>Integridade</span>
                </div>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 1}
                aria-controls="panel-1"
                id="tab-1"
                tabIndex={activeTab === 1 ? 0 : -1}
                onClick={() => setActiveTab(1)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121413] ${
                  activeTab === 1 
                  ? "bg-white/10 border-[#16897A] shadow-[0_0_15px_rgba(22,137,122,0.15)]" 
                  : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className={`w-5 h-5 ${activeTab === 1 ? "text-[#16897A]" : "text-gray-400"}`} />
                  <span className={`font-bold ${activeTab === 1 ? "text-white" : "text-gray-400"}`}>Pessoas</span>
                </div>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 2}
                aria-controls="panel-2"
                id="tab-2"
                tabIndex={activeTab === 2 ? 0 : -1}
                onClick={() => setActiveTab(2)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121413] ${
                  activeTab === 2 
                  ? "bg-white/10 border-[#D98C32] shadow-[0_0_15px_rgba(217,140,50,0.15)]" 
                  : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className={`w-5 h-5 ${activeTab === 2 ? "text-[#D98C32]" : "text-gray-400"}`} />
                  <span className={`font-bold ${activeTab === 2 ? "text-white" : "text-gray-400"}`}>Talentos</span>
                </div>
              </button>
            </div>
          </div>

          {/* Right Column: Tab Panels / Mockup representation */}
          <div className="lg:col-span-7">
             <div className="rounded-2xl border border-white/20 bg-[#1A1C1B] shadow-2xl overflow-hidden relative min-h-[400px]">
               {/* Browser Header */}
               <div className="bg-[#121413] border-b border-white/10 p-3 flex items-center gap-2">
                 <div className="flex gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                   <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                   <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                 </div>
               </div>
               
               {/* Body */}
               <div className="flex h-full min-h-[360px]">
                  {/* Sidebar */}
                  <div className="w-[60px] sm:w-[140px] border-r border-white/5 p-2 flex flex-col gap-2">
                     <div className="w-full h-8 bg-white/10 rounded-lg mb-4" />
                     <div className={`w-full h-8 rounded-lg transition-colors duration-200 ${activeTab === 0 ? "bg-[#3457D5]" : "bg-white/5"}`} />
                     <div className={`w-full h-8 rounded-lg transition-colors duration-200 ${activeTab === 1 ? "bg-[#16897A]" : "bg-white/5"}`} />
                     <div className={`w-full h-8 rounded-lg transition-colors duration-200 ${activeTab === 2 ? "bg-[#D98C32]" : "bg-white/5"}`} />
                  </div>
                  {/* Tab Panel Content */}
                  <div className="flex-1 p-6 relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        id={`panel-${activeTab}`}
                        role="tabpanel"
                        aria-labelledby={`tab-${activeTab}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex flex-col gap-4"
                      >
                         {activeTab === 0 && (
                           <>
                             <div className="h-8 w-40 bg-white/10 rounded mb-4"></div>
                             <div className="h-16 bg-[#3457D5]/10 border border-[#3457D5]/30 rounded-xl"></div>
                             <div className="h-32 bg-white/5 border border-white/10 rounded-xl"></div>
                           </>
                         )}
                         {activeTab === 1 && (
                           <>
                             <div className="h-8 w-40 bg-white/10 rounded mb-4"></div>
                             <div className="h-16 bg-[#16897A]/10 border border-[#16897A]/30 rounded-xl"></div>
                             <div className="grid grid-cols-2 gap-4">
                               <div className="h-24 bg-white/5 border border-white/10 rounded-xl"></div>
                               <div className="h-24 bg-white/5 border border-white/10 rounded-xl"></div>
                             </div>
                           </>
                         )}
                         {activeTab === 2 && (
                           <>
                             <div className="h-8 w-40 bg-white/10 rounded mb-4"></div>
                             <div className="h-16 bg-[#D98C32]/10 border border-[#D98C32]/30 rounded-xl"></div>
                             <div className="flex gap-4">
                               <div className="w-1/3 h-32 bg-white/5 border border-white/10 rounded-xl"></div>
                               <div className="w-1/3 h-32 bg-white/5 border border-white/10 rounded-xl"></div>
                               <div className="w-1/3 h-32 bg-white/5 border border-white/10 rounded-xl"></div>
                             </div>
                           </>
                         )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
}
