import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Archive as ArchiveIcon, Search, Filter, Calendar, ExternalLink, Eye, Trash2, CheckCircle2, Clock, Send, Globe, User, Tag, Layout } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store';

interface Story {
  id: string;
  en: { headline: string; caption: string; hashtags: string[] };
  ar: { headline: string; caption: string; hashtags: string[] };
  imageUrl: string;
  status: 'draft' | 'scheduled' | 'published';
  theme?: string;
  format?: string;
  createdBy?: string;
  createdAt: any;
  publishedAt?: any;
  publishInfo?: {
    en?: { postId: string; url: string };
    ar?: { postId: string; url: string };
  };
  metrics?: {
    en?: { impressions: number; reach: number; likes: number; comments: number; saves: number };
    ar?: { impressions: number; reach: number; likes: number; comments: number; saves: number };
  };
}

export default function Archive() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'scheduled' | 'published'>('all');
  const [themeFilter, setThemeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');

  const { user } = useAuthStore();

  useEffect(() => {
    let unsubscribe = () => {};
    
    const startListener = () => {
      if (!user) return;
      
      const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
        setStories(docs);
        setLoading(false);
      }, (error) => {
        console.error("Stories listener error:", error);
        setLoading(false);
      });
    };

    startListener();
    return () => unsubscribe();
  }, [user]);

  const themes = Array.from(new Set(stories.map(s => s.theme).filter(Boolean)));
  const formats = Array.from(new Set(stories.map(s => s.format).filter(Boolean)));

  const filteredStories = stories.filter(s => {
    const matchesSearch = s.en?.headline?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.ar?.headline?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesTheme = themeFilter === 'all' || s.theme === themeFilter;
    const matchesFormat = formatFilter === 'all' || s.format === formatFilter;
    return matchesSearch && matchesStatus && matchesTheme && matchesFormat;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-bold tracking-tighter">Content Archive</h2>
            <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Historical Repository & Performance</p>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input 
              type="text" 
              placeholder="Search by headline..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] transition-colors w-80"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-4 glass rounded-xl border-white/5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 mr-2">
            <Filter size={14} />
            Filters:
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f27d26] transition-colors"
          >
            <option value="all">All Status</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>

          <select 
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f27d26] transition-colors"
          >
            <option value="all">All Themes</option>
            {themes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select 
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f27d26] transition-colors"
          >
            <option value="all">All Formats</option>
            {formats.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStories.map((story, idx) => (
            <motion.div 
              key={story.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass rounded-2xl border-white/5 overflow-hidden flex flex-col md:flex-row group hover:border-[#f27d26]/30 transition-all"
            >
              {/* Image Section */}
              <div className="w-full md:w-48 h-48 md:h-auto relative shrink-0">
                <img 
                  src={story.imageUrl} 
                  className="w-full h-full object-cover"
                  alt="Story"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="p-2 bg-white/10 rounded-full hover:bg-[#f27d26] hover:text-black transition-all">
                    <Eye size={16} />
                  </button>
                </div>
              </div>

              {/* Content Section */}
              <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[8px] uppercase tracking-widest px-2 py-0.5 rounded font-bold border",
                        story.status === 'published' ? "bg-green-400/10 text-green-400 border-green-400/20" : 
                        story.status === 'scheduled' ? "bg-blue-400/10 text-blue-400 border-blue-400/20" : "bg-[#f27d26]/10 text-[#f27d26] border-[#f27d26]/20"
                      )}>
                        {story.status}
                      </span>
                      <span className="text-[8px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 font-bold">
                        {story.format || 'Post'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/20 font-mono">
                      {story.id.substring(0, 8)}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg leading-tight line-clamp-1">{story.en?.headline}</h3>
                  <p className="text-xs text-white/40 line-clamp-2 italic">"{story.ar?.headline}"</p>
                </div>

                <div className="grid grid-cols-3 gap-4 py-3 border-y border-white/5">
                  <div className="space-y-1">
                    <p className="text-[8px] uppercase tracking-widest text-white/20">Theme</p>
                    <p className="text-[10px] font-bold truncate">{story.theme || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] uppercase tracking-widest text-white/20">Editor</p>
                    <p className="text-[10px] font-bold truncate">{story.createdBy?.substring(0, 8) || 'System'}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[8px] uppercase tracking-widest text-white/20">Created</p>
                    <p className="text-[10px] font-bold">{story.createdAt?.toDate ? story.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>

                {story.status === 'published' && story.metrics && (
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                      <Eye size={12} className="text-blue-400" />
                      <span className="text-[10px] font-bold">{(story.metrics?.en?.impressions || 0) + (story.metrics?.ar?.impressions || 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-green-400" />
                      <span className="text-[10px] font-bold">{(story.metrics?.en?.likes || 0) + (story.metrics?.ar?.likes || 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ArchiveIcon size={12} className="text-[#f27d26]" />
                      <span className="text-[10px] font-bold">{(story.metrics?.en?.saves || 0) + (story.metrics?.ar?.saves || 0)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  {story.publishInfo?.en?.url && (
                    <a href={story.publishInfo.en.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all">
                    Details
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
