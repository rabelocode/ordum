import React, { useState, useEffect } from "react";
import { 
  Building, LayoutDashboard, Settings, LogOut, Menu, X, Search, ShieldCheck,
  AlertOctagon, WalletCards, Headphones, BriefcaseBusiness, ChevronDown
} from "lucide-react";
import { useAccess } from "../../core/auth/AccessContext";
import { PageShellSkeleton } from "../../components/ui/LoadingSkeletons";
import {
  activeAdminNavigation,
  adminBreadcrumb,
  buildAdminNavigation,
  isKnownAdminRouteAllowed,
  isNavigationChildActive,
  type AdminNavigationGroup,
} from "./adminNavigation";

function AdminLayoutInner({ children, currentPath }: { children: React.ReactNode, currentPath: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(() => window.localStorage.getItem('ordum.admin.openNavGroup'));
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
  const navigation = buildAdminNavigation({ can: platformCan, roleKey: platformRole?.key, hasTeams: memberTeams.length > 0 });
  const activeNavigation = activeAdminNavigation(navigation, currentPath);
  const activeGroupId = activeNavigation?.group.id || null;

  useEffect(() => {
    setIsMobileMenuOpen(false);
    if (activeGroupId) setOpenGroupId(activeGroupId);
    document.title = `${activeNavigation?.child.label || 'Início'} — Ordum Admin`;
  }, [currentPath, activeGroupId, activeNavigation?.child.label]);

  useEffect(() => {
    if (openGroupId) window.localStorage.setItem('ordum.admin.openNavGroup', openGroupId);
    else window.localStorage.removeItem('ordum.admin.openNavGroup');
  }, [openGroupId]);

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

  if (!isKnownAdminRouteAllowed(navigation, currentPath)) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F6F5F2] p-4"><div className="w-full max-w-md rounded-2xl border border-[#DDD8CF] bg-white p-8 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-[#B66E45]"/><h1 className="mt-4 text-xl font-black">Área restrita</h1><p className="mt-2 text-sm leading-6 text-[#626866]">Você não possui acesso a esta área administrativa.</p><a href="#/admin" className="mt-6 inline-flex rounded-xl bg-[#202322] px-5 py-3 text-sm font-bold text-white">Voltar ao início</a></div></div>;
  }

  const personName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pessoa da Ordum';
  const initials = personName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();

  const SidebarContent = ({ idPrefix }: { idPrefix: string }) => (
    <>
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <div className="text-xl font-black tracking-tighter text-white">ORDUM.</div>
        <div className="text-[10px] font-bold text-[#B66E45] uppercase tracking-widest mt-1">Painel Administrativo</div>
      </div>
      
      <nav aria-label="Navegação administrativa" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <a href="#/admin" onClick={() => setIsMobileMenuOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${currentPath === '#/admin' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><LayoutDashboard className="h-5 w-5"/>Início</a>
        {navigation.map(group => {
          const isOpen = openGroupId === group.id;
          const isActive = activeGroupId === group.id;
          return <div key={group.id} className="pt-1">
            <button type="button" aria-expanded={isOpen} aria-controls={`${idPrefix}-admin-nav-${group.id}`} onClick={() => setOpenGroupId(current => current === group.id ? null : group.id)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
              <NavigationGroupIcon group={group}/><span className="flex-1">{group.label}</span><ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            <div id={`${idPrefix}-admin-nav-${group.id}`} hidden={!isOpen} className="ml-5 border-l border-white/10 py-1 pl-3">
              {group.children.map(child => {
                const childActive = isNavigationChildActive(child, currentPath);
                return <a key={child.id} href={child.path} onClick={() => setIsMobileMenuOpen(false)} aria-current={childActive ? 'page' : undefined} className={`relative flex min-h-10 items-center rounded-lg px-3 py-2 text-sm transition-colors ${childActive ? 'bg-[#B66E45]/15 font-bold text-[#E8A47B] before:absolute before:-left-[13px] before:h-5 before:w-0.5 before:bg-[#B66E45]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>{child.label}</a>;
              })}
            </div>
          </div>;
        })}
      </nav>

      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#B66E45] flex items-center justify-center font-bold text-xs text-white uppercase">
            {initials || 'OR'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-bold text-white">{personName}</div>
            <div className="truncate text-[10px] text-gray-400">{platformRole?.name || 'Equipe Ordum'} · Ambiente administrativo</div>
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
      <aside aria-label="Menu administrativo" className="hidden w-64 flex-shrink-0 flex-col bg-[#121413] md:flex">
        <SidebarContent idPrefix="desktop" />
      </aside>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside aria-label="Menu administrativo" className="relative flex h-full w-72 max-w-[80vw] flex-col bg-[#121413] shadow-2xl animate-in slide-in-from-left">
            <button 
              aria-label="Fechar menu"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#B66E45] rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
            <SidebarContent idPrefix="mobile" />
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
          <div aria-label="Breadcrumb" className="hidden text-xs text-[#777D7A] lg:block">{adminBreadcrumb(navigation, currentPath)}</div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavigationGroupIcon({ group }: { group: AdminNavigationGroup }) {
  const className = "h-5 w-5";
  if (group.icon === 'commercial') return <BriefcaseBusiness className={className}/>;
  if (group.icon === 'clients') return <Building className={className}/>;
  if (group.icon === 'finance') return <WalletCards className={className}/>;
  if (group.icon === 'operations') return <Headphones className={className}/>;
  return <Settings className={className}/>;
}

export function OrdumAdminLayout(props: { children: React.ReactNode, currentPath: string }) {
  return <AdminLayoutInner {...props} />;
}
