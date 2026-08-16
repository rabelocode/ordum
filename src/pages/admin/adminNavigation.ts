export type AdminNavigationContext = {
  can: (permission: string) => boolean;
  roleKey?: string;
  hasTeams?: boolean;
};

export type AdminNavigationChild = {
  id: string;
  label: string;
  path: string;
  permissions: string[];
  legacyRoles?: string[];
  allowTeamMember?: boolean;
  routePrefixes?: string[];
};

export type AdminNavigationGroup = {
  id: string;
  label: string;
  icon: 'commercial' | 'clients' | 'finance' | 'operations' | 'administration';
  children: AdminNavigationChild[];
};

export const adminNavigationDefinition: AdminNavigationGroup[] = [
  {
    id: 'commercial', label: 'Comercial', icon: 'commercial', children: [
      { id: 'leads', label: 'Leads', path: '#/admin/leads', permissions: ['platform.leads.read'], legacyRoles: ['sales'] },
      { id: 'demos', label: 'Demonstrações', path: '#/admin/demos', permissions: ['platform.demos.manage'], legacyRoles: ['sales'] },
      { id: 'proposals', label: 'Propostas', path: '#/admin/propostas', permissions: ['platform.commercial.read'] },
      { id: 'contracts', label: 'Contratos', path: '#/admin/contratos', permissions: ['platform.commercial.read'] },
    ],
  },
  {
    id: 'clients', label: 'Clientes', icon: 'clients', children: [
      { id: 'companies', label: 'Empresas', path: '#/admin/empresas', routePrefixes: ['#/admin/empresas/'], permissions: ['platform.clients.read'], legacyRoles: ['sales'] },
      { id: 'onboarding', label: 'Implantação', path: '#/admin/onboarding', permissions: ['platform.onboarding.read'] },
      { id: 'success', label: 'Customer Success', path: '#/admin/customer-success', permissions: ['platform.success.read'] },
    ],
  },
  {
    id: 'finance', label: 'Financeiro', icon: 'finance', children: [
      { id: 'finance-overview', label: 'Visão geral', path: '#/admin/financeiro?view=overview', permissions: ['platform.billing.read'] },
      { id: 'subscriptions', label: 'Assinaturas', path: '#/admin/financeiro?view=subscriptions', permissions: ['platform.billing.read'] },
      { id: 'charges', label: 'Cobranças', path: '#/admin/financeiro?view=payments', permissions: ['platform.billing.read'] },
      { id: 'overdue', label: 'Inadimplência', path: '#/admin/financeiro?view=overdue', permissions: ['platform.billing.read'] },
      { id: 'plans', label: 'Planos', path: '#/admin/planos', permissions: ['platform.billing.read'] },
    ],
  },
  {
    id: 'operations', label: 'Operação', icon: 'operations', children: [
      { id: 'support', label: 'Suporte', path: '#/admin/suporte', permissions: ['platform.support.read'] },
      { id: 'audit', label: 'Auditoria', path: '#/admin/auditoria', permissions: ['platform.audit.read', 'platform.audit.team.read'] },
      { id: 'system', label: 'Saúde do sistema', path: '#/admin/sistema', permissions: ['platform.system.read'] },
    ],
  },
  {
    id: 'administration', label: 'Administração', icon: 'administration', children: [
      { id: 'staff', label: 'Membros', path: '#/admin/membros', routePrefixes: ['#/admin/consultores', '#/admin/pessoas'], permissions: ['platform.staff.read'], legacyRoles: ['admin'] },
      { id: 'teams', label: 'Equipes', path: '#/admin/equipes', routePrefixes: ['#/admin/equipes/'], permissions: ['platform.teams.read'], allowTeamMember: true },
      { id: 'access', label: 'Acessos e permissões', path: '#/admin/acessos', permissions: ['platform.access.simulate'] },
      { id: 'settings', label: 'Configurações', path: '#/admin/configuracoes', permissions: ['platform.settings.read'] },
    ],
  },
];

export function canSeeNavigationChild(child: AdminNavigationChild, context: AdminNavigationContext) {
  return child.permissions.some(context.can)
    || Boolean(context.roleKey && child.legacyRoles?.includes(context.roleKey))
    || Boolean(child.allowTeamMember && context.hasTeams);
}

export function buildAdminNavigation(context: AdminNavigationContext) {
  return adminNavigationDefinition
    .map(group => ({ ...group, children: group.children.filter(child => canSeeNavigationChild(child, context)) }))
    .filter(group => group.children.length > 0);
}

function parsedLocation(currentPath: string) {
  const normalized = currentPath.startsWith('#') ? currentPath : `#${currentPath}`;
  const [pathname, query = ''] = normalized.split('?');
  return { pathname, params: new URLSearchParams(query) };
}

export function isNavigationChildActive(child: AdminNavigationChild, currentPath: string) {
  const current = parsedLocation(currentPath);
  const target = parsedLocation(child.path);
  if (target.pathname === '#/admin/financeiro') {
    const currentView = current.params.get('view') || 'overview';
    return current.pathname === target.pathname && currentView === target.params.get('view');
  }
  return current.pathname === target.pathname || Boolean(child.routePrefixes?.some(prefix => current.pathname.startsWith(prefix)));
}

export function activeAdminNavigation(navigation: AdminNavigationGroup[], currentPath: string) {
  for (const group of navigation) {
    const child = group.children.find(item => isNavigationChildActive(item, currentPath));
    if (child) return { group, child };
  }
  return null;
}

export function adminBreadcrumb(navigation: AdminNavigationGroup[], currentPath: string) {
  const active = activeAdminNavigation(navigation, currentPath);
  if (!active) return 'Início';
  const { pathname } = parsedLocation(currentPath);
  if (active.child.id === 'companies' && pathname !== '#/admin/empresas') return 'Clientes / Empresa';
  if (active.child.id === 'teams' && pathname !== '#/admin/equipes') return 'Administração / Equipe';
  return `${active.group.label} / ${active.child.label}`;
}

export function isKnownAdminRouteAllowed(navigation: AdminNavigationGroup[], currentPath: string) {
  const known = activeAdminNavigation(adminNavigationDefinition, currentPath);
  if (!known) return true;
  return navigation.some(group => group.id === known.group.id && group.children.some(child => child.id === known.child.id));
}
