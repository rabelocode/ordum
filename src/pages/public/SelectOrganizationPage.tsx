import React, { useState, useEffect } from "react";
import { Building2, ArrowRight, LogOut, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../core/auth/AuthProvider";
import { usePlatform } from "../../core/auth/PlatformAuthProvider";

export function SelectOrganizationPage() {
  const { signOut } = useAuth();
  const { tenantMemberships, isPlatformLoading } = usePlatform();

  const handleSelectTenant = (tenantSlug?: string) => {
    // If slug exists or store in localStorage as preference
    window.location.hash = "#/workspace";
  };

  const handleLogout = async () => {
    await signOut();
    window.location.hash = "#/login";
  };

  if (isPlatformLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#B66E45] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#121413] text-white font-black text-lg mx-auto mb-4 flex items-center justify-center">
            O.
          </div>
          <h1 className="text-xl font-black text-[#202322] tracking-tight mb-1">
            Escolha uma Organização
          </h1>
          <p className="text-xs text-[#626866]">
            Sua conta possui acesso a múltiplas empresas. Selecione qual deseja acessar:
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {tenantMemberships.map((m) => {
            const tenantName = m.tenants?.name || m.tenants?.legal_name || "Organização";
            return (
              <button
                key={m.id}
                onClick={() => handleSelectTenant(m.tenants?.slug)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-[#DDD8CF] hover:border-[#B66E45] hover:bg-[#F6F5F2]/50 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#DDD8CF]/40 text-[#121413] font-bold text-sm flex items-center justify-center group-hover:bg-[#B66E45] group-hover:text-white transition-colors">
                    {tenantName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#202322] group-hover:text-[#B66E45] transition-colors">
                      {tenantName}
                    </div>
                    <div className="text-[11px] text-[#626866] uppercase font-mono">
                      Função: {m.role}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#B66E45] transition-colors" />
              </button>
            );
          })}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-[#626866] hover:text-[#202322] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
