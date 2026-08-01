import React, { useState, useEffect, Suspense, lazy } from "react";
import { PublicSite } from "./pages/public/PublicSite";
import { TenantDiscoveryPage } from "./pages/public/TenantDiscoveryPage";
import { TenantLoginPage } from "./pages/public/TenantLoginPage";
import { IntegrityChannelPage } from "./pages/public/IntegrityChannelPage";
import { LoginPage } from "./pages/public/LoginPage";
import { ResetPasswordPage } from "./pages/public/ResetPasswordPage";
import { AcceptInvitePage } from "./pages/public/AcceptInvitePage";
import { SelectOrganizationPage } from "./pages/public/SelectOrganizationPage";

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

const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F6F5F2]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#DDD8CF] border-t-[#B66E45]" />
  </div>
);

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
    const route = currentRoute;

    if (route === "/") {
      return <PublicSite />;
    }
    if (route.startsWith("/login")) {
      return <LoginPage />;
    }
    if (route === "/auth/reset-password") {
      return <ResetPasswordPage />;
    }
    if (route === "/auth/accept-invite") {
      return <AcceptInvitePage />;
    }
    if (route === "/select-organization") {
      return <SelectOrganizationPage />;
    }
    if (route === "/entrar") {
      return <TenantDiscoveryPage />;
    }
    if (route.startsWith("/canal/")) {
      const slug = route.split("/")[2];
      return <IntegrityChannelPage slug={slug} />;
    }
    if (route.startsWith("/acesso/")) {
      const slug = route.split("/")[2];
      return <TenantLoginPage slug={slug} />;
    }
    if (route.startsWith("/workspace")) {
      return (
        <Suspense fallback={<SuspenseFallback />}>
          <WorkspaceApp />
        </Suspense>
      );
    }
    if (route.startsWith("/admin")) {
      let adminContent = <AdminDashboard />;
      
      if (route === "/admin/empresas") {
        adminContent = <CompaniesPage />;
      } else if (route.startsWith("/admin/empresas/")) {
        const tenantId = route.split("/")[3];
        adminContent = <CompanyDetailPage tenantId={tenantId} />;
      } else if (route === "/admin/equipes") {
        adminContent = <TeamsPage />;
      } else if (route.startsWith("/admin/equipes/")) {
        const teamId = route.split("/")[3];
        adminContent = <TeamDetailPage teamId={teamId} />;
      } else if (route === "/admin/consultores") {
        adminContent = <ConsultantsPage />;
      } else if (route === "/admin/leads") {
        adminContent = <LeadsPage />;
      } else if (route === "/admin/auditoria") {
        adminContent = <AuditPage />;
      } else if (route === "/admin/sistema") {
        adminContent = <SystemHealthPage />;
      } else if (route === "/admin/contratos") {
        adminContent = <ContractsPage />;
      } else if (route === "/admin/propostas") {
        adminContent = <ProposalsPage />;
      } else if (route === "/admin/planos") {
        adminContent = <PlansPage />;
      } else if (route === "/admin/financeiro") {
        adminContent = <BillingPage />;
      } else if (route === "/admin/demos") {
        adminContent = <DemosPage />;
      } else if (
        route === "/admin/desempenho" ||
        route === "/admin/solucoes" ||
        
        
        route === "/admin/deployments" ||
        route === "/admin/configuracoes" ||
        route === "/admin/engenharia"
      ) {
        adminContent = <PlaceholderAdminPage title={route} />;
      }

      return (
        <Suspense fallback={<SuspenseFallback />}>
          <OrdumAdminLayout currentPath={"#" + route}>
            {adminContent}
          </OrdumAdminLayout>
        </Suspense>
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
