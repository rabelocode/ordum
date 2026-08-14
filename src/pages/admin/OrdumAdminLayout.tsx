import React, { useState, useEffect } from "react";
import { 
  Building, LayoutDashboard, Settings, LogOut, Users, FileText, Menu, X, 
  Search, Activity, ShieldCheck, Box, Server, GitMerge, AlertOctagon, WalletCards, Layers3,
  ClipboardList, HeartHandshake, Headphones, Scale, Target, Waypoints, KeyRound
} from "lucide-react";
import { useAccess } from "../../core/auth/AccessContext";
import { PageShellSkeleton } from "../../components/ui/LoadingSkeletons";

function AdminLayoutInner({ children, currentPath }: { children: React.ReactNode, currentPath: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { 
    user, 
    session, 
    signOut, 
    isLoading: isAuthLoading,
    isPlatformMember, 
    isPlatformSuspended, 
    platformMember, 
    platformRole, 
    hasPlatformPermission: platformCan, 
    memberTeams, 
    memberships: tenantMemberships, // tenantMemberships are in AccessContext
    error: platformError,
    refreshAccessContext: reloadPlatformContext
  } = useAccess();
  
  // Note: tenantMemberships needs to be mapped differently or just from useAccess().memberships
  const allMemberships = useAccess().memberships || [];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPath]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMobileMenuOpen(false); setSearchResults([]); }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault(); document.querySelector<HTMLInputElement>('[aria-label="Busca global"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (globalSearch.trim().length < 2 || !session) { setSearchResults([]); return; }
    const timeout = window.setTimeout(async () => {
      const response = await fetch(`/api/admin/control-plane/search?q=${encodeURIComponent(globalSearch.trim())}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (response.ok) setSearchResults((await response.json()).items || []);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [globalSearch, session]);

  const handleLogout = async () => {
    await signOut();
    window.location.hash = "#/login";
  };

  const handleGoToOrganization = () => {
    if (allMemberships.length > 1) {
      window.location.hash = "#/select-organization";
    } else {
      window.location.hash = "#/workspace";
    }
  };

  // 1. Loading State: show skeleton spinner without flicker of "Acesso Negado"
  if (isAuthLoading) {
    return <PageShellSkeleton />;
  }

  // 2. Unauthenticated: Redirect to login with returnTo
  if (!user) {
    const returnTo = currentPath.replace(/^#/, "");
    window.location.hash = `#/login?returnTo=${encodeURIComponent(returnTo)}`;
    return null;
  }

  // 3a. Integration/Server Error State (NOT Access Denied)
  if (platformError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F5F2] p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full">
          <AlertOctagon className="w-14 h-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#202322] mb-2">Erro ao carregar permissões</h1>
          <p className="text-xs text-[#626866] mb-6 leading-relaxed">
            {platformError}
          </p>
          <div className="space-y-2">
            <button 
              onClick={() => reloadPlatformContext()} 
              className="w-full py-2.5 bg-[#B66E45] text-white rounded-xl text-xs font-bold hover:bg-[#A05C35] transition-colors"
            >
              Tentar novamente
            </button>
            <button 
              onClick={handleLogout} 
              className="w-full py-2.5 bg-[#121413] text-white rounded-xl text-xs font-bold hover:bg-[#202322] transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3b. Platform Member Suspended
  if (isPlatformSuspended) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F5F2] p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full">
          <AlertOctagon className="w-14 h-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#202322] mb-2">Acesso Suspenso</h1>
          <p className="text-xs text-[#626866] mb-6 leading-relaxed">
            Seu acesso administrativo à plataforma ORDUM está suspenso. Entre em contato com a diretoria ou administrador do sistema.
          </p>
          <button 
            onClick={handleLogout} 
            className="w-full py-2.5 bg-[#121413] text-white rounded-xl text-xs font-bold hover:bg-[#202322] transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  // 4. Authenticated but NOT Platform Member / Authorized (Primary criterion: isPlatformMember AND platform.access or admin role)
  const hasAccessPermission = platformCan('platform.access') || platformRole?.key === 'admin';
  if (!isPlatformMember || !hasAccessPermission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F5F2] p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#DDD8CF]/60 max-w-md w-full">
          <ShieldCheck className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#202322] mb-2">Acesso Negado</h1>
          <p className="text-xs text-[#626866] mb-6 leading-relaxed">
            Você não possui permissão para acessar o painel administrativo global da ORDUM.
          </p>
          <div className="space-y-2">
            {allMemberships.length > 0 && (
              <button 
                onClick={handleGoToOrganization} 
                className="w-full py-2.5 bg-[#B66E45] text-white rounded-xl text-xs font-bold hover:bg-[#A05C35] transition-colors"
              >
                Ir para minha organização
              </button>
            )}
            <button 
              onClick={handleLogout} 
              className="w-full py-2.5 bg-[#121413] text-white rounded-xl text-xs font-bold hover:bg-[#202322] transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allNavItems = [
    { id: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Início", path: "#/admin", section: "INÍCIO", show: true },
    { id: "leads", icon: <Search className="w-5 h-5" />, label: "Leads", path: "#/admin/leads", section: "COMERCIAL", show: platformCan('platform.leads.read') || platformRole?.key === 'sales' },
    { id: "demos", icon: <Activity className="w-5 h-5" />, label: "Demonstrações", path: "#/admin/demos", section: "COMERCIAL", show: platformCan('platform.demos.manage') || platformRole?.key === 'sales' },
    { id: "propostas", icon: <FileText className="w-5 h-5" />, label: "Propostas", path: "#/admin/propostas", section: "COMERCIAL", show: platformCan('platform.commercial.read') },
    { id: "contratos", icon: <FileText className="w-5 h-5" />, label: "Contratos", path: "#/admin/contratos", section: "COMERCIAL", show: platformCan('platform.commercial.read') },
    { id: "clientes", icon: <Building className="w-5 h-5" />, label: "Empresas", path: "#/admin/empresas", section: "CLIENTES", show: platformCan('platform.clients.read') || platformRole?.key === 'sales' },
    { id: "onboarding", icon: <ClipboardList className="w-5 h-5" />, label: "Implantação", path: "#/admin/onboarding", section: "CLIENTES", show: platformCan('platform.onboarding.read') },
    { id: "customer_success", icon: <HeartHandshake className="w-5 h-5" />, label: "Customer Success", path: "#/admin/customer-success", section: "CLIENTES", show: platformCan('platform.success.read') },
    { id: "financeiro", icon: <WalletCards className="w-5 h-5" />, label: "Visão geral", path: "#/admin/financeiro", section: "FINANCEIRO", show: platformCan('platform.billing.read') },
    { id: "planos", icon: <Layers3 className="w-5 h-5" />, label: "Planos", path: "#/admin/planos", section: "FINANCEIRO", show: platformCan('platform.billing.read') },
    { id: "suporte", icon: <Headphones className="w-5 h-5" />, label: "Suporte", path: "#/admin/suporte", section: "OPERAÇÃO", show: platformCan('platform.support.read') },
    { id: "sistema", icon: <Server className="w-5 h-5" />, label: "Saúde do sistema", path: "#/admin/sistema", section: "OPERAÇÃO", show: platformCan('platform.system.read') },
    { id: "auditoria", icon: <FileText className="w-5 h-5" />, label: "Auditoria", path: "#/admin/auditoria", section: "OPERAÇÃO", show: platformCan('platform.audit.read') || platformCan('platform.audit.team.read') },
    { id: "membros_ordum", icon: <Users className="w-5 h-5" />, label: "Membros", path: "#/admin/membros", section: "ADMINISTRAÇÃO", show: platformCan('platform.staff.read') || platformRole?.key === 'admin' },
    { id: "equipes", icon: <Users className="w-5 h-5" />, label: "Equipes comerciais", path: "#/admin/equipes", section: "ADMINISTRAÇÃO", show: platformCan('platform.teams.read') || memberTeams.length > 0 },
    { id: "acessos", icon: <KeyRound className="w-5 h-5" />, label: "Acessos", path: "#/admin/acessos", section: "ADMINISTRAÇÃO", show: platformCan('platform.access.simulate') },
    { id: "configuracoes", icon: <Settings className="w-5 h-5" />, label: "Configurações", path: "#/admin/configuracoes", section: "ADMINISTRAÇÃO", show: platformCan('platform.settings.read') },
  ];

  const visibleNavItems = allNavItems.filter(item => item.show);
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive 
                        ? "bg-[#B66E45] text-white" 
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
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
            {platformRole?.key?.substring(0, 2) || "AD"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">{platformRole?.name || "Admin"}</div>
            <div className="text-[10px] text-gray-400 truncate">Ambiente administrativo Ordum</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
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
            aria-label="Abrir menu"
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-[#202322] hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#B66E45]"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777D7A]" />
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              aria-label="Busca global"
              placeholder="Buscar cliente…  (atalho /)"
              className="w-full rounded-xl border border-[#DDD8CF] bg-[#F6F5F2] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#B66E45]"
            />
            {searchResults.length > 0 && <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-[#DDD8CF] bg-white shadow-xl">
              {searchResults.map((item) => <a key={`${item.type}-${item.id}`} href={item.href} onClick={() => { setGlobalSearch(''); setSearchResults([]); }} className="block border-b border-[#EEEAE3] px-4 py-3 last:border-0 hover:bg-[#F6F5F2]"><div className="text-sm font-bold text-[#202322]">{item.title}</div><div className="text-xs text-[#626866]">{item.subtitle || item.type}</div></a>)}
            </div>}
          </div>
          <div className="hidden text-xs text-[#777D7A] lg:block">{breadcrumbLabel(currentPath)}</div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function breadcrumbLabel(path:string){const labels:Record<string,string>={"#/admin":"Início","#/admin/leads":"Comercial / Leads","#/admin/demos":"Comercial / Demonstrações","#/admin/propostas":"Comercial / Propostas","#/admin/contratos":"Comercial / Contratos","#/admin/empresas":"Clientes / Empresas","#/admin/onboarding":"Clientes / Implantação","#/admin/customer-success":"Clientes / Customer Success","#/admin/financeiro":"Financeiro / Visão geral","#/admin/planos":"Financeiro / Planos","#/admin/suporte":"Operação / Suporte","#/admin/sistema":"Operação / Saúde do sistema","#/admin/auditoria":"Operação / Auditoria","#/admin/membros":"Administração / Membros","#/admin/consultores":"Administração / Membros","#/admin/equipes":"Administração / Equipes comerciais","#/admin/acessos":"Administração / Acessos","#/admin/configuracoes":"Administração / Configurações"};const exact=labels[path];if(exact)return exact;if(path.startsWith("#/admin/empresas/"))return "Clientes / Empresa";return "Administração";}

export function OrdumAdminLayout(props: { children: React.ReactNode, currentPath: string }) {
  return <AdminLayoutInner {...props} />;
}
