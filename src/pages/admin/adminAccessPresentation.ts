import { adminNavigationDefinition, buildAdminNavigation } from './adminNavigation';

export const SYSTEM_ROLE_KEYS = new Set(['admin', 'manager', 'sales']);

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendas',
};

const PERMISSION_LABELS: Record<string, string> = {
  'platform.access': 'Acessar o painel administrativo',
  'platform.dashboard.read': 'Visualizar o início',
  'platform.leads.read': 'Visualizar leads',
  'platform.leads.manage': 'Atualizar leads e registrar contatos',
  'platform.leads.assign': 'Distribuir leads',
  'platform.leads.claim': 'Assumir leads disponíveis',
  'platform.demos.manage': 'Agendar e registrar demonstrações',
  'platform.commercial.read': 'Visualizar propostas e contratos',
  'platform.commercial.manage': 'Preparar propostas e contratos',
  'platform.commercial.approve': 'Aprovar condições comerciais',
  'platform.clients.read': 'Visualizar empresas',
  'platform.clients.manage': 'Administrar empresas',
  'platform.clients.assign': 'Definir responsáveis por empresas',
  'platform.clients.provision': 'Ativar novos clientes',
  'platform.clients.suspend': 'Suspender ou reativar clientes',
  'platform.clients.delete': 'Excluir clientes quando permitido',
  'platform.solutions.read': 'Visualizar produtos contratados',
  'platform.solutions.manage': 'Administrar produtos contratados',
  'platform.onboarding.read': 'Visualizar implantações',
  'platform.onboarding.manage': 'Administrar implantações',
  'platform.success.read': 'Visualizar Customer Success',
  'platform.success.manage': 'Administrar Customer Success',
  'platform.billing.read': 'Visualizar financeiro',
  'platform.billing.manage': 'Administrar planos e assinaturas',
  'platform.billing.webhooks.manage': 'Reprocessar eventos financeiros',
  'platform.support.read': 'Visualizar suporte',
  'platform.support.manage': 'Administrar suporte',
  'platform.audit.read': 'Visualizar auditoria global',
  'platform.audit.team.read': 'Visualizar auditoria das próprias equipes',
  'platform.system.read': 'Visualizar saúde do sistema',
  'platform.system.restart': 'Executar ação operacional autorizada',
  'platform.operations.read': 'Visualizar operações internas',
  'platform.operations.manage': 'Reprocessar operações autorizadas',
  'platform.privacy.read': 'Visualizar solicitações de privacidade',
  'platform.privacy.manage': 'Administrar solicitações de privacidade',
  'platform.staff.read': 'Visualizar membros da Ordum',
  'platform.staff.manage': 'Administrar membros da Ordum',
  'platform.staff.invite_sales': 'Convidar pessoas para equipes gerenciadas',
  'platform.teams.read': 'Visualizar equipes',
  'platform.teams.create': 'Criar equipes',
  'platform.teams.manage': 'Administrar equipes',
  'platform.teams.delete': 'Arquivar equipes',
  'platform.teams.members.read': 'Visualizar pessoas das equipes',
  'platform.teams.members.manage': 'Adicionar ou remover pessoas das equipes',
  'platform.team.performance.read': 'Visualizar desempenho das equipes',
  'platform.performance.own.read': 'Visualizar o próprio desempenho',
  'platform.access.simulate': 'Diagnosticar acesso',
  'platform.settings.read': 'Visualizar configurações',
  'platform.settings.manage': 'Alterar configurações',
  'platform.exports.execute': 'Exportar dados autorizados',
  'platform.targets.read': 'Visualizar metas e comissões',
  'platform.targets.manage': 'Administrar metas e comissões',
};

const GROUP_MATCHERS: Array<{ label: string; matches: (key: string) => boolean }> = [
  { label: 'Comercial', matches: key => /\.(leads|demos|commercial|targets|performance)/.test(key) },
  { label: 'Clientes', matches: key => /\.(clients|solutions|onboarding|success)/.test(key) },
  { label: 'Financeiro', matches: key => key.includes('.billing') },
  { label: 'Operação', matches: key => /\.(support|audit|system|operations|privacy)/.test(key) },
  { label: 'Administração', matches: key => /\.(staff|teams|access|settings|exports|dashboard)/.test(key) || key === 'platform.access' },
];

export function roleLabel(role?: { key?: string; name?: string } | null) {
  if (!role) return 'Função não definida';
  return ROLE_LABELS[role.key || ''] || role.name || 'Função personalizada';
}

export function roleDescription(role?: { key?: string; description?: string } | null) {
  if (role?.key === 'admin') return 'Administra toda a operação e os acessos da Ordum.';
  if (role?.key === 'manager') return 'Coordena equipes e acompanha a operação sob sua responsabilidade.';
  if (role?.key === 'sales') return 'Atua no fluxo comercial e na carteira de empresas permitida.';
  return role?.description || 'Acesso configurado para uma responsabilidade específica.';
}

export function permissionLabel(key: string) {
  return PERMISSION_LABELS[key] || 'Capacidade administrativa';
}

export function permissionGroups(keys: string[]) {
  return GROUP_MATCHERS.map(group => ({
    label: group.label,
    items: keys.filter(group.matches).map(key => ({ key, label: permissionLabel(key) })),
  })).filter(group => group.items.length > 0);
}

export function navigationPreview(keys: string[]) {
  const allowed = new Set(keys);
  return buildAdminNavigation({ can: permission => allowed.has(permission) });
}

export function roleAreas(keys: string[]) {
  const groups = navigationPreview(keys).map(group => group.label);
  return groups.length ? groups : ['Somente acesso básico'];
}

export function knownPermissionKeys() {
  return [...new Set(adminNavigationDefinition.flatMap(group => group.children.flatMap(child => child.permissions)))];
}
