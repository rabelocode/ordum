import React, { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, ShieldCheck, Users, Briefcase } from "lucide-react";
import { Button } from "../ui/Button";
import { solutionsData } from "../../lib/solutions";

interface HeaderProps {
  onNavigateLogin: () => void;
  onOpenDemo: (module?: string) => void;
}

export function Header({ onNavigateLogin, onOpenDemo }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        solutionsOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setSolutionsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && solutionsOpen) {
        setSolutionsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [solutionsOpen]);

  const toggleSolutions = () => {
    setSolutionsOpen((prev) => !prev);
  };

  const getIcon = (id: string) => {
    switch (id) {
      case "integrity": return <ShieldCheck className="w-4.5 h-4.5" />;
      case "people": return <Users className="w-4.5 h-4.5" />;
      case "talent": return <Briefcase className="w-4.5 h-4.5" />;
      default: return null;
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-md border-b border-[#DDD8CF]/50 shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-6 xl:px-12 flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2.5 group outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-offset-4">
          <div className="w-9 h-9 rounded-xl bg-[#202322] flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-sm">
            <span className="text-white font-bold text-lg leading-none">O</span>
          </div>
          <span className="text-[22px] font-bold tracking-tight text-[#202322]">
            ordum
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-6 2xl:gap-8 ml-8">
          <a
            href="#plataforma"
            className="text-[13px] font-semibold text-[#626866] hover:text-[#202322] transition-colors py-2 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-offset-2"
          >
            Plataforma
          </a>

          {/* Solutions Mega Menu */}
          <div className="relative group" ref={menuRef}>
            <button
              ref={buttonRef}
              onClick={toggleSolutions}
              aria-expanded={solutionsOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#626866] hover:text-[#202322] transition-colors py-2 cursor-pointer outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-offset-2"
            >
              Soluções
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  solutionsOpen ? "rotate-180 text-[#B66E45]" : ""
                }`}
              />
            </button>

            {/* Mega Menu Popup */}
            {solutionsOpen && (
              <div className="absolute top-full -left-20 w-[480px] rounded-2xl border border-[#DDD8CF]/70 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)] animate-in fade-in slide-in-from-top-1 duration-200 z-50">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#626866] px-2.5 py-1.5 border-b border-[#DDD8CF]/20 mb-1.5">
                  Soluções Corporativas
                </div>
                <div className="space-y-0.5" role="menu">
                  {solutionsData.map((sol) => {
                    const hoverBg = sol.id === "integrity" ? "hover:bg-[#E9EDFF]/50" : sol.id === "people" ? "hover:bg-[#E4F5F1]/50" : "hover:bg-[#FFF1DD]/50";
                    const groupHoverText = sol.id === "integrity" ? "group-hover:text-[#3457D5]" : sol.id === "people" ? "group-hover:text-[#16897A]" : "group-hover:text-[#D98C32]";
                    return (
                    <a
                      key={sol.id}
                      href={sol.anchor}
                      onClick={() => setSolutionsOpen(false)}
                      role="menuitem"
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-inset ${hoverBg}`}
                    >
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: sol.bgColor, color: sol.color }}
                      >
                        {getIcon(sol.id)}
                      </div>
                      <div>
                        <div className={`text-xs font-bold text-[#202322] flex items-center gap-2 transition-colors ${groupHoverText}`}>
                          <span>{sol.name.replace("Ordum ", "")}</span>
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded-md font-semibold"
                            style={{ backgroundColor: sol.bgColor, color: sol.badgeColor }}
                          >
                            {sol.id === "integrity" ? "Canal Público" : sol.id === "people" ? "Portal Interno" : "Recrutamento"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#626866] mt-0.5 leading-snug">
                          {sol.shortDescription}
                        </p>
                      </div>
                    </a>
                  )})}
                </div>
              </div>
            )}
          </div>

          <a
            href="#areas"
            className="text-[13px] font-semibold text-[#626866] hover:text-[#202322] transition-colors py-2 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-offset-2"
          >
            Para sua empresa
          </a>
          <a
            href="#seguranca"
            className="text-[13px] font-semibold text-[#626866] hover:text-[#202322] transition-colors py-2 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[#B66E45] focus-visible:ring-offset-2"
          >
            Segurança
          </a>
        </nav>

        {/* Desktop CTA Actions */}
        <div className="hidden xl:flex items-center gap-3">
          <Button variant="ghost" onClick={onNavigateLogin} className="font-bold text-xs text-[#626866] hover:text-[#202322] min-h-[44px]">
            Entrar
          </Button>
          <Button variant="default" size="sm" onClick={() => onOpenDemo()} className="px-5 rounded-xl shadow-xs min-h-[44px]">
            Agendar demonstração
          </Button>
        </div>

        {/* Tablet and Mobile header actions */}
        <div className="flex xl:hidden items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenDemo()}
            className="hidden sm:inline-flex px-3.5 text-xs rounded-xl h-10 min-h-[40px]"
          >
            Demonstração
          </Button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#202322] hover:bg-[#FAF8F3] rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[#B66E45]"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-[#DDD8CF]/50 bg-white p-5 space-y-4 animate-in slide-in-from-top duration-200 shadow-lg">
          <div className="space-y-1">
            <a
              href="#plataforma"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-[#202322] py-2.5 px-3 hover:bg-[#FAF8F3] rounded-xl text-sm min-h-[44px] flex items-center"
            >
              Plataforma
            </a>
            {solutionsData.map((sol) => (
              <a
                key={sol.id}
                href={sol.anchor}
                onClick={() => setMobileMenuOpen(false)}
                className="block font-bold text-[#202322] py-2.5 px-3 hover:bg-[#FAF8F3] rounded-xl text-sm min-h-[44px] flex items-center"
              >
                {sol.name}
              </a>
            ))}
            <a
              href="#areas"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-[#202322] py-2.5 px-3 hover:bg-[#FAF8F3] rounded-xl text-sm min-h-[44px] flex items-center"
            >
              Para sua empresa
            </a>
            <a
              href="#seguranca"
              onClick={() => setMobileMenuOpen(false)}
              className="block font-bold text-[#202322] py-2.5 px-3 hover:bg-[#FAF8F3] rounded-xl text-sm min-h-[44px] flex items-center"
            >
              Segurança & Governança
            </a>
          </div>
          <div className="pt-3 border-t border-[#DDD8CF]/40 flex flex-col gap-2.5">
            <Button variant="outline" onClick={onNavigateLogin} className="w-full justify-center text-xs min-h-[44px] rounded-xl font-bold">
              Entrar na plataforma
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDemo();
              }}
              className="w-full justify-center text-xs min-h-[44px] rounded-xl font-bold"
            >
              Agendar demonstração
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
