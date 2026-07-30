import React from 'react';
import { Settings, Shield, Clock, HardDrive, BarChart3, Cloud, GitCommit } from 'lucide-react';

export function PlaceholderAdminPage({ title }: { title: string }) {
  const path = title.replace('/admin/', '');
  
  const getPageDetails = () => {
    switch (path) {
      case 'leads': return { icon: <BarChart3 className="w-8 h-8 text-blue-500"/>, title: 'Gestão de Leads', desc: 'Acompanhe prospectos, funil de vendas e qualificação.' };
      case 'demos': return { icon: <Cloud className="w-8 h-8 text-purple-500"/>, title: 'Demonstrações', desc: 'Agendamentos e instâncias de demonstração ativas.' };
      case 'desempenho': return { icon: <BarChart3 className="w-8 h-8 text-green-500"/>, title: 'Meu Desempenho', desc: 'Métricas individuais, fechamentos e metas.' };
      case 'solucoes': return { icon: <HardDrive className="w-8 h-8 text-orange-500"/>, title: 'Soluções', desc: 'Catálogo de módulos disponíveis na ORDUM.' };
      case 'auditoria': return { icon: <Clock className="w-8 h-8 text-gray-500"/>, title: 'Auditoria Global', desc: 'Logs de ações administrativas e de segurança.' };
      case 'sistema': return { icon: <Shield className="w-8 h-8 text-red-500"/>, title: 'Saúde do Sistema', desc: 'Monitoramento de recursos, APIs e banco de dados.' };
      case 'deployments': return { icon: <GitCommit className="w-8 h-8 text-indigo-500"/>, title: 'Deployments', desc: 'Versões lançadas e histórico de atualizações.' };
      case 'configuracoes': return { icon: <Settings className="w-8 h-8 text-slate-500"/>, title: 'Configurações', desc: 'Parametrização global da plataforma e integrações.' };
      case 'engenharia': return { icon: <GitCommit className="w-8 h-8 text-emerald-500"/>, title: 'Engenharia', desc: 'Ferramentas de debug, acesso ao código e infraestrutura.' };
      default: return { icon: <Settings className="w-8 h-8 text-gray-500"/>, title: path.toUpperCase(), desc: 'Módulo em desenvolvimento.' };
    }
  };

  const info = getPageDetails();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
            {info.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#202322]">{info.title}</h1>
            <p className="text-[#626866] mt-1 text-sm">{info.desc}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 shadow-sm p-16 flex flex-col items-center justify-center text-center">
        
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {path === 'engenharia' ? 'Integração de Repositório Não Configurada' : path === 'deployments' ? 'Integração de Deployment Não Configurada' : 'Em Construção'}
        </h2>
        <p className="text-gray-500 max-w-md">
          {path === 'engenharia' 
            ? 'A área de engenharia requer integração com o repositório Git para exibir branches, commits e documentação técnica.'
            : path === 'deployments'
            ? 'Não há integrações de CI/CD conectadas no momento para exibir histórico de deploys.'
            : 'Este módulo está sendo arquitetado de acordo com os requisitos de negócio estabelecidos.'}
        </p>

      </div>
    </div>
  );
}
