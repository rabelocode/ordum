import React, { useState, useEffect } from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { useAuth } from "../../core/auth/AuthProvider";
import { useTenant } from "../../core/auth/TenantProvider";
import { WorkspaceLayout } from "../../components/workspace/WorkspaceLayout";
import { WorkspaceHome } from "../../components/workspace/WorkspaceHome";
import { IntegrityModuleView } from "../../components/workspace/IntegrityModuleView";
import { PeopleModuleView } from "../../components/workspace/PeopleModuleView";
import { TalentModuleView } from "../../components/workspace/TalentModuleView";
import { TenantInfo, UserProfile, ModuleId } from "../../types";
import { WorkspaceErrorBoundary } from "../../components/workspace/WorkspaceErrorBoundary";
import { captureAnalytics, identifyAnalyticsUser } from '../../lib/analytics';

export function WorkspaceApp() {
  const { user, signOut } = useAuth();
  const { profile, activeTenant, roles, permissions, hasSolution, hasPermission, isLoading } = useTenant();

  const [currentRoute, setCurrentRoute] = useState("");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const parts = hash.replace("#/workspace", "").split("/").filter(Boolean);
      setCurrentRoute(parts.length > 0 ? parts[0] : "");
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.hash = "#/entrar";
    }
  }, [isLoading, user]);

  useEffect(() => {
    if (!user || !activeTenant || roles.length === 0) return;
    identifyAnalyticsUser(user.id, activeTenant.id, roles[0].key);
  }, [user?.id, activeTenant?.id, roles.map((role) => role.key).join('|')]);

  useEffect(() => {
    if (!activeTenant || !currentRoute || !['integridade', 'pessoas', 'talentos'].includes(currentRoute)) return;
    captureAnalytics('module_opened', {
      tenant_ref: activeTenant.id,
      module: currentRoute === 'integridade' ? 'integrity' : currentRoute === 'pessoas' ? 'people' : 'talent',
    });
  }, [activeTenant?.id, currentRoute]);

  if (isLoading || !activeTenant || !profile) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center">
        <Activity className="w-8 h-8 text-[#B66E45] animate-spin" />
      </div>
    );
  }

  const tenantInfo: TenantInfo = {
    id: activeTenant.id,
    slug: activeTenant.slug,
    name: activeTenant.name,
    createdAt: (activeTenant as any).created_at,
    branding: {
      companyName: activeTenant.name,
      primaryColor: activeTenant.settings?.primaryColor || "#B66E45",
      welcomeMessage: activeTenant.settings?.welcomeMessage || "Bem-vindo",
      supportEmail: activeTenant.settings?.supportEmail || "suporte@ordum.com.br"
    }
  };

  const userProfile: UserProfile = {
    id: user!.id,
    tenantId: activeTenant.id,
    name: profile.full_name || user!.email || "Usuário",
    email: user!.email || "",
    role: (roles[0]?.key || 'employee') as UserProfile['role'],
    permissions,
    avatarUrl: profile.avatar_path || undefined
  };

  const handleLogout = () => {
    signOut();
  };
  
  const handleNavigate = (path: string) => {
    window.location.hash = path;
  };

  const canAccessIntegrity = hasPermission('integrity.cases.read') || hasPermission('integrity.cases.manage');
  const canAccessPeople = hasPermission('people.portal.read') || hasPermission('people.requests.create') || hasPermission('people.requests.manage');
  const canAccessTalent = hasPermission('talents.jobs.manage') || hasPermission('talents.candidates.manage') || hasPermission('talents.interviews.manage');

  const getAuthorizedModules = () => {
    const modules: ModuleId[] = [];
    if (hasSolution('integrity') && canAccessIntegrity) modules.push('integrity');
    if (hasSolution('people') && canAccessPeople) modules.push('people');
    if (hasSolution('talent') && canAccessTalent) modules.push('talent');
    return modules;
  };

  const renderUnauthorized = () => (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-[#202322] mb-2">Acesso Restrito</h2>
      <p className="text-[#626866] max-w-md">Você não possui permissão para visualizar esta área.</p>
    </div>
  );

  const renderNotFound = () => (
    <div className="p-8 flex flex-col items-center justify-center h-[60vh] text-center">
      <h2 className="text-2xl font-bold text-[#202322] mb-2">Página não encontrada</h2>
      <p className="text-[#626866]">O recurso que você tentou acessar não existe.</p>
    </div>
  );

  const renderModuleContent = () => {
    if (currentRoute === "pessoas") {
      if (!canAccessPeople) return renderUnauthorized();
      return <PeopleModuleView tenant={tenantInfo} user={userProfile} onBack={() => handleNavigate("")} />;
    }
    if (currentRoute === "integridade") {
      if (!canAccessIntegrity) return renderUnauthorized();
      return <IntegrityModuleView tenant={tenantInfo} user={userProfile} onBack={() => handleNavigate("")} />;
    }
    if (currentRoute === "talentos") {
      if (!canAccessTalent) return renderUnauthorized();
      return <TalentModuleView tenant={tenantInfo} user={userProfile} onBack={() => handleNavigate("")} />;
    }
    if (currentRoute === "") {
       return <WorkspaceHome
              user={userProfile}
              tenant={tenantInfo}
              enabledModules={getAuthorizedModules()}
             onNavigate={handleNavigate}
            />;
    }
    return renderNotFound();
  };

  return (
    <WorkspaceErrorBoundary>
      <WorkspaceLayout 
        tenant={tenantInfo}
        user={userProfile}
        enabledModules={getAuthorizedModules()}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        currentPath={`#/workspace${currentRoute ? '/' + currentRoute : ''}`}
      >
        {renderModuleContent()}
      </WorkspaceLayout>
    </WorkspaceErrorBoundary>
  );
}
