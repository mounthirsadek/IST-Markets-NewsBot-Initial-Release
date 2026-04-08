import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, ShieldCheck, ShieldAlert, MoreVertical, Search, Filter, Mail, Calendar, Lock } from 'lucide-react';
import { auth } from '../firebase';
import { fetchWithAuth } from '../lib/api';

interface User {
  id: string;
  email: string;
  role: 'viewer' | 'editor' | 'senior-editor' | 'admin' | 'super-admin';
  two_factor_enabled?: boolean;
  last_login?: string;
  created_at?: string;
}

const ROLE_COLORS = {
  'viewer': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  'editor': 'bg-green-400/10 text-green-400 border-green-400/20',
  'senior-editor': 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  'admin': 'bg-[#f27d26]/10 text-[#f27d26] border-[#f27d26]/20',
  'super-admin': 'bg-red-400/10 text-red-400 border-red-400/20',
};

const ROLE_ICONS = {
  'viewer': Users,
  'editor': Shield,
  'senior-editor': ShieldCheck,
  'admin': ShieldAlert,
  'super-admin': ShieldAlert,
};

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetchWithAuth('/api/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (uid: string, newRole: string) => {
    try {
      const response = await fetchWithAuth(`/api/users/${uid}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      
      if (response.ok) {
        setUsers(users.map(u => u.id === uid ? { ...u, role: newRole as any } : u));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Update failed", error);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter">User Management</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Access Control & Security Policies</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] transition-colors w-full sm:w-64"
            />
          </div>
          
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="senior-editor">Senior Editor</option>
            <option value="admin">Admin</option>
            <option value="super-admin">Super Admin</option>
          </select>
        </div>
      </header>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]"></div>
        </div>
      ) : (
        <div className="glass rounded-2xl border-white/5 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">User</th>
                <th className="p-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Role</th>
                <th className="p-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Security</th>
                <th className="p-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Last Active</th>
                <th className="p-4 text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, idx) => {
                const RoleIcon = ROLE_ICONS[user.role] || Users;
                return (
                  <motion.tr 
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#f27d26]/10 flex items-center justify-center text-[#f27d26] font-bold text-xs">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.email}</p>
                          <p className="text-[10px] text-white/20 font-mono">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest px-2 py-1 rounded font-bold border flex items-center gap-1.5 w-fit",
                        ROLE_COLORS[user.role]
                      )}>
                        <RoleIcon size={10} />
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5" title="2FA Status">
                          <Lock size={12} className={user.two_factor_enabled ? "text-green-400" : "text-white/20"} />
                          <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">2FA</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                        <Calendar size={12} />
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <select 
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] uppercase tracking-widest font-bold focus:outline-none focus:border-[#f27d26] transition-colors"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="senior-editor">Senior Editor</option>
                        <option value="admin">Admin</option>
                        <option value="super-admin">Super Admin</option>
                      </select>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
