import { useTenant } from "../../core/auth/TenantProvider";
import React, { useState } from "react";
import {
  ShieldCheck,
  Users,
  Briefcase,
  Activity,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight,
  PlusCircle,
  AlertCircle,
  Megaphone,
  Check,
} from "lucide-react";
import { UserProfile, TenantInfo, ModuleId, ModuleManifest } from "../../types";
import { ModuleRegistry, ORDUM_MODULES } from "../../core/modules/registry";
import { ModuleCard } from "../ui/ModuleCard";
import { MetricCard } from "../ui/MetricCard";
import { Button } from "../ui/Button";

interface WorkspaceHomeProps {

  user: UserProfile;
  tenant: TenantInfo;
  enabledModules: ModuleId[];
  onNavigate: (path: string) => void;
  onOpenDemoRequest?: (moduleName: string) => void;
}

export function WorkspaceHome({
  user,
  tenant,
  enabledModules,

  onNavigate,
  onOpenDemoRequest,
}: WorkspaceHomeProps) {
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const { permissions, hasPermission, roles } = useTenant();
  const roleKeys = roles.map((r: any) => r.key);
  
  const canViewIntegrity = hasPermission('integrity.indicator.view') || hasPermission('integrity.case.triage') || hasPermission('integrity.case.view_assigned') || hasPermission('integrity.report.submit_public') || roleKeys.includes('TENANT_ADMIN');
  const canViewPeople = hasPermission('people.communication.view') || hasPermission('people.document.view_own') || hasPermission('people.payslip.view_own') || roleKeys.includes('TENANT_ADMIN');
  const canViewTalent = hasPermission('talent.job.publish') || hasPermission('talent.application.view') || hasPermission('talent.interview.manage') || roleKeys.includes('TENANT_ADMIN');
  
  const canManageIntegrity = hasPermission('integrity.case.triage') || hasPermission('integrity.case.assign') || roleKeys.includes('TENANT_ADMIN');
  const canManagePeople = hasPermission('people.communication.manage') || hasPermission('people.document.manage') || roleKeys.includes('TENANT_ADMIN');
  const canManageTalent = hasPermission('talent.job.create') || hasPermission('talent.assessment.manage') || roleKeys.includes('TENANT_ADMIN');
  
  const isExecutive = hasPermission('integrity.indicator.view') || roleKeys.includes('TENANT_ADMIN');

  const activeModules = ModuleRegistry.getEnabledModules(enabledModules);

  // Uncontracted modules for "Conheça outras soluções" section
  const allModulesList = ModuleRegistry.getAllModules();
  const uncontractedModules = allModulesList.filter(
    (m) => !enabledModules.includes(m.id)
  );

  const pendingCounts: Record<ModuleId, number> = {
    integrity: 2,
    people: 1,
    talent: 4,
  };

  const handleActivationRequest = (moduleName: string) => {
    if (onOpenDemoRequest) {
      onOpenDemoRequest(moduleName);
    } else {
      setSuccessToast(`Solicitação de ativação da solução ${moduleName} enviada com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Dynamic Success Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#202322] text-white text-xs px-4.5 py-3 rounded-xl shadow-lg border border-white/10 flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
          <Check className="w-4 h-4 text-[#1F8A63]" />
          <span>{successToast}</span>
        </div>
      )}

      {/* User Greeting Section */}
      <div className="rounded-2xl border border-[#DDD8CF]/80 bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.01)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#B66E45]/5 via-[#FAF8F3] to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[#DDD8CF]/80 bg-[#FAF8F3] px-2.5 py-1 text-[10px] font-bold text-[#B66E45] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#B66E45]" />
              <span>{tenant.branding.companyName}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-[#202322] tracking-tight">
              Olá, {user.name}. O que você precisa gerenciar hoje?
            </h1>

            <p className="text-xs text-[#626866] font-medium">
              Todas as soluções e atividades da sua empresa unificados em um mesmo ecossistema seguro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="p-3.5 rounded-xl bg-[#FAF8F3] border border-[#DDD8CF]/80 text-center min-w-[110px] shadow-2xs">
              <div className="text-[10px] text-[#626866] font-bold uppercase tracking-wider">Soluções da sua empresa</div>
              <div className="text-xl font-black text-[#202322] mt-0.5">{activeModules.length} de 3</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF8F3] border border-[#DDD8CF]/80 text-center min-w-[110px] shadow-2xs">
              <div className="text-[10px] text-[#626866] font-bold uppercase tracking-wider">Pendências</div>
              <div className="text-xl font-black text-[#C98224] mt-0.5">7 itens</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contracted Modules Adaptive Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#202322] uppercase tracking-wider text-[#626866]">
            Soluções da sua empresa
          </h2>
          <span className="text-xs text-[#626866] font-semibold">
            Dados ilustrativos da interface • Exibindo {activeModules.length} {activeModules.length === 1 ? "solução" : "soluções"}
          </span>
        </div>

        {/* Adaptive Layout Grid */}
        {activeModules.length === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {activeModules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                pendingCount={pendingCounts[mod.id]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {activeModules.length === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeModules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                pendingCount={pendingCounts[mod.id]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {activeModules.length === 1 && (
          <div className="space-y-5">
            <ModuleCard
              module={activeModules[0]}
              pendingCount={pendingCounts[activeModules[0].id]}
              onNavigate={onNavigate}
              isSpotlight={true}
            />
          </div>
        )}
      </div>

      
      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(canViewIntegrity) && enabledModules.includes("integrity") && (
          <MetricCard
            title="Relatos do Canal"
            value="8 Registros"
            change="Em acompanhamento"
            changeType="positive"
            subtitle="2 sob análise ativa"
            accentColor="#3457D5"
            icon={<ShieldCheck className="w-4 h-4" />}
          />
        )}
        
        {(canViewPeople) && enabledModules.includes("people") && (
          <MetricCard
            title="Colaboradores"
            value="Base Cadastral"
            change="Adesão registrada"
            changeType="positive"
            subtitle="Comunicações em curso"
            accentColor="#16897A"
            icon={<Users className="w-4 h-4" />}
          />
        )}
        
        {(canViewTalent) && enabledModules.includes("talent") && (
          <MetricCard
            title="Vagas Abertas"
            value="4 Vagas"
            change="38 Candidatos"
            changeType="neutral"
            subtitle="Processos em andamento"
            accentColor="#D98C32"
            icon={<Briefcase className="w-4 h-4" />}
          />
        )}
        
        {(isExecutive) && (
          <MetricCard
            title="Conformidade LGPD"
            value="Estruturado"
            change="Adequado"
            changeType="positive"
            subtitle="Trilha registrada"
            accentColor="#B66E45"
            icon={<CheckCircle className="w-4 h-4" />}
          />
        )}
      </div>

      {/* Recent Activities & Quick Tasks Panel */}
      <div className="rounded-2xl border border-[#DDD8CF]/80 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#DDD8CF]/30">
          <div className="flex items-center gap-2">
            <Activity className="w-4.5 h-4.5 text-[#B66E45]" />
            <h3 className="text-xs font-bold text-[#202322] uppercase tracking-wider text-[#353938]">
              Atividades Recentes & Prazos
            </h3>
          </div>
          <span className="text-[10px] text-[#626866] font-bold">Dados ilustrativos da interface</span>
        </div>
        
        <div className="space-y-2.5">
          {(canManageIntegrity) && enabledModules.includes("integrity") && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F3]/60 border border-[#DDD8CF]/40 text-xs gap-4 hover:bg-[#FAF8F3] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-[#3457D5] flex-shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-[#202322]">
                    [Integridade] Relato #PROT-2026-89 recebido
                  </span>
                  <p className="text-[10px] text-[#626866] mt-0.5 truncate">
                    Aguardando atribuição de comitê. Prazo legal de resposta em 14 dias.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-8 rounded-lg cursor-pointer"
                onClick={() => onNavigate("/workspace/integridade")}
              >
                Analisar
              </Button>
            </div>
          )}
          
          {(canManagePeople) && enabledModules.includes("people") && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F3]/60 border border-[#DDD8CF]/40 text-xs gap-4 hover:bg-[#FAF8F3] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-[#16897A] flex-shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-[#202322]">
                    [Pessoas] Comunicado "Código de Ética 2026"
                  </span>
                  <p className="text-[10px] text-[#626866] mt-0.5 truncate">
                    218 de 242 colaboradores já confirmaram leitura eletrônica.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-8 rounded-lg cursor-pointer"
                onClick={() => onNavigate("/workspace/pessoas")}
              >
                Auditar
              </Button>
            </div>
          )}
          
          {(canManageTalent) && enabledModules.includes("talent") && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F3]/60 border border-[#DDD8CF]/40 text-xs gap-4 hover:bg-[#FAF8F3] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-[#D98C32] flex-shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-[#202322]">
                    [Talentos] Vaga Analista de Compliance Sênior
                  </span>
                  <p className="text-[10px] text-[#626866] mt-0.5 truncate">
                    3 novos candidatos cadastrados na etapa de triagem de currículo.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-8 rounded-lg cursor-pointer"
                onClick={() => onNavigate("/workspace/talentos")}
              >
                Pipeline
              </Button>
            </div>
          )}
          
          {/* Fallback empty state if no activities are allowed */}
          {(!canViewIntegrity && !canViewPeople && !canViewTalent) && (
             <div className="p-4 text-center text-gray-500 text-xs">
               Nenhuma atividade pendente no momento.
             </div>
          )}
        </div>
      </div>
      
      {/* Uncontracted Modules Area */}
      {(isExecutive) && (

        <div className="pt-5 border-t border-[#DDD8CF]/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#202322] uppercase tracking-wider text-[#626866]">
                Conheça Outras Soluções Integradas
              </h3>
              <p className="text-[11px] text-[#626866]">
                Expanda as capacidades organizacionais da sua empresa habilitando novas soluções nativas.
              </p>
            </div>
            <span className="text-[9px] font-bold text-[#B66E45] bg-[#B66E45]/5 border border-[#D2926D]/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Ativação On-Demand
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {uncontractedModules.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-dashed border-[#DDD8CF] bg-white flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-bold text-[#202322] mb-0.5">{m.name}</div>
                  <p className="text-[11px] text-[#626866] leading-relaxed max-w-md">{m.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleActivationRequest(m.name)}
                  className="flex-shrink-0 text-[10px] h-8 border-[#B66E45] text-[#B66E45] hover:bg-[#B66E45] hover:text-white rounded-lg cursor-pointer font-bold"
                >
                  Falar com consultor
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
