import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Flame, 
  ClipboardCheck, 
  GraduationCap, 
  Calendar,
  Trophy,
  Settings,
  UsersRound,
  AlertOctagon,
  Stethoscope,
  BookOpen,
  LogOut,
  UserCheck,
  Menu,
  X,
  FileSignature,
  Building2,
  FlaskConical,
  Bell,
  Pill
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../contexts/AuthContext";
import { fetchSettings, CompanySettings } from "../utils/pdfUtils";
import { supabase } from "../lib/supabase";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Funcionários", href: "/funcionarios", icon: Users },
  { name: "EPIs", href: "/epis", icon: Shield },
  { name: "Produtos Químicos", href: "/produtos-quimicos", icon: FlaskConical },
  { name: "Laudos", href: "/laudos", icon: FileSignature },
  { name: "Prevenção de Incêndio", href: "/incendio", icon: Flame },
  { name: "Inspeções", href: "/inspecoes", icon: ClipboardCheck },
  { name: "Fornecedores / Terceiros", href: "/fornecedores", icon: Building2 },
  { name: "Relatórios de Inspeções", href: "/relatorios-inspecoes", icon: ClipboardCheck },
  { name: "Relatórios 5S", href: "/relatorios-5s", icon: Trophy },
  { name: "Treinamentos", href: "/treinamentos", icon: GraduationCap },
  { name: "CIPA", href: "/cipa", icon: UsersRound },
  { name: "Medicamentos", href: "/medicamentos", icon: Pill },
  { name: "Exames", href: "/exames", icon: Stethoscope },
  { name: "Acidentes/Incidentes", href: "/ocorrencias", icon: AlertOctagon },
  { name: "Permissão de Trabalho", href: "/permissao-trabalho", icon: FileSignature },
  { name: "Normas e Procedimentos", href: "/normas", icon: BookOpen },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isMaster } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchSettings().then(setSettings);
    if (user) {
      loadNotifications();
      
      // Subscribe to new notifications
      const channel = supabase.channel('custom-all-channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        console.warn("Failed to load notifications:", error.message);
        return;
      }
      if (data) setNotifications(data);
    } catch (err) {
      console.warn("Notifications error:", err);
    }
  };

  const markAsRead = async (id: number) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [...navigation];
  if (isMaster) {
    navItems.push({ name: "Usuários", href: "/usuarios", icon: UserCheck });
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 border-r border-slate-800",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={settings?.company_logo || "/logo.png?v=3"} alt="SST Gestão Logo" className="w-8 h-8 object-contain rounded" />
            <h1 className="text-xl font-bold tracking-tight text-slate-200">{settings?.company_name || "SST Gestão"}</h1>
          </div>
          <button 
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive 
                    ? "bg-emerald-600 text-slate-100" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Sair do Sistema</span>
          </button>
          <div className="text-center pt-3 border-t border-slate-800/50 mt-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Desenvolvido por</p>
            <p className="text-xs font-bold text-emerald-500">Consultoria Seg</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center px-4 sm:px-6 shadow-sm">
          {/* Left: Hamburger + Page Title */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button 
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-md shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <h2 className="text-lg sm:text-xl font-semibold text-slate-200 truncate">
              {navItems.find(n => location.pathname === n.href || (n.href !== "/" && location.pathname.startsWith(n.href)))?.name || settings?.company_name || "SST Gestão"}
            </h2>
          </div>

          {/* Right: User Info + Notifications */}
          <div className="flex items-center gap-3 shrink-0">
            {/* User Name & Role */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider leading-tight" style={{
                  color: user?.role === 'proprietario' ? '#f87171' : user?.role === 'master' ? '#c084fc' : user?.role === 'operador' ? '#60a5fa' : '#9ca3af'
                }}>
                  {user?.role === 'proprietario' ? 'Proprietário' : user?.role === 'master' ? 'Master' : user?.role === 'operador' ? 'Operador' : 'Visualizador'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full relative transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Notificações</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                        {unreadCount} novas
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        Nenhuma notificação no momento.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={clsx(
                              "p-4 hover:bg-gray-50 transition-colors cursor-pointer",
                                !notification.read && "bg-blue-50/50"
                            )}
                            onClick={() => {
                              if (!notification.read) markAsRead(notification.id);
                              setShowNotifications(false);
                              if (notification.action_url) {
                                navigate(notification.action_url);
                              }
                            }}
                          >
                            <div className="flex gap-3">
                              <div className={clsx(
                                "w-2 h-2 mt-2 rounded-full shrink-0",
                                !notification.read ? "bg-blue-500" : "bg-transparent"
                              )} />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {new Date(notification.created_at).toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
