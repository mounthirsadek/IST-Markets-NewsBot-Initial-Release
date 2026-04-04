import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Loader2, Instagram, Send, Calendar, 
  CheckCircle2, AlertCircle, Globe, Hash, ShieldAlert,
  Link as LinkIcon, Sparkles, RefreshCw
} from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateSocialCaption, publishToInstagram, SocialPackage } from '../services/geminiService';

interface CompanySettings {
  enDisclaimer: string;
  arDisclaimer: string;
  websiteUrl: string;
  telegramUrl: string;
  whatsappUrl: string;
  fixedHashtags: string[];
  enInstagramId: string;
  arInstagramId: string;
  metaAccessToken: string;
}

export default function Publish() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [story, setStory] = useState<any>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [socialPackage, setSocialPackage] = useState<SocialPackage | null>(null);
  
  const [targetAccounts, setTargetAccounts] = useState({ en: true, ar: true });
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [publishStatus, setPublishStatus] = useState<{ [key: string]: { status: 'idle' | 'loading' | 'success' | 'error', error?: string, url?: string } }>({
    en: { status: 'idle' },
    ar: { status: 'idle' }
  });

  useEffect(() => {
    if (storyId) {
      fetchData();
    }
  }, [storyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const storyRef = doc(db, 'stories', storyId!);
      const storySnap = await getDoc(storyRef);
      
      const settingsRef = doc(db, 'settings', 'company');
      const settingsSnap = await getDoc(settingsRef);
      
      if (storySnap.exists()) {
        setStory(storySnap.data());
        // If social package already exists in story, use it
        if (storySnap.data().socialPackage) {
          setSocialPackage(storySnap.data().socialPackage);
        }
      }
      
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as CompanySettings);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCaptions = async () => {
    if (!story) return;
    setGenerating(true);
    try {
      const pkg = await generateSocialCaption(story.en.headline, story.en.caption);
      setSocialPackage(pkg);
      // Save to story
      await updateDoc(doc(db, 'stories', storyId!), { socialPackage: pkg });
    } catch (error) {
      console.error("Caption generation failed", error);
    } finally {
      setGenerating(false);
    }
  };

  const formatCaption = (lang: 'en' | 'ar', pkg: SocialPackage, settings: CompanySettings) => {
    const content = pkg[lang];
    const disclaimer = lang === 'en' ? settings.enDisclaimer : settings.arDisclaimer;
    const hashtags = [...content.hashtags, ...settings.fixedHashtags].map(t => `#${t.replace('#', '')}`).join(' ');
    
    const links = `
🌐 ${settings.websiteUrl}
📢 ${settings.telegramUrl}
💬 ${settings.whatsappUrl}
    `.trim();

    return `
${content.hook}

${content.summary}

${content.cta}

${hashtags}

${links}

⚠️ ${disclaimer}
    `.trim();
  };

  const handlePublish = async () => {
    if (!story || !settings || !socialPackage) return;
    
    if (scheduledAt) {
      // Handle Scheduling
      setPublishing(true);
      try {
        await updateDoc(doc(db, 'stories', storyId!), {
          status: 'scheduled',
          scheduledAt: new Date(scheduledAt),
          targetAccounts,
          // Store formatted captions for the server
          enCaptionFinal: formatCaption('en', socialPackage, settings),
          arCaptionFinal: formatCaption('ar', socialPackage, settings)
        });
        navigate('/archive');
      } catch (error) {
        console.error("Scheduling failed", error);
      } finally {
        setPublishing(false);
      }
      return;
    }

    // Handle Immediate Publishing
    setPublishing(true);
    
    const accountsToPublish = [];
    if (targetAccounts.en) accountsToPublish.push('en');
    if (targetAccounts.ar) accountsToPublish.push('ar');

    for (const lang of accountsToPublish) {
      setPublishStatus(prev => ({ ...prev, [lang]: { status: 'loading' } }));
      
      const caption = formatCaption(lang as 'en' | 'ar', socialPackage, settings);
      const instagramId = lang === 'en' ? settings.enInstagramId : settings.arInstagramId;
      const imageUrl = lang === 'en' ? story.enBrandedUrl : story.arBrandedUrl;

      try {
        const result = await publishToInstagram(imageUrl, caption, instagramId, settings.metaAccessToken);
        
        if (result.success) {
          setPublishStatus(prev => ({ ...prev, [lang]: { status: 'success', url: `https://instagram.com/p/${result.postId}` } }));
          // Update story status
          await updateDoc(doc(db, 'stories', storyId!), {
            [`publishInfo.${lang}`]: {
              postId: result.postId,
              publishedAt: serverTimestamp(),
              status: 'published'
            },
            status: 'published'
          });
        } else {
          setPublishStatus(prev => ({ ...prev, [lang]: { status: 'error', error: result.error } }));
        }
      } catch (error) {
        setPublishStatus(prev => ({ ...prev, [lang]: { status: 'error', error: String(error) } }));
      }
    }
    
    setPublishing(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#f27d26]" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-bold tracking-tighter">Final Review & Publish</h2>
            <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Social Packaging & Distribution</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            <Calendar size={18} className="text-white/40" />
            <input 
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="bg-transparent text-xs font-bold focus:outline-none"
            />
          </div>
          <button 
            onClick={handlePublish}
            disabled={publishing || !socialPackage}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="animate-spin" size={18} /> : (scheduledAt ? <Calendar size={18} /> : <Send size={18} />)}
            {scheduledAt ? 'Schedule Later' : 'Publish Now'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Social Previews (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {!socialPackage && !generating && (
            <div className="glass p-12 rounded-2xl text-center border-dashed border-white/10">
              <Sparkles className="mx-auto mb-4 text-white/20" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm mb-6">Social captions not generated</p>
              <button 
                onClick={handleGenerateCaptions}
                className="btn-primary inline-flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Generate Social Package
              </button>
            </div>
          )}

          {generating && (
            <div className="glass p-12 rounded-2xl text-center">
              <Loader2 className="mx-auto mb-4 animate-spin text-[#f27d26]" size={48} />
              <p className="text-white/40 uppercase tracking-widest text-sm">Crafting social captions...</p>
            </div>
          )}

          {socialPackage && settings && (
            <div className="space-y-8">
              {/* English Preview */}
              <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram size={18} className="text-[#f27d26]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">English Instagram Post</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {publishStatus.en.status === 'success' && (
                      <span className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Published
                      </span>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={targetAccounts.en}
                        onChange={(e) => setTargetAccounts({ ...targetAccounts, en: e.target.checked })}
                        className="rounded border-white/10 bg-white/5 text-[#f27d26] focus:ring-[#f27d26]"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Target</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="aspect-square rounded-xl overflow-hidden border border-white/5">
                    <img src={story.enBrandedUrl} className="w-full h-full object-cover" alt="EN Visual" />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                      {formatCaption('en', socialPackage, settings)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleGenerateCaptions} className="text-[10px] uppercase font-bold text-white/40 hover:text-white flex items-center gap-1">
                        <RefreshCw size={12} /> Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arabic Preview */}
              <div className="glass p-8 rounded-2xl border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram size={18} className="text-[#f27d26]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Arabic Instagram Post</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {publishStatus.ar.status === 'success' && (
                      <span className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Published
                      </span>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={targetAccounts.ar}
                        onChange={(e) => setTargetAccounts({ ...targetAccounts, ar: e.target.checked })}
                        className="rounded border-white/10 bg-white/5 text-[#f27d26] focus:ring-[#f27d26]"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Target</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="aspect-square rounded-xl overflow-hidden border border-white/5">
                    <img src={story.arBrandedUrl} className="w-full h-full object-cover" alt="AR Visual" />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto text-right font-arabic" dir="rtl">
                      {formatCaption('ar', socialPackage, settings)}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={handleGenerateCaptions} className="text-[10px] uppercase font-bold text-white/40 hover:text-white flex items-center gap-1">
                        <RefreshCw size={12} /> Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Status & Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Publishing Status</h3>
            
            <div className="space-y-4">
              {/* EN Status */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${publishStatus.en.status === 'success' ? 'bg-green-400' : publishStatus.en.status === 'error' ? 'bg-red-400' : 'bg-white/20'}`} />
                  <span className="text-xs font-bold">English Account</span>
                </div>
                {publishStatus.en.status === 'loading' && <Loader2 className="animate-spin text-white/40" size={14} />}
                {publishStatus.en.status === 'success' && <CheckCircle2 className="text-green-400" size={14} />}
                {publishStatus.en.status === 'error' && <AlertCircle className="text-red-400" size={14} />}
              </div>

              {/* AR Status */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${publishStatus.ar.status === 'success' ? 'bg-green-400' : publishStatus.ar.status === 'error' ? 'bg-red-400' : 'bg-white/20'}`} />
                  <span className="text-xs font-bold">Arabic Account</span>
                </div>
                {publishStatus.ar.status === 'loading' && <Loader2 className="animate-spin text-white/40" size={14} />}
                {publishStatus.ar.status === 'success' && <CheckCircle2 className="text-green-400" size={14} />}
                {publishStatus.ar.status === 'error' && <AlertCircle className="text-red-400" size={14} />}
              </div>
            </div>

            {(publishStatus.en.error || publishStatus.ar.error) && (
              <div className="p-4 bg-red-400/10 border border-red-400/20 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase">
                  <AlertCircle size={14} /> Publishing Error
                </div>
                <p className="text-[10px] text-red-400/80 leading-relaxed">
                  {publishStatus.en.error || publishStatus.ar.error}
                </p>
                <button onClick={handlePublish} className="text-[10px] font-bold underline text-red-400">Retry Publishing</button>
              </div>
            )}
          </section>

          <section className="glass p-6 rounded-2xl border-white/5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Distribution Checklist</h3>
            <ul className="space-y-3">
              {[
                "Branded visuals generated",
                "Captions localized (EN/AR)",
                "Risk disclaimers included",
                "Company links appended",
                "Hashtag strategy applied"
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-[10px] text-white/60">
                  <CheckCircle2 size={14} className="text-green-400" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
