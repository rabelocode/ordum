export interface AuthorizationContext {
  role?: { key?: string } | null;
  platformMember: { id: string; status?: string };
  teams: Array<{ id: string; member_lead_visibility?: string; member_client_visibility?: string }>;
  managedTeams: Array<{ id: string }>;
  permissions?: string[];
}

export interface Assignment {
  team_id?: string | null;
  owner_platform_member_id?: string | null;
}

export function isGlobalAdmin(context: AuthorizationContext) {
  return context.platformMember?.status !== 'suspended' && context.role?.key === 'admin';
}

export function canReadAssignedResource(
  context: AuthorizationContext,
  assignment: Assignment | null | undefined,
  visibilityField: 'member_lead_visibility' | 'member_client_visibility',
) {
  if (context.platformMember?.status === 'suspended') return false;
  if (isGlobalAdmin(context)) return true;
  if (!assignment?.team_id) return false;
  if (assignment.owner_platform_member_id === context.platformMember.id) return true;
  if (context.managedTeams.some((team) => team.id === assignment.team_id)) return true;
  const team = context.teams.find((candidate) => candidate.id === assignment.team_id);
  return team?.[visibilityField] === 'team' || team?.[visibilityField] === 'all';
}

export function canManageTeam(context: AuthorizationContext, teamId: string) {
  if (context.platformMember?.status === 'suspended') return false;
  return isGlobalAdmin(context) || context.managedTeams.some((team) => team.id === teamId);
}

export function canChangePlatformRole(
  context: AuthorizationContext,
  targetUserId: string,
  actorUserId: string,
  currentRole: string,
  requestedRole: string,
) {
  if (context.platformMember?.status === 'suspended') return false;
  if (targetUserId === actorUserId && currentRole !== requestedRole) return false;
  if (isGlobalAdmin(context)) return true;
  return context.role?.key === 'manager' && currentRole === 'sales' && requestedRole === 'sales';
}

export function relationshipGrantsPrivilege() {
  return false;
}
