import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { History, Search, Filter, Calendar, User, Activity, Database, Settings, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { auth } from '../firebase';
import { fetchWithAuth } from '../lib/api';

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  details?: string;
  before_data?: any;
  after_data?: any;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetchWithAuth('/api/audit-logs');
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = ['ALL', ...new Set(logs.map(l => l.action_type))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterType === 'ALL' || log.action_type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const getActionIcon = (type: string) => {
    if (type.includes('FETCH')) return <Database size={16} className="text-blue-400" />;
    if (type.includes('SELECT')) return <Activity size={16} className="text-green-400" />;
    if (type.includes('PUBLISH')) return <Shield size={16} className="text-[#f27d26]" />;
    if (type.includes('SETTINGS')) return <Settings size={16} className="text-purple-400" />;
    return <History size={16} className="text-white/40" />;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter">Audit Trail</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">System Traceability & Event Logs</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] transition-colors appearance-none w-full sm:w-48"
            >
              {actionTypes.map(type => (
                <option key={type} value={type} className="bg-[#1a1a1a]">{type}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] transition-colors w-full sm:w-64"
            />
          </div>
        </div>
      </header>

      <div className="glass rounded-2xl border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Timestamp</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-white/40">User</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Action</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Entity</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-[#f27d26] mx-auto"></div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/20 uppercase tracking-widest text-xs">
                    No logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => (
                  <motion.tr 
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.01 }}
                    className="hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                        <Calendar size={12} />
                        {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                          <User size={12} className="text-white/40" />
                        </div>
                        <span className="text-xs font-medium text-white/80">{log.user_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        <span className="text-xs font-bold uppercase tracking-tight">{log.action_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/40 uppercase tracking-widest">
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-white/40 max-w-md">
                        {log.details || log.entity_id}
                      </p>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
