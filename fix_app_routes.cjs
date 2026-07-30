const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const imports = `const OrdumAdminLayout = lazy(() => import("./pages/admin/OrdumAdminLayout").then(m => ({ default: m.OrdumAdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const CompaniesPage = lazy(() => import("./pages/admin/CompaniesPage").then(m => ({ default: m.CompaniesPage })));
const CompanyDetailPage = lazy(() => import("./pages/admin/CompanyDetailPage").then(m => ({ default: m.CompanyDetailPage })));
const ConsultantsPage = lazy(() => import("./pages/admin/ConsultantsPage").then(m => ({ default: m.ConsultantsPage })));
const ContractsPage = lazy(() => import("./pages/admin/ContractsPage").then(m => ({ default: m.ContractsPage })));
const TeamsPage = lazy(() => import("./pages/admin/TeamsPage").then(m => ({ default: m.TeamsPage })));
const TeamDetailPage = lazy(() => import("./pages/admin/TeamDetailPage").then(m => ({ default: m.TeamDetailPage })));
const PlaceholderAdminPage = lazy(() => import("./pages/admin/PlaceholderAdminPage").then(m => ({ default: m.PlaceholderAdminPage })));
`;

code = code.replace(/const OrdumAdminLayout = lazy\([\s\S]*?const ContractsPage = lazy\([\s\S]*?\n/, imports);

const routes = `    if (route.startsWith("/admin")) {
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
      } else if (route === "/admin/contratos") {
        adminContent = <ContractsPage />;
      } else if (
        route === "/admin/leads" ||
        route === "/admin/demos" ||
        route === "/admin/desempenho" ||
        route === "/admin/solucoes" ||
        route === "/admin/auditoria" ||
        route === "/admin/sistema" ||
        route === "/admin/deployments" ||
        route === "/admin/configuracoes" ||
        route === "/admin/engenharia"
      ) {
        adminContent = <PlaceholderAdminPage title={route} />;
      }
`;

code = code.replace(/    if \(route\.startsWith\("\/admin"\)\) \{[\s\S]*?    return <PublicSite \/>;/m, routes + '\n      return (\n        <Suspense fallback={<SuspenseFallback />}>\n          <OrdumAdminLayout currentPath={"#" + route}>\n            {adminContent}\n          </OrdumAdminLayout>\n        </Suspense>\n      );\n    }\n    return <PublicSite />;');

fs.writeFileSync('src/App.tsx', code);
