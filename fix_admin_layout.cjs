const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/OrdumAdminLayout.tsx', 'utf8');

const newLayout = `import React, { useState, useEffect } from "react";
import { 
  Building, LayoutDashboard, Settings, LogOut, Users, FileText, Menu, X, 
  Megaphone, Search, Activity, ShieldCheck, Box, Server, GitMerge
} from "lucide-react";
import { PlatformAuthProvider, usePlatform } from "../../core/auth/PlatformAuthProvider";
import { useAuth } from "../../core/auth/AuthProvider";

function AdminLayoutInner({ children, currentPath }: { children: React.ReactNode, currentPath: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isPlatformLoading, isPlatformMember, platformMember, platformRole, platformCan, memberTeams, managedTeams } = usePlatform();
  const { signOut } = useAuth();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPath]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLogout = async () => {
    await signOut();
    window.location.hash = "#/";
  };

  if (isPlatformLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#DDD8CF] border-t-[#B66E45]" />
      </div>
    );
  }

  if (!isPlatformMember) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F5F2] p-4 text-center">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[#202322] mb-2">Acesso Negado</h1>
        <p className="text-[#626866] mb-6">Você não possui permissão para acessar o painel administrativo global da ORDUM.</p>
        <button onClick={handleLogout} className="px-6 py-2 bg-[#121413] text-white rounded-lg font-medium hover:bg-[#202322] transition-colors">
          Voltar e Sair
        </button>
      </div>
    );
  }

  const allNavItems = [
    { id: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Visão Geral", path: "#/admin", section: "COMERCIAL", show: true },
    { id: "leads", icon: <Search className="w-5 h-5" />, label: "Leads", path: "#/admin/leads", section: "COMERCIAL", show: platformCan('platform.leads.read') || platformRole?.key === 'sales' },
    { id: "demos", icon: <Activity className="w-5 h-5" />, label: "Demonstrações", path: "#/admin/demos", section: "COMERCIAL", show: platformCan('platform.demos.manage') || platformRole?.key === 'sales' },
    { id: "clientes", icon: <Building className="w-5 h-5" />, label: "Clientes", path: "#/admin/empresas", section: "COMERCIAL", show: platformCan('platform.clients.read') || platformRole?.key === 'sales' },
    { id: "equipes", icon: <Users className="w-5 h-5" />, label: "Equipes", path: "#/admin/equipes", section: "EQUIPES", show: platformCan('platform.teams.read') || memberTeams.length > 0 },
    { id: "desempenho", icon: <Activity className="w-5 h-5" />, label: "Meu Desempenho", path: "#/admin/desempenho", section: "EQUIPES", show: platformCan('platform.performance.own.read') || platformRole?.key === 'sales' },
    { id: "solucoes", icon: <Box className="w-5 h-5" />, label: "Soluções", path: "#/admin/solucoes", section: "PLATAFORMA", show: platformCan('platform.solutions.read') },
    { id: "equipe_ordum", icon: <Users className="w-5 h-5" />, label: "Equipe Ordum", path: "#/admin/consultores", section: "OPERAÇÃO", show: platformCan('platform.staff.read') },
    { id: "auditoria", icon: <FileText className="w-5 h-5" />, label: "Auditoria", path: "#/admin/auditoria", section: "OPERAÇÃO", show: platformCan('platform.audit.read') || platformCan('platform.audit.team.read') },
    { id: "sistema", icon: <Server className="w-5 h-5" />, label: "Saúde do Sistema", path: "#/admin/sistema", section: "SISTEMA", show: platformCan('platform.system.read') },
    { id: "deployments", icon: <GitMerge className="w-5 h-5" />, label: "Deployments", path: "#/admin/deployments", section: "SISTEMA", show: platformCan('platform.deploy.read') },
    { id: "configuracoes", icon: <Settings className="w-5 h-5" />, label: "Configurações", path: "#/admin/configuracoes", section: "SISTEMA", show: platformCan('platform.settings.read') },
    { id: "engenharia", icon: <Settings className="w-5 h-5" />, label: "Engenharia", path: "#/admin/engenharia", section: "ENGENHARIA", show: platformCan('platform.code.read') },
  ];

  const visibleNavItems = allNavItems.filter(item => item.show);

  // Group by section
  const sections = Array.from(new Set(visibleNavItems.map(item => item.section)));

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <div className="text-xl font-black tracking-tighter text-white">ORDUM.</div>
        <div className="text-[10px] font-bold text-[#B66E45] uppercase tracking-widest mt-1">Painel Administrativo</div>
      </div>
      
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {sections.map(section => (
          <div key={section} className="mb-6">
            {section && (
              <div className="px-3 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {section}
              </div>
            )}
            <div className="space-y-1">
              {visibleNavItems.filter(item => item.section === section).map(item => {
                const isActive = currentPath === item.path || (item.path !== "#/admin" && currentPath.startsWith(item.path));
                return (
                  <a
                    key={item.id}
                    href={item.path}
                    className={\`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors \${
                      isActive 
                        ? "bg-[#B66E45] text-white" 
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }\`}
                  >
                    {item.icon}
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#B66E45] flex items-center justify-center font-bold text-xs text-white uppercase">
            {platformRole?.key.substring(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{platformRole?.name || "Admin"}</div>
            <div className="text-[10px] text-gray-400 truncate uppercase">{platformMember?.relationship_type}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair do painel
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] bg-[#F6F5F2] overflow-hidden font-sans">
      <aside className="hidden md:flex w-64 bg-[#121413] flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[80vw] bg-[#121413] flex flex-col h-full shadow-2xl animate-in slide-in-from-left">
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#B66E45] rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-[#DDD8CF]/40 h-16 flex items-center px-4 md:px-8 flex-shrink-0 gap-4">
          <button 
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-[#202322] hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#B66E45]"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function OrdumAdminLayout(props: { children: React.ReactNode, currentPath: string }) {
  return (
    <PlatformAuthProvider>
      <AdminLayoutInner {...props} />
    </PlatformAuthProvider>
  );
}
`;

fs.writeFileSync('src/pages/admin/OrdumAdminLayout.tsx', newLayout);
