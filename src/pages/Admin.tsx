import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Shield, ShieldCheck, ShieldAlert, Search,
  Lock, Calendar, Trash2, X, Crown, Eye,
  CheckCircle2, AlertTriangle, ChevronDown, Info,
  RefreshCw,
} from 'lucide-react';
import { fetchWithAuth } from '../lib/api';
import { useAuthStore } from '../store';

// ── Types ──────────────────────────────────────────────────────────────────────
type RoleKey = 'viewer' | 'editor' | 'senior-editor' | 'admin' | 'super-admin';

interface UserRecord {
  id: string;
  email: string;
  name?: string;
  role: RoleKey;
  two_factor_enabled?: boolean;
  last_login?: string;
  created_at?: string;
}

// ── Role config ────────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<RoleKey, {
  label: string; color: string; bg: string; border: string;
  Icon: React.ElementType; order: number; description: string;
}> = {
  'viewer':        { label: 'Viewer',        color: 'text-blue-400',   bg: 'bg-blue-400/10',    border: 'border-blue-400/20',    Icon: Eye,         order: 0, description: 'Read-only access to public sections' },
  'editor':        { label: 'Editor',        color: 'text-green-400',  bg: 'bg-green-400/10',   border: 'border-green-400/20',   Icon: Shield,      order: 1, description: 'Create and edit news & stories' },
  'senior-editor': { label: 'Senior Editor', color: 'text-purple-400', bg: 'bg-purple-400/10',  border: 'border-purple-400/20',  Icon: ShieldCheck, order: 2, description: 'All editor rights + publish to social' },
  'admin':         { label: 'Admin',         color: 'text-[#f27d26]',  bg: 'bg-[#f27d26]/10',  border: 'border-[#f27d26]/20',  Icon: ShieldAlert, order: 3, description: 'Full access except super-admin settings' },
  'super-admin':   { label: 'Super Admin',   color: 'text-red-400',    bg: 'bg-red-400/10',     border: 'border-red-400/20',     Icon: Crown,       order: 4, description: 'Unrestricted access to everything' },
};

const ROLES = (Object.entries(ROLE_CONFIG) as [RoleKey, typeof ROLE_CONFIG[RoleKey]][])
  .sort((a, b) => a[1].order - b[1].order);

// ── Permissions matrix ─────────────────────────────────────────────────────────
type PermissionRow = { feature: string } & Record<RoleKey, boolean>;
const PERMISSIONS: PermissionRow[] = [
  { feature: 'Dashboard',        viewer: true,  editor: true,  'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'News Feed',        viewer: false, editor: true,  'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'Editor',           viewer: false, editor: true,  'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'Hooks',            viewer: false, editor: true,  'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'Publish',          viewer: false, editor: false, 'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'Trending',         viewer: true,  editor: true,  'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'Archive',          viewer: true,  editor: true,  'senior-editor': true,  admin: true,  'super-admin': true  },
  { feature: 'Brand Settings',   viewer: false, editor: false, 'senior-editor': false, admin: true,  'super-admin': true  },
  { feature: 'Company Settings', viewer: false, editor: false, 'senior-editor': false, admin: true,  'super-admin': true  },
  { feature: 'Audit Logs',       viewer: false, editor: false, 'senior-editor': false, admin: true,  'super-admin': true  },
  { feature: 'User Management',  viewer: false, editor: false, 'senior-editor': false, admin: true,  'super-admin': true  },
];

// ── Toast ──────────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'success' | 'error'; message: string }

// ── Component ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const { role: myRole, user: myUser } = useAuthStore();

  const [users, setUsers]               = useState<UserRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [roleFilter, setRoleFilter]     = useState<'all' | RoleKey>('all');
  const [toasts, setToasts]             = useState<Toast[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [showPerms, setShowPerms]       = useState(false);
  const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);

  // ── Toast helpers ────────────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // ── Fetch users ──────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetchWithAuth('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(
          data.sort((a: UserRecord, b: UserRecord) =>
            (ROLE_CONFIG[b.role]?.order ?? 0) - (ROLE_CONFIG[a.role]?.order ?? 0)
          )
        );
      }
    } catch {
      addToast('error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Close role menu on outside click
  useEffect(() => {
    const close = () => setOpenRoleMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Role update ───────────────────────────────────────────────────────────────
  const updateRole = async (uid: string, newRole: RoleKey) => {
    const prev = users.find(u => u.id === uid)?.role;
    setUsers(us => us.map(u => u.id === uid ? { ...u, role: newRole } : u));
    setOpenRoleMenu(null);
    try {
      const res = await fetchWithAuth(`/api/users/${uid}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        addToast('success', `Role updated to ${ROLE_CONFIG[newRole].label}`);
      } else {
        const err = await res.json();
        setUsers(us => us.map(u => u.id === uid ? { ...u, role: prev! } : u));
        addToast('error', err.error || 'Failed to update role');
      }
    } catch {
      setUsers(us => us.map(u => u.id === uid ? { ...u, role: prev! } : u));
      addToast('error', 'Network error');
    }
  };

  // ── Delete user ───────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetchWithAuth(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(us => us.filter(u => u.id !== deleteTarget.id));
        addToast('success', `${deleteTarget.email} removed`);
        setDeleteTarget(null);
      } else {
        const err = await res.json();
        addToast('error', err.error || 'Failed to delete user');
      }
    } catch {
      addToast('error', 'Network error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      (u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)) &&
      (roleFilter === 'all' || u.role === roleFilter)
    );
  });

  const canModifyUser = (u: UserRecord) => {
    if (u.id === myUser?.id) return false;          // can't modify self
    if (myRole === 'super-admin') return true;
    if (myRole === 'admin' && u.role !== 'super-admin') return true;
    return false;
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter">User Management</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">
            Access Control & Role Permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPerms(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs uppercase tracking-widest font-bold transition-colors ${
              showPerms
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Info size={13} />
            Permissions
          </button>
          <button
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#f27d26]/10 border border-[#f27d26]/20 rounded-lg text-xs uppercase tracking-widest font-bold text-[#f27d26] hover:bg-[#f27d26]/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ROLES.map(([key, cfg]) => {
          const count = users.filter(u => u.role === key).length;
          const active = roleFilter === key;
          return (
            <motion.button
              key={key}
              onClick={() => setRoleFilter(active ? 'all' : key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`glass rounded-xl p-4 border text-left transition-all ${
                active ? 'border-white/20 bg-white/[0.07]' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-3 ${cfg.bg} border ${cfg.border}`}>
                <cfg.Icon size={14} className={cfg.color} />
              </div>
              <p className="text-2xl font-bold tabular-nums">{count}</p>
              <p className={`text-[10px] uppercase tracking-widest font-bold mt-0.5 ${cfg.color}`}>{cfg.label}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Permissions matrix (collapsible) */}
      <AnimatePresence>
        {showPerms && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl border border-white/5 overflow-x-auto">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                  Role Permissions Matrix
                </span>
                <button onClick={() => setShowPerms(false)} className="text-white/30 hover:text-white/70 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-white/40 font-bold w-44">Feature</th>
                    {ROLES.map(([key, cfg]) => (
                      <th key={key} className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <cfg.Icon size={12} className={cfg.color} />
                          <span className={`text-[9px] uppercase tracking-widest font-bold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-2.5 text-xs text-white/50">{row.feature}</td>
                      {ROLES.map(([key]) => (
                        <td key={key} className="px-4 py-2.5 text-center">
                          {row[key]
                            ? <CheckCircle2 size={13} className="text-green-400 mx-auto" />
                            : <X size={13} className="text-white/15 mx-auto" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Role descriptions */}
              <div className="px-5 py-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {ROLES.map(([key, cfg]) => (
                  <div key={key} className={`rounded-xl p-3 border ${cfg.bg} ${cfg.border}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <cfg.Icon size={11} className={cfg.color} />
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">{cfg.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={15} />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#f27d26] transition-colors placeholder:text-white/20"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#f27d26] transition-colors"
        >
          <option value="all">All Roles ({users.length})</option>
          {ROLES.map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label} ({users.filter(u => u.role === key).length})
            </option>
          ))}
        </select>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl border border-white/5 h-48 flex flex-col items-center justify-center gap-3 text-white/20">
          <Users size={28} />
          <p className="text-sm">{searchTerm || roleFilter !== 'all' ? 'No users match your filters' : 'No users yet'}</p>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 text-[10px] uppercase tracking-widest text-white/40 font-bold">User</th>
                <th className="px-5 py-3.5 text-[10px] uppercase tracking-widest text-white/40 font-bold">Role</th>
                <th className="px-5 py-3.5 text-[10px] uppercase tracking-widest text-white/40 font-bold">2FA</th>
                <th className="px-5 py-3.5 text-[10px] uppercase tracking-widest text-white/40 font-bold">Joined</th>
                <th className="px-5 py-3.5 text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => {
                const cfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG['viewer'];
                const isSelf = u.id === myUser?.id;
                const canEdit = canModifyUser(u);

                return (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.035 }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.025] transition-colors"
                  >
                    {/* User cell */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 ${cfg.bg} ${cfg.border}`}>
                          <span className={cfg.color}>{(u.name || u.email)[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium leading-tight truncate">{u.name || u.email.split('@')[0]}</p>
                            {isSelf && (
                              <span className="text-[9px] uppercase tracking-widest font-bold text-[#f27d26] bg-[#f27d26]/10 border border-[#f27d26]/20 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/40 truncate leading-tight mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role cell */}
                    <td className="px-5 py-4">
                      {canEdit ? (
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenRoleMenu(openRoleMenu === u.id ? null : u.id)}
                            className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg border font-bold transition-all hover:brightness-110 ${cfg.bg} ${cfg.border} ${cfg.color}`}
                          >
                            <cfg.Icon size={10} />
                            {cfg.label}
                            <ChevronDown size={9} className={`transition-transform duration-200 ${openRoleMenu === u.id ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {openRoleMenu === u.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                                transition={{ duration: 0.12 }}
                                className="absolute top-full mt-1.5 left-0 z-30 glass rounded-xl border border-white/10 py-1 min-w-[170px] shadow-2xl"
                              >
                                {ROLES.map(([key, rcfg]) => {
                                  if (myRole === 'admin' && key === 'super-admin') return null;
                                  const isCurrent = key === u.role;
                                  return (
                                    <button
                                      key={key}
                                      onClick={() => updateRole(u.id, key)}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-white/5 ${
                                        isCurrent ? `${rcfg.color}` : 'text-white/50 hover:text-white/80'
                                      }`}
                                    >
                                      <rcfg.Icon size={11} className={isCurrent ? rcfg.color : ''} />
                                      <span className="flex-1 text-left">{rcfg.label}</span>
                                      {isCurrent && <CheckCircle2 size={11} className={rcfg.color} />}
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg border font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          <cfg.Icon size={10} />
                          {cfg.label}
                        </span>
                      )}
                    </td>

                    {/* 2FA cell */}
                    <td className="px-5 py-4">
                      <div className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold ${u.two_factor_enabled ? 'text-green-400' : 'text-white/20'}`}>
                        <Lock size={11} />
                        {u.two_factor_enabled ? 'On' : 'Off'}
                      </div>
                    </td>

                    {/* Joined cell */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                        <Calendar size={11} />
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </div>
                    </td>

                    {/* Actions cell */}
                    <td className="px-5 py-4 text-right">
                      {canEdit && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          title="Remove user"
                          className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {/* Table footer */}
          <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/25 font-bold">
              {filtered.length} of {users.length} users
            </span>
            <div className="flex items-center gap-3">
              {ROLES.map(([key, cfg]) => {
                const count = users.filter(u => u.role === key).length;
                if (count === 0) return null;
                return (
                  <span key={key} className={`flex items-center gap-1 text-[10px] font-bold ${cfg.color}`}>
                    <cfg.Icon size={9} />
                    {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !deletingId && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-2xl border border-white/10 p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold">Remove User</h3>
                  <p className="text-xs text-white/40 mt-0.5">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-white/60 leading-relaxed">
                Remove{' '}
                <span className="text-white font-semibold">{deleteTarget.email}</span>{' '}
                from the system? Their{' '}
                <span className={`font-bold ${ROLE_CONFIG[deleteTarget.role]?.color}`}>
                  {ROLE_CONFIG[deleteTarget.role]?.label}
                </span>{' '}
                access will be revoked immediately.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={!!deletingId}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={!!deletingId}
                  className="flex-1 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deletingId ? (
                    <><div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> Removing…</>
                  ) : (
                    <><Trash2 size={13} /> Remove</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl pointer-events-auto ${
                t.type === 'success'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {t.type === 'success'
                ? <CheckCircle2 size={14} />
                : <AlertTriangle size={14} />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
