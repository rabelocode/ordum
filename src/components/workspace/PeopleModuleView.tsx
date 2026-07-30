import { useTenant } from "../../core/auth/TenantProvider";
import React from "react";
import { Users, Server, Key, ArrowLeft, Terminal } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  tenant: any;
  user: any;
  onBack: () => void;
}



export function PeopleModuleView({ tenant, user, onBack }: Props) {
  
  const tenantCtx = useTenant();
  const roleKeys = tenantCtx.roles.map((r: any) => r.key);
  
  
  const isAdmin = tenantCtx.hasPermission('people.communication.manage') || roleKeys.includes('TENANT_ADMIN');
  const isManager = tenantCtx.hasPermission('people.request.manage_team') || roleKeys.includes('TENANT_ADMIN');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <button onClick={onBack} className="hover:text-[#202322] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Workspace
        </button>
        <span>/</span>
        <span className="font-medium text-[#202322]">Ordum Pessoas</span>
      </div>

      <div className="rounded-3xl border border-[#16897A]/30 bg-white p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#E4F5F1] rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row gap-6">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-[#E4F5F1] text-[#16897A] font-extrabold shadow-xs">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-black text-[#202322]">Ordum Pessoas</h1>
              <span className="px-2.5 py-1 bg-[#16897A]/10 text-[#16897A] text-[10px] font-bold uppercase rounded-full">Solução Ativa</span>
            </div>
            <p className="text-sm text-[#626866] max-w-2xl leading-relaxed">
              Portal do colaborador, envio de comunicados corporativos oficiais, central de 
              solicitações de RH (atestados, férias) e registro com protocolo de leitura digital.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-[#DDD8CF] bg-[#FAF8F3]/50 p-8 sm:p-12 text-center space-y-6">
        <div className="w-16 h-16 bg-white border border-[#DDD8CF] shadow-sm rounded-2xl flex items-center justify-center mx-auto text-[#626866]">
          <Terminal className="w-8 h-8" />
        </div>
        
        <div className="max-w-xl mx-auto space-y-3">
          <h2 className="text-xl font-bold text-[#202322]">Estrutura Pronta para Integração</h2>
          <p className="text-sm text-[#626866] leading-relaxed">
            A interface desta solução não foi recriada para a demonstração local. O ambiente do workspace 
            está preparado para receber o sistema existente de Pessoas por meio da arquitetura de integração já estabelecida.
          </p>
        </div>

        <div className="max-w-2xl mx-auto text-left bg-white p-6 rounded-xl border border-[#DDD8CF]/60 shadow-sm">
          <h3 className="text-sm font-bold text-[#202322] mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-[#16897A]" /> Ponto de Montagem do Sistema
          </h3>
          
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Contrato de Entrada (Props Injetadas)</span>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 font-mono text-xs text-[#202322] overflow-x-auto">
                <span className="text-[#16897A]">tenant</span>: {JSON.stringify({ id: tenant.id, slug: tenant.slug }, null, 2)}<br/>
                <span className="text-[#16897A]">user</span>: {JSON.stringify({ id: user.id, role: user.role }, null, 2)}
              </div>
            </div>
            
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Autenticação e Permissões</span>
              <p className="text-xs text-[#626866] flex items-start gap-2">
                <Key className="w-4 h-4 flex-shrink-0 mt-0.5" />
                O sistema de Pessoas utilizará o contexto do tenant injetado pelo Workspace. 
                Nenhuma reautenticação será necessária (SSO garantido pelo shell corporativo).
              </p>
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={onBack} className="mt-4">
          Voltar para o Workspace
        </Button>
      </div>
    </div>
  );
}
