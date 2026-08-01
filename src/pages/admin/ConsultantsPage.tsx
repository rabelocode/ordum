import React, { useState, useEffect } from 'react';
import { 
  Search, Users, UserPlus, ShieldAlert, ShieldCheck, CheckCircle2, 
  Ban, RefreshCw, Edit3, X, Loader2, AlertCircle, Calendar, Mail, Check
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../core/auth/AuthProvider';
import { usePlatform } from '../../core/auth/PlatformAuthProvider';

interface StaffMember {
  id: string;
  user_id: string;
  relationship_type: string;
  status: 'active' | 'suspended' | 'invited';
  created_at: string;
  user?: {
    id: string;
    email: string;
    user_metadata?: { full_name?: string };
    last_sign_in_at?: string;
  };
  role?: {
    id: string;
    key: string;
    name: string;
  };
  teams?: Array<{
    id: string;
    name: string;
  }>;
}

export function ConsultantsPage() {
  const { session } = useAuth();
  const { platformRole } = usePlatform();

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);

  // Invite Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'sales'>('sales');
  const [inviteRelationship, setInviteRelationship] = useState<string>('employee');
  const [inviteTeamIds, setInviteTeamIds] = useState<string[]>([]);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Edit Form state
  const [editRole, setEditRole] = useState<'admin' | 'manager' | 'sales'>('sales');
  const [editRelationship, setEditRelationship] = useState<string>('employee');
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Action Loading ID
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadStaffAndTeams = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      // Fetch Staff
      const resStaff = await fetch('/api/admin/staff', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (resStaff.ok) {
        const dataStaff = await resStaff.json();
        setMembers(dataStaff);
      }

      // Fetch Teams
      const resTeams = await fetch('/api/admin/teams', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (resTeams.ok) {
        const dataTeams = await resTeams.json();
        setTeamsList(dataTeams);
      }
    } catch (e) {
      console.error('Failed to load staff/teams:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffAndTeams();
  }, [session]);

  // When role changes to admin, force relationship to partner
  useEffect(() => {
    if (inviteRole === 'admin') {
      setInviteRelationship('partner');
    }
  }, [inviteRole]);

  useEffect(() => {
    if (editRole === 'admin') {
      setEditRelationship('partner');
    }
  }, [editRole]);

  const handleOpenInviteModal = () => {
    setInviteEmail('');
    setInviteRole(platformRole?.key === 'manager' ? 'sales' : 'sales');
    setInviteRelationship(platformRole?.key === 'manager' ? 'employee' : 'employee');
    setInviteTeamIds([]);
    setActionError('');
    setIsInviteModalOpen(true);
  };

  const handleOpenEditModal = (member: StaffMember) => {
    setSelectedMember(member);
    setEditRole((member.role?.key as any) || 'sales');
    setEditRelationship(member.relationship_type || 'employee');
    setEditTeamIds((member.teams || []).map((t) => t.id));
    setActionError('');
    setIsEditModalOpen(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setActionError('');

    if (!inviteEmail.trim()) {
      setActionError('Informe o e-mail do colaborador.');
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role_key: inviteRole,
          relationship_type: inviteRole === 'admin' ? 'partner' : inviteRelationship,
          team_ids: inviteTeamIds
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar convite.');
      }

      setActionSuccess('Convite enviado com sucesso por e-mail!');
      setIsInviteModalOpen(false);
      await loadStaffAndTeams();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao enviar convite.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedMember) return;
    setActionError('');

    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`/api/admin/staff/${selectedMember.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          role_key: editRole,
          relationship_type: editRole === 'admin' ? 'partner' : editRelationship,
          team_ids: editTeamIds
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar membro.');
      }

      setActionSuccess('Membro atualizado com sucesso!');
      setIsEditModalOpen(false);
      await loadStaffAndTeams();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao atualizar membro.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleSuspendMember = async (memberId: string) => {
    if (!session) return;
    if (!window.confirm('Tem certeza que deseja suspender este membro? Ele perderá o acesso ao painel.')) {
      return;
    }

    setActionLoadingId(memberId);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/staff/${memberId}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao suspender membro.');
      }

      setActionSuccess('Membro suspenso com sucesso.');
      await loadStaffAndTeams();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao suspender membro.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReactivateMember = async (memberId: string) => {
    if (!session) return;

    setActionLoadingId(memberId);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/staff/${memberId}/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao reativar membro.');
      }

      setActionSuccess('Membro reativado com sucesso.');
      await loadStaffAndTeams();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao reativar membro.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTerminateSessions = async (memberId: string) => {
    if (!session || !window.confirm('Encerrar todas as sessões renováveis deste usuário?')) return;
    setActionLoadingId(memberId); setActionError('');
    try { const res=await fetch(`/api/admin/staff/${memberId}/terminate-sessions`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Falha ao encerrar sessões.');setActionSuccess('Sessões encerradas. Tokens de acesso atuais expiram no prazo configurado pelo Supabase.'); }
    catch(err:any){setActionError(err.message||'Falha ao encerrar sessões.');}finally{setActionLoadingId(null);}
  };

  const filteredMembers = members.filter(m => {
    const search = searchTerm.toLowerCase();
    const name = m.user?.user_metadata?.full_name?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    const roleName = m.role?.name?.toLowerCase() || m.role?.key?.toLowerCase() || '';
    return name.includes(search) || email.includes(search) || roleName.includes(search);
  });

  const getRelationshipLabel = (type: string) => {
    switch (type) {
      case 'partner': return 'Sócio / Diretoria';
      case 'employee': return 'CLT / Interno';
      case 'contractor': return 'Contratado / PJ';
      case 'representative': return 'Representante Comercial';
      case 'agency': return 'Agência Parceira';
      default: return type;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202322]">Equipe ORDUM</h1>
          <p className="text-[#626866] mt-1 text-xs">
            Gerenciamento global de colaboradores internos, diretores, gerentes e consultores comerciais.
          </p>
        </div>
        <Button 
          onClick={handleOpenInviteModal}
          className="w-full sm:w-auto gap-2 bg-[#121413] hover:bg-[#202322] text-white text-xs font-bold"
        >
          <UserPlus className="w-4 h-4" />
          <span>Convidar Colaborador</span>
        </Button>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-[#DDD8CF]/60 shadow-sm overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-[#DDD8CF]/40 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou função..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] focus:ring-1 focus:ring-[#B66E45]"
            />
          </div>
          <div className="text-xs text-gray-500">
            Total: <span className="font-bold text-[#202322]">{filteredMembers.length}</span> colaboradores
          </div>
        </div>

        {/* Members List Table */}
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-[#B66E45] animate-spin" />
            <span className="text-xs">Carregando membros da equipe...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#DDD8CF]/40 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3.5 font-bold">Membro</th>
                  <th className="px-6 py-3.5 font-bold">Função</th>
                  <th className="px-6 py-3.5 font-bold">Vínculo</th>
                  <th className="px-6 py-3.5 font-bold">Equipes</th>
                  <th className="px-6 py-3.5 font-bold">Status</th>
                  <th className="px-6 py-3.5 font-bold">Último Acesso</th>
                  <th className="px-6 py-3.5 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/30 text-xs">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-xs">
                      Nenhum colaborador encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(member => {
                    const name = member.user?.user_metadata?.full_name || member.user?.email || 'Sem nome';
                    const avatar = name.substring(0, 2).toUpperCase();
                    const isSuspended = member.status === 'suspended';
                    const isInvited = member.status === 'invited';

                    return (
                      <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Member Name/Email */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#121413] text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {avatar}
                            </div>
                            <div>
                              <div className="font-bold text-[#202322]">{name}</div>
                              <div className="text-[11px] text-gray-500 font-mono mt-0.5">{member.user?.email || '-'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            member.role?.key === 'admin' 
                              ? 'bg-amber-100 text-amber-800' 
                              : member.role?.key === 'manager'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {member.role?.name || member.role?.key || '-'}
                          </span>
                        </td>

                        {/* Relationship */}
                        <td className="px-6 py-4 text-gray-600 font-medium">
                          {getRelationshipLabel(member.relationship_type)}
                        </td>

                        {/* Teams */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {member.teams && member.teams.length > 0 ? (
                              member.teams.map(t => (
                                <span key={t.id} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">
                                  {t.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-[11px] italic">Nenhuma</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-100 text-red-800">
                              <Ban className="w-3 h-3" /> Suspenso
                            </span>
                          ) : isInvited ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Mail className="w-3 h-3" /> Convidado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </span>
                          )}
                        </td>

                        {/* Last sign in */}
                        <td className="px-6 py-4 text-gray-500 font-mono text-[11px]">
                          {member.user?.last_sign_in_at 
                            ? new Date(member.user.last_sign_in_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })
                            : 'Nunca acessou'}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {platformRole?.key==='admin'&&<button onClick={()=>handleTerminateSessions(member.id)} disabled={actionLoadingId===member.id} className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-800 rounded-lg" title="Encerrar sessões">Sessões</button>}
                            <button
                              onClick={() => handleOpenEditModal(member)}
                              className="p-1.5 text-gray-500 hover:text-[#202322] hover:bg-gray-100 rounded-lg transition-colors"
                              title="Editar Função / Vínculo"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {isSuspended ? (
                              <button
                                onClick={() => handleReactivateMember(member.id)}
                                disabled={actionLoadingId === member.id}
                                className="px-2.5 py-1 text-[11px] font-bold bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
                              >
                                {actionLoadingId === member.id ? 'Reativando...' : 'Reativar'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSuspendMember(member.id)}
                                disabled={actionLoadingId === member.id}
                                className="px-2.5 py-1 text-[11px] font-bold bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                {actionLoadingId === member.id ? 'Suspendendo...' : 'Suspender'}
                              </button>
                            )}
                          </div>
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

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#DDD8CF]/60 space-y-5 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-[#DDD8CF]/40 pb-4">
              <h2 className="text-lg font-bold text-[#202322]">Convidar Novo Colaborador</h2>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-[#202322]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  E-mail do Colaborador
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colaborador@empresa.com"
                  required
                  className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Função na Plataforma (Role)
                </label>
                <select
                  value={inviteRole}
                  onChange={(e: any) => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                >
                  <option value="sales">Sales (Vendedor / Consultor Commercial)</option>
                  {platformRole?.key === 'admin' && (
                    <>
                      <option value="manager">Manager (Gerente de Equipe)</option>
                      <option value="admin">Admin (Diretoria / Administrador Global)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Vínculo Institucional
                </label>
                {inviteRole === 'admin' ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium">
                    Regra da Plataforma: Administradores globais devem possuir vínculo <strong>Sócio / Diretoria (Partner)</strong>.
                  </div>
                ) : (
                  <select
                    value={inviteRelationship}
                    onChange={(e) => setInviteRelationship(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                  >
                    <option value="employee">CLT / Interno (Employee)</option>
                    <option value="contractor">Contratado / PJ (Contractor)</option>
                    <option value="representative">Representante Comercial (Representative)</option>
                    <option value="agency">Agência Parceira (Agency)</option>
                    <option value="partner">Sócio (Partner)</option>
                  </select>
                )}
              </div>

              {/* Teams Checkboxes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                  Atribuir às Equipes (Opcional)
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-[#DDD8CF] rounded-xl p-3 bg-[#F6F5F2]/20">
                  {teamsList.length === 0 ? (
                    <span className="text-gray-400 text-xs italic">Nenhuma equipe cadastrada.</span>
                  ) : (
                    teamsList.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-xs font-medium text-[#202322] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteTeamIds.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteTeamIds([...inviteTeamIds, t.id]);
                            } else {
                              setInviteTeamIds(inviteTeamIds.filter(id => id !== t.id));
                            }
                          }}
                          className="rounded border-[#DDD8CF] text-[#B66E45] focus:ring-[#B66E45]"
                        />
                        <span>{t.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="bg-[#121413] hover:bg-[#202322] text-white text-xs font-bold"
                >
                  {isSubmittingInvite ? 'Enviando...' : 'Enviar Convite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {isEditModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#DDD8CF]/60 space-y-5 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-[#DDD8CF]/40 pb-4">
              <h2 className="text-lg font-bold text-[#202322]">Editar Função & Vínculo</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-[#202322]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Colaborador
                </label>
                <div className="p-3 bg-[#F6F5F2] rounded-xl text-xs font-bold text-[#202322]">
                  {selectedMember.user?.user_metadata?.full_name || selectedMember.user?.email}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Função na Plataforma
                </label>
                <select
                  value={editRole}
                  onChange={(e: any) => setEditRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                >
                  <option value="sales">Sales (Vendedor / Consultor Comercial)</option>
                  <option value="manager">Manager (Gerente de Equipe)</option>
                  <option value="admin">Admin (Diretoria / Administrador Global)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-1">
                  Vínculo Institucional
                </label>
                {editRole === 'admin' ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium">
                    Regra da Plataforma: Administradores globais devem possuir vínculo <strong>Sócio / Diretoria (Partner)</strong>.
                  </div>
                ) : (
                  <select
                    value={editRelationship}
                    onChange={(e) => setEditRelationship(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-[#DDD8CF] rounded-xl focus:outline-none focus:border-[#B66E45] bg-[#F6F5F2]/30"
                  >
                    <option value="employee">CLT / Interno (Employee)</option>
                    <option value="contractor">Contratado / PJ (Contractor)</option>
                    <option value="representative">Representante Comercial (Representative)</option>
                    <option value="agency">Agência Parceira (Agency)</option>
                    <option value="partner">Sócio (Partner)</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#202322] mb-2">
                  Atribuição de Equipes
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-[#DDD8CF] rounded-xl p-3 bg-[#F6F5F2]/20">
                  {teamsList.map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-xs font-medium text-[#202322] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTeamIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditTeamIds([...editTeamIds, t.id]);
                          } else {
                            setEditTeamIds(editTeamIds.filter(id => id !== t.id));
                          }
                        }}
                        className="rounded border-[#DDD8CF] text-[#B66E45] focus:ring-[#B66E45]"
                      />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="bg-[#121413] hover:bg-[#202322] text-white text-xs font-bold"
                >
                  {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
