const fs = require('fs');
const newCode = `import React, { useState, useEffect } from 'react';
import { ArrowLeft, Building, Settings } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';

export function CompanyDetailPage({ tenantId }: { tenantId: string }) {
  const { session } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function loadTenant() {
      if (!session) return;
      try {
        const response = await fetch(\`/api/admin/tenants/\${tenantId}\`, {
          headers: { 'Authorization': \`Bearer \${session.access_token}\` }
        });
        if (response.ok) {
          const data = await response.json();
          setTenant(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadTenant();
  }, [session, tenantId]);

  if (!tenant) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <a href="#/admin/empresas" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-[#DDD8CF]/40">
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm"
              style={{ backgroundColor: tenant.settings?.primaryColor || '#353938' }}
            >
              {tenant.settings?.logoInitials || tenant.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#202322]">{tenant.name}</h1>
              <p className="text-[#626866] font-mono">{tenant.slug}</p>
            </div>
          </div>
        </div>
        
        <div className="flex border-b border-[#DDD8CF]/40 overflow-x-auto">
          {["Visão Geral", "Soluções", "Usuários", "Organização", "Domínios", "Responsáveis", "Auditoria", "Configurações"].map(tab => {
            const tabId = tab.toLowerCase().replace(/[^a-z]/g, '');
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={\`px-6 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 \${
                  activeTab === tabId ? 'border-[#B66E45] text-[#202322]' : 'border-transparent text-gray-500 hover:text-gray-900'
                }\`}
              >
                {tab}
              </button>
            )
          })}
        </div>
        
        <div className="p-8">
          {activeTab === 'visoogeral' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold">Visão Geral</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-bold text-gray-900 capitalize">{tenant.status}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-500">Criado em</div>
                  <div className="font-bold text-gray-900">{new Date(tenant.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'solues' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold">Soluções Contratadas</h2>
              <div className="grid gap-4">
                {tenant.tenant_solutions?.map((s: any) => (
                  <div key={s.solution_id} className="p-4 border rounded-xl flex justify-between items-center">
                    <span className="font-bold text-gray-700">{s.solution_id}</span>
                    <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded capitalize">{s.status}</span>
                  </div>
                ))}
                {(!tenant.tenant_solutions || tenant.tenant_solutions.length === 0) && (
                  <p className="text-gray-500">Nenhuma solução contratada.</p>
                )}
              </div>
            </div>
          )}
          {activeTab !== 'visoogeral' && activeTab !== 'solues' && (
             <p className="text-gray-600">Conteúdo da aba: {activeTab}</p>
          )}
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/pages/admin/CompanyDetailPage.tsx', newCode);
