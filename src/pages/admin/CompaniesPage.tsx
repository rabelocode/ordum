import React, { useState, useEffect } from 'react';
import { Search, Filter, Building, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../core/auth/AuthProvider';

export function CompaniesPage() {
  const { session } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTenants() {
      if (!session) return;
      try {
        const response = await fetch('/api/admin/clients', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter out leads/demos, only show active/suspended tenants
          const clients = data.filter((t: any) => t.status === 'active' || t.status === 'suspended');
          setTenants(clients);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadTenants();
  }, [session]);

  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202322]">Clientes</h1>
          <p className="text-[#626866] mt-1 text-sm">Gerencie os clientes ativos da ORDUM.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#DDD8CF]/40 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou slug..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-[#DDD8CF] rounded-lg focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45]"
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#DDD8CF]/40 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Soluções</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/30">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0"
                            style={{ backgroundColor: tenant.settings?.primaryColor || '#353938' }}
                          >
                            {tenant.settings?.logoInitials || tenant.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#202322]">{tenant.name}</div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">{tenant.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {tenant.status === 'active' ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {tenant.tenant_solutions?.map((s: any) => (
                            <span key={s.solution_id} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">
                              {s.solution_id}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => window.location.hash = `#/admin/empresas/${tenant.id}`}
                          className="text-[#B66E45] hover:text-[#A05D38] hover:bg-orange-50"
                        >
                          Ver detalhes <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
