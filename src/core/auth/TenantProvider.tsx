import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '../../lib/supabase';
import { captureClientException } from '../../lib/observability';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_path: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: any;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
}

export interface Role {
  id: string;
  key: string;
}

export interface Solution {
  id: string;
  key: string;
}

interface TenantContextType {
  profile: Profile | null;
  memberships: Membership[];
  activeMembership: Membership | null;
  tenants: Tenant[];
  activeTenant: Tenant | null;
  roles: Role[];
  permissions: string[];
  solutions: string[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => void;
  hasPermission: (permissionKey: string) => boolean;
  hasSolution: (solutionKey: string) => boolean;
}

const TenantContext = createContext<TenantContextType>({
  profile: null,
  memberships: [],
  activeMembership: null,
  tenants: [],
  activeTenant: null,
  roles: [],
  permissions: [],
  solutions: [],
  isLoading: true,
  switchTenant: () => {},
  hasPermission: () => false,
  hasSolution: () => false,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [solutions, setSolutions] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setProfile(null);
      setMemberships([]);
      setActiveMembership(null);
      setTenants([]);
      setActiveTenant(null);
      setRoles([]);
      setPermissions([]);
      setSolutions([]);
      setIsLoading(false);
      return;
    }

    const loadWorkspace = async () => {
      try {
        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_path')
          .eq('id', user.id)
          .single();
          
        if (profileData) setProfile(profileData);

        // Load memberships
        const { data: membershipsData } = await supabase
          .from('memberships')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active');
          
        if (!membershipsData || membershipsData.length === 0) {
          setIsLoading(false);
          return;
        }

        setMemberships(membershipsData);

        // Load tenants
        const tenantIds = (membershipsData as any[]).map(m => m.tenant_id);
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*')
          .in('id', tenantIds)
          .in('status', ['active', 'trial']);
          
        if (!tenantsData || tenantsData.length === 0) {
          setIsLoading(false);
          return;
        }

        setTenants(tenantsData);
        
        // Auto-select tenant
        const savedTenantId = localStorage.getItem('ordum_active_tenant');
        let selectedTenant = (tenantsData as any[]).find(t => t.id === savedTenantId);
        if (!selectedTenant) {
           selectedTenant = tenantsData[0];
        }
        
        await setActiveTenantData(selectedTenant, (membershipsData as any[]).find(m => m.tenant_id === selectedTenant.id)!);
      } catch (err) {
        captureClientException(err, { operation: 'workspace_load' });
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspace();
  }, [user, authLoading]);

  const setActiveTenantData = async (tenant: Tenant, membership: Membership) => {
    setActiveTenant(tenant);
    setActiveMembership(membership);
    localStorage.setItem('ordum_active_tenant', tenant.id);

    try {
      // Load Roles
      const { data: membershipRoles } = await supabase
        .from('membership_roles')
        .select('role_id')
        .eq('membership_id', membership.id);
        
      let roleKeys: Role[] = [];
      let permKeys: string[] = [];
      
      if (membershipRoles && membershipRoles.length > 0) {
        const rIds = (membershipRoles as any[]).map(mr => mr.role_id);
        const { data: rolesData } = await supabase
          .from('roles')
          .select('id, key')
          .in('id', rIds);
          
        if (rolesData) roleKeys = rolesData;
        
        const { data: rolePerms } = await supabase
          .from('role_permissions')
          .select('permission_id')
          .in('role_id', rIds);
          
        if (rolePerms && rolePerms.length > 0) {
          const pIds = (rolePerms as any[]).map(rp => rp.permission_id);
          const { data: permsData } = await supabase
            .from('permissions')
            .select('key')
            .in('id', pIds);
            
          if (permsData) permKeys = (permsData as any[]).map(p => p.key);
        }
      }
      
      setRoles(roleKeys);
      setPermissions(permKeys);

      // Load Solutions
      const { data: tenantSols } = await supabase
        .from('tenant_solutions')
        .select('solution_id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');
        
      let solKeys: string[] = [];
      if (tenantSols && tenantSols.length > 0) {
        const sIds = (tenantSols as any[]).map(ts => ts.solution_id);
        const { data: solsData } = await supabase
          .from('solutions')
          .select('key')
          .in('id', sIds);
          
        if (solsData) solKeys = (solsData as any[]).map(s => s.key);
      }
      setSolutions(solKeys);
      
    } catch (err) {
      captureClientException(err, { operation: 'workspace_tenant_switch' });
    }
  };

  const switchTenant = (tenantId: string) => {
    const t = tenants.find(t => t.id === tenantId);
    const m = memberships.find(m => m.tenant_id === tenantId);
    if (t && m) {
      setActiveTenantData(t, m);
    }
  };

  const hasPermission = (permissionKey: string) => {
    return permissions.includes(permissionKey);
  };

  const hasSolution = (solutionKey: string) => {
    return solutions.includes(solutionKey);
  };

  return (
    <TenantContext.Provider value={{
      profile, memberships, activeMembership, tenants, activeTenant, roles, permissions, solutions,
      isLoading: isLoading || authLoading, switchTenant, hasPermission, hasSolution
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
