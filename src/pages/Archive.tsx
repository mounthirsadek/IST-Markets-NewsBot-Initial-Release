import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Archive as ArchiveIcon, Search, Filter, ExternalLink,
  CheckCircle2, Clock, Send, Hash, Globe, FileText,
  ChevronDown, ChevronUp, Copy, Check, PenTool
} from 'lucide-react';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';

interface Story {
  id: string;
  originalArticleId?: string;
  en: { headline: string; caption: string; hashtags: string[] };
  ar: { headline: string; caption: string; hashtags: string[] };
  imageUrl?: string;
  enBrandedUrl?: string;
  arBrandedUrl?: string;
  status: 'draft' | 'scheduled' | 'published';
  format?: string;
  createdBy?: string;
  createdAt: any;
  publishedAt?: any;
  publishInfo?: {
    en?: { postId: string; url: string };
    ar?: { postId: string; url: string };
  };
  versions?: any[];
}

const FORMAT_LABELS: Record<string, string> = {
  'ig-post':  'Instagram Post',
  'ig-story': 'Instagram Story',
  'fb-post':  'Facebook Post',
  'fb-story': 'Facebook Story',
  'yt-thumb': 'YouTube Thumbnail',
  'tw-post':  'Twitter/X Post',
};

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25',
  scheduled: 'bg-blue-400/10 text-blue-400 border-blue-400/25',
  draft:     'bg-[#f27d26]/10 text-[#f27d26] border-[#f27d26]/25',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handle}
      className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/70"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function StoryCard({ story }: { story: Story }) {
  const [expanded, setExpanded] = useState(false);
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  const content = story[lang];
  const brandedImage = lang === 'en' ? story.enBrandedUrl : story.arBrandedUrl;
  const displayImage = brandedImage || story.imageUrl;

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const publishUrl = lang === 'en' ? story.publishInfo?.en?.url : story.publishInfo?.ar?.url;

  const StatusIcon = story.status === 'published' ? CheckCircle2
    : story.status === 'scheduled' ? Clock
    : FileText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors"
    >
      {/* ── Card Header ───────────────────────────────────── */}
      <div className="flex">

        {/* Branded image */}
        <div className="w-36 shrink-0 relative bg-black/40">
          {displayImage ? (
            <img
              src={displayImage}
              alt="Visual"
              className="w-full h-full object-cover"
              style={{ minHeight: '152px' }}
            />
          ) : (
            <div className="w-full h-full min-h-[152px] flex items-center justify-center text-white/10">
              <ArchiveIcon size={32} />
            </div>
          )}
          {/* Lang toggle */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {(['en', 'ar'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                  lang === l ? 'bg-[#f27d26] text-black' : 'bg-black/60 text-white/50 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          {/* Badges + date */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[story.status]}`}>
                <StatusIcon size={9} />
                {story.status}
              </span>
              {story.format && (
                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 font-bold">
                  {FORMAT_LABELS[story.format] || story.format}
                </span>
              )}
            </div>
            <span className="text-[10px] text-white/25 font-mono shrink-0">{formatDate(story.createdAt)}</span>
          </div>

          {/* Headline */}
          <h3
            className="font-bold text-sm leading-snug mb-1"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {content?.headline || '—'}
          </h3>

          {/* Caption preview */}
          <p
            className="text-xs text-white/50 leading-relaxed line-clamp-2"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {content?.caption || '—'}
          </p>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              {story.originalArticleId && (
                <Link
                  to={`/editor/${story.originalArticleId}`}
                  className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-white/30 hover:text-[#f27d26] transition-colors"
                >
                  <PenTool size={11} />
                  Edit
                </Link>
              )}
              {publishUrl && (
                <a
                  href={publishUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-white/30 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink size={11} />
                  View Post
                </a>
              )}
            </div>
            <button
              onClick={() => setExpanded(p => !p)}
              className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Less' : 'Full Details'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded panel ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-5 space-y-5">

              {/* Language tabs */}
              <div className="flex gap-2">
                {(['en', 'ar'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                      lang === l ? 'bg-[#f27d26] text-black' : 'bg-white/5 text-white/40 hover:text-white'
                    }`}
                  >
                    {l === 'en' ? '🇬🇧 English' : '🇦🇪 Arabic'}
                  </button>
                ))}
              </div>

              {/* Full caption */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-widest text-white/30 flex items-center gap-1.5">
                    <FileText size={10} />
                    Full Caption
                  </p>
                  <CopyButton text={content?.caption || ''} />
                </div>
                <div
                  className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-sm text-white/80 leading-relaxed whitespace-pre-line"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {content?.caption || '—'}
                </div>
              </div>

              {/* Hashtags */}
              {(content?.hashtags?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-widest text-white/30 flex items-center gap-1.5">
                      <Hash size={10} />
                      Hashtags
                    </p>
                    <CopyButton text={content.hashtags.join(' ')} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {content.hashtags.map((tag, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 font-mono">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Published links */}
              {(story.publishInfo?.en?.url || story.publishInfo?.ar?.url) && (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest text-white/30 flex items-center gap-1.5">
                    <Send size={10} />
                    Published Links
                  </p>
                  <div className="space-y-2">
                    {story.publishInfo?.en?.url && (
                      <a
                        href={story.publishInfo.en.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-mono bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 truncate transition-colors"
                      >
                        <Globe size={11} className="shrink-0" />
                        <span className="text-white/30 mr-1">EN —</span>
                        {story.publishInfo.en.url}
                      </a>
                    )}
                    {story.publishInfo?.ar?.url && (
                      <a
                        href={story.publishInfo.ar.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-mono bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 truncate transition-colors"
                      >
                        <Globe size={11} className="shrink-0" />
                        <span className="text-white/30 mr-1">AR —</span>
                        {story.publishInfo.ar.url}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-white/20 mb-0.5">Format</p>
                  <p className="text-xs font-bold">{FORMAT_LABELS[story.format || ''] || story.format || '—'}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-white/20 mb-0.5">Created</p>
                  <p className="text-xs font-bold">{formatDate(story.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-widest text-white/20 mb-0.5">Story ID</p>
                  <p className="text-xs font-mono text-white/30">{story.id.substring(0, 10)}…</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Archive() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'scheduled' | 'published'>('all');
  const [formatFilter, setFormatFilter] = useState('all');

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch('/api/stories', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Sort by createdAt descending
        const sorted = (Array.isArray(data) ? data : []).sort((a: any, b: any) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        setStories(sorted);
      } catch (err) {
        console.error('Archive fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  const formats = Array.from(new Set(stories.map(s => s.format).filter(Boolean))) as string[];

  const filtered = stories.filter(s => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      s.en?.headline?.toLowerCase().includes(q) ||
      s.ar?.headline?.toLowerCase().includes(q) ||
      s.en?.caption?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesFormat = formatFilter === 'all' || s.format === formatFilter;
    return matchesSearch && matchesStatus && matchesFormat;
  });

  const total     = stories.length;
  const published = stories.filter(s => s.status === 'published').length;
  const scheduled = stories.filter(s => s.status === 'scheduled').length;
  const drafts    = stories.filter(s => s.status === 'draft').length;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-bold tracking-tighter">Archive</h2>
            <p className="text-white/40 uppercase tracking-widest text-xs mt-1">All designed posts — full captions &amp; details</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              placeholder="Search headlines or captions…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#f27d26] transition-colors w-72"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total',     value: total,     color: 'text-white' },
            { label: 'Published', value: published, color: 'text-emerald-400' },
            { label: 'Scheduled', value: scheduled, color: 'text-blue-400' },
            { label: 'Drafts',    value: drafts,    color: 'text-[#f27d26]' },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl border-white/5 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] uppercase tracking-widest text-white/30 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 glass rounded-xl border-white/5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/30">
            <Filter size={13} />
            Filter:
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f27d26] transition-colors"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
          </select>
          <select
            value={formatFilter}
            onChange={e => setFormatFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#f27d26] transition-colors"
          >
            <option value="all">All Formats</option>
            {formats.map(f => <option key={f} value={f}>{FORMAT_LABELS[f] || f}</option>)}
          </select>
          {(statusFilter !== 'all' || formatFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => { setStatusFilter('all'); setFormatFilter('all'); setSearchTerm(''); }}
              className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-[10px] text-white/20">{filtered.length} of {total}</span>
        </div>
      </header>

      {/* Stories */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f27d26]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-white/20 gap-3">
          <ArchiveIcon size={40} />
          <p className="text-sm uppercase tracking-widest">No stories found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}
