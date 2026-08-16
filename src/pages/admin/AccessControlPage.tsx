import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Pencil, Plus, Search, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { AccessPreview } from '../../components/admin/AccessPreview';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { ListSkeleton } from '../../components/ui/LoadingSkeletons';
import { useAccess } from '../../core/auth/AccessContext';
import { userFacingApiError, userFacingException } from '../../lib/userFacingError';
import { permissionGroups, permissionLabel, roleAreas, roleDescription, roleLabel, SYSTEM_ROLE_KEYS } from './adminAccessPresentation';

type Tab = 'access' | 'roles' | 'permissions';
type Role = { id: string; key: string; name: string; description?: string; active?: boolean; system_managed?: boolean; member_count?: number; active_member_count?: number; permission_keys?: string[] };
type Permission = { key: string; category?: string | null; description?: string | null };
type Team = { id: string; name: string };
type StaffMember = {
  id: string; user_id: string; status: string; relationship_type: string;
  user?: { email?: string; last_sign_in_at?: string; user_metadata?: { full_name?: string } };
  role?: Role;
  teams?: Team[];
};
type Matrix = {
  members: Array<{ id: string; user_id: string; status: string; relationship_type: string; platform_roles?: Role }>;
  rolePermissions: Array<{ role_id: string; platform_permissions?: { key?: string; description?: string; category?: string } }>;
  teamMemberships: Array<{ platform_member_id: string; team_id: string; team_role: string; status: string; platform_teams?: Team }>;
};

const STATUS_LABELS: Record<string, string> = { active: 'Ativo', invited: 'Convite pendente', suspended: 'Suspenso' };

export function AccessControlPage() {
  const { session, user, hasPlatformPermission } = useAccess();
  const [tab, setTab] = useState<Tab>('access');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matrix, setMatrix] = useState<Matrix>({ members: [], rolePermissions: [], teamMemberships: [] });
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editTeams, setEditTeams] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<'save' | 'suspend' | null>(null);
  const [permissionRoleId, setPermissionRoleId] = useState('');
  const [diagnosticMemberId, setDiagnosticMemberId] = useState('');
  const [diagnosticPermission, setDiagnosticPermission] = useState('');
  const [diagnosticTeamId, setDiagnosticTeamId] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState<{ allowed: boolean; origin?: string } | null>(null);
  const [roleEditor, setRoleEditor] = useState<Role | 'new' | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescriptionText, setRoleDescriptionText] = useState('');
  const [rolePermissionKeys, setRolePermissionKeys] = useState<string[]>([]);
  const [confirmRoleImpact, setConfirmRoleImpact] = useState(false);

  const canManage = hasPlatformPermission('platform.staff.manage');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError('');
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [staffResponse, matrixResponse, teamsResponse, rolesResponse] = await Promise.all([
        fetch('/api/admin/staff', { headers }),
        fetch('/api/admin/access/matrix', { headers }),
        fetch('/api/admin/teams', { headers }),
        fetch('/api/admin/access/roles', { headers }),
      ]);
      const [staffBody, matrixBody, teamsBody, rolesBody] = await Promise.all([
        staffResponse.json().catch(() => ([])),
        matrixResponse.json().catch(() => ({})),
        teamsResponse.json().catch(() => ([])),
        rolesResponse.json().catch(() => ({})),
      ]);
      if (!staffResponse.ok) throw new Error(userFacingApiError(staffBody, staffResponse.status, 'Não foi possível carregar as pessoas.'));
      if (!matrixResponse.ok) throw new Error(userFacingApiError(matrixBody, matrixResponse.status, 'Não foi possível carregar os acessos.'));
      if (!teamsResponse.ok) throw new Error(userFacingApiError(teamsBody, teamsResponse.status, 'Não foi possível carregar as equipes.'));
      if (!rolesResponse.ok) throw new Error(userFacingApiError(rolesBody, rolesResponse.status, 'Não foi possível carregar os papéis.'));
      setStaff(staffBody || []); setMatrix(matrixBody); setTeams(teamsBody || []);
      setRoles((rolesBody.roles || []).sort((a: Role, b: Role) => roleLabel(a).localeCompare(roleLabel(b), 'pt-BR')));
      setAvailablePermissions(rolesBody.permissions || []);
    } catch (caught) {
      setError(userFacingException(caught, 'Não foi possível carregar os acessos. Tente novamente.'));
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const permissionsByRole = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const item of matrix.rolePermissions) {
      const key = item.platform_permissions?.key;
      if (!key) continue;
      result.set(item.role_id, [...(result.get(item.role_id) || []), key]);
    }
    return result;
  }, [matrix.rolePermissions]);

  useEffect(() => {
    if (!permissionRoleId && roles[0]) setPermissionRoleId(roles[0].id);
    if (!diagnosticMemberId && staff[0]) setDiagnosticMemberId(staff[0].id);
    if (!diagnosticPermission) {
      const first = matrix.rolePermissions.find(item => item.platform_permissions?.key)?.platform_permissions?.key;
      if (first) setDiagnosticPermission(first);
    }
    const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('member');
    if (requested && !selected) {
      const member = staff.find(item => item.id === requested);
      if (member) openAccess(member);
    }
  }, [diagnosticMemberId, diagnosticPermission, matrix.rolePermissions, permissionRoleId, roles, selected, staff]);

  const filtered = useMemo(() => staff.filter(member => {
    const term = query.trim().toLowerCase();
    const name = member.user?.user_metadata?.full_name || '';
    const email = member.user?.email || '';
    return (!term || `${name} ${email}`.toLowerCase().includes(term))
      && (!roleFilter || member.role?.id === roleFilter)
      && (!statusFilter || member.status === statusFilter)
      && (!teamFilter || member.teams?.some(team => team.id === teamFilter));
  }), [query, roleFilter, staff, statusFilter, teamFilter]);

  function permissionsForRole(roleId?: string) {
    const role = roles.find(item => item.id === roleId);
    return role?.permission_keys || (roleId ? permissionsByRole.get(roleId) || [] : []);
  }
  function permissionsForMember(member: StaffMember) { return permissionsForRole(member.role?.id); }
  function openAccess(member: StaffMember) {
    setSelected(member); setEditRole(member.role?.key || ''); setEditTeams((member.teams || []).map(team => team.id));
    setError(''); setSuccess('');
  }

  async function applyUpdate() {
    if (!session || !selected) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/admin/staff/${selected.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_key: editRole, team_ids: editTeams }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(userFacingApiError(body, response.status, 'Não foi possível atualizar o acesso.'));
      setSuccess('Função e equipes atualizadas.');
      setPendingAction(null); setSelected(null);
      await load();
    } catch (caught) { setError(userFacingException(caught, 'Não foi possível atualizar o acesso.')); }
    finally { setSaving(false); }
  }

  async function changeStatus(action: 'suspend' | 'reactivate') {
    if (!session || !selected) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/admin/staff/${selected.id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(userFacingApiError(body, response.status, action === 'suspend' ? 'Não foi possível suspender o acesso.' : 'Não foi possível reativar o acesso.'));
      setSuccess(action === 'suspend' ? 'Acesso suspenso.' : 'Acesso reativado.');
      setPendingAction(null); setSelected(null);
      await load();
    } catch (caught) { setError(userFacingException(caught, 'Não foi possível alterar o acesso.')); }
    finally { setSaving(false); }
  }

  function requestSave() {
    if (!selected) return;
    const removedTeam = (selected.teams || []).some(team => !editTeams.includes(team.id));
    const administrativeChange = selected.role?.key === 'admin' || editRole === 'admin';
    if (removedTeam || administrativeChange) setPendingAction('save');
    else void applyUpdate();
  }

  function openRoleEditor(role: Role | 'new') {
    setRoleEditor(role);
    setRoleName(role === 'new' ? '' : role.name);
    setRoleDescriptionText(role === 'new' ? '' : role.description || '');
    setRolePermissionKeys(role === 'new' ? [] : (role.permission_keys || []).filter(key => key !== 'platform.access'));
    setError(''); setSuccess(''); setConfirmRoleImpact(false);
  }

  function toggleRolePermission(key: string) {
    setRolePermissionKeys(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  }

  function requestRoleSave() {
    if (!roleName.trim()) { setError('Informe um nome para o papel.'); return; }
    if (roleEditor !== 'new' && roleEditor && Number(roleEditor.member_count || 0) > 0) {
      const before = [...(roleEditor.permission_keys || []).filter(key => key !== 'platform.access')].sort().join('|');
      const after = [...rolePermissionKeys].sort().join('|');
      if (before !== after) { setConfirmRoleImpact(true); return; }
    }
    void saveRole();
  }

  async function saveRole() {
    if (!session || !roleEditor) return;
    setSaving(true); setError('');
    try {
      const editing = roleEditor !== 'new';
      const response = await fetch(editing ? `/api/admin/access/roles/${roleEditor.id}` : '/api/admin/access/roles', {
        method: editing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roleName.trim(), description: roleDescriptionText.trim(), permission_keys: rolePermissionKeys }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(userFacingApiError(body, response.status, 'Não foi possível salvar este papel.'));
      setSuccess(editing ? 'Papel atualizado.' : 'Papel criado.');
      setConfirmRoleImpact(false); setRoleEditor(null);
      await load();
    } catch (caught) { setError(userFacingException(caught, 'Não foi possível salvar este papel.')); }
    finally { setSaving(false); }
  }

  async function simulate(event: React.FormEvent) {
    event.preventDefault(); if (!session) return;
    setSaving(true); setError(''); setDiagnosticResult(null);
    try {
      const response = await fetch('/api/admin/access/simulate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformMemberId: diagnosticMemberId, permission: diagnosticPermission, teamId: diagnosticTeamId || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(userFacingApiError(body, response.status, 'Não foi possível diagnosticar este acesso.'));
      setDiagnosticResult(body);
    } catch (caught) { setError(userFacingException(caught, 'Não foi possível diagnosticar este acesso.')); }
    finally { setSaving(false); }
  }

  const selectedRole = roles.find(role => role.key === editRole);
  const selectedRolePermissions = permissionsForRole(selectedRole?.id);
  const permissionRoleKeys = permissionsForRole(permissionRoleId);
  const selectedIsSelf = selected?.user_id === user?.id;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#B66E45]">Administração</p><h1 className="mt-1 text-3xl font-black">Acessos e permissões</h1><p className="mt-1 text-sm text-[#626866]">Defina quem pode fazer o quê na Ordum.</p></div>
      <a href="#/admin/membros" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD8CF] bg-white px-4 py-2.5 text-sm font-bold"><Users className="h-4 w-4"/>Ver membros</a>
    </header>

    {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}<button aria-label="Fechar erro" onClick={() => setError('')} className="ml-auto"><X className="h-4 w-4"/></button></div> : null}
    {success ? <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>{success}<button aria-label="Fechar mensagem" onClick={() => setSuccess('')} className="ml-auto"><X className="h-4 w-4"/></button></div> : null}

    <nav aria-label="Áreas de acesso" className="flex gap-1 overflow-x-auto border-b border-[#DDD8CF]">
      {([['access', 'Acessos'], ['roles', 'Papéis'], ['permissions', 'Permissões']] as Array<[Tab, string]>).map(([key, label]) => <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${tab === key ? 'border-[#B66E45] text-[#202322]' : 'border-transparent text-[#626866]'}`}>{label}</button>)}
    </nav>

    {loading ? <ListSkeleton rows={7}/> : tab === 'access' ? <>
      <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm lg:grid-cols-[1fr_repeat(3,minmax(150px,210px))]">
        <label className="relative"><span className="sr-only">Buscar pessoa</span><Search className="absolute left-3 top-3 h-4 w-4 text-[#777D7A]"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full rounded-xl border border-[#DDD8CF] py-2.5 pl-9 pr-3 text-sm"/></label>
        <FilterSelect label="Função" value={roleFilter} onChange={setRoleFilter} options={roles.map(role => ({ value: role.id, label: roleLabel(role) }))}/>
        <FilterSelect label="Equipe" value={teamFilter} onChange={setTeamFilter} options={teams.map(team => ({ value: team.id, label: team.name }))}/>
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}/>
      </section>
      <p className="text-sm text-[#626866]">{filtered.length} pessoa{filtered.length === 1 ? '' : 's'} com acesso administrativo</p>
      {filtered.length === 0 ? <EmptyAccess/> : <div className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white">
        <div className="hidden grid-cols-[1.5fr_1fr_1.2fr_1.2fr_.8fr_auto] gap-4 border-b bg-[#F6F5F2] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#777D7A] md:grid"><span>Nome</span><span>Função</span><span>Equipes</span><span>Nível de acesso</span><span>Status</span><span></span></div>
        <div className="divide-y">{filtered.map(member => <AccessRow key={member.id} member={member} permissions={permissionsForMember(member)} onManage={() => openAccess(member)}/>)}</div>
      </div>}
    </> : tab === 'roles' ? <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Papéis disponíveis</h2><p className="mt-1 text-sm text-[#626866]">Cada papel reúne um conjunto padrão de áreas e ações.</p></div>{canManage ? <button onClick={() => openRoleEditor('new')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202322] px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4"/>Novo papel</button> : null}</div>
      <div className="grid gap-4 lg:grid-cols-2">{roles.map(role => {
        const keys = permissionsForRole(role.id); const count = Number(role.member_count ?? staff.filter(member => member.role?.id === role.id).length); const system = Boolean(role.system_managed || SYSTEM_ROLE_KEYS.has(role.key));
        return <article key={role.id} className="rounded-2xl border border-[#DDD8CF] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{roleLabel(role)}</h3><p className="mt-1 text-sm text-[#626866]">{roleDescription(role)}</p></div><span className="rounded-full bg-[#F6F5F2] px-2.5 py-1 text-xs font-bold">{system ? 'Papel do sistema' : 'Personalizado'}</span></div><p className="mt-4 text-sm"><strong>{count}</strong> pessoa{count === 1 ? '' : 's'}</p><div className="mt-4 flex flex-wrap gap-2">{roleAreas(keys).map(area => <span key={area} className="rounded-lg bg-[#F3E8E1] px-2.5 py-1 text-xs font-bold text-[#8B4C2D]">{area}</span>)}</div><div className="mt-5 border-t border-[#EEEAE3] pt-4">{system ? <span className="inline-flex items-center gap-2 text-sm font-bold text-[#626866]"><ShieldCheck className="h-4 w-4"/>Permissões protegidas</span> : canManage ? <button onClick={() => openRoleEditor(role)} className="inline-flex items-center gap-2 text-sm font-bold text-[#8B4C2D]"><Pencil className="h-4 w-4"/>Editar papel</button> : null}</div></article>;
      })}</div>
    </section> : <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <div className="space-y-5"><div><h2 className="text-xl font-black">Permissões por papel</h2><p className="mt-1 text-sm text-[#626866]">Veja as áreas e ações incluídas em cada função.</p></div><label className="block text-sm font-bold">Função<select value={permissionRoleId} onChange={event => setPermissionRoleId(event.target.value)} className="mt-1 w-full rounded-xl border border-[#DDD8CF] bg-white p-2.5 font-normal">{roles.map(role => <option key={role.id} value={role.id}>{roleLabel(role)}</option>)}</select></label><div className="rounded-2xl border border-[#DDD8CF] bg-white p-5"><AccessPreview permissions={permissionRoleKeys} detailed/></div></div>
      <form onSubmit={simulate} className="h-fit space-y-4 rounded-2xl bg-[#202322] p-5 text-white"><div><p className="text-xs font-bold uppercase tracking-wide text-[#D99368]">Ferramenta administrativa</p><h2 className="mt-1 text-lg font-black">Diagnosticar acesso</h2><p className="mt-1 text-sm text-white/60">Confira uma capacidade específica sem alterar o acesso.</p></div><label className="block text-sm font-bold">Pessoa<select value={diagnosticMemberId} onChange={event => setDiagnosticMemberId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 p-2.5 font-normal">{staff.map(member => <option className="text-black" key={member.id} value={member.id}>{member.user?.user_metadata?.full_name || member.user?.email || 'Pessoa da Ordum'}</option>)}</select></label><label className="block text-sm font-bold">Ação consultada<select value={diagnosticPermission} onChange={event => setDiagnosticPermission(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 p-2.5 font-normal">{[...new Set(matrix.rolePermissions.map(item => item.platform_permissions?.key).filter(Boolean) as string[])].sort((a, b) => permissionLabel(a).localeCompare(permissionLabel(b), 'pt-BR')).map(key => <option className="text-black" key={key} value={key}>{permissionLabel(key)}</option>)}</select></label><label className="block text-sm font-bold">Equipe <span className="font-normal text-white/60">(opcional)</span><select value={diagnosticTeamId} onChange={event => setDiagnosticTeamId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 p-2.5 font-normal"><option className="text-black" value="">Sem equipe específica</option>{teams.map(team => <option className="text-black" key={team.id} value={team.id}>{team.name}</option>)}</select></label><button disabled={saving || !diagnosticMemberId || !diagnosticPermission} className="w-full rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold disabled:opacity-50">Verificar acesso</button>{diagnosticResult ? <div role="status" className={`rounded-xl p-4 text-sm ${diagnosticResult.allowed ? 'bg-emerald-400/15 text-emerald-200' : 'bg-red-400/15 text-red-200'}`}><strong>{diagnosticResult.allowed ? 'Acesso permitido.' : 'Acesso não permitido.'}</strong><p className="mt-1 opacity-80">{diagnosticResult.allowed ? 'A função e o escopo atendem a esta ação.' : 'A função ou o escopo atual não permite esta ação.'}</p></div> : null}</form>
    </section>}

    {selected ? <div className="fixed inset-0 z-[60] flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-labelledby="access-drawer-title" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#B66E45]">Gerenciar acesso</p><h2 id="access-drawer-title" className="mt-1 text-2xl font-black">{selected.user?.user_metadata?.full_name || selected.user?.email || 'Pessoa da Ordum'}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-[#F6F5F2] px-2.5 py-1 font-bold">{roleLabel(selected.role)}</span><StatusBadge status={selected.status}/></div></div><button aria-label="Fechar" onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5"/></button></div>
      <div className="mt-7 space-y-6"><section><h3 className="font-black">Função</h3><p className="mt-1 text-sm text-[#626866]">Define o conjunto padrão de áreas e ações.</p><select aria-label="Função" disabled={!canManage || selectedIsSelf} value={editRole} onChange={event => setEditRole(event.target.value)} className="mt-3 w-full rounded-xl border border-[#DDD8CF] p-2.5 disabled:bg-gray-100">{roles.map(role => <option key={role.id} value={role.key}>{roleLabel(role)}</option>)}</select>{selectedIsSelf ? <p className="mt-2 text-xs text-amber-800">Por segurança, você não pode alterar a própria função.</p> : null}</section>
      <section><h3 className="font-black">Equipes</h3><p className="mt-1 text-sm text-[#626866]">Define em quais equipes esta pessoa atua. A função continua determinando as permissões.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{teams.length === 0 ? <p className="text-sm text-[#626866]">Nenhuma equipe cadastrada.</p> : teams.map(team => <label key={team.id} className="flex items-center gap-2 rounded-xl border border-[#DDD8CF] p-3 text-sm"><input type="checkbox" disabled={!canManage} checked={editTeams.includes(team.id)} onChange={event => setEditTeams(current => event.target.checked ? [...current, team.id] : current.filter(id => id !== team.id))}/><span>{team.name}</span></label>)}</div></section>
      <section className="rounded-2xl border border-[#DDD8CF] p-5"><AccessPreview permissions={selectedRolePermissions} detailed/></section>
      <section className="grid gap-3 rounded-2xl bg-[#F6F5F2] p-4 text-sm sm:grid-cols-2"><div><span className="text-xs font-bold uppercase text-[#777D7A]">Último acesso</span><p className="mt-1 font-semibold">{formatLastAccess(selected.user?.last_sign_in_at)}</p></div><div><span className="text-xs font-bold uppercase text-[#777D7A]">Cadastro</span><p className="mt-1"><a className="font-bold text-[#B66E45]" href={`#/admin/membros?q=${encodeURIComponent(selected.user?.email || '')}`}>Ver pessoa <ChevronRight className="inline h-4 w-4"/></a></p></div></section>
      {canManage ? <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between"><div>{selected.status === 'suspended' ? <button onClick={() => void changeStatus('reactivate')} disabled={saving} className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-800">Reativar acesso</button> : <button onClick={() => setPendingAction('suspend')} disabled={saving || selectedIsSelf} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-40">Suspender acesso</button>}</div><button onClick={requestSave} disabled={saving || (selectedIsSelf && editRole !== selected.role?.key)} className="rounded-xl bg-[#202322] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar acesso'}</button></div> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Seu perfil permite consultar, mas não alterar acessos.</p>}</div>
    </aside></div> : null}

    {roleEditor ? <div className="fixed inset-0 z-[70] flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-labelledby="role-editor-title" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setRoleEditor(null); }}><aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#B66E45]">{roleEditor === 'new' ? 'Novo papel' : 'Editar papel'}</p><h2 id="role-editor-title" className="mt-1 text-2xl font-black">{roleEditor === 'new' ? 'Crie uma função para sua operação' : roleLabel(roleEditor)}</h2><p className="mt-1 text-sm text-[#626866]">Escolha em linguagem simples as áreas e ações disponíveis.</p></div><button aria-label="Fechar editor de papel" disabled={saving} onClick={() => setRoleEditor(null)} className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5"/></button></div>
      <div className="mt-7 grid gap-7 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-6"><section className="grid gap-4"><label className="text-sm font-bold">Nome<input autoFocus value={roleName} onChange={event => setRoleName(event.target.value)} maxLength={80} placeholder="Ex.: Coordenador Financeiro" className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-3 font-normal"/></label><label className="text-sm font-bold">Descrição<textarea value={roleDescriptionText} onChange={event => setRoleDescriptionText(event.target.value)} maxLength={280} rows={3} placeholder="Explique a responsabilidade deste papel." className="mt-1 w-full resize-none rounded-xl border border-[#DDD8CF] p-3 font-normal"/></label></section>
      <section><h3 className="font-black">Permissões</h3><p className="mt-1 text-sm text-[#626866]">Marque somente o necessário para esta função.</p><div className="mt-4 space-y-5">{permissionGroups(availablePermissions.map(permission => permission.key).filter(key => key !== 'platform.access')).map(group => <fieldset key={group.label}><legend className="text-sm font-black text-[#343937]">{group.label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.items.map(item => <label key={item.key} className={`flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm transition ${rolePermissionKeys.includes(item.key) ? 'border-[#B66E45] bg-[#FBF5F1]' : 'border-[#DDD8CF] bg-white'}`}><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#B66E45]" checked={rolePermissionKeys.includes(item.key)} onChange={() => toggleRolePermission(item.key)}/><span>{item.label}</span></label>)}</div></fieldset>)}</div></section></div>
      <aside className="h-fit rounded-2xl border border-[#DDD8CF] bg-[#F9F8F5] p-5 lg:sticky lg:top-4"><AccessPreview permissions={['platform.access', ...rolePermissionKeys]} detailed/><p className="mt-4 border-t border-[#DDD8CF] pt-4 text-xs text-[#626866]">O acesso ao painel é incluído automaticamente. O papel não altera a participação em equipes.</p></aside></div>
      <div className="mt-7 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"><button disabled={saving} onClick={() => setRoleEditor(null)} className="rounded-xl border border-[#DDD8CF] px-4 py-2.5 text-sm font-bold disabled:opacity-50">Cancelar</button><button disabled={saving || roleName.trim().length < 2} onClick={requestRoleSave} className="rounded-xl bg-[#202322] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Salvando…' : roleEditor === 'new' ? 'Criar papel' : 'Salvar alterações'}</button></div>
    </aside></div> : null}

    <ActionDialog open={pendingAction === 'save'} title="Confirmar alteração de acesso" description="A função administrativa ou o escopo de equipe será alterado. Confirme somente se esta mudança foi revisada." confirmLabel="Confirmar alteração" busy={saving} onClose={() => setPendingAction(null)} onConfirm={applyUpdate}/>
    <ActionDialog open={pendingAction === 'suspend'} title={`Suspender acesso de ${selected?.user?.user_metadata?.full_name || 'esta pessoa'}?`} description="Ela não poderá acessar o painel administrativo até ser reativada. Nenhum cadastro será excluído." confirmLabel="Suspender acesso" danger busy={saving} onClose={() => setPendingAction(null)} onConfirm={() => changeStatus('suspend')}/>
    <ActionDialog open={confirmRoleImpact} title="Confirmar alteração de permissões" description={`Esta alteração afetará ${roleEditor !== 'new' && roleEditor ? Number(roleEditor.member_count || 0) : 0} pessoa${roleEditor !== 'new' && roleEditor && Number(roleEditor.member_count || 0) === 1 ? '' : 's'} que usa${roleEditor !== 'new' && roleEditor && Number(roleEditor.member_count || 0) === 1 ? '' : 'm'} este papel.`} confirmLabel="Salvar alterações" busy={saving} onClose={() => setConfirmRoleImpact(false)} onConfirm={saveRole}/>
  </div>;
}

function AccessRow({ member, permissions, onManage }: { member: StaffMember; permissions: string[]; onManage: () => void }) {
  const name = member.user?.user_metadata?.full_name || member.user?.email || 'Pessoa da Ordum';
  const teams = member.teams?.map(team => team.name).join(', ') || 'Sem equipe';
  const areas = roleAreas(permissions);
  return <article className="grid gap-3 p-4 md:grid-cols-[1.5fr_1fr_1.2fr_1.2fr_.8fr_auto] md:items-center md:px-5">
    <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#202322] text-xs font-black text-white">{initials(name)}</div><div className="min-w-0"><h3 className="truncate font-black">{name}</h3><p className="truncate text-xs text-[#626866]">{member.user?.email || 'E-mail não informado'}</p></div></div>
    <Data label="Função" value={roleLabel(member.role)}/><Data label="Equipes" value={teams}/><Data label="Nível de acesso" value={areas.slice(0, 2).join(' · ') + (areas.length > 2 ? ` +${areas.length - 2}` : '')}/><div><span className="md:hidden text-xs font-bold text-[#777D7A]">Status</span><div className="mt-1 md:mt-0"><StatusBadge status={member.status}/></div></div><button onClick={onManage} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#DDD8CF] px-3 py-2 text-sm font-bold hover:border-[#B66E45]">Gerenciar acesso <ChevronRight className="h-4 w-4"/></button>
  </article>;
}

function Data({ label, value }: { label: string; value: string }) { return <div><span className="text-xs font-bold text-[#777D7A] md:hidden">{label}</span><p className="mt-0.5 text-sm text-[#4F5553] md:mt-0">{value}</p></div>; }
function StatusBadge({ status }: { status: string }) { const tone = status === 'active' ? 'bg-emerald-100 text-emerald-800' : status === 'invited' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{STATUS_LABELS[status] || 'Indisponível'}</span>; }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl border border-[#DDD8CF] bg-white p-2.5 text-sm"><option value="">{label}: todos</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function EmptyAccess() { return <section className="rounded-2xl border border-dashed border-[#C9C3B9] bg-white p-10 text-center"><UserCog className="mx-auto h-10 w-10 text-[#B66E45]"/><h2 className="mt-3 font-black">Nenhuma pessoa encontrada</h2><p className="mt-1 text-sm text-[#626866]">Ajuste a busca ou os filtros para consultar outro acesso.</p></section>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function formatLastAccess(value?: string) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Ainda não acessou'; }
