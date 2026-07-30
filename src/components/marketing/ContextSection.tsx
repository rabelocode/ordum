import React from "react";
import { motion } from "motion/react";
import { AlertCircle, FileText, Users } from "lucide-react";

export function ContextSection() {
  return (
    <section className="py-16 md:py-24 bg-white border-b border-[#DDD8CF]/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-3xl sm:text-4xl font-extrabold text-[#202322] tracking-tight"
          >
            Três operações críticas. Uma gestão menos fragmentada.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-base md:text-lg text-[#626866] leading-relaxed"
          >
            Relatos não devem ficar dispersos. Demandas de colaboradores não precisam depender de mensagens e e-mails. Processos seletivos não deveriam se perder entre planilhas. A Ordum organiza cada fluxo em um produto próprio e conecta tudo no mesmo ecossistema.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-[#FAF8F3]/50 border border-[#DDD8CF]/60 rounded-2xl p-6 md:p-8 flex flex-col items-center text-center"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-[#DDD8CF]/40 flex items-center justify-center mb-6 text-[#3457D5]">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#202322] mb-3">Relatos e apurações sem rastreabilidade.</h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="bg-[#FAF8F3]/50 border border-[#DDD8CF]/60 rounded-2xl p-6 md:p-8 flex flex-col items-center text-center"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-[#DDD8CF]/40 flex items-center justify-center mb-6 text-[#16897A]">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#202322] mb-3">Comunicação e solicitações espalhadas.</h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="bg-[#FAF8F3]/50 border border-[#DDD8CF]/60 rounded-2xl p-6 md:p-8 flex flex-col items-center text-center"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-[#DDD8CF]/40 flex items-center justify-center mb-6 text-[#D98C32]">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#202322] mb-3">Vagas e candidatos sem visão de processo.</h3>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
