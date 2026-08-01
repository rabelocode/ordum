import React from "react";
import { Lock, ShieldCheck } from "lucide-react";

interface FooterProps {
  onNavigateLogin: () => void;
  onOpenDemo: () => void;
}

export function Footer({ onNavigateLogin, onOpenDemo }: FooterProps) {
  return (
    <footer className="bg-[#151817] text-white border-t border-white/10 pt-16 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B66E45] font-extrabold text-xl text-white">
                O
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-tight text-white text-xl leading-none">
                  ORDUM
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D2926D] mt-0.5">
                  Soluções Corporativas
                </span>
              </div>
            </div>

            <p className="text-sm text-[#DDD8CF] italic">
              “A ordem que move empresas.”
            </p>

            <p className="text-xs text-[#626866] max-w-sm leading-relaxed">
              Plataforma modular para organização de integridade, pessoas e talentos. Estruturada para empresas em crescimento.
            </p>

            <div className="flex items-center gap-2 text-xs text-[#D2926D]">
              <ShieldCheck className="w-4 h-4 text-[#1F8A63]" />
              <span>Boas práticas de proteção de dados e estrutura para a LGPD</span>
            </div>
          </div>

          {/* Produtos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D2926D] mb-4">
              Produtos
            </h4>
            <ul className="space-y-2.5 text-xs text-[#DDD8CF]">
              <li><a href="#integridade" className="hover:text-white transition-colors">Ordum Integridade</a></li>
              <li><a href="#pessoas" className="hover:text-white transition-colors">Ordum Pessoas</a></li>
              <li><a href="#talentos" className="hover:text-white transition-colors">Ordum Talentos</a></li>
              
            </ul>
          </div>

          {/* Empresa & Segurança */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D2926D] mb-4">
              Plataforma
            </h4>
            <ul className="space-y-2.5 text-xs text-[#DDD8CF]">
              <li><a href="#plataforma" className="hover:text-white transition-colors">Visão Geral</a></li>
              <li><a href="#areas" className="hover:text-white transition-colors">Para sua empresa</a></li>
              <li><a href="#seguranca" className="hover:text-white transition-colors">Segurança e Governança</a></li>
              <li><button onClick={onNavigateLogin} className="hover:text-white transition-colors text-left">Acesso ao SaaS</button></li>
            </ul>
          </div>

          {/* Contato & Suporte */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D2926D] mb-4">
              Contato
            </h4>
            <ul className="space-y-2.5 text-xs text-[#DDD8CF]">
              <li><button onClick={onOpenDemo} className="hover:text-white transition-colors text-left">Agendar Demonstração</button></li>
              <li><span className="text-[#626866]">suporte@ordum.com.br</span></li>
              <li><span className="text-[#626866]">Atendimento Corporativo</span></li>
              <li>
                <button
                  onClick={onNavigateLogin}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                >
                  <Lock className="w-3 h-3 text-[#B66E45]" />
                  <span>Portal do Cliente</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#626866] gap-4">
          <div>
            © {new Date().getFullYear()} ORDUM Soluções Corporativas. Todos os direitos reservados.
          </div>
          <div className="bg-[#B66E45]/10 border border-[#B66E45]/20 text-[#D2926D] px-3 py-1.5 rounded-lg font-medium text-[10px] uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-3 h-3" />
            Demonstração • Dados ilustrativos
          </div>
        </div>
      </div>
      <div className="text-center pb-4"><a href="#/admin" className="text-[10px] text-gray-500 hover:text-[#B66E45]">Acesso interno Ordum (Demonstração)</a></div>
    </footer>
  );
}
