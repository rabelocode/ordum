const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/ConsultantsPage.tsx', 'utf8');

const newCode = `import React, { useState, useEffect } from 'react';
import { Search, Filter, Users, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../core/auth/AuthProvider';

export function ConsultantsPage() {
  const { session } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      if (!session) return;
      try {
        const response = await fetch('/api/admin/consultants', {
          headers: { 'Authorization': \`Bearer \${session.access_token}\` }
        });
        if (response.ok) {
          const data = await response.json();
          setMembers(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadMembers();
  }, [session]);

  const filteredMembers = members.filter(m => 
    m.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.user?.user_metadata?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.role?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202322]">Equipe ORDUM</h1>
          <p className="text-[#626866] mt-1 text-sm">Gerencie os membros da plataforma, vendedores e consultores.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="default" className="w-full sm:w-auto gap-2">
            <UserPlus className="w-4 h-4" />
            <span>Convidar Membro</span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#DDD8CF]/40 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou email..." 
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
                  <th className="px-6 py-4 font-semibold">Membro</th>
                  <th className="px-6 py-4 font-semibold">Função</th>
                  <th className="px-6 py-4 font-semibold">Vínculo</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/30">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                      Nenhum membro encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(member => {
                    const name = member.user?.user_metadata?.full_name || member.user?.email || 'Usuário';
                    const avatar = name.substring(0, 2).toUpperCase();
                    return (
                      <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0 bg-[#B66E45]">
                              {avatar}
                            </div>
                            <div>
                              <div className="font-bold text-[#202322]">{name}</div>
                              <div className="text-[11px] text-gray-500 font-mono mt-0.5">{member.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {member.role?.name || member.role?.key || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 capitalize">
                            {member.relationship_type === 'employee' ? 'Interno' :
                             member.relationship_type === 'representative' ? 'Representante Externo' :
                             member.relationship_type === 'partner' ? 'Sócio' :
                             member.relationship_type === 'agency' ? 'Agência' :
                             member.relationship_type === 'contractor' ? 'Contratado' : member.relationship_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={\`inline-flex items-center px-2 py-1 rounded text-xs font-medium \${member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}\`}>
                            {member.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/admin/ConsultantsPage.tsx', newCode);
