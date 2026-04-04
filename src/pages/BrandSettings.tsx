import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Palette, Save, Upload, Layout, Type, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

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

const DEFAULT_SETTINGS: BrandSettings = {
  logoUrl: 'https://ais-dev-kdcuv573zwlik2eo6p72cv-73901879866.europe-west2.run.app/logo.png', // Placeholder
  logoPosition: 'top-left',
  logoSize: 120,
  backgroundStyle: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
  backgroundImageUrl: '',
  fixedTagline: 'IST MARKETS | Institutional Grade Analysis',
  footerDisclaimer: 'Trading involves risk. Past performance is not indicative of future results.',
  footerDisclaimer2: '',
  defaultAccentColor: '#f27d26',
  isActive: true,
};

export default function BrandSettingsPage() {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'brand');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as BrandSettings);
        }
      } catch (error) {
        console.error("Error fetching brand settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'brand'), settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving brand settings:", error);
    } finally {
      setSaving(false);
    }
  };

  // Compress image — preserves transparency for PNG (logo), uses JPEG for backgrounds
  const compressImage = (
    file: File,
    maxKB = 600,
    maxDim = 1200,
    keepTransparency = false
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onloadend = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;

          if (keepTransparency) {
            // Keep canvas transparent — draw image directly (preserves alpha channel)
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            // PNG: no quality loop, just resize
            resolve(canvas.toDataURL('image/png'));
          } else {
            // JPEG: fill white bg first, then compress with quality loop
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            let quality = 0.85;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.15) {
              quality = parseFloat((quality - 0.1).toFixed(2));
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(dataUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      // keepTransparency=true → saves as PNG → no black background on transparent logos
      const compressed = await compressImage(file, 300, 600, true);
      setSettings(prev => ({ ...prev, logoUrl: compressed }));
    } catch (err) {
      console.error('Logo upload failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const compressed = await compressImage(file, 600, 1200);
      setSettings(prev => ({ ...prev, backgroundImageUrl: compressed }));
    } catch (err) {
      console.error('Background upload failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#f27d26]" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter">Brand Identity</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Configure your visual DNA</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-8"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : (success ? <CheckCircle2 size={18} /> : <Save size={18} />)}
          {saving ? 'Saving...' : (success ? 'Saved!' : 'Save Identity')}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-7 space-y-8">
          {/* Logo Section */}
          <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
            <div className="flex items-center gap-3 text-[#f27d26]">
              <Upload size={20} />
              <h3 className="font-bold uppercase tracking-widest text-sm">Logo & Assets</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
                    ) : (
                      <Palette size={24} className="text-white/10" />
                    )}
                  </div>
                  <label className="cursor-pointer px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all border border-white/10">
                    Upload New
                    <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Logo Position</label>
                <select 
                  value={settings.logoPosition}
                  onChange={(e) => setSettings({...settings, logoPosition: e.target.value as any})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Logo Size (px)</label>
                <input 
                  type="number" 
                  value={settings.logoSize}
                  onChange={(e) => setSettings({...settings, logoSize: parseInt(e.target.value)})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Accent Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={settings.defaultAccentColor}
                    onChange={(e) => setSettings({...settings, defaultAccentColor: e.target.value})}
                    className="w-10 h-10 bg-transparent border-none cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={settings.defaultAccentColor}
                    onChange={(e) => setSettings({...settings, defaultAccentColor: e.target.value})}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Typography Section */}
          <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
            <div className="flex items-center gap-3 text-[#f27d26]">
              <Type size={20} />
              <h3 className="font-bold uppercase tracking-widest text-sm">Typography & Copy</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Fixed Tagline</label>
                <input 
                  type="text" 
                  value={settings.fixedTagline}
                  onChange={(e) => setSettings({...settings, fixedTagline: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
                  placeholder="e.g. IST MARKETS | Institutional Grade Analysis"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">
                  Footer — Line 1
                </label>
                <textarea
                  value={settings.footerDisclaimer}
                  onChange={(e) => setSettings({...settings, footerDisclaimer: e.target.value})}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] resize-none"
                  placeholder="e.g. Trading involves risk. Past performance is not indicative of future results."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40">
                  Footer — Line 2 <span className="text-white/20">(optional)</span>
                </label>
                <textarea
                  value={settings.footerDisclaimer2}
                  onChange={(e) => setSettings({...settings, footerDisclaimer2: e.target.value})}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] resize-none"
                  placeholder="e.g. CFDs are complex instruments and carry a high risk of losing money."
                />
              </div>
            </div>
          </section>

          {/* Background Section */}
          <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
            <div className="flex items-center gap-3 text-[#f27d26]">
              <Layout size={20} />
              <h3 className="font-bold uppercase tracking-widest text-sm">Canvas Layout</h3>
            </div>

            {/* Background Image Upload */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Background Template Image</label>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Upload a branded image (e.g. your purple IST Markets template). When set, this replaces the CSS gradient and AI-generated image on the canvas.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-white/5 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  {settings.backgroundImageUrl ? (
                    <img src={settings.backgroundImageUrl} className="w-full h-full object-cover" alt="Background" />
                  ) : (
                    <Layout size={28} className="text-white/10" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer px-4 py-2 bg-[#f27d26]/20 hover:bg-[#f27d26]/30 border border-[#f27d26]/40 rounded-lg text-xs font-bold text-[#f27d26] transition-all">
                    Upload Template Image
                    <input type="file" className="hidden" onChange={handleBackgroundUpload} accept="image/*" />
                  </label>
                  {settings.backgroundImageUrl && (
                    <button
                      onClick={() => setSettings({...settings, backgroundImageUrl: ''})}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 transition-all"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Fallback Background Style (CSS Gradient)</label>
              <p className="text-[10px] text-white/20">Used when no background image is set.</p>
              <input
                type="text"
                value={settings.backgroundStyle}
                onChange={(e) => setSettings({...settings, backgroundStyle: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-[#f27d26]"
              />
            </div>
          </section>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-8 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Live Preview (Post)</h3>
            
            <div className="aspect-square w-full rounded-2xl overflow-hidden relative shadow-2xl border border-white/10" style={{ background: settings.backgroundImageUrl ? 'transparent' : settings.backgroundStyle }}>
              {settings.backgroundImageUrl && (
                <>
                  <img src={settings.backgroundImageUrl} className="absolute inset-0 w-full h-full object-cover" alt="Brand background" />
                  <div className="absolute inset-0 bg-black/50" />
                </>
              )}
              {/* Logo Overlay */}
              <div className={`absolute p-6 ${
                settings.logoPosition === 'top-left'      ? 'top-0 left-0' :
                settings.logoPosition === 'top-center'    ? 'top-0 left-1/2 -translate-x-1/2' :
                settings.logoPosition === 'top-right'     ? 'top-0 right-0' :
                settings.logoPosition === 'bottom-left'   ? 'bottom-0 left-0' :
                settings.logoPosition === 'bottom-center' ? 'bottom-0 left-1/2 -translate-x-1/2' :
                'bottom-0 right-0'
              }`}>
                {settings.logoUrl && <img src={settings.logoUrl} style={{ width: settings.logoSize }} alt="Logo" />}
              </div>

              {/* Tagline Overlay */}
              <div className="absolute top-1/2 left-0 w-full text-center -translate-y-1/2 px-12">
                <div className="w-12 h-1 mb-4 mx-auto" style={{ backgroundColor: settings.defaultAccentColor }} />
                <h4 className="text-2xl font-bold tracking-tighter leading-tight mb-2">
                  MARKET HEADLINE<br/>
                  <span style={{ color: settings.defaultAccentColor }}>GOES HERE</span>
                </h4>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-50">{settings.fixedTagline}</p>
              </div>

              {/* Footer Overlay */}
              <div className="absolute bottom-0 left-0 w-full p-6 bg-black/40 backdrop-blur-md border-t border-white/10 space-y-0.5">
                {settings.footerDisclaimer && (
                  <p className="text-[8px] leading-tight text-white/40 text-center uppercase tracking-wider">
                    {settings.footerDisclaimer}
                  </p>
                )}
                {settings.footerDisclaimer2 && (
                  <p className="text-[8px] leading-tight text-white/30 text-center uppercase tracking-wider">
                    {settings.footerDisclaimer2}
                  </p>
                )}
              </div>
            </div>

            <div className="glass p-4 rounded-xl border-white/5 flex items-start gap-3">
              <Info size={16} className="text-[#f27d26] shrink-0 mt-0.5" />
              <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-wider">
                This preview shows the fixed elements of your brand template. 
                Dynamic content like story headlines and AI visuals will be composited during the editorial process.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
