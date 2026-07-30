import React, { useState, useEffect } from "react";
import { ArrowLeft, Lock, Mail, ArrowRight, Activity, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { authService } from "../../services/auth";
import { useAuth } from "../../core/auth/AuthProvider";

interface TenantLoginPageProps {
  slug: string;
}

export function TenantLoginPage({ slug }: TenantLoginPageProps) {
  const [tenant, setTenant] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      window.location.hash = "#/workspace";
      return;
    }

    const fetchTenant = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/public/tenants/resolve?slug=${slug}`);
        if (!res.ok) {
          setError("Empresa não encontrada.");
          return;
        }
        const data = await res.json();
        if (!data) {
          setError("Empresa não encontrada.");
          return;
        }
        setTenant(data);
      } catch (err) {
        setError("Erro ao carregar a página de acesso.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenant();
  }, [slug, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.signInWithEmailPassword(email.trim(), password);
      window.location.hash = "#/workspace";
    } catch (err: any) {
      console.error("Login error:", err);
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setErrorMessage("E-mail ou senha incorretos.");
      } else {
        setErrorMessage("Erro ao realizar login. Verifique suas credenciais.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center">
        <Activity className="w-8 h-8 text-[#B66E45] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-[#202322] mb-3">Acesso Indisponível</h1>
          <p className="text-[#626866] mb-8 text-sm">{error}</p>
          <Button onClick={() => window.location.hash = "#/entrar"} className="w-full h-12">
            Voltar para a busca
          </Button>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="w-full md:w-1/2 p-6 md:p-12 lg:p-20 flex flex-col justify-center bg-white relative">
        <button 
          onClick={() => window.location.hash = "#/entrar"}
          className="absolute top-8 left-8 flex items-center text-xs font-semibold text-[#626866] hover:text-[#202322] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </button>
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-8 text-center">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-6 shadow-sm"
              style={{ backgroundColor: tenant.settings?.primaryColor || "#B66E45" }}
            >
              {tenant.name.substring(0, 2).toUpperCase()}
            </div>
            <h1 className="text-2xl font-black text-[#202322] tracking-tight mb-2">
              Acessar {tenant.name}
            </h1>
            <p className="text-sm text-[#626866]">
              Informe suas credenciais corporativas.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com"
                  required
                  className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-12 text-sm font-bold shadow-sm cursor-pointer" 
              style={{ backgroundColor: tenant.settings?.primaryColor || "#B66E45" }}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Entrando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar na Organização <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-[#DDD8CF]/40 text-center">
            <p className="text-xs text-[#626866]">
              Plataforma desenvolvida por <span className="font-bold text-[#202322]">Ordum Soluções</span>
            </p>
          </div>
        </div>
      </div>
      <div 
        className="hidden md:flex w-1/2 items-center justify-center p-12 relative"
        style={{ backgroundColor: tenant.settings?.primaryColor || "#B66E45" }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 max-w-md text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Ambiente Seguro</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            A ordem que move empresas.
          </h2>
          <p className="text-white/80 leading-relaxed">
            Acesso corporativo às soluções da plataforma Ordum.
          </p>
        </div>
      </div>
    </div>
  );
}
