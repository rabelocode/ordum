import React, { useState } from "react";
import { Header } from "../../components/marketing/Header";
import { HeroSection } from "../../components/marketing/HeroSection";
import { SolutionsSection } from "../../components/marketing/SolutionsSection";
import { SecuritySection } from "../../components/marketing/SecuritySection";
import { AreasSection } from "../../components/marketing/AreasSection";
import { FinalCTASection } from "../../components/marketing/FinalCTASection";
import { Footer } from "../../components/marketing/Footer";
import { DemoModal } from "../../components/marketing/DemoModal";

export function PublicSite() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModule, setDemoModule] = useState("all");

  const openDemo = (module?: string) => {
    setDemoModule(typeof module === "string" ? module : "all");
    setIsDemoModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] font-sans overflow-x-hidden selection:bg-[#B66E45]/20 selection:text-[#B66E45]">
      <Header onNavigateLogin={() => window.location.hash = "#/entrar"} onOpenDemo={() => openDemo()} />
      <main>
        <HeroSection onOpenDemo={() => openDemo()} onNavigateLogin={() => window.location.hash = "#/entrar"} />
        <SolutionsSection onOpenDemo={openDemo} />
        <AreasSection />
        <SecuritySection />
        <FinalCTASection onOpenDemo={() => openDemo()} />
      </main>
      <Footer onNavigateLogin={() => window.location.hash = "#/entrar"} onOpenDemo={() => openDemo()} />
      <DemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} defaultModule={demoModule} />
    </div>
  );
}
