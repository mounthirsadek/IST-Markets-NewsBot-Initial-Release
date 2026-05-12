import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Newspaper, PenTool, Archive, Settings, LogOut, Palette, History, Shield, Lock, Menu, X, Zap, TrendingUp, ChevronDown, LayoutTemplate } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../store';
import { useBrandStore } from '../context/BrandContext';
import { BRANDS } from '../data/brands';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',       path: '/' },
  { icon: Newspaper,       label: 'News Feed',        path: '/news',    roles: ['editor', 'senior-editor', 'admin', 'super-admin'] },
  { icon: PenTool,         label: 'Editor',           path: '/editor',  roles: ['editor', 'senior-editor', 'admin', 'super-admin'] },
  { icon: Zap,             label: 'Hooks',            path: '/hooks',   roles: ['editor', 'senior-editor', 'admin', 'super-admin'] },
  // Marsad Al Souq card generator — only visible when Marsad brand is active
  { icon: LayoutTemplate,  label: 'البطاقات',         path: '/cards',   roles: ['editor', 'senior-editor', 'admin', 'super-admin'], brandId: 'marsad-alsouq' },
  { icon: TrendingUp,      label: 'Trending',         path: '/trending' },
  { icon: Archive,         label: 'Archive',          path: '/archive' },
  { icon: Palette,         label: 'Brand Settings',   path: '/brand',   roles: ['admin', 'super-admin'] },
  { icon: Settings,        label: 'Company Settings', path: '/settings',roles: ['admin', 'super-admin'] },
  { icon: History,         label: 'Audit Logs',       path: '/logs',    roles: ['admin', 'super-admin'] },
  { icon: Shield,          label: 'Admin',            path: '/admin',   roles: ['admin', 'super-admin'] },
  { icon: Lock,            label: 'Security',         path: '/security' },
];

export default function Layout() {
  const { role, user, logout } = useAuthStore();
  const { activeBrand, setActiveBrand } = useBrandStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);

  const accent = activeBrand.accentColor;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(item =>
    (!item.roles   || (role && item.roles.includes(role))) &&
    (!(item as any).brandId || (item as any).brandId === activeBrand.id)
  );

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* ── Mobile Top Bar ───────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#0a0a0a] border-b border-white/10 flex items-center px-4 justify-between shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* Mobile brand selector */}
        <div className="relative">
          <button
            onClick={() => setBrandMenuOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <h1 className="text-sm font-bold tracking-tighter" style={{ color: accent }}>
              {activeBrand.nameAr ?? activeBrand.name}
            </h1>
            {BRANDS.length > 1 && <ChevronDown size={12} className="opacity-50" />}
          </button>
          {brandMenuOpen && BRANDS.length > 1 && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[160px]">
              {BRANDS.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setActiveBrand(b.id); setBrandMenuOpen(false); }}
                  className={cn(
                    'w-full text-left px-4 py-3 text-sm transition-colors',
                    b.id === activeBrand.id
                      ? 'font-bold'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                  style={b.id === activeBrand.id ? { color: b.accentColor } : undefined}
                >
                  {b.nameAr ?? b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-9" />
      </div>

      {/* ── Backdrop ─────────────────────────────────────────── */}
      {(sidebarOpen || brandMenuOpen) && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => { setSidebarOpen(false); setBrandMenuOpen(false); }}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a]",
        "border-r border-white/10 flex flex-col",
        "transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0"
      )}>
        {/* Mobile close button */}
        <div className="md:hidden flex justify-end p-3 border-b border-white/5">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Desktop brand header */}
        <div className="p-6 hidden md:block">
          <h1 className="text-xl font-bold tracking-tighter" style={{ color: accent }}>
            {activeBrand.nameAr ?? activeBrand.name}
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50">NewsBot v1.0</p>

          {/* Desktop brand selector */}
          {BRANDS.length > 1 && (
            <select
              value={activeBrand.id}
              onChange={(e) => setActiveBrand(e.target.value)}
              className="mt-3 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none cursor-pointer appearance-none"
              style={{ borderColor: accent + '40' }}
            >
              {BRANDS.map(b => (
                <option key={b.id} value={b.id} className="bg-[#1a1a1a]">
                  {b.nameAr ? `${b.nameAr} — ${b.name}` : b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-2">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "text-black font-semibold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={isActive ? { backgroundColor: accent } : undefined}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center font-bold text-sm shrink-0"
              style={{ backgroundColor: accent + '33', color: accent, borderColor: accent + '50' }}
            >
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || user?.username}</p>
              <p className="text-[10px] text-white/40 truncate">{user?.email || user?.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
