import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Newspaper, PenTool, Archive, Settings, LogOut, Palette, History, Shield, Lock, Menu, X } from 'lucide-react';
import { auth, logout } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Newspaper, label: 'News Feed', path: '/news', roles: ['editor', 'senior-editor', 'admin', 'super-admin'] },
  { icon: PenTool, label: 'Editor', path: '/editor', roles: ['editor', 'senior-editor', 'admin', 'super-admin'] },
  { icon: Archive, label: 'Archive', path: '/archive' },
  { icon: Palette, label: 'Brand Settings', path: '/brand', roles: ['admin', 'super-admin'] },
  { icon: Settings, label: 'Company Settings', path: '/settings', roles: ['admin', 'super-admin'] },
  { icon: History, label: 'Audit Logs', path: '/logs', roles: ['admin', 'super-admin'] },
  { icon: Shield, label: 'Admin', path: '/admin', roles: ['admin', 'super-admin'] },
  { icon: Lock, label: 'Security', path: '/security' },
];

export default function Layout() {
  const { role } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(item =>
    !item.roles || (role && item.roles.includes(role))
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
        <h1 className="text-base font-bold tracking-tighter text-[#f27d26]">IST MARKETS</h1>
        <div className="w-9" />
      </div>

      {/* ── Backdrop ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
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

        <div className="p-6 hidden md:block">
          <h1 className="text-xl font-bold tracking-tighter text-[#f27d26]">IST MARKETS</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50">NewsBot v1.0</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-2">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-[#f27d26] text-black font-semibold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <img
              src={auth.currentUser?.photoURL || 'https://picsum.photos/seed/user/40/40'}
              className="w-8 h-8 rounded-full border border-white/20 shrink-0"
              alt="User"
            />
            <div className="overflow-hidden min-w-0">
              <p className="text-sm font-medium truncate">{auth.currentUser?.displayName}</p>
              <p className="text-[10px] text-white/40 truncate">{auth.currentUser?.email}</p>
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
