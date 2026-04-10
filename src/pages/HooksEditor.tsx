import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Zap, Image as ImageIcon, Save, Languages, ChevronLeft, Loader2, AlertCircle, Download, Maximize2, X, Radio, Search, RefreshCw } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit, doc, getDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { generateHookContent, generateStoryImage, generateVisualBrief, StoryContent } from '../services/geminiService';
import { fetchMetricoolBrands, scheduleToMetricool, MetricoolBrand, getConnectedNetworks } from '../services/metricoolService';
import BrandedCanvas from '../components/BrandedCanvas';

// ─── Social media format definitions ────────────────────────────────────────
const FORMAT_MAP: Record<string, { width: number; height: number; aspectRatio: string; label: string; platform: string }> = {
  'ig-post':     { width: 1080, height: 1080, aspectRatio: '1:1',  label: 'Post (1:1)',       platform: 'Instagram' },
  'ig-portrait': { width: 1080, height: 1350, aspectRatio: '3:4',  label: 'Portrait (4:5)',   platform: 'Instagram' },
  'ig-story':    { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Story / Reels',    platform: 'Instagram' },
  'fb-post':     { width: 1080, height: 1080, aspectRatio: '1:1',  label: 'Post (1:1)',       platform: 'Facebook'  },
  'fb-story':    { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Story',            platform: 'Facebook'  },
  'fb-cover':    { width: 1200, height: 628,  aspectRatio: '16:9', label: 'Cover Photo',      platform: 'Facebook'  },
  'yt-thumb':    { width: 1280, height: 720,  aspectRatio: '16:9', label: 'Thumbnail (16:9)', platform: 'YouTube'   },
  'yt-short':    { width: 1080, height: 1920, aspectRatio: '9:16', label: 'Short',            platform: 'YouTube'   },
};

interface BrandSettings {
  logoUrl: string;
  logoPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  logoSize: number;
  backgroundStyle: string;
  backgroundImageUrl: string;
  fixedTagline: string;
  footerDisclaimer: string;
  footerDisclaimer2: string;
  defaultAccentColor: string;
  isActive: boolean;
}

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  logoUrl: '',
  logoPosition: 'top-left',
  logoSize: 160,
  backgroundStyle: 'dark',
  backgroundImageUrl: '',
  fixedTagline: 'IST MARKETS | INSTITUTIONAL GRADE ANALYSIS',
  footerDisclaimer: 'This content is for informational purposes only and does not constitute financial advice.',
  footerDisclaimer2: '',
  defaultAccentColor: '#f27d26',
  isActive: true,
};

interface NewsArticle {
  id: string;
  headline: string;
  article_body: string;
  article_url: string;
  source_name: string;
  published_at_source: string;
  theme: string;
  asset_tags: string[];
  safety_status: string;
  status: string;
}

// ─── Extract dominant colors from a base64 image (Canvas API, no deps) ─────
const extractDominantColors = (dataUrl: string, topN = 5): Promise<string[]> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const freq: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 4 * 10) {
        const r = Math.min(240, Math.floor(data[i]     / 32) * 32);
        const g = Math.min(240, Math.floor(data[i + 1] / 32) * 32);
        const b = Math.min(240, Math.floor(data[i + 2] / 32) * 32);
        const isGray  = Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
        const isDark  = r < 30  && g < 30  && b < 30;
        const isLight = r > 200 && g > 200 && b > 200;
        if (isGray || isDark || isLight) continue;
        const key = `${r},${g},${b}`;
        freq[key] = (freq[key] || 0) + 1;
      }
      const colors = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([key]) => {
          const [r, g, b] = key.split(',').map(Number);
          const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
          return hex.length === 7 ? hex : null;
        })
        .filter(Boolean) as string[];
      resolve(colors);
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });

export default function HooksEditor() {
  const { articleId } = useParams();
  const navigate = useNavigate();

  // ── Article selector state ──────────────────────────────────────────────────
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // ── Content state ───────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [enHeadline, setEnHeadline] = useState('');
  const [enCaption, setEnCaption] = useState('');
  const [enHashtags, setEnHashtags] = useState<string[]>([]);

  const [arHeadline, setArHeadline] = useState('');
  const [arCaption, setArCaption] = useState('');
  const [arHashtags, setArHashtags] = useState<string[]>([]);

  // ── Visual state ────────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('');
  const [enBrandedUrl, setEnBrandedUrl] = useState('');
  const [arBrandedUrl, setArBrandedUrl] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('ig-portrait');
  const [imageGenFormat, setImageGenFormat] = useState('');
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null);
  const [previewModal, setPreviewModal] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [selectedExtractedColor, setSelectedExtractedColor] = useState<string>('');
  const [savingColor, setSavingColor] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Metricool state ─────────────────────────────────────────────────────────
  const [metricoolOpen, setMetricoolOpen] = useState(false);
  const [mcBrands, setMcBrands] = useState<MetricoolBrand[]>([]);
  const [mcSelectedBrand, setMcSelectedBrand] = useState<MetricoolBrand | null>(null);
  const [mcSelectedNetworks, setMcSelectedNetworks] = useState<string[]>([]);
  const [mcLanguage, setMcLanguage] = useState<'en' | 'ar'>('en');
  const [mcScheduledAt, setMcScheduledAt] = useState('');
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);
  const [mcSuccess, setMcSuccess] = useState(false);

  // ── Load brand settings ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'brand'));
        setBrandSettings(docSnap.exists()
          ? { ...DEFAULT_BRAND_SETTINGS, ...docSnap.data() as BrandSettings }
          : DEFAULT_BRAND_SETTINGS);
      } catch {
        setBrandSettings(DEFAULT_BRAND_SETTINGS);
      }
    };
    fetchBrand();
  }, []);

  // ── Directly fetch the article from URL param (same pattern as Editor) ──────
  useEffect(() => {
    if (!articleId) return;
    const fetchTargetArticle = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'news', articleId));
        if (docSnap.exists()) {
          setSelectedArticle({ id: docSnap.id, ...docSnap.data() } as NewsArticle);
        }
      } catch (err) {
        console.error('Failed to fetch target article', err);
      }
    };
    fetchTargetArticle();
  }, [articleId]);

  // ── Subscribe to news articles ──────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('published_at_source', 'desc'), limit(150));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as NewsArticle))
        .filter(a => a.status !== 'rejected');
      setArticles(docs);
      setArticlesLoading(false);
    }, () => setArticlesLoading(false));
    return () => unsub();
  }, []);

  // ── Generate hook content ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedArticle) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const content: StoryContent = await generateHookContent(
        selectedArticle.headline,
        selectedArticle.article_body
      );
      setEnHeadline(content.en.headline);
      setEnCaption(content.en.caption);
      setEnHashtags(content.en.hashtags);
      setArHeadline(content.ar.headline);
      setArCaption(content.ar.caption);
      setArHashtags(content.ar.hashtags);
    } catch (err) {
      console.error('Hook generation failed', err);
      setGenerateError('AI Hook generation failed. Try again or edit content manually.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Generate visual ─────────────────────────────────────────────────────────
  const handleGenerateImage = async () => {
    if (!enHeadline) return;
    setImageGenerating(true);
    setImageError(null);
    try {
      const currentFormat = FORMAT_MAP[selectedFormat] ?? FORMAT_MAP['ig-post'];
      const brief = await generateVisualBrief(enHeadline, enCaption);
      const url   = await generateStoryImage(brief, currentFormat.aspectRatio);
      setImageUrl(url);
      setImageGenFormat(selectedFormat);
      const colors = await extractDominantColors(url);
      setExtractedColors(colors);
      setSelectedExtractedColor('');
    } catch (err) {
      console.error('Image generation failed', err);
      setImageError('Visual generation failed. Try again or use a fallback image.');
    } finally {
      setImageGenerating(false);
    }
  };

  // ── Save accent color ────────────────────────────────────────────────────────
  const handleSaveColor = async (color: string) => {
    setSavingColor(true);
    try {
      await setDoc(doc(db, 'settings', 'brand'), { defaultAccentColor: color }, { merge: true });
      setBrandSettings(prev => prev ? { ...prev, defaultAccentColor: color } : prev);
      setSelectedExtractedColor(color);
    } catch (err) {
      console.error('Failed to save accent color', err);
    } finally {
      setSavingColor(false);
    }
  };

  // ── Download helper ──────────────────────────────────────────────────────────
  const handleDownload = (dataUrl: string, lang: string) => {
    const link = document.createElement('a');
    link.download = `IST-Hooks-${lang}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // ── Save story ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const compressCanvasImage = (dataUrl: string, quality = 0.52): Promise<string> =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 540;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        });

      const finalEn = enBrandedUrl ? await compressCanvasImage(enBrandedUrl) : '';
      const finalAr = arBrandedUrl ? await compressCanvasImage(arBrandedUrl) : '';

      await addDoc(collection(db, 'stories'), {
        type: 'hook',
        originalArticleId: selectedArticle?.id || null,
        en: { headline: enHeadline, caption: enCaption, hashtags: enHashtags },
        ar: { headline: arHeadline, caption: arCaption, hashtags: arHashtags },
        imageUrl,
        enBrandedUrl: finalEn,
        arBrandedUrl: finalAr,
        format: selectedFormat,
        status: 'draft',
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      navigate('/archive');
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Metricool helpers ────────────────────────────────────────────────────────
  const openMetricool = async () => {
    setMetricoolOpen(true);
    setMcError(null);
    setMcSuccess(false);
    if (mcBrands.length === 0) {
      setMcLoading(true);
      try {
        const brands = await fetchMetricoolBrands();
        setMcBrands(brands);
        if (brands.length > 0) setMcSelectedBrand(brands[0]);
      } catch (err: any) {
        setMcError(err.message);
      } finally {
        setMcLoading(false);
      }
    }
  };

  const handleBrandChange = (brand: MetricoolBrand) => {
    setMcSelectedBrand(brand);
    setMcSelectedNetworks([]);
  };

  const toggleNetwork = (network: string) => {
    setMcSelectedNetworks(prev =>
      prev.includes(network) ? prev.filter(n => n !== network) : [...prev, network]
    );
  };

  const uploadCanvasForMetricool = async (dataUrl: string): Promise<string> => {
    const token = await auth.currentUser?.getIdToken();
    const filePath = `metricool-posts/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const res = await fetch('/api/upload-brand-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dataUrl, filePath }),
    });
    if (!res.ok) throw new Error('Failed to upload image for Metricool');
    const { url } = await res.json();
    return url;
  };

  const handleMetricoolSend = async () => {
    if (!mcSelectedBrand || mcSelectedNetworks.length === 0) {
      setMcError('Select a brand and at least one network.');
      return;
    }
    const canvasDataUrl = mcLanguage === 'en' ? enBrandedUrl : arBrandedUrl;
    const caption = mcLanguage === 'en'
      ? `${enCaption}\n\n${enHashtags.map(h => `#${h.replace('#', '')}`).join(' ')}`
      : `${arCaption}\n\n${arHashtags.map(h => `#${h.replace('#', '')}`).join(' ')}`;

    if (!canvasDataUrl) {
      setMcError('No branded image available. Generate the visual first.');
      return;
    }

    setMcLoading(true);
    setMcError(null);
    try {
      const imageUrl = await uploadCanvasForMetricool(canvasDataUrl);
      await scheduleToMetricool({
        blogId: mcSelectedBrand.id,
        networks: mcSelectedNetworks,
        imageUrl,
        caption,
        scheduledAt: mcScheduledAt || undefined,
      });
      setMcSuccess(true);
    } catch (err: any) {
      setMcError(err.message);
    } finally {
      setMcLoading(false);
    }
  };

  const dims = FORMAT_MAP[selectedFormat] ?? FORMAT_MAP['ig-post'];
  const formatMismatch = imageUrl && imageGenFormat && imageGenFormat !== selectedFormat
    && FORMAT_MAP[imageGenFormat]?.aspectRatio !== dims.aspectRatio;

  const filteredArticles = articles.filter(a => {
    if (!searchTerm) return true;
    const kw = searchTerm.toLowerCase();
    return a.headline.toLowerCase().includes(kw)
      || (a.source_name || '').toLowerCase().includes(kw)
      || (a.theme || '').toLowerCase().includes(kw);
  });

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg transition-colors shrink-0">
            <ChevronLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-yellow-400" />
              <h2 className="text-2xl md:text-4xl font-bold tracking-tighter">Hooks Editor</h2>
            </div>
            <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Viral Hook-Based Content Generator</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={handleSave}
            disabled={saving || (!enHeadline && !arHeadline)}
            className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save to Archive
          </button>
          <button
            onClick={openMetricool}
            disabled={!enBrandedUrl && !arBrandedUrl}
            className="hidden md:flex px-6 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 font-bold text-purple-300 transition-all items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Radio size={18} />
            Send to Metricool
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* ── Left: Article Selector (3 cols) ─────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Select Article</h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-xs focus:outline-none focus:border-yellow-400/50 transition-colors"
            />
          </div>

          {/* Article list */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {articlesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-yellow-400" size={24} />
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="glass p-6 rounded-xl text-center">
                <p className="text-white/30 text-xs uppercase tracking-widest">No articles found</p>
              </div>
            ) : (
              filteredArticles.map(article => {
                const isSelected = selectedArticle?.id === article.id;
                return (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-yellow-400/10 border-yellow-400/40'
                        : 'glass border-white/5 hover:bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-white/10 rounded font-bold text-white/50 truncate max-w-[100px]">
                        {article.source_name}
                      </span>
                      <span className="text-[9px] text-white/30 ml-auto shrink-0">
                        {new Date(article.published_at_source).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-xs font-semibold leading-snug line-clamp-2 ${isSelected ? 'text-yellow-300' : 'text-white/80'}`}>
                      {article.headline}
                    </p>
                    {article.theme && (
                      <span className="mt-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400/70 font-bold uppercase tracking-wider">
                        {article.theme}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Center: Hook Content (6 cols) ────────────────────────────────── */}
        <div className="xl:col-span-6 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Hook Content</h3>
            {(enHeadline || arHeadline) && !generating && (
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedArticle}
                className="text-[10px] uppercase font-bold px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
              >
                Regenerate Hook
              </button>
            )}
          </div>

          {generateError && (
            <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg flex flex-col gap-3 text-red-400 text-xs">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} />
                <p>{generateError}</p>
              </div>
              <button
                onClick={handleGenerate}
                className="self-start px-3 py-1 bg-red-400/20 hover:bg-red-400/30 rounded font-bold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!selectedArticle && !generating && (
            <div className="glass p-12 rounded-2xl text-center border-dashed border-white/10">
              <Zap className="mx-auto mb-4 text-yellow-400/30" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm mb-2">No article selected</p>
              <p className="text-white/20 text-xs">Pick an article from the left panel to get started</p>
            </div>
          )}

          {selectedArticle && !enHeadline && !generating && (
            <div className="glass p-12 rounded-2xl text-center border-dashed border-white/10">
              <Zap className="mx-auto mb-4 text-yellow-400/40" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm mb-6">Ready to generate hooks</p>
              <p className="text-white/30 text-xs mb-6 max-w-xs mx-auto">"{selectedArticle.headline}"</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:bg-yellow-300 transition-colors"
              >
                <Zap size={18} />
                Generate Hook Content
              </button>
            </div>
          )}

          {generating && (
            <div className="glass p-12 rounded-2xl text-center">
              <Loader2 className="mx-auto mb-4 animate-spin text-yellow-400" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm">AI is crafting your viral hooks...</p>
            </div>
          )}

          {(enHeadline || arHeadline) && !generating && (
            <div className="space-y-8">
              {/* English Version */}
              <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Languages size={16} className="text-yellow-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">English Hook</span>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !selectedArticle}
                    className="text-[9px] uppercase font-bold text-white/40 hover:text-yellow-400 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className="inline mr-1" />
                    Regenerate
                  </button>
                </div>

                <input
                  value={enHeadline}
                  onChange={e => setEnHeadline(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-bold focus:outline-none focus:border-yellow-400 transition-colors"
                  placeholder="Hook Headline..."
                />

                <textarea
                  value={enCaption}
                  onChange={e => setEnCaption(e.target.value)}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-yellow-400 transition-colors resize-none leading-relaxed"
                  placeholder="Hook caption..."
                />

                <div className="flex flex-wrap gap-2">
                  {enHashtags.map((tag, idx) => (
                    <span key={idx} className="text-xs text-yellow-400 font-mono">#{tag.replace('#', '')}</span>
                  ))}
                </div>
              </div>

              {/* Arabic Version */}
              <div className="glass p-8 rounded-2xl border-white/5 space-y-6" dir="rtl">
                <div className="flex items-center justify-between" dir="ltr">
                  <div className="flex items-center gap-2">
                    <Languages size={16} className="text-yellow-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Arabic Hook</span>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !selectedArticle}
                    className="text-[9px] uppercase font-bold text-white/40 hover:text-yellow-400 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className="inline mr-1" />
                    Regenerate
                  </button>
                </div>

                <input
                  value={arHeadline}
                  onChange={e => setArHeadline(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-bold focus:outline-none focus:border-yellow-400 transition-colors text-right font-arabic"
                  placeholder="العنوان بالعربية..."
                />

                <textarea
                  value={arCaption}
                  onChange={e => setArCaption(e.target.value)}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-yellow-400 transition-colors resize-none leading-relaxed text-right font-arabic"
                  placeholder="المحتوى بالعربية..."
                />

                <div className="flex flex-wrap gap-2 justify-end">
                  {arHashtags.map((tag, idx) => (
                    <span key={idx} className="text-xs text-yellow-400 font-mono">#{tag.replace('#', '')}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Branded Visuals (3 cols) ─────────────────────────────── */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Branded Visuals</h3>
            <select
              value={selectedFormat}
              onChange={e => setSelectedFormat(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] uppercase font-bold focus:outline-none focus:border-yellow-400 max-w-[160px]"
            >
              <optgroup label="── Instagram">
                <option value="ig-post">IG · Post (1:1)</option>
                <option value="ig-portrait">IG · Portrait (4:5)</option>
                <option value="ig-story">IG · Story / Reels</option>
              </optgroup>
              <optgroup label="── Facebook">
                <option value="fb-post">FB · Post (1:1)</option>
                <option value="fb-story">FB · Story</option>
                <option value="fb-cover">FB · Cover Photo</option>
              </optgroup>
              <optgroup label="── YouTube">
                <option value="yt-thumb">YT · Thumbnail</option>
                <option value="yt-short">YT · Short</option>
              </optgroup>
            </select>
          </div>

          {/* Format mismatch warning */}
          {formatMismatch && (
            <div className="p-3 bg-amber-400/10 border border-amber-400/25 rounded-xl flex items-center gap-3">
              <AlertCircle size={14} className="text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Wrong aspect ratio</p>
                <p className="text-[9px] text-amber-300/60 mt-0.5">Regenerate for best results.</p>
              </div>
              <button
                onClick={handleGenerateImage}
                disabled={imageGenerating}
                className="shrink-0 px-2 py-1 bg-amber-400/20 hover:bg-amber-400/30 rounded text-[9px] font-bold text-amber-300 transition-all"
              >
                Regen
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* English Branded Preview */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40">English · {dims.platform} {dims.label}</label>
              <div className="w-full bg-white/5 rounded-xl overflow-hidden relative group border border-white/5 shadow-2xl" style={{ aspectRatio: dims.width / dims.height }}>
                {brandSettings && (
                  <BrandedCanvas
                    backgroundImage={brandSettings.backgroundImageUrl || null}
                    storyImage={imageUrl || null}
                    headline={enHeadline}
                    accentColor={brandSettings.defaultAccentColor}
                    logoUrl={brandSettings.logoUrl}
                    logoSize={brandSettings.logoSize}
                    logoPosition={brandSettings.logoPosition}
                    tagline={brandSettings.fixedTagline}
                    disclaimer={brandSettings.footerDisclaimer}
                    disclaimer2={brandSettings.footerDisclaimer2}
                    language="en"
                    width={dims.width}
                    height={dims.height}
                    onExport={setEnBrandedUrl}
                  />
                )}
                {imageGenerating && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-yellow-400" size={24} />
                  </div>
                )}
              </div>
              {enBrandedUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewModal(enBrandedUrl)}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Maximize2 size={12} /> Full Preview
                  </button>
                  <button
                    onClick={() => handleDownload(enBrandedUrl, 'EN')}
                    className="flex-1 py-2 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download size={12} /> Download EN
                  </button>
                </div>
              )}
            </div>

            {/* Arabic Branded Preview */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Arabic · {dims.platform} {dims.label}</label>
              <div className="w-full bg-white/5 rounded-xl overflow-hidden relative group border border-white/5 shadow-2xl" style={{ aspectRatio: dims.width / dims.height }}>
                {brandSettings && (
                  <BrandedCanvas
                    backgroundImage={brandSettings.backgroundImageUrl || null}
                    storyImage={imageUrl || null}
                    headline={arHeadline}
                    accentColor={brandSettings.defaultAccentColor}
                    logoUrl={brandSettings.logoUrl}
                    logoSize={brandSettings.logoSize}
                    logoPosition={brandSettings.logoPosition}
                    tagline={brandSettings.fixedTagline}
                    disclaimer={brandSettings.footerDisclaimer}
                    disclaimer2={brandSettings.footerDisclaimer2}
                    language="ar"
                    width={dims.width}
                    height={dims.height}
                    onExport={setArBrandedUrl}
                  />
                )}
                {imageGenerating && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-yellow-400" size={24} />
                  </div>
                )}
              </div>
              {arBrandedUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewModal(arBrandedUrl)}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Maximize2 size={12} /> Full Preview
                  </button>
                  <button
                    onClick={() => handleDownload(arBrandedUrl, 'AR')}
                    className="flex-1 py-2 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-[10px] font-bold uppercase tracking-wider text-yellow-400 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download size={12} /> Download AR
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateImage}
              disabled={imageGenerating || !enHeadline}
              className="hidden md:flex w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {imageGenerating ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
              Regenerate Theme Visual
            </button>

            {/* Extracted Color Palette */}
            {extractedColors.length > 0 && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-white/40">
                  Extracted Colors — tap to save as brand accent
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  {extractedColors.map(color => (
                    <button
                      key={color}
                      onClick={() => handleSaveColor(color)}
                      title={`Save ${color} as accent`}
                      disabled={savingColor}
                      className={`w-8 h-8 rounded-full border-2 transition-all disabled:opacity-50 ${
                        selectedExtractedColor === color
                          ? 'border-white scale-110 shadow-lg shadow-black/40'
                          : 'border-transparent hover:border-white/60 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {selectedExtractedColor && (
                  <p className="text-[9px] text-white/30 flex items-center gap-1">
                    {savingColor
                      ? <><Loader2 size={9} className="animate-spin" /> Saving…</>
                      : <>✓ Saved <span style={{ color: selectedExtractedColor }}>{selectedExtractedColor}</span> as accent</>
                    }
                  </p>
                )}
              </div>
            )}

            {imageError && (
              <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-[10px] flex items-center gap-2">
                <AlertCircle size={12} />
                <p>{imageError}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Metricool Publish Modal ──────────────────────────────────────────── */}
      {metricoolOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setMetricoolOpen(false)}
        >
          <div
            className="glass rounded-2xl w-full max-w-md p-8 space-y-6 border border-purple-500/20 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio size={20} className="text-purple-400" />
                <h3 className="font-bold text-lg tracking-tight">Send to Metricool</h3>
              </div>
              <button onClick={() => setMetricoolOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {mcLoading && !mcBrands.length ? (
              <div className="flex items-center justify-center py-10 gap-3 text-white/40">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-sm uppercase tracking-widest">Connecting to Metricool...</span>
              </div>
            ) : mcSuccess ? (
              <div className="py-10 text-center space-y-4">
                <div className="text-4xl">✓</div>
                <p className="font-bold text-green-400 uppercase tracking-widest text-sm">Post Sent Successfully!</p>
                <p className="text-white/40 text-xs">Check your Metricool planner dashboard to confirm.</p>
                <button
                  onClick={() => { setMetricoolOpen(false); setMcSuccess(false); }}
                  className="btn-primary px-8"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Brand</label>
                  <select
                    value={mcSelectedBrand?.id ?? ''}
                    onChange={e => {
                      const brand = mcBrands.find(b => String(b.id) === e.target.value);
                      if (brand) handleBrandChange(brand);
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    {mcBrands.map(b => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>

                {mcSelectedBrand && (() => {
                  const nets = getConnectedNetworks(mcSelectedBrand);
                  return nets.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Networks</label>
                      <div className="flex flex-wrap gap-2">
                        {nets.map(({ key, label, handle }) => {
                          const selected = mcSelectedNetworks.includes(key);
                          return (
                            <button
                              key={key}
                              onClick={() => toggleNetwork(key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                selected
                                  ? 'bg-purple-500/30 border-purple-500/60 text-purple-300'
                                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                              }`}
                            >
                              {label}
                              <span className="ml-1.5 font-normal opacity-60">@{handle}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Image & Caption Language</label>
                  <div className="flex gap-2">
                    {(['en', 'ar'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setMcLanguage(lang)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                          mcLanguage === lang
                            ? 'bg-purple-500/30 border-purple-500/60 text-purple-300'
                            : 'bg-white/5 border-white/10 text-white/40'
                        }`}
                      >
                        {lang === 'en' ? 'English' : 'العربية'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Caption Preview</label>
                  <div
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white/60 leading-relaxed max-h-24 overflow-y-auto"
                    dir={mcLanguage === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {(mcLanguage === 'en' ? enCaption : arCaption) || <em className="text-white/20">No caption generated yet</em>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">
                    Schedule Date &amp; Time <span className="text-white/20">(leave blank to post now)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={mcScheduledAt}
                    onChange={e => setMcScheduledAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                {mcError && (
                  <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{mcError}</span>
                  </div>
                )}

                <button
                  onClick={handleMetricoolSend}
                  disabled={mcLoading || mcSelectedNetworks.length === 0}
                  className="w-full py-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mcLoading
                    ? <><Loader2 className="animate-spin" size={16} /> Sending...</>
                    : <><Radio size={16} /> {mcScheduledAt ? 'Schedule Post' : 'Post Now'}</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile Fixed Bottom Actions ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-white/10 px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedArticle}
            className="flex-1 py-3 rounded-xl bg-yellow-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {generating ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
            Generate Hook
          </button>

          <button
            onClick={handleGenerateImage}
            disabled={imageGenerating || !enHeadline}
            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform"
          >
            {imageGenerating ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
            Visual
          </button>

          <button
            onClick={openMetricool}
            disabled={!enBrandedUrl && !arBrandedUrl}
            className="flex-1 py-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Radio size={14} />
            Metricool
          </button>
        </div>
      </div>

      {/* ── Full-size Image Preview Modal ─────────────────────────────────── */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div className="relative max-w-3xl max-h-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewModal(null)}
              className="absolute -top-4 -right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            <img
              src={previewModal}
              alt="Preview"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
