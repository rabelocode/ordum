import React, { useState, useEffect } from "react";
import { User, Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { authService } from "../../services/auth";
import { supabase } from "../../lib/supabase";
import { captureClientException } from '../../lib/observability';

export function AcceptInvitePage() {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasValidSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasValidSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const resolveAndRedirect = async (accessToken: string) => {
    try {
      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.isPlatformMember && !data.isPlatformSuspended) {
          window.location.hash = "#/admin";
          return;
        }

        const tenantMemberships = data.tenantMemberships || [];
        if (tenantMemberships.length >= 1) {
          window.location.hash = "#/workspace";
          return;
        }
      }
    } catch (e) {
      captureClientException(e, { operation: 'invite_session' });
    }
    window.location.hash = "#/login";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Por favor, informe seu nome completo.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas informadas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.updatePassword(password, { full_name: fullName.trim() });
      const session = await authService.getSession();
      if (session) {
        await resolveAndRedirect(session.access_token);
      } else {
        window.location.hash = "#/login";
      }
    } catch (err: any) {
      captureClientException(err, { operation: 'invite_acceptance' });
      setErrorMessage(err.message || "Erro ao concluir cadastro. O convite pode estar expirado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasValidSession === null) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#B66E45] animate-spin" />
      </div>
    );
  }

  if (hasValidSession === false) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[#202322] mb-3">Convite Inválido ou Expirado</h1>
          <p className="text-xs text-[#626866] mb-8 leading-relaxed">
            Este link de convite é inválido ou já foi utilizado. Solicite um novo convite ao seu administrador.
          </p>
          <a
            href="#/login"
            className="inline-flex items-center justify-center w-full h-12 bg-[#121413] hover:bg-[#202322] text-white text-sm font-bold rounded-xl transition-colors"
          >
            Ir para o Login
          </a>
        </div>
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
            Aceitar Convite ORDUM
          </h1>
          <p className="text-xs text-[#626866]">
            Defina seu nome e senha para ativar seu acesso à plataforma.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
              Nome Completo
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
                required
                className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
              Nova Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 text-sm font-bold bg-[#121413] hover:bg-[#202322] text-white rounded-xl shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Concluindo cadastro...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Concluir Cadastro <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
