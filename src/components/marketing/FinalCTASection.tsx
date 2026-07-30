import React from "react";
import { ArrowRight, MessageSquare, ShieldCheck, Users, Briefcase } from "lucide-react";
import { Button } from "../ui/Button";

interface FinalCTASectionProps {
  onOpenDemo: (module?: string) => void;
}

export function FinalCTASection({ onOpenDemo }: FinalCTASectionProps) {
  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden">
      <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center space-y-8">
        
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#202322] leading-tight">
          Coloque ordem no que hoje está espalhado.
        </h2>
        <p className="text-base sm:text-lg text-[#626866] max-w-2xl mx-auto leading-relaxed">
          Comece com Integridade, Pessoas ou Talentos e amplie a plataforma conforme as necessidades da sua empresa.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button
            variant="default"
            size="lg"
            onClick={() => onOpenDemo()}
            className="w-full sm:w-auto h-12 px-8 text-sm font-bold rounded-xl shadow-xs"
          >
            <span>Agendar uma demonstração</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenDemo()}
            className="w-full sm:w-auto h-12 px-8 text-sm font-bold rounded-xl border-[#DDD8CF] bg-[#FAF8F3]/50 text-[#353938] hover:bg-white"
          >
            <MessageSquare className="w-4 h-4 mr-2 text-[#B66E45]" />
            <span>Falar com um especialista</span>
          </Button>
        </div>

        <div className="pt-12 flex flex-wrap justify-center gap-6 text-sm text-[#626866] font-medium">
           <div className="flex items-center gap-2">
             <ShieldCheck className="w-4 h-4 text-[#3457D5]" />
             Ordum Integridade
           </div>
           <div className="flex items-center gap-2">
             <Users className="w-4 h-4 text-[#16897A]" />
             Ordum Pessoas
           </div>
           <div className="flex items-center gap-2">
             <Briefcase className="w-4 h-4 text-[#D98C32]" />
             Ordum Talentos
           </div>
        </div>

      </div>
    </section>
  );
}
