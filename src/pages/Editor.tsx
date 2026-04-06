import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Image as ImageIcon, Send, Save, Languages, ChevronLeft, Loader2, XCircle, RefreshCw, AlertCircle, Download, Maximize2, X, Radio } from 'lucide-react';
import { doc, getDoc, addDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { rewriteArticle, generateStoryImage, generateVisualBrief, checkSafety, StoryContent } from '../services/geminiService';
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
        // Math.floor avoids overflow to 256 (which would produce 3-char hex "100")
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
          return hex.length === 7 ? hex : null; // guard: only return valid #rrggbb
        })
        .filter(Boolean) as string[];
      resolve(colors);
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });

export default function Editor() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  
  const [enHeadline, setEnHeadline] = useState('');
  const [enCaption, setEnCaption] = useState('');
  const [enHashtags, setEnHashtags] = useState<string[]>([]);
  
  const [arHeadline, setArHeadline] = useState('');
  const [arCaption, setArCaption] = useState('');
  const [arHashtags, setArHashtags] = useState<string[]>([]);
  
  const [imageUrl, setImageUrl] = useState('');
  const [enBrandedUrl, setEnBrandedUrl] = useState('');
  const [arBrandedUrl, setArBrandedUrl] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('ig-post');
  const [imageGenFormat, setImageGenFormat] = useState('');   // which format was used when generating
  const [originalArticle, setOriginalArticle] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null);
  const [previewModal, setPreviewModal] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [selectedExtractedColor, setSelectedExtractedColor] = useState<string>('');
  const [savingColor, setSavingColor] = useState(false);

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

  useEffect(() => {
    fetchBrandSettings();
    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  const fetchBrandSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'brand');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setBrandSettings({ ...DEFAULT_BRAND_SETTINGS, ...docSnap.data() as BrandSettings });
      } else {
        // No brand settings saved yet — use defaults so canvas always renders
        setBrandSettings(DEFAULT_BRAND_SETTINGS);
      }
    } catch (error) {
      console.error("Failed to fetch brand settings", error);
      setBrandSettings(DEFAULT_BRAND_SETTINGS);
    }
  };

  const fetchArticle = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'news', articleId!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setOriginalArticle(docSnap.data());
      }
    } catch (error) {
      console.error("Failed to fetch article", error);
    } finally {
      setLoading(false);
    }
  };

  const saveVersion = (en: any, ar: any) => {
    const newVersion = {
      timestamp: new Date().toISOString(),
      en,
      ar,
      author: auth.currentUser?.email
    };
    setVersions(prev => [newVersion, ...prev]);
  };

  const handleRewrite = async (target: 'all' | 'en' | 'ar' = 'all') => {
    if (!originalArticle) return;
    setGenerating(true);
    setSafetyError(null);
    setRewriteError(null);
    try {
      // 1. Safety Check (only on full rewrite)
      if (target === 'all') {
        const safety = await checkSafety(originalArticle.article_body);
        if (!safety.safe) {
          setSafetyError(safety.reason || "Content flagged by safety filter.");
          setGenerating(false);
          return;
        }
      }

      // 2. Rewrite
      const content = await rewriteArticle(originalArticle.headline, originalArticle.article_body);
      
      if (target === 'all' || target === 'en') {
        setEnHeadline(content.en.headline);
        setEnCaption(content.en.caption);
        setEnHashtags(content.en.hashtags);
      }
      
      if (target === 'all' || target === 'ar') {
        setArHeadline(content.ar.headline);
        setArCaption(content.ar.caption);
        setArHashtags(content.ar.hashtags);
      }

      saveVersion(content.en, content.ar);
    } catch (error) {
      console.error("Rewrite failed", error);
      setRewriteError("AI Rewrite service is currently unavailable. You can manually edit the content below or try again.");
    } finally {
      setGenerating(false);
    }
  };

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
      // استخراج الألوان السائدة من الصورة المولَّدة
      const colors = await extractDominantColors(url);
      setExtractedColors(colors);
      setSelectedExtractedColor('');
    } catch (error) {
      console.error("Image generation failed", error);
      setImageError("Visual generation failed. You can try again or use a fallback image.");
    } finally {
      setImageGenerating(false);
    }
  };

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

  const handleDownload = (dataUrl: string, lang: string) => {
    const link = document.createElement('a');
    link.download = `IST-Markets-${lang}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
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
        if (brands.length > 0) {
          setMcSelectedBrand(brands[0]);
        }
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

  const handleSave = async (status: 'draft' | 'scheduled') => {
    setLoading(true);
    try {
      let finalEnBrandedUrl = '';
      let finalArBrandedUrl = '';

      // Compress canvas PNG → JPEG, scaled to max 540px to stay under Firestore 1MB limit
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

      if (enBrandedUrl) {
        finalEnBrandedUrl = await compressCanvasImage(enBrandedUrl);
      }

      if (arBrandedUrl) {
        finalArBrandedUrl = await compressCanvasImage(arBrandedUrl);
      }

      const docRef = await addDoc(collection(db, 'stories'), {
        originalArticleId: articleId || null,
        en: { headline: enHeadline, caption: enCaption, hashtags: enHashtags },
        ar: { headline: arHeadline, caption: arCaption, hashtags: arHashtags },
        imageUrl,
        enBrandedUrl: finalEnBrandedUrl,
        arBrandedUrl: finalArBrandedUrl,
        format: selectedFormat,
        status,
        versions,
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      
      if (status === 'scheduled') {
        navigate(`/publish/${docRef.id}`);
      } else {
        navigate('/archive');
      }
    } catch (error) {
      console.error("Save failed", error);
    } finally {
      setLoading(false);
    }
  };

  const dims = FORMAT_MAP[selectedFormat] ?? FORMAT_MAP['ig-post'];
  const formatMismatch = imageUrl && imageGenFormat && imageGenFormat !== selectedFormat
    && FORMAT_MAP[imageGenFormat]?.aspectRatio !== dims.aspectRatio;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#f27d26]" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-bold tracking-tighter">Editorial Review</h2>
            <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Review, Edit & Regenerate</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave('draft')}
            className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 font-bold transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Save Draft
          </button>
          <button
            onClick={openMetricool}
            disabled={!enBrandedUrl && !arBrandedUrl}
            className="px-6 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 font-bold text-purple-300 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Radio size={18} />
            Send to Metricool
          </button>
          <button
            onClick={() => handleSave('scheduled')}
            className="btn-primary flex items-center gap-2"
          >
            <Send size={18} />
            Approve & Continue
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left: Original Article (3 cols) */}
        <div className="xl:col-span-3 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Raw Source</h3>
          {originalArticle && (
            <div className="glass p-6 rounded-2xl border-white/5 space-y-4 sticky top-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded font-bold">{originalArticle.source_name}</span>
                <span className="text-[10px] text-white/40">{new Date(originalArticle.published_at_source).toLocaleTimeString()}</span>
              </div>
              <h4 className="font-bold text-lg leading-tight">{originalArticle.headline}</h4>
              <div className="h-px bg-white/5" />
              <p className="text-xs text-white/60 leading-relaxed max-h-[400px] overflow-y-auto pr-2">
                {originalArticle.article_body}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {originalArticle.asset_tags?.map((tag: string) => (
                  <span key={tag} className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-white/40">${tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Editorial Rewrites (6 cols) */}
        <div className="xl:col-span-6 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Editorial Versions</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => handleRewrite('all')}
                disabled={generating}
                className="text-[10px] uppercase font-bold px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
              >
                Regenerate All
              </button>
            </div>
          </div>

          {safetyError && (
            <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg flex items-center gap-3 text-red-400 text-xs">
              <XCircle size={16} />
              <p>{safetyError}</p>
            </div>
          )}

          {rewriteError && (
            <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg flex flex-col gap-3 text-red-400 text-xs">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} />
                <p>{rewriteError}</p>
              </div>
              <button 
                onClick={() => handleRewrite('all')}
                className="self-start px-3 py-1 bg-red-400/20 hover:bg-red-400/30 rounded font-bold transition-colors"
              >
                Retry AI Rewrite
              </button>
            </div>
          )}

          {!enHeadline && !generating && (
            <div className="glass p-12 rounded-2xl text-center border-dashed border-white/10">
              <Sparkles className="mx-auto mb-4 text-white/20" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm mb-6">No editorial content generated yet</p>
              <button 
                onClick={() => handleRewrite('all')}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Sparkles size={18} />
                Generate AI Story
              </button>
            </div>
          )}

          {generating && (
            <div className="glass p-12 rounded-2xl text-center">
              <Loader2 className="mx-auto mb-4 animate-spin text-[#f27d26]" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm">AI is rewriting your story...</p>
            </div>
          )}

          {(enHeadline || arHeadline) && !generating && (
            <div className="space-y-8">
              {/* English Version */}
              <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Languages size={16} className="text-[#f27d26]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">English Version</span>
                  </div>
                  <button onClick={() => handleRewrite('en')} className="text-[9px] uppercase font-bold text-white/40 hover:text-white">Regenerate EN</button>
                </div>
                
                <input 
                  value={enHeadline}
                  onChange={(e) => setEnHeadline(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-bold focus:outline-none focus:border-[#f27d26] transition-colors"
                  placeholder="EN Headline..."
                />
                
                <textarea 
                  value={enCaption}
                  onChange={(e) => setEnCaption(e.target.value)}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-[#f27d26] transition-colors resize-none leading-relaxed"
                  placeholder="EN Caption..."
                />

                <div className="flex flex-wrap gap-2">
                  {enHashtags.map((tag, idx) => (
                    <span key={idx} className="text-xs text-[#f27d26] font-mono">#{tag.replace('#', '')}</span>
                  ))}
                </div>
              </div>

              {/* Arabic Version */}
              <div className="glass p-8 rounded-2xl border-white/5 space-y-6" dir="rtl">
                <div className="flex items-center justify-between" dir="ltr">
                  <div className="flex items-center gap-2">
                    <Languages size={16} className="text-[#f27d26]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Arabic Version</span>
                  </div>
                  <button onClick={() => handleRewrite('ar')} className="text-[9px] uppercase font-bold text-white/40 hover:text-white">Regenerate AR</button>
                </div>
                
                <input 
                  value={arHeadline}
                  onChange={(e) => setArHeadline(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-bold focus:outline-none focus:border-[#f27d26] transition-colors text-right font-arabic"
                  placeholder="العنوان بالعربية..."
                />
                
                <textarea 
                  value={arCaption}
                  onChange={(e) => setArCaption(e.target.value)}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-[#f27d26] transition-colors resize-none leading-relaxed text-right font-arabic"
                  placeholder="المحتوى بالعربية..."
                />

                <div className="flex flex-wrap gap-2 justify-end">
                  {arHashtags.map((tag, idx) => (
                    <span key={idx} className="text-xs text-[#f27d26] font-mono">#{tag.replace('#', '')}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Visual Review (3 cols) */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Branded Visuals</h3>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] uppercase font-bold focus:outline-none focus:border-[#f27d26] max-w-[160px]"
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
                <p className="text-[9px] text-amber-300/60 mt-0.5">Image was generated for a different format. Regenerate for best results.</p>
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
                    <Loader2 className="animate-spin text-[#f27d26]" size={24} />
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
                    className="flex-1 py-2 rounded-lg bg-[#f27d26]/10 hover:bg-[#f27d26]/20 border border-[#f27d26]/30 text-[10px] font-bold uppercase tracking-wider text-[#f27d26] flex items-center justify-center gap-1.5 transition-all"
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
                    <Loader2 className="animate-spin text-[#f27d26]" size={24} />
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
                    className="flex-1 py-2 rounded-lg bg-[#f27d26]/10 hover:bg-[#f27d26]/20 border border-[#f27d26]/30 text-[10px] font-bold uppercase tracking-wider text-[#f27d26] flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download size={12} /> Download AR
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={handleGenerateImage}
              disabled={imageGenerating || !enHeadline}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {imageGenerating ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
              Regenerate Theme Visual
            </button>

            {/* ── Color Palette extracted from generated image ── */}
            {extractedColors.length > 0 && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-white/40">
                  Extracted Colors — tap to save as brand accent
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  {extractedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleSaveColor(color)}
                      title={`Save ${color} as accent color`}
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

          {/* Version History */}
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 pt-4">Version History</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {versions.length === 0 ? (
              <p className="text-[10px] text-white/20 uppercase tracking-widest text-center py-4">No history yet</p>
            ) : (
              versions.map((v, i) => (
                <div key={i} className="glass p-3 rounded-lg border-white/5 text-[10px] space-y-1">
                  <div className="flex justify-between text-white/40">
                    <span>{new Date(v.timestamp).toLocaleTimeString()}</span>
                    <span>{v.author?.split('@')?.[0] || 'Unknown'}</span>
                  </div>
                  <p className="text-white/60 line-clamp-1 italic">"{v.en.headline}"</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Metricool Publish Modal ─────────────────────────────────────────── */}
      {metricoolOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setMetricoolOpen(false)}
        >
          <div
            className="glass rounded-2xl w-full max-w-md p-8 space-y-6 border border-purple-500/20 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
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
                {/* Brand selector */}
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

                {/* Network selector — derived directly from brand data */}
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

                {/* Language toggle */}
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

                {/* Caption preview */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Caption Preview</label>
                  <div
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white/60 leading-relaxed max-h-24 overflow-y-auto"
                    dir={mcLanguage === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {(mcLanguage === 'en' ? enCaption : arCaption) || <em className="text-white/20">No caption generated yet</em>}
                  </div>
                </div>

                {/* Schedule date/time */}
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

      {/* Full-size Image Preview Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-6 backdrop-blur-sm"
          onClick={() => setPreviewModal(null)}
        >
          <button
            onClick={() => setPreviewModal(null)}
            className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10"
          >
            <X size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(previewModal, 'Story'); }}
            className="absolute top-5 left-5 flex items-center gap-2 px-4 py-2 bg-[#f27d26]/20 hover:bg-[#f27d26]/30 border border-[#f27d26]/40 rounded-lg text-xs font-bold text-[#f27d26] transition-all z-10"
          >
            <Download size={14} /> Download
          </button>
          <img
            src={previewModal}
            className="max-h-full max-w-full rounded-2xl shadow-2xl"
            alt="Full preview"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
