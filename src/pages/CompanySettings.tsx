import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Save, ChevronLeft, Loader2, Globe, Hash, Link as LinkIcon, ShieldAlert, Instagram, Eye, EyeOff, Lock, RefreshCw } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthStore } from '../store';
import { fetchWithAuth } from '../lib/api';

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

export default function CompanySettings() {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>({
    enDisclaimer: 'Risk Warning: Trading financial instruments involves significant risk. Past performance is not indicative of future results.',
    arDisclaimer: 'تحذير من المخاطر: ينطوي تداول الأدوات المالية على مخاطر كبيرة. الأداء السابق ليس مؤشراً على النتائج المستقبلية.',
    websiteUrl: 'https://istrealestate.ae',
    telegramUrl: 'https://t.me/istmarkets',
    whatsappUrl: 'https://wa.me/istmarkets',
    fixedHashtags: ['ISTMarkets', 'Trading', 'Forex', 'Gold', 'Oil'],
    enInstagramId: '',
    arInstagramId: '',
    metaAccessToken: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'company');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CompanySettings;
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error("Failed to fetch company settings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (role !== 'super-admin' && role !== 'admin') return;
    
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'company'), settings);
      
      // Log the action
      await fetchWithAuth('/api/audit-logs', {
        method: 'POST',
        body: JSON.stringify({
          action_type: 'UPDATE_COMPANY_SETTINGS',
          entity_type: 'SETTINGS',
          entity_id: 'company',
          details: `Company settings updated by ${auth.currentUser?.email}`
        })
      });
    } catch (error) {
      console.error("Save failed", error);
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

  const isSuperAdmin = role === 'super-admin';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-bold tracking-tighter">Company Settings</h2>
            <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Links, Disclaimers & API Keys</p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Save Settings
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Links & Social */}
        <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
          <div className="flex items-center gap-2 text-[#f27d26]">
            <LinkIcon size={20} />
            <h3 className="font-bold uppercase tracking-widest text-sm">Company Links</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Website URL</label>
              <input 
                value={settings.websiteUrl}
                onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Telegram Channel</label>
              <input 
                value={settings.telegramUrl}
                onChange={(e) => setSettings({ ...settings, telegramUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">WhatsApp Support</label>
              <input 
                value={settings.whatsappUrl}
                onChange={(e) => setSettings({ ...settings, whatsappUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
              />
            </div>
          </div>
        </section>

        {/* Instagram API */}
        <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
          <div className="flex items-center gap-2 text-[#f27d26]">
            <Instagram size={20} />
            <h3 className="font-bold uppercase tracking-widest text-sm">Instagram Publishing</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">English Account ID</label>
              <input 
                value={settings.enInstagramId}
                onChange={(e) => setSettings({ ...settings, enInstagramId: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Arabic Account ID</label>
              <input 
                value={settings.arInstagramId}
                onChange={(e) => setSettings({ ...settings, arInstagramId: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Meta Access Token</label>
              <div className="relative">
                <input 
                  type={showToken ? "text" : "password"}
                  value={settings.metaAccessToken}
                  readOnly={!isSuperAdmin}
                  onChange={(e) => setSettings({ ...settings, metaAccessToken: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-[#f27d26] font-mono"
                  placeholder={isSuperAdmin ? "Enter token..." : "••••••••••••••••"}
                />
                <button 
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!isSuperAdmin && (
                <p className="text-[10px] text-red-400/60 flex items-center gap-1 mt-1">
                  <Lock size={10} />
                  Only Super Admins can modify API keys
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Hashtags */}
        <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
          <div className="flex items-center gap-2 text-[#f27d26]">
            <Hash size={20} />
            <h3 className="font-bold uppercase tracking-widest text-sm">Fixed Hashtags</h3>
          </div>
          
          <div className="space-y-4">
            <textarea 
              value={settings.fixedHashtags.join(', ')}
              onChange={(e) => setSettings({ ...settings, fixedHashtags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] resize-none"
              placeholder="Comma separated tags..."
            />
            <p className="text-[10px] text-white/40">These tags will be appended to every post automatically.</p>
          </div>
        </section>

        {/* Disclaimers */}
        <section className="glass p-6 rounded-2xl border-white/5 space-y-6">
          <div className="flex items-center gap-2 text-[#f27d26]">
            <ShieldAlert size={20} />
            <h3 className="font-bold uppercase tracking-widest text-sm">Risk Disclaimers</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">English Disclaimer</label>
              <textarea 
                value={settings.enDisclaimer}
                onChange={(e) => setSettings({ ...settings, enDisclaimer: e.target.value })}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Arabic Disclaimer</label>
              <textarea 
                value={settings.arDisclaimer}
                onChange={(e) => setSettings({ ...settings, arDisclaimer: e.target.value })}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#f27d26] resize-none text-right font-arabic"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
