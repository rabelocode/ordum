import { useState } from "react";
import { ArrowLeft, BarChart3, BriefcaseBusiness, FileBarChart, Settings, ShieldCheck } from "lucide-react";
import { IntegrityDashboard } from "./integrity/IntegrityDashboard";
import { IntegrityCasesList } from "./integrity/IntegrityCasesList";
import { IntegrityCaseDetail } from "./integrity/IntegrityCaseDetail";
import { IntegritySettings } from "./integrity/IntegritySettings";
import { IntegrityNotifications } from "./integrity/IntegrityNotifications";
import { IntegrityReports } from "./integrity/IntegrityReports";

type Props={tenant:{id:string;name?:string};user:{name?:string;permissions?:string[]}|unknown;onBack:()=>void};
type Section="overview"|"cases"|"investigations"|"reports"|"settings";

export function IntegrityModuleView({tenant,user,onBack}:Props){
  const profile=user as {name?:string;permissions?:string[]};const permissions=profile.permissions||[];const canSettings=permissions.includes("integrity.settings.manage");const canExport=permissions.includes("integrity.exports.execute")||permissions.includes("integrity.executive.export");
  const[section,setSection]=useState<Section>("overview");const[caseId,setCaseId]=useState<string|null>(null);const[caseView,setCaseView]=useState("all");
  const openCases=(view="all")=>{setCaseView(view);setSection("cases");};
  if(caseId)return <IntegrityCaseDetail tenantId={tenant.id} caseId={caseId} permissions={permissions} onBack={()=>setCaseId(null)}/>;
  return <div className="min-h-full bg-[#F6F5F2] text-[#202322]"><header className="sticky top-0 z-20 border-b border-[#DDD8CF] bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><button aria-label="Voltar ao workspace" onClick={onBack} className="rounded-lg p-2 hover:bg-[#F6F5F2]"><ArrowLeft className="h-4 w-4"/></button><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3457D5]/10"><ShieldCheck className="h-5 w-5 text-[#3457D5]"/></div><div><h1 className="font-black">Ordum Integridade</h1><p className="text-xs text-[#626866]">Canal e gestão de casos</p></div></div><IntegrityNotifications tenantId={tenant.id} enabled={permissions.includes("integrity.notifications.read")} onOpenCase={setCaseId}/></div><nav aria-label="Áreas do Integridade" className="mx-auto flex max-w-[1500px] gap-6 overflow-x-auto px-4 sm:px-6">{[
    ["overview","Visão geral",BarChart3],["cases","Casos",ShieldCheck],["investigations","Investigações",BriefcaseBusiness],["reports","Relatórios",FileBarChart],...(canSettings?[["settings","Configurações",Settings]]:[]),
  ].map(([key,label,Icon]:any)=><button key={key} onClick={()=>{setSection(key);if(key==="investigations")setCaseView("mine");}} className={`flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm font-bold ${section===key?"border-[#3457D5] text-[#3457D5]":"border-transparent text-[#626866] hover:text-[#202322]"}`}><Icon className="h-4 w-4"/>{label}</button>)}</nav></header>
    {section==="overview"?<IntegrityDashboard tenantId={tenant.id} userName={profile.name||"Olá"} onOpenCases={openCases} onOpenCase={setCaseId}/>:null}
    {section==="cases"?<IntegrityCasesList key={`cases-${caseView}`} tenantId={tenant.id} canExport={canExport} initialView={caseView} onSelect={setCaseId}/>:null}
    {section==="investigations"?<IntegrityCasesList key="investigations" tenantId={tenant.id} canExport={canExport} initialView="mine" mode="investigations" onSelect={setCaseId}/>:null}
    {section==="reports"?<IntegrityReports tenantId={tenant.id} canExport={canExport}/>:null}
    {section==="settings"&&canSettings?<IntegritySettings tenantId={tenant.id}/>:null}
  </div>;
}
