import { AlertCircle, Check, Circle, Clock3, Sparkles } from 'lucide-react';
import { useTenant } from '../../core/auth/TenantProvider';
import { ModuleRegistry } from '../../core/modules/registry';
import type { ModuleId, TenantInfo, UserProfile } from '../../types';
import { ModuleCard } from '../ui/ModuleCard';
import { usePilotOverview } from './usePilotOverview';

interface WorkspaceHomeProps {
  user: UserProfile;
  tenant: TenantInfo;
  enabledModules: ModuleId[];
  onNavigate: (path: string) => void;
}

const COUNT_LABEL: Record<ModuleId, string> = {
  integrity: 'relatos em acompanhamento',
  people: 'solicitações em andamento',
  talent: 'candidaturas ativas',
};

export function WorkspaceHome({ user, tenant, enabledModules, onNavigate }: WorkspaceHomeProps) {
  const { permissions, roles } = useTenant();
  const modules = ModuleRegistry.getEnabledModules(enabledModules);
  const overview = usePilotOverview({ tenant, activeModules: enabledModules, permissions, roleCount: roles.length });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="relative overflow-hidden rounded-2xl border border-[#DDD8CF]/80 bg-white p-6 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-gradient-to-bl from-[#B66E45]/10 to-transparent blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-[#DDD8CF] bg-[#FAF8F3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#B66E45]">
              <Sparkles className="h-3 w-3" /> {tenant.branding.companyName}
            </div>
            <h1 className="text-xl font-black tracking-tight text-[#202322] sm:text-2xl">Olá, {user.name}.</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#626866]">Configure o essencial e faça a primeira ação relevante. O progresso abaixo usa somente dados reais deste tenant.</p>
          </div>
          <div className="min-w-44 rounded-xl border border-[#DDD8CF] bg-[#FAF8F3] p-4">
            <div className="flex items-end justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#626866]">Ativação inicial</span>
              <strong className="text-xl text-[#202322]">{overview.progress}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E0D7]" aria-label={`Progresso de ativação: ${overview.progress}%`}>
              <div className="h-full rounded-full bg-[#B66E45] transition-all" style={{ width: `${overview.progress}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
        <div className="rounded-2xl border border-[#DDD8CF]/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#353938]">Checklist do piloto</h2>
              <p className="mt-1 text-xs text-[#626866]">Retome quando quiser; nenhuma etapa fictícia é marcada como concluída.</p>
            </div>
            {overview.loading && <Clock3 className="h-4 w-4 animate-pulse text-[#B66E45]" aria-label="Atualizando" />}
          </div>
          {overview.error && <div className="mb-4 flex gap-2 rounded-xl border border-[#E8C1B9] bg-[#FFF4F1] p-3 text-xs text-[#8B3425]"><AlertCircle className="h-4 w-4 shrink-0" /> {overview.error}</div>}
          <ol className="space-y-3">
            {overview.checklist.map((item) => (
              <li key={item.key} className="flex gap-3 rounded-xl border border-[#E8E3DB] bg-[#FAF8F3]/60 p-3">
                {item.complete ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#16897A]" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#9B7B68]" />}
                <div><p className="text-xs font-bold text-[#202322]">{item.label}</p><p className="mt-0.5 text-[11px] text-[#626866]">{item.detail}</p></div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-[#DDD8CF]/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#353938]">Visão operacional</h2>
          <p className="mt-1 text-xs text-[#626866]">{overview.updatedAt ? `Atualizada às ${new Date(overview.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : 'Aguardando atualização.'}</p>
          <div className="mt-5 space-y-3">
            {enabledModules.map((moduleId) => {
              const count = overview.counts[moduleId];
              return (
                <div key={moduleId} className="rounded-xl border border-[#E8E3DB] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#626866]">{ModuleRegistry.getModule(moduleId)?.name}</p>
                  {count === null ? <p className="mt-1 text-xs text-[#626866]">Indicador indisponível para o seu escopo.</p> : count === 0 ? <p className="mt-1 text-xs text-[#626866]">Ainda não há {COUNT_LABEL[moduleId]}.</p> : <p className="mt-1 text-lg font-black text-[#202322]">{count} <span className="text-xs font-medium text-[#626866]">{COUNT_LABEL[moduleId]}</span></p>}
                </div>
              );
            })}
            {enabledModules.length === 0 && <p className="rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF8F3] p-4 text-xs text-[#626866]">Nenhum módulo está liberado para a combinação atual de contrato e permissões.</p>}
          </div>
        </div>
      </section>

      {modules.length > 0 && (
        <section className="space-y-3">
          <div><h2 className="text-sm font-extrabold uppercase tracking-wider text-[#353938]">Soluções ativas</h2><p className="mt-1 text-xs text-[#626866]">Acesse somente os módulos contratados e autorizados para sua função.</p></div>
          <div className={`grid grid-cols-1 gap-5 ${modules.length > 1 ? 'md:grid-cols-2' : ''} ${modules.length > 2 ? 'xl:grid-cols-3' : ''}`}>
            {modules.map((module) => <ModuleCard key={module.id} module={module} pendingCount={overview.counts[module.id] ?? 0} onNavigate={onNavigate} isSpotlight={modules.length === 1} />)}
          </div>
        </section>
      )}
    </div>
  );
}
