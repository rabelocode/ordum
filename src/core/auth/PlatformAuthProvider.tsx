import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { PlatformMember, PlatformRole, PlatformTeam } from "../../types/platform";

interface TenantMembershipInfo {
  id: string;
  tenant_id: string;
  role: string;
  tenants?: {
    id: string;
    name: string;
    slug: string;
    legal_name?: string;
  };
}

interface PlatformContextType {
  isPlatformLoading: boolean;
  platformMember: PlatformMember | null;
  platformRole: PlatformRole | null;
  relationshipType: string | null;
  platformPermissions: string[];
  memberTeams: PlatformTeam[];
  managedTeams: PlatformTeam[];
  isPlatformMember: boolean;
  isPlatformSuspended: boolean;
  tenantMemberships: TenantMembershipInfo[];
  platformError: string | null;
  platformCan: (permissionKey: string) => boolean;
  canReadTeam: (teamId: string) => boolean;
  canManageTeam: (teamId: string) => boolean;
  reloadPlatformContext: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextType>({
  isPlatformLoading: true,
  platformMember: null,
  platformRole: null,
  relationshipType: null,
  platformPermissions: [],
  memberTeams: [],
  managedTeams: [],
  isPlatformMember: false,
  isPlatformSuspended: false,
  tenantMemberships: [],
  platformError: null,
  platformCan: () => false,
  canReadTeam: () => false,
  canManageTeam: () => false,
  reloadPlatformContext: async () => {},
});

export const usePlatform = () => useContext(PlatformContext);

export function PlatformAuthProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoading: isAuthLoading } = useAuth();
  
  const [isPlatformLoading, setIsPlatformLoading] = useState(true);
  const [platformMember, setPlatformMember] = useState<PlatformMember | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformRole | null>(null);
  const [platformPermissions, setPlatformPermissions] = useState<string[]>([]);
  const [memberTeams, setMemberTeams] = useState<PlatformTeam[]>([]);
  const [managedTeams, setManagedTeams] = useState<PlatformTeam[]>([]);
  const [isPlatformMember, setIsPlatformMember] = useState(false);
  const [isPlatformSuspended, setIsPlatformSuspended] = useState(false);
  const [tenantMemberships, setTenantMemberships] = useState<TenantMembershipInfo[]>([]);
  const [platformError, setPlatformError] = useState<string | null>(null);

  const loadPlatformContext = async () => {
    if (isAuthLoading) return;
    
    if (!session) {
      setIsPlatformLoading(false);
      setIsPlatformMember(false);
      setIsPlatformSuspended(false);
      setPlatformError(null);
      setPlatformMember(null);
      setPlatformRole(null);
      setPlatformPermissions([]);
      setMemberTeams([]);
      setManagedTeams([]);
      setTenantMemberships([]);
      return;
    }

    try {
      setIsPlatformLoading(true);
      setPlatformError(null);
      const response = await fetch("/api/admin/me", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsPlatformMember(!!data.isPlatformMember);
        setIsPlatformSuspended(!!data.isPlatformSuspended);
        setPlatformMember(data.platformMember || null);
        setPlatformRole(data.role || null);
        setPlatformPermissions(data.permissions || []);
        setMemberTeams(data.teams || []);
        setManagedTeams(data.managedTeams || []);
        setTenantMemberships(data.tenantMemberships || []);
        setPlatformError(null);
      } else {
        const errData = await response.json().catch(() => ({}));
        setPlatformError(errData.error || `Erro do servidor (${response.status})`);
      }
    } catch (e: any) {
      console.error("Failed to load platform context:", e);
      setPlatformError(e.message || "Erro de conexão com o servidor.");
    } finally {
      setIsPlatformLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformContext();
  }, [session, isAuthLoading]);

  const platformCan = (permissionKey: string) => {
    if (isPlatformSuspended) return false;
    return platformPermissions.includes(permissionKey);
  };

  const canReadTeam = (teamId: string) => {
    if (isPlatformSuspended) return false;
    if (platformRole?.key === 'admin') return true;
    return memberTeams.some(t => t.id === teamId);
  };

  const canManageTeam = (teamId: string) => {
    if (isPlatformSuspended) return false;
    if (platformRole?.key === 'admin') return true;
    return managedTeams.some(t => t.id === teamId);
  };

  const value = {
    isPlatformLoading: isAuthLoading || isPlatformLoading,
    platformMember,
    platformRole,
    relationshipType: platformMember?.relationship_type || null,
    platformPermissions,
    memberTeams,
    managedTeams,
    isPlatformMember,
    isPlatformSuspended,
    tenantMemberships,
    platformError,
    platformCan,
    canReadTeam,
    canManageTeam,
    reloadPlatformContext: loadPlatformContext,
  };

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}
