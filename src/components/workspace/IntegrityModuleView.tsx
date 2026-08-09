import { useState } from "react";
import { ArrowLeft, BarChart3, Settings, ShieldCheck } from "lucide-react";
import { IntegrityDashboard } from "./integrity/IntegrityDashboard";
import { IntegrityCasesList } from "./integrity/IntegrityCasesList";
import { IntegrityCaseDetail } from "./integrity/IntegrityCaseDetail";
import { IntegritySettings } from "./integrity/IntegritySettings";
import { IntegrityNotifications } from "./integrity/IntegrityNotifications";

type Props = { tenant:{ id:string;name?:string }; user:{ permissions?:string[] } | unknown; onBack:()=>void };
type Section = "dashboard" | "cases" | "settings";

export function IntegrityModuleView({ tenant,user,onBack }: Props) {
  const permissions = (user as any)?.permissions || [];
  const canSettings = permissions.includes("integrity.settings.manage");
  const [section,setSection] = useState<Section>("dashboard");
  const [caseId,setCaseId] = useState<string | null>(null);
  if (caseId) return <IntegrityCaseDetail tenantId={tenant.id} caseId={caseId} permissions={permissions} onBack={() => setCaseId(null)} />;
  return <div className="min-h-full bg-[#F6F5F2] text-[#202322]">
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#DDD8CF] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3"><button aria-label="Voltar" onClick={onBack} className="rounded-lg p-2 hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></button><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3457D5]/10"><ShieldCheck className="h-5 w-5 text-[#3457D5]" /></div><div><h1 className="font-bold">Ordum Integridade</h1><p className="text-xs text-[#626866]">Cockpit de investigação e governança</p></div></div>
      <div className="flex items-center gap-2"><IntegrityNotifications tenantId={tenant.id} enabled={permissions.includes("integrity.notifications.read")} onOpenCase={setCaseId} /><nav className="flex gap-1 rounded-xl bg-[#F6F5F2] p-1" aria-label="Áreas do Integridade"><NavButton active={section === "dashboard"} onClick={() => setSection("dashboard")} icon={<BarChart3 className="h-4 w-4" />}>Visão geral</NavButton><NavButton active={section === "cases"} onClick={() => setSection("cases")} icon={<ShieldCheck className="h-4 w-4" />}>Casos</NavButton>{canSettings ? <NavButton active={section === "settings"} onClick={() => setSection("settings")} icon={<Settings className="h-4 w-4" />}>Configurações</NavButton> : null}</nav></div>
    </header>
    {section === "dashboard" ? <IntegrityDashboard tenantId={tenant.id} onOpenCases={() => setSection("cases")} /> : null}
    {section === "cases" ? <IntegrityCasesList tenantId={tenant.id} canExport={permissions.includes("integrity.exports.execute")} onSelect={setCaseId} /> : null}
    {section === "settings" && canSettings ? <IntegritySettings tenantId={tenant.id} /> : null}
  </div>;
}

function NavButton({ active,onClick,icon,children }: { active:boolean;onClick:()=>void;icon:React.ReactNode;children:React.ReactNode }) {
  return <button aria-label={typeof children === "string" ? children : undefined} onClick={onClick} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold sm:text-sm ${active ? "bg-white text-[#3457D5] shadow-sm" : "text-[#626866]"}`}>{icon}<span className="hidden sm:inline">{children}</span></button>;
}
