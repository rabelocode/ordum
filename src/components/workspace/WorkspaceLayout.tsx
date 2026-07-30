import React, { useState } from "react";
import {
  ShieldCheck,
  Users,
  Briefcase,
  Home,
  LogOut,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  HelpCircle,
  Layers,
  Building2
} from "lucide-react";
import { UserProfile, TenantInfo, ModuleId } from "../../types";
import { ModuleRegistry } from "../../core/modules/registry";
import { TenantLogo } from "../tenant/TenantLogo";
import { Badge } from "../ui/Badge";
import { useToast } from "../ui/Toast";
import { Button } from "../ui/Button";

interface WorkspaceLayoutProps {
  user: UserProfile;
  tenant: TenantInfo;
  enabledModules: ModuleId[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function WorkspaceLayout({
  user,
  tenant,
  enabledModules,
  currentPath,
  onNavigate,
  onLogout,
  children,
}: WorkspaceLayoutProps) {
  const { toast } = useToast();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const modules = ModuleRegistry.getAllModules();
  const activeModules = modules.filter(m => enabledModules.includes(m.id));

  // Determine standard app route links
  const menuItems = [
    {
      id: "home",
      label: "Início",
      icon: <Home className="w-5 h-5" />,
      path: "/workspace",
      exact: true
    },
    ...activeModules.map(m => ({
      id: m.id,
      label: m.shortName,
      icon: m.id === "integrity" ? <ShieldCheck className="w-5 h-5" /> : 
            m.id === "people" ? <Users className="w-5 h-5" /> :
            <Briefcase className="w-5 h-5" />,
      path: `/workspace/${m.id}`,
      exact: false
    }))
  ];

  return (
    <div className="flex h-screen bg-[#F6F5F2] overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#121413] text-[#DDD8CF] z-50 transform transition-transform duration-300 ease-in-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } flex flex-col shadow-2xl lg:shadow-none`}
      >
        {/* Tenant Header */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 flex-shrink-0 relative">
          <div className="flex items-center gap-3 w-full">
            <TenantLogo branding={tenant.branding} size="sm" showText={false} />
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-white text-sm truncate">{tenant.name}</h1>
              <div className="text-[10px] text-[#B66E45] uppercase tracking-wider font-semibold">Workspace</div>
            </div>
          </div>
          <button 
            className="lg:hidden absolute right-4 text-white/50 hover:text-white"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-2 mb-3">Navegação</div>
          
          {menuItems.map((item) => {
            const isActive = item.exact 
              ? currentPath === item.path
              : currentPath.startsWith(item.path);
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.path);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-[#B66E45] text-white shadow-sm font-semibold" 
                    : "text-white/70 hover:bg-white/5 hover:text-white font-medium"
                }`}
              >
                <div className={`${isActive ? "text-white" : "text-white/50"}`}>
                  {item.icon}
                </div>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => window.open('/#/entrar', '_self')}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
               <Building2 className="w-5 h-5 text-white/50" />
               <div>
                  <div className="text-sm font-semibold text-white">Alternar Empresa</div>
                  <div className="text-[10px] text-white/40">Demonstração local</div>
               </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0">
        {/* Topbar */}
        <header className="h-20 bg-white border-b border-[#DDD8CF]/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 relative z-30">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-[#626866] hover:bg-[#FAF8F3] rounded-xl transition-colors"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden sm:flex relative w-64 lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#626866]/50" />
              <input 
                type="text" 
                placeholder="Buscar no workspace..." 
                className="w-full pl-9 pr-4 py-2 text-sm bg-[#FAF8F3] border border-transparent rounded-xl focus:bg-white focus:border-[#B66E45]/50 focus:ring-2 focus:ring-[#B66E45]/10 outline-none transition-all placeholder:text-[#626866]/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button className="relative p-2 text-[#626866] hover:bg-[#FAF8F3] rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#B66E45] rounded-full border border-white" />
            </button>
            <button className="hidden sm:flex p-2 text-[#626866] hover:bg-[#FAF8F3] rounded-xl transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>

            <div className="h-8 w-[1px] bg-[#DDD8CF]/50 mx-2 hidden sm:block" />

            <div className="relative">
              <button 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 p-1.5 pr-2 rounded-xl hover:bg-[#FAF8F3] transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#121413] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-bold text-[#202322] leading-tight">{user.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-[#626866] capitalize">{user.role.replace('_', ' ')}</div>
                </div>
                <ChevronDown className={`hidden md:block w-4 h-4 text-[#626866] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#DDD8CF]/50 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-[#DDD8CF]/30 mb-2">
                    <div className="font-bold text-[#202322] truncate">{user.name}</div>
                    <div className="text-xs text-[#626866] truncate">{user.email}</div>
                  </div>
                  
                  <button className="w-full text-left px-4 py-2 text-sm text-[#202322] hover:bg-[#FAF8F3] transition-colors">
                    Meu Perfil
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-[#202322] hover:bg-[#FAF8F3] transition-colors">
                    Configurações
                  </button>
                  
                  <div className="h-[1px] bg-[#DDD8CF]/30 my-2" />
                  
                  <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair do sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-b from-[#F6F5F2] to-white pointer-events-none -z-10" />
          
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
            {children}
          </div>
          
          <footer className="py-6 px-8 border-t border-[#DDD8CF]/50 text-center text-xs text-[#626866] bg-white mt-auto">
             <div className="flex justify-center items-center gap-4 mb-2">
                <button onClick={() => toast("info", "Ação Simulada", "Link indisponível na demonstração")} className="hover:text-[#B66E45] transition-colors">Suporte</button>
                <button onClick={() => toast("info", "Ação Simulada", "Link indisponível na demonstração")} className="hover:text-[#B66E45] transition-colors">Política de Privacidade</button>
             </div>
             <div>
               &copy; {new Date().getFullYear()} ORDUM. Todos os direitos reservados.
             </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
