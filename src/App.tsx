import React, { useState, useEffect, Suspense, lazy } from "react";
import { PublicSite } from "./pages/public/PublicSite";
import { TenantDiscoveryPage } from "./pages/public/TenantDiscoveryPage";
import { TenantLoginPage } from "./pages/public/TenantLoginPage";
import { IntegrityChannelPage } from "./pages/public/IntegrityChannelPage";
import { LoginPage } from "./pages/public/LoginPage";
import { ResetPasswordPage } from "./pages/public/ResetPasswordPage";
import { AcceptInvitePage } from "./pages/public/AcceptInvitePage";
import { SelectOrganizationPage } from "./pages/public/SelectOrganizationPage";
import { CareerSitePage } from "./pages/public/CareerSitePage";
import { PageShellSkeleton } from "./components/ui/LoadingSkeletons";
import { RequireAuth, RequireTenant, RequirePlatformPermission } from "./core/auth/Guards";

// Lazy load heavy internal applications
const WorkspaceApp = lazy(() => import("./pages/workspace/WorkspaceApp").then(m => ({ default: m.WorkspaceApp })));
const OrdumAdminLayout = lazy(() => import("./pages/admin/OrdumAdminLayout").then(m => ({ default: m.OrdumAdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const CompaniesPage = lazy(() => import("./pages/admin/CompaniesPage").then(m => ({ default: m.CompaniesPage })));
const CompanyDetailPage = lazy(() => import("./pages/admin/CompanyDetailPage").then(m => ({ default: m.CompanyDetailPage })));
const ConsultantsPage = lazy(() => import("./pages/admin/ConsultantsPage").then(m => ({ default: m.ConsultantsPage })));
const ContractsPage = lazy(() => import("./pages/admin/ContractsPage").then(m => ({ default: m.ContractsPage })));
const TeamsPage = lazy(() => import("./pages/admin/TeamsPage").then(m => ({ default: m.TeamsPage })));
const TeamDetailPage = lazy(() => import("./pages/admin/TeamDetailPage").then(m => ({ default: m.TeamDetailPage })));
const PlaceholderAdminPage = lazy(() => import("./pages/admin/PlaceholderAdminPage").then(m => ({ default: m.PlaceholderAdminPage })));
const LeadsPage = lazy(() => import("./pages/admin/LeadsPage").then(m => ({ default: m.LeadsPage })));
const AuditPage = lazy(() => import("./pages/admin/AuditPage").then(m => ({ default: m.AuditPage })));
const SystemHealthPage = lazy(() => import("./pages/admin/SystemHealthPage").then(m => ({ default: m.SystemHealthPage })));
const PlansPage = lazy(() => import("./pages/admin/PlansPage").then(m => ({ default: m.PlansPage })));
const BillingPage = lazy(() => import("./pages/admin/BillingPage").then(m => ({ default: m.BillingPage })));
const DemosPage = lazy(() => import("./pages/admin/DemosPage").then(m => ({ default: m.DemosPage })));
const ProposalsPage = lazy(() => import("./pages/admin/ProposalsPage").then(m => ({ default: m.ProposalsPage })));
const ControlPlaneModulePage = lazy(() => import("./pages/admin/ControlPlaneModulePage").then(m => ({ default: m.ControlPlaneModulePage })));
const AccessControlPage = lazy(() => import("./pages/admin/AccessControlPage").then(m => ({ default: m.AccessControlPage })));

const SuspenseFallback = () => <PageShellSkeleton />;

export default function App() {
  const [currentRoute, setCurrentRoute] = useState("/");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      // If the hash represents an internal route (starts with #/)
      if (hash.startsWith("#/")) {
        setCurrentRoute(hash.replace("#", ""));
        window.scrollTo(0, 0);
      } else if (hash === "" || hash === "#") {
        setCurrentRoute("/");
        window.scrollTo(0, 0);
      } else {
        // It is an anchor like #solucoes
        // Don't change route, just let the browser scroll (or handle smooth scrolling manually if needed)
        // Ensure route is at root for public site anchors
        if (currentRoute !== "/") {
            setCurrentRoute("/");
        }
        
        // Let the browser handle the jump to id, or we do it smoothly:
        const id = hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }
    };
    
    // Initial check
    handleHashChange();
    
    // We need to wait a tick for initial anchor scrolling to work if the element hasn't mounted
    if (window.location.hash && !window.location.hash.startsWith("#/")) {
      setTimeout(() => {
        const id = window.location.hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [currentRoute]);

  const renderContent = () => {
    const [pathname] = currentRoute.split("?");

    if (pathname === "/") {
      return <PublicSite />;
    }
    if (pathname.startsWith("/login")) {
      return <LoginPage />;
    }
    if (pathname === "/auth/reset-password") {
      return <ResetPasswordPage />;
    }
    if (pathname === "/auth/accept-invite") {
      return <AcceptInvitePage />;
    }
    if (pathname === "/select-organization") {
      return <SelectOrganizationPage />;
    }
    if (pathname === "/entrar") {
      return <TenantDiscoveryPage />;
    }
    if (pathname.startsWith("/canal/")) {
      const slug = pathname.split("/")[2];
      return <IntegrityChannelPage slug={slug} />;
    }
    if (pathname.startsWith("/carreiras/")) {
      const slug = pathname.split("/")[2];
      return <CareerSitePage slug={slug} />;
    }
    if (pathname.startsWith("/acesso/")) {
      const slug = pathname.split("/")[2];
      return <TenantLoginPage slug={slug} />;
    }
    if (pathname.startsWith("/workspace")) {
      return (
        <RequireAuth>
          <RequireTenant>
            <Suspense fallback={<SuspenseFallback />}>
              <WorkspaceApp />
            </Suspense>
          </RequireTenant>
        </RequireAuth>
      );
    }
    if (pathname.startsWith("/admin")) {
      let adminContent = <AdminDashboard />;
      
      if (pathname === "/admin/empresas") {
        adminContent = <CompaniesPage />;
      } else if (pathname.startsWith("/admin/empresas/")) {
        const tenantId = pathname.split("/")[3];
        adminContent = <CompanyDetailPage tenantId={tenantId} />;
      } else if (pathname === "/admin/equipes") {
        adminContent = <TeamsPage />;
      } else if (pathname.startsWith("/admin/equipes/")) {
        const teamId = pathname.split("/")[3];
        adminContent = <TeamDetailPage teamId={teamId} />;
      } else if (pathname === "/admin/consultores") {
        adminContent = <ConsultantsPage />;
      } else if (pathname === "/admin/leads") {
        adminContent = <LeadsPage />;
      } else if (pathname === "/admin/auditoria") {
        adminContent = <AuditPage />;
      } else if (pathname === "/admin/sistema") {
        adminContent = <SystemHealthPage />;
      } else if (pathname === "/admin/contratos") {
        adminContent = <ContractsPage />;
      } else if (pathname === "/admin/propostas") {
        adminContent = <ProposalsPage />;
      } else if (pathname === "/admin/planos") {
        adminContent = <PlansPage />;
      } else if (pathname === "/admin/financeiro") {
        adminContent = <BillingPage />;
      } else if (pathname === "/admin/demos") {
        adminContent = <DemosPage />;
      } else if (pathname === "/admin/onboarding") {
        adminContent = <ControlPlaneModulePage module="onboarding" />;
      } else if (pathname === "/admin/customer-success") {
        adminContent = <ControlPlaneModulePage module="success" />;
      } else if (pathname === "/admin/suporte") {
        adminContent = <ControlPlaneModulePage module="support" />;
      } else if (pathname === "/admin/privacidade") {
        adminContent = <ControlPlaneModulePage module="privacy" />;
      } else if (pathname === "/admin/metas") {
        adminContent = <ControlPlaneModulePage module="targets" />;
      } else if (pathname === "/admin/operacoes") {
        adminContent = <ControlPlaneModulePage module="operations" />;
      } else if (pathname === "/admin/acessos") {
        adminContent = <AccessControlPage />;
      } else if (
        pathname === "/admin/desempenho" ||
        pathname === "/admin/solucoes" ||
        pathname === "/admin/deployments" ||
        pathname === "/admin/configuracoes" ||
        pathname === "/admin/engenharia"
      ) {
        adminContent = <PlaceholderAdminPage title={pathname} />;
      }

      return (
        <RequireAuth>
          <RequirePlatformPermission permission="platform.access">
            <Suspense fallback={<SuspenseFallback />}>
              <OrdumAdminLayout currentPath={"#" + currentRoute}>
                {adminContent}
              </OrdumAdminLayout>
            </Suspense>
          </RequirePlatformPermission>
        </RequireAuth>
      );
    }
    return <PublicSite />;
  };

  return (
    <>
      {renderContent()}
    </>
  );
}
