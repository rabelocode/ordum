import React, { useState } from "react";
import { ArrowRight, Search, Building2, HelpCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { supabase } from "../../lib/supabase";

export function TenantDiscoveryPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError("");

    try {
      
      const res = await fetch(`/api/public/tenants/resolve?slug=${identifier.trim().toLowerCase()}`);
      if (!res.ok) {
        setError("Empresa não encontrada ou inativa.");
        return;
      }
      const data = await res.json();
      const error = null;


      if (error || !data) {
        setError("Empresa não encontrada ou inativa.");
        return;
      }

      window.location.hash = `#/acesso/${(data as any).slug}`;
    } catch (err) {
      setError("Erro ao buscar empresa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#B66E45] shadow-sm mb-6 border border-[#DDD8CF]/40">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-[#202322] mb-2 tracking-tight">
            Encontrar sua Empresa
          </h1>
          <p className="text-sm text-[#626866]">
            Digite o código ou slug da sua empresa para acessar o ambiente corporativo.
          </p>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="company-id" className="block text-[11px] font-bold text-[#202322] mb-1.5 uppercase tracking-wider">
                Código da Empresa
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="company-id"
                  type="text"
                  placeholder="ex: acme-corp"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10 h-12 text-base"
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="text-sm text-red-500 font-medium text-center">
                {error}
              </div>
            )}

            <div className="pt-2">
              <Button type="submit" disabled={loading} className="w-full h-12 text-base shadow-sm">
                {loading ? "Buscando..." : "Localizar ambiente"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </div>

        <div className="text-center">
          <a href="#/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#626866] hover:text-[#B66E45] transition-colors">
            <HelpCircle className="w-4 h-4" />
            <span>Voltar ao site da Ordum</span>
          </a>
        </div>
      </div>
    </div>
  );
}
