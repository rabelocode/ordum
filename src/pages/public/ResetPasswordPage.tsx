import React, { useState, useEffect } from "react";
import { Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { authService } from "../../services/auth";
import { supabase } from "../../lib/supabase";

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if recovery session exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasValidSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("As senhas informadas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.updatePassword(newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setErrorMessage(err.message || "Erro ao redefinir senha. O link pode estar expirado.");
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

  if (hasValidSession === false && !isSuccess) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[#202322] mb-3">Link Inválido ou Expirado</h1>
          <p className="text-xs text-[#626866] mb-8 leading-relaxed">
            O link de recuperação de senha é inválido ou já expirou. Por favor, solicite um novo link de recuperação.
          </p>
          <a
            href="#/login"
            className="inline-flex items-center justify-center w-full h-12 bg-[#121413] hover:bg-[#202322] text-white text-sm font-bold rounded-xl transition-colors"
          >
            Solicitar novo link
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
            Redefinir Senha
          </h1>
          <p className="text-xs text-[#626866]">
            Crie uma nova senha de acesso para sua conta.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="text-center space-y-6">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#202322]">Senha redefinida com sucesso!</h2>
            <p className="text-xs text-[#626866] leading-relaxed">
              Você já pode acessar sua conta utilizando a nova senha cadastrada.
            </p>
            <a
              href="#/login"
              className="inline-flex items-center justify-center w-full h-12 bg-[#121413] hover:bg-[#202322] text-white text-sm font-bold rounded-xl transition-colors"
            >
              Ir para o Login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                Confirmar Nova Senha
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Atualizando...
                </span>
              ) : (
                "Redefinir Senha"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
