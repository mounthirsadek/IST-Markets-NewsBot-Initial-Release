import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Filter, RefreshCw, ExternalLink, PenTool, CheckCircle2, XCircle, Sparkles, Plus, CalendarDays, Tag, Globe, X, Zap } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../store';
import { fetchWithAuth } from '../lib/api';

interface NewsArticle {
  id: string;
  headline: string;
  article_body: string;
  article_url: string;
  source_name: string;
  published_at_source: string;
  theme: string;
  asset_tags: string[];
  safety_status: 'safe' | 'unsafe' | 'conditional';
  rejection_reason?: string;
  status: 'pending' | 'processed' | 'rejected';
}

// ── RSS source definitions (mirrors server.ts) ───────────────────────────────
const RSS_SOURCES_UI = [
  { key: 'fmp',            label: 'FMP (Financial Modeling Prep)', category: 'General'       },
  { key: 'bloomberg',      label: 'Bloomberg Markets',             category: 'General'       },
  { key: 'yahoo',          label: 'Yahoo Finance',                 category: 'General'       },
  { key: 'cnbc',           label: 'CNBC Markets',                  category: 'General'       },
  { key: 'bbc',            label: 'BBC Business',                  category: 'General'       },
  { key: 'marketwatch',    label: 'MarketWatch',                   category: 'General'       },
  { key: 'zerohedge',      label: 'Zero Hedge',                    category: 'General'       },
  { key: 'oilprice',       label: 'OilPrice.com',                  category: 'Energy'        },
  { key: 'coindesk',       label: 'CoinDesk',                      category: 'Crypto'        },
  { key: 'cointelegraph',  label: 'CoinTelegraph',                 category: 'Crypto'        },
  { key: 'cryptoslate',    label: 'CryptoSlate',                   category: 'Crypto'        },
  { key: 'bitcoinmagazine',label: 'Bitcoin Magazine',              category: 'Crypto'        },
  { key: 'fed',            label: 'Federal Reserve',               category: 'Central Banks' },
  { key: 'ecb',            label: 'ECB',                           category: 'Central Banks' },
  { key: 'bbc_ar',         label: 'BBC عربي — اقتصاد',           category: 'Arabic'        },
  { key: 'rt_ar',          label: 'RT عربي — اقتصاد',            category: 'Arabic'        },
];

const SOURCE_CATEGORIES = ['General', 'Energy', 'Crypto', 'Central Banks', 'Arabic'];

export default function NewsFeed() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchAllProgress, setFetchAllProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('fmp');
  const [filterDate, setFilterDate]     = useState('');
  const [filterTheme, setFilterTheme]   = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualArticle, setManualArticle] = useState({
    headline: '',
    article_body: '',
    article_url: '',
    source_name: 'Manual Entry',
    theme: 'Market Update',
    asset_tags: [] as string[]
  });

  const { user } = useAuthStore();

  useEffect(() => {
    let unsubscribe = () => {};
    
    const startListener = () => {
      if (!user) return;
      
      const q = query(collection(db, 'news'), orderBy('published_at_source', 'desc'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
        setArticles(docs);
        setLoading(false);
      }, (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      });
    };

    startListener();
    return () => unsubscribe();
  }, [user]);

  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const endpoint = selectedSource === 'fmp'
        ? '/api/news/fetch'
        : `/api/news/fetch-rss?source=${selectedSource}`;
      const res = await fetchWithAuth(endpoint);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "News source currently unavailable.");
      }
      const data = await res.json();
      console.log("Fetch result:", data);
    } catch (error: any) {
      console.error("Fetch failed", error);
      setFetchError(error.message || "Failed to fetch news. Please try again later.");
    } finally {
      setFetching(false);
    }
  };

  const handleFetchAll = async () => {
    setFetchingAll(true);
    setFetchError(null);
    const allSourcesToFetch = RSS_SOURCES_UI; // includes fmp + all rss
    const total = allSourcesToFetch.length;
    let totalApproved = 0;
    const errors: string[] = [];

    for (let i = 0; i < allSourcesToFetch.length; i++) {
      const src = allSourcesToFetch[i];
      setFetchAllProgress({ done: i, total, current: src.label });
      try {
        const endpoint = src.key === 'fmp'
          ? '/api/news/fetch'
          : `/api/news/fetch-rss?source=${src.key}`;
        const res = await fetchWithAuth(endpoint);
        if (res.ok) {
          const data = await res.json();
          totalApproved += data.approved || 0;
        } else {
          const err = await res.json().catch(() => ({}));
          errors.push(`${src.label}: ${err.error || 'unavailable'}`);
        }
      } catch (e: any) {
        errors.push(`${src.label}: ${e.message}`);
      }
    }

    setFetchAllProgress(null);
    setFetchingAll(false);
    if (errors.length > 0 && totalApproved === 0) {
      setFetchError(`Some sources failed: ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? ' ...' : ''}`);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const updateStatus = async (id: string, status: 'processed' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'news', id), { status });
    } catch (error) {
      console.error("Update failed", error);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'news'), {
        ...manualArticle,
        published_at_source: new Date().toISOString(),
        safety_status: 'safe',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setShowManualModal(false);
      setManualArticle({
        headline: '',
        article_body: '',
        article_url: '',
        source_name: 'Manual Entry',
        theme: 'Market Update',
        asset_tags: []
      });
    } catch (error) {
      console.error("Manual entry failed", error);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic lists for filter dropdowns
  const allThemes  = useMemo(() => Array.from(new Set(articles.map(a => a.theme).filter(Boolean))).sort(), [articles]);
  const allSources = useMemo(() => Array.from(new Set(articles.map(a => a.source_name).filter(Boolean))).sort(), [articles]);

  const activeFilterCount = [filterDate, filterTheme, filterSource, searchTerm].filter(Boolean).length;

  const clearFilters = () => {
    setFilterDate('');
    setFilterTheme('');
    setFilterSource('');
    setSearchTerm('');
  };

  const filteredArticles = articles.filter(a => {
    if (a.status === 'rejected') return false;

    // Keyword search
    if (searchTerm) {
      const kw = searchTerm.toLowerCase();
      const match = a.headline.toLowerCase().includes(kw)
        || a.source_name.toLowerCase().includes(kw)
        || (a.article_body || '').toLowerCase().includes(kw)
        || (a.asset_tags || []).some(t => t.toLowerCase().includes(kw));
      if (!match) return false;
    }

    // Date filter — compare YYYY-MM-DD portion
    if (filterDate) {
      const articleDay = a.published_at_source
        ? new Date(a.published_at_source).toISOString().slice(0, 10)
        : '';
      if (articleDay !== filterDate) return false;
    }

    // Theme filter
    if (filterTheme && a.theme !== filterTheme) return false;

    // Source filter
    if (filterSource && a.source_name !== filterSource) return false;

    return true;
  }).sort((a, b) => {
    const da = a.published_at_source ? new Date(a.published_at_source).getTime() : 0;
    const db_ = b.published_at_source ? new Date(b.published_at_source).getTime() : 0;
    return db_ - da; // newest first
  });

  const trendingAssets = Array.from(
    articles.reduce((acc, article) => {
      article.asset_tags?.forEach(tag => acc.set(tag, (acc.get(tag) || 0) + 1));
      return acc;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">News Review</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Review and Select Market Intelligence</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={() => navigate(`/editor/${Array.from(selectedIds)[0]}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f27d26] text-black font-bold hover:bg-[#f27d26]/90 transition-all"
            >
              <Sparkles size={18} />
              Create Rewrite Job ({selectedIds.size})
            </button>
          )}
          <select
            value={selectedSource}
            onChange={e => setSelectedSource(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#f27d26] max-w-[200px]"
          >
            {SOURCE_CATEGORIES.map(cat => (
              <optgroup key={cat} label={`── ${cat}`}>
                {RSS_SOURCES_UI.filter(s => s.category === cat).map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={handleFetch}
            disabled={fetching || fetchingAll}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={fetching ? "animate-spin" : ""} />
            {fetching ? "Fetching..." : "Fetch News"}
          </button>
          <button
            onClick={handleFetchAll}
            disabled={fetching || fetchingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f27d26] text-black font-bold hover:bg-[#f27d26]/90 transition-all disabled:opacity-50"
          >
            <Zap size={18} className={fetchingAll ? "animate-pulse" : ""} />
            {fetchingAll ? `${fetchAllProgress?.done ?? 0}/${fetchAllProgress?.total ?? 0}` : "Fetch All"}
          </button>
          <button 
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Manual Entry
          </button>
        </div>
      </header>

      {/* ── Fetch All Progress Bar ─────────────────────────────────── */}
      {fetchingAll && fetchAllProgress && (
        <div className="glass rounded-xl border border-[#f27d26]/20 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-[#f27d26] font-bold">
              <Zap size={13} className="animate-pulse" />
              Fetching all sources...
            </span>
            <span className="text-white/40">{fetchAllProgress.done} / {fetchAllProgress.total}</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f27d26] rounded-full transition-all duration-300"
              style={{ width: `${(fetchAllProgress.done / fetchAllProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-white/40 truncate">
            ↳ {fetchAllProgress.current}
          </p>
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="glass rounded-xl border border-white/5 p-3 md:p-4">
        {/* Header row: label + count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-bold">
            <Filter size={13} className="text-[#f27d26]" />
            Filter
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#f27d26] text-black text-[9px] font-black leading-none">
                {activeFilterCount}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/30">
            {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters grid: 1 col mobile → 2 col sm → 4 col lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            <input
              type="text"
              placeholder="Keyword search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-xs focus:outline-none focus:border-[#f27d26] transition-colors"
            />
          </div>

          {/* Date Filter */}
          <div className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
            <CalendarDays size={14} className="text-white/30 shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="flex-1 bg-transparent text-xs focus:outline-none text-white/80 [color-scheme:dark] min-w-0"
            />
          </div>

          {/* Theme Filter */}
          <div className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
            <Tag size={14} className="text-white/30 shrink-0" />
            <select
              value={filterTheme}
              onChange={e => setFilterTheme(e.target.value)}
              className="flex-1 bg-transparent text-xs focus:outline-none text-white/80 min-w-0"
            >
              <option value="">All Themes</option>
              {allThemes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Source Filter */}
          <div className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
            <Globe size={14} className="text-white/30 shrink-0" />
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="flex-1 bg-transparent text-xs focus:outline-none text-white/80 min-w-0"
            >
              <option value="">All Sources</option>
              {allSources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Clear button */}
        {activeFilterCount > 0 && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-400/10 border border-white/10 hover:border-red-400/20 text-white/40 hover:text-red-400 transition-all text-xs"
            >
              <X size={13} />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Trending Assets */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold shrink-0 flex items-center gap-2">
          <Sparkles size={14} className="text-[#f27d26]" />
          Trending:
        </span>
        {trendingAssets.map(([asset, count]) => (
          <div 
            key={asset}
            className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono flex items-center gap-2 shrink-0"
          >
            <span className="text-[#f27d26] font-bold">{asset}</span>
            <span className="opacity-40">{count}</span>
          </div>
        ))}
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-2xl p-8 rounded-2xl border-white/10 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Manual News Entry</h3>
              <button onClick={() => setShowManualModal(false)} className="text-white/40 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Headline</label>
                <input 
                  required
                  value={manualArticle.headline}
                  onChange={e => setManualArticle({...manualArticle, headline: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#f27d26]"
                  placeholder="Enter news headline..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Body Content</label>
                <textarea 
                  required
                  rows={4}
                  value={manualArticle.article_body}
                  onChange={e => setManualArticle({...manualArticle, article_body: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#f27d26] resize-none"
                  placeholder="Enter article body..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Theme</label>
                  <select 
                    value={manualArticle.theme}
                    onChange={e => setManualArticle({...manualArticle, theme: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#f27d26]"
                  >
                    <option>Market Update</option>
                    <option>Crypto Markets</option>
                    <option>Forex Markets</option>
                    <option>Energy Markets</option>
                    <option>Precious Metals</option>
                    <option>Fed Policy</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Source URL (Optional)</label>
                  <input 
                    value={manualArticle.article_url}
                    onChange={e => setManualArticle({...manualArticle, article_url: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#f27d26]"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Add Article
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {fetchError && (
        <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg flex items-center justify-between gap-3 text-red-400 text-xs">
          <div className="flex items-center gap-3">
            <XCircle size={16} />
            <p>{fetchError}</p>
          </div>
          <button 
            onClick={handleFetch}
            className="px-3 py-1 bg-red-400/20 hover:bg-red-400/30 rounded font-bold transition-colors"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredArticles.length === 0 ? (
            <div className="glass p-12 rounded-2xl text-center">
              <p className="text-white/40 uppercase tracking-widest text-sm">No articles for review</p>
            </div>
          ) : (
            filteredArticles.map((article, idx) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass p-4 md:p-6 rounded-xl border-white/5 hover:bg-white/5 transition-colors group relative space-y-3"
              >
                {/* ── Row 1: Checkbox + Badges ──────────────────── */}
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(article.id)}
                    className={`mt-0.5 w-5 h-5 md:w-6 md:h-6 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                      selectedIds.has(article.id)
                        ? 'bg-[#f27d26] border-[#f27d26]'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {selectedIds.has(article.id) && <CheckCircle2 size={14} className="text-black" />}
                  </button>

                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#f27d26]/20 text-[#f27d26] rounded font-bold whitespace-nowrap">
                      {article.theme}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-white/10 rounded font-bold text-white/60 whitespace-nowrap">
                      {article.source_name}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded font-bold whitespace-nowrap ${
                      article.safety_status === 'safe'        ? 'bg-green-500/20 text-green-400' :
                      article.safety_status === 'conditional' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-red-500/20 text-red-400'
                    }`}>
                      {article.safety_status}
                    </span>
                    <span className="text-[10px] text-white/30 whitespace-nowrap">
                      {new Date(article.published_at_source).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* ── Row 2: Headline + Body ────────────────────── */}
                <div className="space-y-1.5 pl-8 md:pl-9">
                  <h3 className="text-base md:text-xl font-bold leading-snug group-hover:text-[#f27d26] transition-colors">
                    {article.headline}
                  </h3>
                  <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                    {article.article_body}
                  </p>
                </div>

                {/* ── Row 3: Asset Tags + Actions ───────────────── */}
                <div className="pl-8 md:pl-9 flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
                  {/* Asset tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {article.asset_tags.map(tag => (
                      <span key={tag} className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-white/40">
                        ${tag}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <a
                      href={article.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 md:p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                      title="View Original"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button
                      onClick={() => updateStatus(article.id, 'rejected')}
                      className="p-2 md:p-3 rounded-lg bg-white/5 hover:bg-red-400/10 transition-colors text-white/60 hover:text-red-400"
                      title="Reject"
                    >
                      <XCircle size={16} />
                    </button>
                    <Link
                      to={`/editor/${article.id}`}
                      className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-3 rounded-lg bg-[#f27d26]/10 text-[#f27d26] hover:bg-[#f27d26] hover:text-black font-bold transition-all text-sm"
                    >
                      <PenTool size={16} />
                      <span>Rewrite</span>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
