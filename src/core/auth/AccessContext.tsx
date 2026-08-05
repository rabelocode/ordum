import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useTenant } from './TenantProvider';
import { usePlatform } from './PlatformAuthProvider';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile, Membership, Tenant, Role } from './TenantProvider';
import type { PlatformMember, PlatformRole, PlatformTeam } from '../../types/platform';

interface AccessContextType {
  // Master state
  isLoading: boolean;
  error: string | null;

  // Supabase Auth
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;

  // Profile
  profile: Profile | null;

  // Tenant Context
  tenants: Tenant[];
  memberships: Membership[];
  activeTenant: Tenant | null;
  activeMembership: Membership | null;
  roles: Role[];
  permissions: string[];
  solutions: string[];
  
  // Tenant Multi-Tenancy Actions
  switchTenant: (tenantId: string) => void;
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  hasAllPermissions: (permissionKeys: string[]) => boolean;
  hasSolution: (solutionKey: string) => boolean;

  // Platform Context
  isPlatformMember: boolean;
  isPlatformSuspended: boolean;
  platformMember: PlatformMember | null;
  platformRole: PlatformRole | null;
  platformPermissions: string[];
  memberTeams: PlatformTeam[];
  managedTeams: PlatformTeam[];
  hasPlatformPermission: (permissionKey: string) => boolean;
  refreshAccessContext: () => Promise<void>;
}

const AccessContext = createContext<AccessContextType | null>(null);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const tenant = useTenant();
  const platform = usePlatform();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(auth.isLoading || tenant.isLoading || platform.isPlatformLoading);
  }, [auth.isLoading, tenant.isLoading, platform.isPlatformLoading]);

  const hasAnyPermission = (permissionKeys: string[]) => {
    return permissionKeys.some(key => tenant.permissions.includes(key));
  };

  const hasAllPermissions = (permissionKeys: string[]) => {
    return permissionKeys.every(key => tenant.permissions.includes(key));
  };

  const value: AccessContextType = {
    isLoading,
    error: platform.platformError,
    
    user: auth.user,
    session: auth.session,
    signOut: auth.signOut,

    profile: tenant.profile,

    tenants: tenant.tenants,
    memberships: tenant.memberships,
    activeTenant: tenant.activeTenant,
    activeMembership: tenant.activeMembership,
    roles: tenant.roles,
    permissions: tenant.permissions,
    solutions: tenant.solutions,

    switchTenant: tenant.switchTenant,
    hasPermission: tenant.hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasSolution: tenant.hasSolution,

    isPlatformMember: platform.isPlatformMember,
    isPlatformSuspended: platform.isPlatformSuspended,
    platformMember: platform.platformMember,
    platformRole: platform.platformRole,
    platformPermissions: platform.platformPermissions,
    memberTeams: platform.memberTeams,
    managedTeams: platform.managedTeams,
    hasPlatformPermission: platform.platformCan,
    
    refreshAccessContext: platform.reloadPlatformContext
  };

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
}

export const useAccess = () => {
  const context = useContext(AccessContext);
  if (!context) throw new Error("useAccess must be used within an AccessProvider");
  return context;
};
