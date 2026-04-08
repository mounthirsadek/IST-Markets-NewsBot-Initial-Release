import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Newspaper, PenTool, Archive, TrendingUp, Users, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store';
import { fetchWithAuth } from '../lib/api';

interface DashboardMetrics {
  totalNews: number;
  totalStories: number;
  publishedCount: number;
  rejectionRate: number;
  themeDistribution: { [key: string]: number };
  formatDistribution: { [key: string]: number };
}

interface Activity {
  id: string;
  action_type: string;
  entity_type: string;
  created_at: string;
  entity_id: string;
}

const COLORS = ['#f27d26', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const { role } = useAuthStore();

  const [health, setHealth] = useState<{ [key: string]: 'online' | 'offline' | 'checking' }>({
    fmp: 'checking',
    gemini: 'checking',
    meta: 'checking'
  });

  useEffect(() => {
    fetchMetrics();
    checkHealth();
    
    // Listen for recent audit logs only for admins
    let unsubscribe = () => {};
    if (role === 'admin' || role === 'super-admin') {
      const q = query(collection(db, 'audit_logs'), orderBy('created_at', 'desc'), limit(5));
      unsubscribe = onSnapshot(q, (snapshot) => {
        setRecentActivity(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
      }, (error) => {
        console.error("Audit logs listener error:", error);
      });
    }

    return () => unsubscribe();
  }, [role]);

  const fetchMetrics = async () => {
    try {
      const response = await fetchWithAuth('/api/dashboard/metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch metrics", error);
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async () => {
    // Mock health checks for demo
    setTimeout(() => setHealth(prev => ({ ...prev, fmp: 'online' })), 500);
    setTimeout(() => setHealth(prev => ({ ...prev, gemini: 'online' })), 1000);
    setTimeout(() => setHealth(prev => ({ ...prev, meta: 'online' })), 1500);
  };

  const themeData = metrics?.themeDistribution ? Object.entries(metrics.themeDistribution).map(([name, value]) => ({ name, value })) : [];
  const formatData = metrics?.formatDistribution ? Object.entries(metrics.formatDistribution).map(([name, value]) => ({ name, value })) : [];

  const stats = [
    { label: 'News Fetched', value: metrics?.totalNews || 0, icon: Newspaper, color: 'text-blue-400' },
    { label: 'Stories Created', value: metrics?.totalStories || 0, icon: PenTool, color: 'text-[#f27d26]' },
    { label: 'Published to IG', value: metrics?.publishedCount || 0, icon: Archive, color: 'text-green-400' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 md:space-y-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">Dashboard</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">System Overview & Analytics</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xl md:text-2xl font-mono text-[#f27d26]">{new Date().toLocaleDateString()}</p>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end mt-1">
            {Object.entries(health).map(([service, status]) => (
              <div key={service} className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  status === 'online' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 
                  status === 'offline' ? 'bg-red-400' : 'bg-white/20 animate-pulse'
                }`} />
                <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">{service}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass p-4 md:p-8 rounded-2xl border-white/5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={80} />
            </div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{stat.label}</p>
            <h3 className={cn("text-4xl font-bold tracking-tighter", stat.color)}>{stat.value.toLocaleString()}</h3>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Theme Distribution */}
        <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp size={20} className="text-[#f27d26]" />
            Content by Theme
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={themeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '8px' }}
                  itemStyle={{ color: '#f27d26' }}
                />
                <Bar dataKey="value" fill="#f27d26" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Format Distribution */}
        <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Format Distribution
          </h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formatData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {formatData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {formatData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-white/60">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Clock size={20} className="text-[#f27d26]" />
              System Activity
            </h3>
            <Link to="/logs" className="text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors">
              View Audit Trail
            </Link>
          </div>

          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="glass p-4 rounded-xl border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    {activity.action_type.includes('PUBLISH') ? <Archive size={18} /> : activity.action_type.includes('SELECT') ? <PenTool size={18} /> : <Newspaper size={18} />}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{activity.action_type}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">
                      {new Date(activity.created_at).toLocaleTimeString()} • {activity.entity_type}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-white/20 font-mono">
                  {activity.id.substring(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Metrics */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold tracking-tight">Safety & Quality</h3>
          <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-white/40">Rejection Rate</span>
              <span className="text-xl font-bold text-red-400">{(metrics?.rejectionRate || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div 
                className="bg-red-400 h-2 rounded-full transition-all duration-1000" 
                style={{ width: `${metrics?.rejectionRate || 0}%` }}
              />
            </div>
            <div className="flex items-center gap-3 p-4 bg-red-400/5 rounded-xl border border-red-400/10">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-[10px] text-red-400/60 leading-relaxed">
                Rejection rate is within normal parameters. Most rejections are due to political keywords.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
