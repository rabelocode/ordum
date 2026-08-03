import React, { useState, useEffect } from "react";
import { Lock, Mail, ArrowRight, Shield, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { authService } from "../../services/auth";
import { useAuth } from "../../core/auth/AuthProvider";
import { captureClientException } from '../../lib/observability';

export function LoginPage() {
  const { user, signOut } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Recovery mode state
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  
  // Account state for logged in user without tenant/platform access
  const [noAccessState, setNoAccessState] = useState(false);

  // Parse returnTo parameter
  const getReturnTo = () => {
    const hash = window.location.hash;
    const match = hash.match(/returnTo=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  };

  const resolveUserDestination = async (accessToken: string) => {
    const returnTo = getReturnTo();

    try {
      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        
        // 1. Platform Member with active access
        if (data.isPlatformMember && !data.isPlatformSuspended) {
          if (returnTo) {
            window.location.hash = returnTo.startsWith("#") ? returnTo : `#${returnTo}`;
          } else {
            window.location.hash = "#/admin";
          }
          return;
        }

        // 2. Platform Member suspended
        if (data.isPlatformMember && data.isPlatformSuspended) {
          if (returnTo === "/admin") {
            window.location.hash = "#/admin";
            return;
          }
        }

        // 3. Tenant Memberships
        const tenantMemberships = data.tenantMemberships || [];
        if (tenantMemberships.length === 1) {
          window.location.hash = "#/workspace";
          return;
        } else if (tenantMemberships.length > 1) {
          window.location.hash = "#/select-organization";
          return;
        }

        // 4. No access anywhere
        setNoAccessState(true);
        return;
      }
    } catch (e) {
      captureClientException(e, { operation: 'login_destination' });
    }

    // Default fallback
    if (returnTo) {
      window.location.hash = returnTo.startsWith("#") ? returnTo : `#${returnTo}`;
    } else {
      window.location.hash = "#/admin";
    }
  };

  // If user is already logged in when visiting /login
  useEffect(() => {
    if (user) {
      authService.getSession().then((session) => {
        if (session) {
          resolveUserDestination(session.access_token);
        }
      });
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await authService.signInWithEmailPassword(email.trim(), password);
      if (data.session) {
        await resolveUserDestination(data.session.access_token);
      }
    } catch (err: any) {
      captureClientException(err, { operation: 'login' });
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setErrorMessage("E-mail ou senha incorretos.");
      } else if (msg.includes("Email not confirmed")) {
        setErrorMessage("Por favor, confirme seu e-mail antes de acessar.");
      } else if (msg.includes("rate limit")) {
        setErrorMessage("Muitas tentativas sem sucesso. Aguarde alguns minutos e tente novamente.");
      } else {
        setErrorMessage("Erro ao realizar login. Verifique suas credenciais e tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!recoveryEmail.trim()) {
      setErrorMessage("Por favor, informe seu e-mail.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPasswordForEmail(recoveryEmail.trim());
      setRecoverySuccess(true);
    } catch (err: any) {
      captureClientException(err, { operation: 'password_recovery' });
      // Neutral error for security
      setRecoverySuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setNoAccessState(false);
    window.location.hash = "#/login";
  };

  if (noAccessState) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#DDD8CF]/40 text-[#B66E45] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-[#202322] mb-3">Sem Organização Vinculada</h1>
          <p className="text-[#626866] mb-8 text-sm leading-relaxed">
            Sua conta ainda não possui acesso a uma organização na plataforma Ordum. Entre em contato com seu administrador.
          </p>
          <Button onClick={handleLogout} className="w-full h-12 bg-[#121413] hover:bg-[#202322] text-white">
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F6F5F2]">
      {/* Left Column - Form */}
      <div className="w-full md:w-1/2 p-6 md:p-12 lg:p-20 flex flex-col justify-center bg-white relative">
        <a 
          href="#/" 
          className="absolute top-8 left-8 flex items-center text-xs font-semibold text-[#626866] hover:text-[#202322] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Ir para o site principal
        </a>

        <div className="max-w-sm mx-auto w-full py-12">
          {/* Logo Brand */}
          <div className="mb-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#121413] text-white font-black text-xl mx-auto mb-6 flex items-center justify-center shadow-md border border-[#DDD8CF]/40">
              O.
            </div>
            <h1 className="text-2xl font-black text-[#202322] tracking-tight mb-2">
              Acessar Ordum
            </h1>
            <p className="text-sm text-[#626866]">
              {isRecoveryMode 
                ? "Informe seu e-mail para receber as instruções de recuperação." 
                : "Informe suas credenciais corporativas para entrar."}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs leading-relaxed animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isRecoveryMode ? (
            /* Standard Login Form */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    required
                    className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#202322]">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoveryMode(true);
                      setErrorMessage("");
                      setRecoverySuccess(false);
                      setRecoveryEmail(email);
                    }}
                    className="text-xs font-medium text-[#B66E45] hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-sm font-bold bg-[#121413] hover:bg-[#202322] text-white rounded-xl shadow-sm cursor-pointer transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Entrar <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          ) : recoverySuccess ? (
            /* Recovery Success Notice */
            <div className="space-y-6 text-center animate-in fade-in">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs text-[#626866] leading-relaxed">
                Se existir uma conta associada a este e-mail, você receberá as instruções de recuperação em instantes.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(false);
                  setRecoverySuccess(false);
                  setErrorMessage("");
                }}
                className="w-full h-11 text-xs font-semibold bg-[#F6F5F2] hover:bg-[#DDD8CF] text-[#202322] rounded-xl border border-[#DDD8CF]"
              >
                Voltar para o Login
              </Button>
            </div>
          ) : (
            /* Password Recovery Form */
            <form onSubmit={handleRecoverySubmit} className="space-y-5 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    required
                    className="w-full pl-10 pr-4 py-3 text-sm border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45] bg-[#F6F5F2]/30 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-sm font-bold bg-[#B66E45] hover:bg-[#A05C35] text-white rounded-xl shadow-sm cursor-pointer transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </span>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(false);
                  setErrorMessage("");
                }}
                className="w-full py-2 text-xs font-semibold text-[#626866] hover:text-[#202322] transition-colors"
              >
                Cancelar e voltar
              </button>
            </form>
          )}

          <div className="mt-10 pt-8 border-t border-[#DDD8CF]/40 text-center">
            <p className="text-[11px] text-[#626866]">
              Acesso restrito. Contas criadas mediante convite administrativo.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Brand Showcase */}
      <div className="hidden md:flex w-1/2 bg-[#121413] text-white items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#B66E45]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#B66E45]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-xs font-mono tracking-wider text-[#B66E45] uppercase">
            <Shield className="w-3.5 h-3.5" />
            ORDUM Security Engine
          </div>

          <h2 className="text-3xl font-black tracking-tight leading-tight text-white">
            A ordem que move grandes empresas.
          </h2>

          <p className="text-sm text-gray-400 leading-relaxed font-normal">
            Plataforma unificada para governança comercial, canais de integridade, gestão de talentos e operações corporativas.
          </p>

          <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-4 text-xs font-mono text-gray-400">
            <div>
              <span className="block font-bold text-white mb-0.5">RBAC Unificado</span>
              <span>Perfis & Permissões</span>
            </div>
            <div>
              <span className="block font-bold text-white mb-0.5">Auditoria Global</span>
              <span>Trilhas de Logs Realtime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
