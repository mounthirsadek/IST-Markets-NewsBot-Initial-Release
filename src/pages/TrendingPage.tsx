import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, CalendarDays, BarChart2, Hash, Layers } from 'lucide-react';
import { MARKET_SYMBOLS, MarketSymbol, articleMentionsSymbol, CATEGORY_COLORS, CATEGORY_BG } from '../data/symbols';

interface NewsArticle {
  id: string;
  headline: string;
  article_body: string;
  source_name: string;
  published_at_source: string;
  theme: string;
  asset_tags: string[];
  status: string;
}

const STOP_WORDS = new Set([
  'the','a','an','of','in','to','and','for','is','are','on','at','by','be','as',
  'with','that','this','it','its','from','was','will','has','have','had','but','or',
  'not','can','if','up','so','us','we','he','she','they','their','our','new','more',
  'over','after','also','into','than','said','says','says','amid','hits','seen',
  'high','low','rise','fall','rate','year','week','day','month','time','back',
  'been','were','would','could','should','about','amid','amid','amid',
]);

const CATEGORIES: Array<MarketSymbol['category'] | 'All'> = ['All','Forex','Indices','Commodities','Metals','Crypto','Stocks'];

const toDay = (iso: string) => iso ? new Date(iso).toISOString().slice(0, 10) : '';

export default function TrendingPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MarketSymbol['category'] | 'All'>('All');

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo);
  const [dateTo, setDateTo]     = useState(today);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('published_at_source', 'desc'), limit(500));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as NewsArticle))
        .filter(a => a.status !== 'rejected');
      setArticles(docs);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Articles in date range
  const rangeArticles = useMemo(() =>
    articles.filter(a => {
      const day = toDay(a.published_at_source);
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    }), [articles, dateFrom, dateTo]);

  // Symbol trending
  const symbolTrending = useMemo(() => {
    const pool = activeCategory === 'All'
      ? MARKET_SYMBOLS
      : MARKET_SYMBOLS.filter(s => s.category === activeCategory);
    return pool
      .map(sym => ({ sym, count: rangeArticles.filter(a => articleMentionsSymbol(a, sym)).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [rangeArticles, activeCategory]);

  // Keyword trending from headlines
  const keywordTrending = useMemo(() => {
    const freq = new Map<string, number>();
    rangeArticles.forEach(a => {
      a.headline
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w))
        .forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
    });
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([word, count]) => ({ word, count }));
  }, [rangeArticles]);

  // Theme trending
  const themeTrending = useMemo(() => {
    const freq = new Map<string, number>();
    rangeArticles.forEach(a => {
      if (a.theme) freq.set(a.theme, (freq.get(a.theme) || 0) + 1);
    });
    return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  }, [rangeArticles]);

  const maxSymbolCount  = symbolTrending[0]?.count  || 1;
  const maxKeywordCount = keywordTrending[0]?.count || 1;
  const maxThemeCount   = themeTrending[0]?.[1]     || 1;

  const daysDiff = dateFrom && dateTo
    ? Math.max(1, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1)
    : 7;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-[#f27d26]" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">Trending Analysis</h2>
          </div>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">
            Most Circulated Instruments & Keywords
          </p>
        </div>

        {/* Date range pickers */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <CalendarDays size={14} className="text-white/30 shrink-0" />
            <span className="text-[10px] text-white/40 uppercase">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-white/80 [color-scheme:dark] w-32"
            />
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <CalendarDays size={14} className="text-white/30 shrink-0" />
            <span className="text-[10px] text-white/40 uppercase">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-xs focus:outline-none text-white/80 [color-scheme:dark] w-32"
            />
          </div>
        </div>
      </header>

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Articles Analyzed', value: rangeArticles.length, color: 'text-[#f27d26]' },
          { label: 'Active Symbols',    value: symbolTrending.length, color: 'text-purple-400' },
          { label: 'Top Keywords',      value: keywordTrending.length, color: 'text-blue-400' },
          { label: 'Days in Range',     value: daysDiff, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="glass p-4 rounded-xl border border-white/5 text-center">
            <p className={`text-2xl md:text-3xl font-bold tracking-tighter ${s.color}`}>{loading ? '…' : s.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Section 1: Top Symbols ─────────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/5 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-[#f27d26]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Top Instruments</h3>
          </div>
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as any)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  activeCategory === cat
                    ? cat === 'All'
                      ? 'bg-[#f27d26] text-black border-[#f27d26]'
                      : `${CATEGORY_BG[cat as MarketSymbol['category']]} ${CATEGORY_COLORS[cat as MarketSymbol['category']]}`
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]" />
          </div>
        ) : symbolTrending.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-white/30 text-sm uppercase tracking-widest">No symbol data for this period</p>
          </div>
        ) : (
          <div className="space-y-2">
            {symbolTrending.map(({ sym, count }, idx) => (
              <div key={sym.symbol} className="flex items-center gap-3 group">
                {/* Rank */}
                <span className="text-[10px] text-white/20 w-5 text-right shrink-0">{idx + 1}</span>
                {/* Symbol + Name */}
                <div className="w-36 shrink-0">
                  <span className={`text-xs font-bold font-mono ${CATEGORY_COLORS[sym.category]}`}>{sym.symbol}</span>
                  <span className="text-[10px] text-white/30 ml-2 hidden sm:inline">{sym.name}</span>
                </div>
                {/* Progress bar */}
                <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sym.category === 'Metals'      ? 'bg-yellow-400/40' :
                      sym.category === 'Crypto'      ? 'bg-purple-400/40' :
                      sym.category === 'Indices'     ? 'bg-blue-400/40'   :
                      sym.category === 'Commodities' ? 'bg-orange-400/40' :
                      sym.category === 'Stocks'      ? 'bg-green-400/40'  :
                                                        'bg-[#f27d26]/40'
                    }`}
                    style={{ width: `${(count / maxSymbolCount) * 100}%` }}
                  />
                </div>
                {/* Count + category badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-white/60 w-6 text-right">{count}</span>
                  <span className={`hidden md:inline text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${CATEGORY_BG[sym.category]} ${CATEGORY_COLORS[sym.category]}`}>
                    {sym.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Top Keywords ────────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/5 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-blue-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Top Keywords from Headlines</h3>
          <span className="text-[10px] text-white/20">— word frequency analysis</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-400" />
          </div>
        ) : keywordTrending.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-white/30 text-sm uppercase tracking-widest">No keyword data for this period</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {keywordTrending.map(({ word, count }) => {
              const ratio = count / maxKeywordCount;
              const size = ratio > 0.7 ? 'text-lg' : ratio > 0.4 ? 'text-base' : ratio > 0.2 ? 'text-sm' : 'text-xs';
              const opacity = ratio > 0.5 ? 'text-white' : ratio > 0.25 ? 'text-white/70' : 'text-white/40';
              return (
                <div
                  key={word}
                  className={`px-3 py-1.5 rounded-xl bg-blue-400/5 border border-blue-400/15 ${size} ${opacity} font-semibold tracking-tight cursor-default hover:bg-blue-400/15 transition-colors`}
                  title={`${count} mentions`}
                >
                  {word}
                  <span className="ml-1.5 text-[9px] text-white/20 font-normal">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 3: News by Theme ───────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/5 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-green-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">News Volume by Theme</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" />
          </div>
        ) : themeTrending.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-white/30 text-sm uppercase tracking-widest">No theme data for this period</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {themeTrending.map(([theme, count], idx) => (
              <div key={theme} className="flex items-center gap-3">
                <span className="text-[10px] text-white/20 w-5 text-right shrink-0">{idx + 1}</span>
                <span className="w-36 md:w-48 text-xs font-semibold text-white/70 truncate shrink-0">{theme}</span>
                <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400/35 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxThemeCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-white/50 w-8 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
