import { useState, useEffect, useCallback } from 'react';
import { Send, Download, RefreshCw, Plus, Trash2, Zap, Calendar, TrendingUp, Radio, ChevronRight, Sparkles, User, ImageIcon, X, Loader2, AlertCircle } from 'lucide-react';
import { useBrandStore } from '../context/BrandContext';
import { fetchWithAuth } from '../lib/api';
import BrandedCanvas, { renderMarsadCardToDataUrl } from '../components/BrandedCanvas';
import { fetchMetricoolBrands, scheduleToMetricool, MetricoolBrand, getConnectedNetworks } from '../services/metricoolService';
import type {
  CardType, SignalData, CalendarData, CalendarEvent,
  ProofOfTradesData, TradeEntry, WebinarData,
} from '../types/marsad-cards';

// ── Toast helper ──────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const show = useCallback((type: ToastType, msg: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function calcRR(entry: number, sl: number, tp: number): string {
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return '—';
  return `1 : ${(reward / risk).toFixed(2)}`;
}

const TODAY = new Date().toISOString().slice(0, 10);

const QUICK_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'US500'];
const TIMEFRAMES  = ['M15', 'H1', 'H4', 'D1', 'W1'];
const PLATFORMS   = ['Telegram', 'Zoom', 'YouTube', 'Other'];

function emptySignal(): SignalData {
  return { pair: 'XAUUSD', direction: 'BUY', assetType: 'Forex', timeframe: 'H1', entry: 0, stopLoss: 0, takeProfit: 0, rrRatio: '—' };
}
function emptyTrade(): TradeEntry {
  return { id: Math.random().toString(36).slice(2), symbol: 'XAUUSD', direction: 'BUY', lots: 0.1, entryPrice: 0, closePrice: 0, profit: 0 };
}
function emptyPOT(): ProofOfTradesData {
  return { period: '', trades: [emptyTrade()], totalProfit: 0 };
}
function emptyWebinar(): WebinarData {
  return { title: '', dateAr: '', timeAr: '', platform: 'Telegram', bookingUrl: '', tags: [] };
}
function emptyCalendar(): CalendarData {
  return { date: TODAY, events: [] };
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS: { id: CardType; label: string; icon: typeof Zap; color: string }[] = [
  { id: 'signal',          label: 'Trading Signal',    icon: TrendingUp, color: '#C9A84C' },
  { id: 'calendar',        label: 'Economic Calendar', icon: Calendar,   color: '#2AABEE' },
  { id: 'proof-of-trades', label: 'Proof of Trades',  icon: Zap,        color: '#10B981' },
  { id: 'webinar',         label: 'Webinar',           icon: Radio,      color: '#A855F7' },
];

// ── Professional caption generator ───────────────────────────────────────────
function generateCardCaption(
  lang: 'ar' | 'en',
  tab: CardType,
  signal: SignalData,
  calendar: CalendarData,
  pot: ProofOfTradesData,
  webinar: WebinarData
): string {
  if (tab === 'signal') {
    const dirAr = signal.direction === 'BUY' ? 'شراء 🟢' : 'بيع 🔴';
    if (lang === 'ar') return [
      `🔔 إشارة تداول | ${signal.pair}`,
      ``,
      `📍 الاتجاه: ${dirAr}`,
      `💰 الدخول: ${signal.entry || '—'}`,
      `🛑 وقف الخسارة: ${signal.stopLoss || '—'}`,
      `🎯 الهدف: ${signal.takeProfit || '—'}`,
      `📊 نسبة المخاطرة: ${signal.rrRatio}`,
      signal.setupNotes ? `\n💬 ${signal.setupNotes}` : '',
      ``,
      `#مرصد_السوق #إشارات_تداول #${signal.pair} #فوركس #تداول`,
    ].filter(l => l !== null).join('\n');

    return [
      `🔔 Trading Signal | ${signal.pair}`,
      ``,
      `📍 Direction: ${signal.direction === 'BUY' ? 'BUY 🟢' : 'SELL 🔴'}`,
      `💰 Entry: ${signal.entry || '—'}`,
      `🛑 Stop Loss: ${signal.stopLoss || '—'}`,
      `🎯 Take Profit: ${signal.takeProfit || '—'}`,
      `📊 Risk:Reward: ${signal.rrRatio}`,
      signal.setupNotes ? `\n💬 ${signal.setupNotes}` : '',
      ``,
      `#MarsadAlSouq #TradingSignal #${signal.pair} #Forex #Trading`,
    ].filter(l => l !== null).join('\n');
  }

  if (tab === 'calendar') {
    const highCount = calendar.events.filter(e => e.impact === 'high').length;
    if (lang === 'ar') return [
      `📅 الأجندة الاقتصادية`,
      ``,
      calendar.date ? `📆 ${new Date(calendar.date + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : '',
      highCount > 0 ? `⚠️ ${highCount} حدث عالي التأثير اليوم` : '',
      ``,
      `تابعوا أبرز الأحداث الاقتصادية المؤثرة على الأسواق العالمية مع مرصد السوق 🎯`,
      ``,
      `#مرصد_السوق #التقويم_الاقتصادي #اخبار_الفوركس #تداول #أسواق_مالية`,
    ].filter(Boolean).join('\n');

    return [
      `📅 Economic Calendar`,
      ``,
      calendar.date ? `📆 ${new Date(calendar.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : '',
      highCount > 0 ? `⚠️ ${highCount} high-impact event${highCount > 1 ? 's' : ''} today` : '',
      ``,
      `Stay ahead of market-moving events with Marsad Al Souq 🎯`,
      ``,
      `#MarsadAlSouq #EconomicCalendar #ForexNews #Trading #FinancialMarkets`,
    ].filter(Boolean).join('\n');
  }

  if (tab === 'proof-of-trades') {
    const profitStr = (pot.totalProfit >= 0 ? '+' : '') + pot.totalProfit.toFixed(2);
    if (lang === 'ar') return [
      `✅ إثبات الصفقات${pot.period ? ' | ' + pot.period : ''}`,
      ``,
      `💼 إجمالي الأرباح: ${profitStr} $`,
      `🔢 عدد الصفقات: ${pot.trades.length}`,
      ``,
      `النتائج تتكلم عن نفسها 📈`,
      `شفافية تامة وأداء موثق مع مرصد السوق`,
      ``,
      `#مرصد_السوق #إثبات_الصفقات #نتائج_موثقة #تداول #فوركس`,
    ].join('\n');

    return [
      `✅ Proof of Trades${pot.period ? ' | ' + pot.period : ''}`,
      ``,
      `💼 Total P&L: ${profitStr} $`,
      `🔢 Number of trades: ${pot.trades.length}`,
      ``,
      `Results speak for themselves 📈`,
      `Full transparency & documented performance with Marsad Al Souq`,
      ``,
      `#MarsadAlSouq #ProofOfTrades #TradingResults #Verified #Forex`,
    ].join('\n');
  }

  if (tab === 'webinar') {
    if (lang === 'ar') return [
      `🎙️ ندوة مباشرة`,
      ``,
      webinar.title || 'ندوة تداول',
      ``,
      webinar.dateAr ? `📅 ${webinar.dateAr}` : '',
      webinar.timeAr ? `🕐 ${webinar.timeAr}` : '',
      `📱 ${webinar.platform}`,
      ``,
      `سجّل الآن مجاناً 👇`,
      webinar.bookingUrl || '',
      ``,
      `#مرصد_السوق #ندوة_مباشرة #تعليم_تداول #فوركس #تداول`,
    ].filter(Boolean).join('\n');

    return [
      `🎙️ Live Webinar`,
      ``,
      webinar.title || 'Trading Webinar',
      ``,
      webinar.dateAr ? `📅 ${webinar.dateAr}` : '',
      webinar.timeAr ? `🕐 ${webinar.timeAr}` : '',
      `📱 ${webinar.platform}`,
      ``,
      `Register now for free 👇`,
      webinar.bookingUrl || '',
      ``,
      `#MarsadAlSouq #LiveWebinar #TradingEducation #Forex #Trading`,
    ].filter(Boolean).join('\n');
  }

  return '';
}

// ══════════════════════════════════════════════════════════════════════════════
export default function MarsadCards() {
  const { activeBrand } = useBrandStore();
  const { toast, show: showToast } = useToast();

  const [activeTab, setActiveTab]   = useState<CardType>('signal');
  const [brandSettings, setBrandSettings] = useState<any>({});
  const [publishing, setPublishing]        = useState(false);

  // Per-tab data
  const [signal,  setSignal]  = useState<SignalData>(emptySignal());
  const [calendar, setCalendar] = useState<CalendarData>(emptyCalendar());
  const [pot,     setPot]     = useState<ProofOfTradesData>(emptyPOT());
  const [webinar, setWebinar] = useState<WebinarData>(emptyWebinar());

  // Calendar fetch
  const [calLoading, setCalLoading] = useState(false);
  // AI calendar screenshot analysis
  const [analyzingCalendar, setAnalyzingCalendar] = useState(false);
  const [calendarScreenshot, setCalendarScreenshot] = useState<string>('');
  // Webinar QR
  const [qrLoading, setQrLoading] = useState(false);
  // AI chart analysis (Signal tab)
  const [analyzing, setAnalyzing] = useState(false);
  // AI POT analysis
  const [analyzingPOT, setAnalyzingPOT] = useState(false);
  // AI Webinar generation (gpt-image-1)
  const [generatingWebinar, setGeneratingWebinar] = useState(false);
  // AI-generated webinar image (bypasses canvas when set)
  const [aiWebinarImage, setAiWebinarImage] = useState<string>('');
  // New tag input
  const [newTag, setNewTag] = useState('');

  // ── Metricool state ──────────────────────────────────────────────────────────
  const [metricoolOpen, setMetricoolOpen]           = useState(false);
  const [mcBrands, setMcBrands]                     = useState<MetricoolBrand[]>([]);
  const [mcSelectedBrand, setMcSelectedBrand]       = useState<MetricoolBrand | null>(null);
  const [mcSelectedNetworks, setMcSelectedNetworks] = useState<string[]>([]);
  const [mcLoading, setMcLoading]                   = useState(false);
  const [mcSuccess, setMcSuccess]                   = useState(false);
  const [mcError, setMcError]                       = useState('');
  const [mcScheduledAt, setMcScheduledAt]           = useState('');

  // ── Dual-language preview ────────────────────────────────────────────────────
  const [arDataUrl, setArDataUrl] = useState<string>('');
  const [enDataUrl, setEnDataUrl] = useState<string>('');

  // ── Captions (auto-generated, user-editable) ─────────────────────────────────
  const [arCaption, setArCaption] = useState<string>('');
  const [enCaption, setEnCaption] = useState<string>('');

  // ── Publish language selection ───────────────────────────────────────────────
  const [publishLang, setPublishLang] = useState<'ar' | 'en'>('ar');

  // ── Telegram language modal ──────────────────────────────────────────────────
  const [tgLangModalOpen, setTgLangModalOpen] = useState(false);

  // ── Load brand settings ── fetch both Marsad and IST Markets; use IST logo
  // as fallback when Marsad brand settings haven't been configured yet
  useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/settings/brand-marsad-alsouq').then(r => r.ok ? r.json() : null).catch(() => null),
      fetchWithAuth('/api/settings/brand-ist-markets').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([marsad, ist]) => {
      // GET /api/settings/:key returns the value object directly (not wrapped in { value: ... })
      const m = (marsad && typeof marsad === 'object' ? marsad : {}) as Record<string, any>;
      const i = (ist    && typeof ist    === 'object' ? ist    : {}) as Record<string, any>;
      // Marsad settings take priority; IST logo fills in only if Marsad logo absent
      setBrandSettings({ ...m, logoUrl: m.logoUrl || i.logoUrl || '' });
    });
  }, []);

  // ── Auto-compute R:R when signal prices change ────────────────────────────
  useEffect(() => {
    setSignal(prev => ({ ...prev, rrRatio: calcRR(prev.entry, prev.stopLoss, prev.takeProfit) }));
  }, [signal.entry, signal.stopLoss, signal.takeProfit]);

  // ── Auto-sum POT total ────────────────────────────────────────────────────
  useEffect(() => {
    const total = pot.trades.reduce((s, t) => s + Number(t.profit), 0);
    setPot(prev => ({ ...prev, totalProfit: parseFloat(total.toFixed(2)) }));
  }, [pot.trades]);

  // ── Fetch economic calendar ───────────────────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await fetchWithAuth(`/api/marsad/economic-calendar?date=${calendar.date}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const events: CalendarEvent[] = await res.json();
      setCalendar(prev => ({ ...prev, events }));
      showToast('success', `Fetched ${events.length} events`);
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setCalLoading(false);
    }
  }, [calendar.date, showToast]);

  // ── Analyse calendar screenshot → auto-fill events ───────────────────────
  const handleAnalyzeCalendar = useCallback(async (imageBase64: string) => {
    setAnalyzingCalendar(true);
    try {
      const res = await fetchWithAuth('/api/marsad/analyze-calendar', {
        method: 'POST',
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();

      const events: CalendarEvent[] = (data.events || []).map((e: any) => ({
        time:     e.time     || '00:00',
        country:  e.country  || '',
        event:    e.event    || '',
        actual:   e.actual   || undefined,
        forecast: e.forecast || undefined,
        previous: e.previous || undefined,
        impact:   (['high','medium','low'].includes(e.impact)) ? e.impact : 'medium',
        result:   e.result   || 'neutral',
      }));

      setCalendar(prev => ({
        ...prev,
        date:   data.date || prev.date,
        events,
      }));

      showToast('success', `Extracted ${events.length} events ✓`);
    } catch (e: any) {
      showToast('error', 'Analysis failed: ' + e.message);
    } finally {
      setAnalyzingCalendar(false);
    }
  }, [showToast]);

  // ── Analyze chart image with Gemini Vision ───────────────────────────────
  const handleAnalyzeChart = useCallback(async (imageBase64: string) => {
    setAnalyzing(true);
    try {
      const res = await fetchWithAuth('/api/marsad/analyze-chart', {
        method: 'POST',
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();

      // Auto-fill all signal fields from AI response
      setSignal(prev => ({
        ...prev,
        pair:        data.pair       || prev.pair,
        direction:   (data.direction === 'BUY' || data.direction === 'SELL') ? data.direction : prev.direction,
        assetType:   (['Forex','Crypto','Indices','Commodities'].includes(data.assetType)) ? data.assetType : prev.assetType,
        timeframe:   (['M15','H1','H4','D1','W1'].includes(data.timeframe)) ? data.timeframe : prev.timeframe,
        entry:       Number(data.entry)      || prev.entry,
        stopLoss:    Number(data.stopLoss)   || prev.stopLoss,
        takeProfit:  Number(data.takeProfit) || prev.takeProfit,
        setupNotes:  data.setupNotes || prev.setupNotes,
        chartImage:  imageBase64,
      }));

      const conf = data.confidence === 'high' ? 'high ✓' : data.confidence === 'medium' ? 'medium' : 'low';
      showToast('success', `Chart analysed — confidence: ${conf}`);
    } catch (e: any) {
      showToast('error', 'Analysis failed: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }, [showToast]);

  // ── Analyse MT5 screenshot → auto-fill POT trades ────────────────────────
  const handleAnalyzePOT = useCallback(async (imageBase64: string) => {
    setAnalyzingPOT(true);
    try {
      const res = await fetchWithAuth('/api/marsad/analyze-pot', {
        method: 'POST',
        body: JSON.stringify({ imageBase64 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();

      // Build trade entries from AI response, keeping existing UI ids
      const newTrades = (data.trades || []).map((t: any) => ({
        id: Math.random().toString(36).slice(2),
        symbol:     (t.symbol     || 'XAUUSD').toUpperCase(),
        direction:  (t.direction === 'SELL' || t.direction?.toLowerCase() === 'sell') ? 'SELL' : 'BUY',
        lots:       Number(t.lots)       || 0.1,
        entryPrice: Number(t.entryPrice) || 0,
        closePrice: Number(t.closePrice) || 0,
        profit:     Number(t.profit)     || 0,
      }));

      setPot(prev => ({
        ...prev,
        period: data.period || prev.period,
        trades: newTrades.length > 0 ? newTrades : prev.trades,
      }));

      const conf = data.confidence === 'high' ? 'high ✓' : data.confidence === 'medium' ? 'medium' : 'low';
      showToast('success', `Analysed ${newTrades.length} trades — confidence: ${conf}`);
    } catch (e: any) {
      showToast('error', 'Analysis failed: ' + e.message);
    } finally {
      setAnalyzingPOT(false);
    }
  }, [showToast]);

  // ── Generate Webinar card using gpt-image-1 ───────────────────────────────
  const handleGenerateWebinar = useCallback(async () => {
    if (!webinar.title.trim()) return showToast('error', 'Enter a webinar title first');
    setGeneratingWebinar(true);
    try {
      const res = await fetchWithAuth('/api/marsad/generate-webinar', {
        method: 'POST',
        body: JSON.stringify({
          title:               webinar.title,
          subtitle:            webinar.subtitle,
          dateAr:              webinar.dateAr,
          timeAr:              webinar.timeAr,
          platform:            webinar.platform,
          hostName:            webinar.hostName,
          tags:                webinar.tags,
          presenterImageBase64: webinar.presenterImage,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { dataUrl } = await res.json();
      setAiWebinarImage(dataUrl);
      showToast('success', 'AI design generated ✨');
    } catch (e: any) {
      showToast('error', 'Design generation failed: ' + e.message);
    } finally {
      setGeneratingWebinar(false);
    }
  }, [webinar, showToast]);

  // ── Fetch QR code when booking URL changes ───────────────────────────────
  useEffect(() => {
    if (!webinar.bookingUrl || !webinar.bookingUrl.startsWith('http')) {
      setWebinar(prev => ({ ...prev, qrDataUrl: undefined }));
      return;
    }
    setQrLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/marsad/qrcode?url=${encodeURIComponent(webinar.bookingUrl)}`);
        if (!res.ok) throw new Error();
        const { dataUrl } = await res.json();
        setWebinar(prev => ({ ...prev, qrDataUrl: dataUrl }));
      } catch { /* ignore */ }
      finally { setQrLoading(false); }
    }, 600); // debounce
    return () => clearTimeout(timeout);
  }, [webinar.bookingUrl]);

  // ── Auto-generate captions when card data or tab changes ─────────────────
  useEffect(() => {
    setArCaption(generateCardCaption('ar', activeTab, signal, calendar, pot, webinar));
    setEnCaption(generateCardCaption('en', activeTab, signal, calendar, pot, webinar));
  }, [activeTab, signal.pair, signal.direction, signal.entry, signal.stopLoss, signal.takeProfit, signal.rrRatio, signal.setupNotes,
      calendar.date, calendar.events.length,
      pot.period, pot.totalProfit, pot.trades.length,
      webinar.title, webinar.dateAr, webinar.timeAr, webinar.platform, webinar.bookingUrl]);

  // ── Active image URL per language ─────────────────────────────────────────
  const activeArImageUrl = (activeTab === 'webinar' && aiWebinarImage) ? aiWebinarImage : arDataUrl;
  const activeEnImageUrl = (activeTab === 'webinar' && aiWebinarImage) ? aiWebinarImage : enDataUrl;
  const activeImageUrl   = publishLang === 'en' ? activeEnImageUrl : activeArImageUrl;

  // ── Download PNG ──────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const ts = Date.now();
    let downloaded = 0;

    if (arDataUrl) {
      const a = document.createElement('a');
      a.href = arDataUrl;
      a.download = `marsad-${activeTab}-AR-${ts}.png`;
      a.click();
      downloaded++;
    }

    if (enDataUrl) {
      await new Promise(r => setTimeout(r, 350));
      const a = document.createElement('a');
      a.href = enDataUrl;
      a.download = `marsad-${activeTab}-EN-${ts}.png`;
      a.click();
      downloaded++;
    }

    if (downloaded === 0) {
      showToast('info', 'Waiting for cards to render…');
    } else {
      showToast('success', `Downloaded ${downloaded === 2 ? 'Arabic + English versions' : (arDataUrl ? 'Arabic' : 'English') + ' version'} ✓`);
    }
  }, [arDataUrl, enDataUrl, activeTab, showToast]);

  // ── Publish to Telegram ───────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    const imgUrl = publishLang === 'en' ? activeEnImageUrl : activeArImageUrl;
    const caption = publishLang === 'en' ? enCaption : arCaption;
    if (!imgUrl) return showToast('info', 'Waiting for card to render…');
    setPublishing(true);
    setTgLangModalOpen(false);
    try {
      const blob = await (await fetch(imgUrl)).blob();
      const form = new FormData();
      form.append('file', blob, `marsad-${activeTab}-${publishLang}.jpg`);
      const upRes = await fetchWithAuth('/api/upload-brand-asset', { method: 'POST', body: form, headers: {} as any });
      if (!upRes.ok) throw new Error('Failed to upload image');
      const { url } = await upRes.json();
      const tgRes = await fetchWithAuth('/api/telegram/send', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: url, caption, brandId: activeBrand.id }),
      });
      if (!tgRes.ok) throw new Error((await tgRes.json()).error);
      showToast('success', `Posted ${publishLang.toUpperCase()} version to Telegram ✓`);
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setPublishing(false);
    }
  }, [activeArImageUrl, activeEnImageUrl, arCaption, enCaption, publishLang, activeTab, activeBrand.id, showToast]);

  // ── Image file → base64 ───────────────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  // ── Metricool helpers ────────────────────────────────────────────────────────
  const openMetricool = async () => {
    if (!activeArImageUrl && !activeEnImageUrl) return showToast('info', 'Waiting for card to render…');
    setMetricoolOpen(true);
    setMcSuccess(false);
    setMcError('');
    if (!mcBrands.length) {
      setMcLoading(true);
      try {
        const brands = await fetchMetricoolBrands();
        setMcBrands(brands);
        if (brands.length > 0) {
          setMcSelectedBrand(brands[0]);
          setMcSelectedNetworks(getConnectedNetworks(brands[0]).map(n => n.key));
        }
      } catch (e: any) {
        setMcError(e.message);
      } finally {
        setMcLoading(false);
      }
    }
  };

  const handleBrandChange = (brand: MetricoolBrand) => {
    setMcSelectedBrand(brand);
    setMcSelectedNetworks(getConnectedNetworks(brand).map(n => n.key));
  };

  const toggleNetwork = (key: string) => {
    setMcSelectedNetworks(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const uploadForMetricool = async (dataUrl: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('file', blob, `marsad-${activeTab}-${Date.now()}.jpg`);
    const res = await fetchWithAuth('/api/upload-brand-asset', { method: 'POST', body: form, headers: {} as any });
    if (!res.ok) throw new Error('Failed to upload image for Metricool');
    const { url } = await res.json();
    return `${window.location.origin}${url}`;
  };

  const handleMetricoolSend = async () => {
    if (!mcSelectedBrand || mcSelectedNetworks.length === 0) return;
    const imgUrl = publishLang === 'en' ? activeEnImageUrl : activeArImageUrl;
    const caption = publishLang === 'en' ? enCaption : arCaption;
    if (!imgUrl) { setMcError('Card not yet rendered. Please wait.'); return; }
    setMcLoading(true);
    setMcError('');
    try {
      const imageUrl = await uploadForMetricool(imgUrl);
      await scheduleToMetricool({
        blogId: mcSelectedBrand.id,
        networks: mcSelectedNetworks,
        imageUrl,
        caption,
        scheduledAt: mcScheduledAt || undefined,
      });
      setMcSuccess(true);
    } catch (e: any) {
      setMcError(e.message);
    } finally {
      setMcLoading(false);
    }
  };

  // ── Current card data for canvas ─────────────────────────────────────────
  const currentCardData = activeTab === 'signal' ? signal
    : activeTab === 'calendar' ? calendar
    : activeTab === 'proof-of-trades' ? pot
    : webinar;

  // Loading placeholder dimensions
  const PREVIEW_W = 360;

  const accent = activeBrand.accentColor;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a] text-white">

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error'   ? 'bg-red-600 text-white' : 'bg-white/10 text-white border border-white/20'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b border-white/10 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id !== 'webinar') setAiWebinarImage(''); }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                active ? 'border-current text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
              style={active ? { color: tab.color, borderColor: tab.color } : {}}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Main content: form + preview ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Form panel ─────────────────────────────────────────────────── */}
        <div className="w-[400px] shrink-0 overflow-y-auto border-l border-white/10 p-5 space-y-4">

          {/* ── SIGNAL FORM ───────────────────────────────────────────────── */}
          {activeTab === 'signal' && (
            <>
              {/* Quick-select pairs */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Instrument</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {QUICK_PAIRS.map(p => (
                    <button key={p}
                      onClick={() => setSignal(s => ({ ...s, pair: p }))}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                        signal.pair === p ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  value={signal.pair}
                  onChange={e => setSignal(s => ({ ...s, pair: e.target.value.toUpperCase() }))}
                  placeholder="Or type a symbol (EURUSD…)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Asset type */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Asset Type</label>
                <div className="flex gap-2 flex-wrap">
                  {(['Forex','Crypto','Indices','Commodities'] as const).map(at => (
                    <button key={at}
                      onClick={() => setSignal(s => ({ ...s, assetType: at }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        signal.assetType === at ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}>
                      {at}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction + Timeframe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-2">Direction</label>
                  <div className="flex gap-2">
                    {(['BUY','SELL'] as const).map(d => (
                      <button key={d}
                        onClick={() => setSignal(s => ({ ...s, direction: d }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                          signal.direction === d
                            ? d === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                            : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}>
                        {d === 'BUY' ? '▲ BUY' : '▼ SELL'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2">Timeframe</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {TIMEFRAMES.map(tf => (
                      <button key={tf}
                        onClick={() => setSignal(s => ({ ...s, timeframe: tf }))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          signal.timeframe === tf ? 'bg-[#1E88E5] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}>
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Entry / Stop / TP */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Entry',       key: 'entry',      color: '#C9A84C' },
                  { label: 'Stop Loss',   key: 'stopLoss',   color: '#EF4444' },
                  { label: 'Take Profit', key: 'takeProfit', color: '#10B981' },
                ].map(({ label, key, color }) => (
                  <div key={key}>
                    <label className="block text-xs mb-1" style={{ color }}>{label}</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={(signal as any)[key] || ''}
                      onChange={e => setSignal(s => ({ ...s, [key]: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none"
                      style={{ borderColor: color + '50' }}
                    />
                  </div>
                ))}
              </div>

              {/* R:R */}
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30">
                <span className="text-xs text-white/50">Risk:Reward:</span>
                <span className="font-bold text-[#C9A84C] font-mono">{signal.rrRatio}</span>
              </div>

              {/* Setup notes */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Setup Notes (optional)</label>
                <textarea
                  value={signal.setupNotes || ''}
                  onChange={e => setSignal(s => ({ ...s, setupNotes: e.target.value }))}
                  placeholder="Describe the setup…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Chart image upload + AI analysis */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Chart Screenshot</label>

                {/* Upload button */}
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-3 hover:border-[#C9A84C]/50 transition-colors">
                  <ChevronRight size={16} className="text-white/30" />
                  <span className="text-sm text-white/40">
                    {signal.chartImage ? 'Uploaded ✓ — click to change' : 'Click to upload screenshot'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const b64 = await fileToBase64(f);
                      setSignal(s => ({ ...s, chartImage: b64 }));
                    }} />
                </label>

                {/* AI analysis button — shown once image is uploaded */}
                {signal.chartImage && (
                  <button
                    onClick={() => signal.chartImage && handleAnalyzeChart(signal.chartImage)}
                    disabled={analyzing}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #1a0f3d 0%, #2d1b69 100%)',
                      border: '1px solid #7c3aed80',
                      color: '#c4b5fd',
                    }}
                  >
                    {analyzing ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-[#c4b5fd] border-t-transparent animate-spin" />
                        Analysing with AI…
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        AI Chart Analysis
                      </>
                    )}
                  </button>
                )}

                {/* Preview of uploaded chart */}
                {signal.chartImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-white/10" style={{ height: 80 }}>
                    <img src={signal.chartImage} alt="chart" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── CALENDAR FORM ─────────────────────────────────────────────── */}
          {activeTab === 'calendar' && (
            <>
              {/* ── Primary: Screenshot upload + AI extraction ─────────── */}
              <div className="rounded-2xl border border-[#2AABEE]/25 bg-[#071828] p-4 space-y-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <Sparkles size={14} className="text-[#2AABEE]" />
                  <span className="text-xs font-semibold text-[#2AABEE]">Extract Events from Screenshot</span>
                </div>
                <p className="text-[11px] text-white/35 leading-relaxed">
                  Take a screenshot from any calendar site (Investing.com, Forex Factory…) — AI extracts all events automatically.
                </p>

                {/* Upload zone */}
                <label className="flex flex-col items-center gap-2 cursor-pointer rounded-xl border border-dashed border-[#2AABEE]/30 bg-white/3 py-3 hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/5 transition-all overflow-hidden">
                  {calendarScreenshot ? (
                    <img src={calendarScreenshot} alt="calendar screenshot" className="w-full rounded-lg object-contain max-h-28" />
                  ) : (
                    <>
                      <Calendar size={24} className="text-[#2AABEE]/40" />
                      <span className="text-sm text-white/35">Click to upload calendar screenshot</span>
                      <span className="text-[10px] text-white/20">PNG / JPG / WebP</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) { const b64 = await fileToBase64(f); setCalendarScreenshot(b64); }
                    }} />
                </label>

                {/* AI analyse button */}
                <button
                  onClick={() => calendarScreenshot && handleAnalyzeCalendar(calendarScreenshot)}
                  disabled={!calendarScreenshot || analyzingCalendar}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: calendarScreenshot ? 'linear-gradient(135deg, #0c2a4a 0%, #1a4a6e 100%)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${calendarScreenshot ? '#2AABEE50' : 'rgba(255,255,255,0.08)'}`,
                    color: calendarScreenshot ? '#7dd3fc' : 'rgba(255,255,255,0.25)',
                    cursor: calendarScreenshot ? 'pointer' : 'not-allowed',
                    opacity: analyzingCalendar ? 0.7 : 1,
                  }}
                >
                  {analyzingCalendar ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-[#7dd3fc] border-t-transparent animate-spin" />
                      Extracting events…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      AI Extract Events
                      {!calendarScreenshot && <span className="text-[10px] opacity-60 ml-1">(upload image first)</span>}
                    </>
                  )}
                </button>
              </div>

              {/* ── Divider ─────────────────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/25">or fetch from API</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* ── Fallback: API fetch ──────────────────────────────────── */}
              <div className="flex gap-2">
                <input type="date"
                  value={calendar.date}
                  onChange={e => setCalendar(c => ({ ...c, date: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2AABEE]"
                />
                <button onClick={fetchCalendar} disabled={calLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2AABEE]/10 border border-[#2AABEE]/25 text-[#2AABEE]/70 rounded-xl text-sm font-medium hover:bg-[#2AABEE]/20 transition-colors disabled:opacity-50">
                  <RefreshCw size={14} className={calLoading ? 'animate-spin' : ''} />
                  {calLoading ? '…' : 'API'}
                </button>
              </div>

              {/* ── Events list ─────────────────────────────────────────── */}
              {calendar.events.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">Events ({calendar.events.length})</label>
                    <div className="flex gap-1">
                      {(['high','medium','low'] as const).map(imp => (
                        <button key={imp}
                          onClick={() => setCalendar(c => ({ ...c, events: c.events.map(ev => ev.impact === imp ? { ...ev, _hidden: !(ev as any)._hidden } : ev) as CalendarEvent[] }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            imp === 'high' ? 'bg-red-500/20 text-red-400' : imp === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                          {imp === 'high' ? 'High' : imp === 'medium' ? 'Medium' : 'Low'}
                        </button>
                      ))}
                      <button onClick={() => { setCalendarScreenshot(''); setCalendar(c => ({ ...c, events: [] })); }}
                        className="px-2 py-0.5 rounded text-[10px] text-white/25 hover:text-red-400 transition-colors">
                        Clear ✕
                      </button>
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                    {calendar.events.map((ev, i) => (
                      <label key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/8">
                        <input type="checkbox"
                          checked={!(ev as any)._hidden}
                          onChange={() => setCalendar(c => ({
                            ...c,
                            events: c.events.map((e2, j) => j === i ? { ...e2, _hidden: !(e2 as any)._hidden } as CalendarEvent : e2)
                          }))}
                          className="accent-[#2AABEE]"
                        />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ev.impact === 'high' ? 'bg-red-500' : ev.impact === 'medium' ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                        <span className="text-xs text-white/70 truncate flex-1">{ev.event}</span>
                        <span className="text-[10px] text-white/30 font-mono shrink-0">{ev.time}</span>
                        <span className="text-[10px] text-white/30 shrink-0">{ev.country}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {calendar.events.length === 0 && !calendarScreenshot && (
                <div className="text-center py-6 text-white/20 text-xs">
                  Upload a screenshot above to auto-extract events
                </div>
              )}
            </>
          )}

          {/* ── PROOF OF TRADES FORM ──────────────────────────────────────── */}
          {activeTab === 'proof-of-trades' && (
            <>
              <div>
                <label className="block text-xs text-white/40 mb-2">Period</label>
                <input
                  value={pot.period}
                  onChange={e => setPot(p => ({ ...p, period: e.target.value }))}
                  placeholder="e.g. April 2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#10B981]"
                />
              </div>

              {/* Screenshot upload + AI analysis */}
              <div>
                <label className="block text-xs text-white/40 mb-2">MT5 Screenshot (optional)</label>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-3 hover:border-[#10B981]/50 transition-colors">
                  <span className="text-sm text-white/40">
                    {pot.screenshotImage ? 'Uploaded ✓ — click to change' : 'Click to upload screenshot'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) { const b64 = await fileToBase64(f); setPot(p => ({ ...p, screenshotImage: b64 })); }
                    }} />
                </label>

                {/* AI analysis button — always shown, disabled until screenshot is uploaded */}
                <button
                  onClick={() => pot.screenshotImage && handleAnalyzePOT(pot.screenshotImage)}
                  disabled={!pot.screenshotImage || analyzingPOT}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: pot.screenshotImage
                      ? 'linear-gradient(135deg, #052e16 0%, #065f46 100%)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${pot.screenshotImage ? '#10B98160' : 'rgba(255,255,255,0.08)'}`,
                    color: pot.screenshotImage ? '#6ee7b7' : 'rgba(255,255,255,0.25)',
                    cursor: pot.screenshotImage ? 'pointer' : 'not-allowed',
                    opacity: analyzingPOT ? 0.7 : 1,
                  }}
                >
                  {analyzingPOT ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-[#6ee7b7] border-t-transparent animate-spin" />
                      Extracting trades…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      AI Auto-fill Trades
                      {!pot.screenshotImage && <span className="text-[10px] opacity-60 ml-1">(upload image first)</span>}
                    </>
                  )}
                </button>

                {/* Thumbnail preview */}
                {pot.screenshotImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-white/10" style={{ height: 70 }}>
                    <img src={pot.screenshotImage} alt="mt5" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Trade rows */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-white/40">Trades ({pot.trades.length})</label>
                  <button
                    onClick={() => setPot(p => ({ ...p, trades: [...p.trades, emptyTrade()] }))}
                    className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#10B981]/80">
                    <Plus size={12} /> Add Trade
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {pot.trades.map((trade, i) => (
                    <div key={trade.id} className="bg-white/5 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={trade.symbol}
                          onChange={e => setPot(p => ({ ...p, trades: p.trades.map((t, j) => j === i ? { ...t, symbol: e.target.value.toUpperCase() } : t) }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none"
                          placeholder="Symbol"
                        />
                        <div className="flex gap-1">
                          {(['BUY','SELL'] as const).map(d => (
                            <button key={d}
                              onClick={() => setPot(p => ({ ...p, trades: p.trades.map((t, j) => j === i ? { ...t, direction: d } : t) }))}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                trade.direction === d
                                  ? d === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                  : 'bg-white/5 text-white/30'
                              }`}>
                              {d}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setPot(p => ({ ...p, trades: p.trades.filter((_, j) => j !== i) }))}
                          className="text-white/20 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Lots',  key: 'lots',       step: '0.01' },
                          { label: 'Entry', key: 'entryPrice', step: '0.01' },
                          { label: 'Close', key: 'closePrice', step: '0.01' },
                          { label: 'P&L $', key: 'profit',    step: '0.01' },
                        ].map(({ label, key, step }) => (
                          <div key={key}>
                            <div className="text-[9px] text-white/30 mb-0.5">{label}</div>
                            <input
                              type="number" step={step}
                              value={(trade as any)[key] || ''}
                              onChange={e => setPot(p => ({ ...p, trades: p.trades.map((t, j) => j === i ? { ...t, [key]: parseFloat(e.target.value) || 0 } : t) }))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-xs font-mono focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between mt-3 px-4 py-2.5 rounded-xl bg-emerald-900/20 border border-emerald-800/40">
                  <span className="text-xs text-white/50">Total:</span>
                  <span className={`font-bold font-mono text-sm ${pot.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pot.totalProfit >= 0 ? '+' : ''}{pot.totalProfit.toFixed(2)} $
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── WEBINAR FORM ──────────────────────────────────────────────── */}
          {activeTab === 'webinar' && (
            <>
              <div>
                <label className="block text-xs text-white/40 mb-2">Webinar Title *</label>
                <textarea
                  value={webinar.title}
                  onChange={e => setWebinar(w => ({ ...w, title: e.target.value }))}
                  placeholder="Enter webinar title…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#A855F7]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">Subtitle (optional)</label>
                <input
                  value={webinar.subtitle || ''}
                  onChange={e => setWebinar(w => ({ ...w, subtitle: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#A855F7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-2">Date</label>
                  <input
                    value={webinar.dateAr}
                    onChange={e => setWebinar(w => ({ ...w, dateAr: e.target.value }))}
                    placeholder="الثلاثاء، ١٥ يناير"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2">Time</label>
                  <input
                    value={webinar.timeAr}
                    onChange={e => setWebinar(w => ({ ...w, timeAr: e.target.value }))}
                    placeholder="٧:٠٠ مساءً"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Platform */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Platform</label>
                <div className="flex gap-2 flex-wrap">
                  {PLATFORMS.map(p => (
                    <button key={p}
                      onClick={() => setWebinar(w => ({ ...w, platform: p }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        webinar.platform === p ? 'bg-[#A855F7] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Booking URL + QR */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Registration Link (generates QR code)</label>
                <input
                  value={webinar.bookingUrl}
                  onChange={e => setWebinar(w => ({ ...w, bookingUrl: e.target.value }))}
                  placeholder="https://t.me/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#A855F7]"
                  dir="ltr"
                />
                {qrLoading && <p className="text-xs text-white/30 mt-1">Generating QR…</p>}
                {webinar.qrDataUrl && (
                  <div className="mt-2 flex justify-center">
                    <img src={webinar.qrDataUrl} alt="QR" className="w-20 h-20 rounded-lg border border-[#C9A84C]/30" />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(webinar.tags || []).map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-[#A855F7]/20 border border-[#A855F7]/40 rounded-lg text-xs text-[#A855F7]">
                      {tag}
                      <button onClick={() => setWebinar(w => ({ ...w, tags: (w.tags || []).filter((_, j) => j !== i) }))}
                        className="hover:text-red-400"><Trash2 size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { setWebinar(w => ({ ...w, tags: [...(w.tags||[]), newTag.trim()] })); setNewTag(''); } }}
                    placeholder="Add tag…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                  />
                  <button
                    onClick={() => { if (newTag.trim()) { setWebinar(w => ({ ...w, tags: [...(w.tags||[]), newTag.trim()] })); setNewTag(''); } }}
                    className="px-3 py-1.5 bg-white/10 rounded-xl text-xs hover:bg-white/15">
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Host name */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Host Name (optional)</label>
                <input
                  value={webinar.hostName || ''}
                  onChange={e => setWebinar(w => ({ ...w, hostName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {/* Presenter photo upload */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Presenter Photo (optional — for AI design)</label>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-3 hover:border-[#A855F7]/50 transition-colors">
                  <User size={15} className="text-white/30 shrink-0" />
                  <span className="text-sm text-white/40">
                    {webinar.presenterImage ? 'Uploaded ✓ — click to change' : 'Upload presenter photo for AI design'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) { const b64 = await fileToBase64(f); setWebinar(w => ({ ...w, presenterImage: b64 })); }
                    }} />
                </label>
                {webinar.presenterImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={webinar.presenterImage} alt="presenter" className="w-12 h-12 rounded-full object-cover border-2 border-[#A855F7]/50" />
                    <button onClick={() => setWebinar(w => ({ ...w, presenterImage: undefined }))}
                      className="text-xs text-white/30 hover:text-red-400 transition-colors flex items-center gap-1">
                      <X size={12} /> Remove
                    </button>
                  </div>
                )}
              </div>

              {/* AI Design button */}
              <div className="pt-1">
                <button
                  onClick={handleGenerateWebinar}
                  disabled={generatingWebinar || !webinar.title.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  style={{
                    background: generatingWebinar
                      ? 'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)'
                      : 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #9333ea 100%)',
                    border: '1px solid #a855f760',
                    color: '#f3e8ff',
                    boxShadow: generatingWebinar ? 'none' : '0 0 20px #7c3aed40',
                  }}
                >
                  {generatingWebinar ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-[#f3e8ff] border-t-transparent animate-spin" />
                      Generating with ChatGPT Image…
                    </>
                  ) : (
                    <>
                      <ImageIcon size={16} />
                      AI Professional Design ✨
                    </>
                  )}
                </button>
                <p className="text-[10px] text-white/20 text-center mt-1">
                  Uses GPT Image to create a professional Marsad Al Souq design
                </p>

                {/* Reset AI design */}
                {aiWebinarImage && activeTab === 'webinar' && (
                  <button
                    onClick={() => setAiWebinarImage('')}
                    className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-white/30 hover:text-red-400 border border-white/5 hover:border-red-400/20 transition-all"
                  >
                    <X size={11} /> Cancel AI Design — use default card
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Action buttons ────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-[#0a0a0a] pb-1">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title="Downloads Arabic + English versions">
              <Download size={14} />
              Download AR + EN
            </button>
            <button onClick={openMetricool} disabled={!activeImageUrl}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-medium bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-40">
              <Radio size={14} />
              Metricool
            </button>
            <button onClick={() => setTgLangModalOpen(true)} disabled={publishing}
              style={{ backgroundColor: accent + '20', borderColor: accent + '60', color: accent }}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-medium border transition-all hover:opacity-80 disabled:opacity-50">
              <Send size={14} />
              {publishing ? 'Posting…' : 'Telegram'}
            </button>
          </div>
        </div>

        {/* ── Preview panel — split AR / EN ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-[#060606] py-6 px-4">
          <div className="flex gap-5 justify-center min-w-0 flex-wrap xl:flex-nowrap">

            {/* ── Arabic preview ─────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-3 min-w-0" style={{ maxWidth: 320 }}>
              {/* Header */}
              <div className="flex items-center gap-2 self-stretch justify-between">
                <span className="text-[10px] font-mono text-white/25 tracking-wide">AR · عربي</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/25">
                  1080 × 1350
                </span>
              </div>

              {/* Card image */}
              {activeTab === 'webinar' && aiWebinarImage ? (
                <img src={aiWebinarImage} alt="AR Webinar" className="rounded-2xl shadow-2xl border border-[#C9A84C]/20 w-full" />
              ) : arDataUrl ? (
                <img src={arDataUrl} alt="AR Card" className="rounded-2xl shadow-2xl border border-[#C9A84C]/20 w-full" />
              ) : (
                <div className="rounded-2xl bg-[#0D1B2A] border border-white/10 flex items-center justify-center w-full"
                  style={{ aspectRatio: '1080/1350' }}>
                  <div className="flex flex-col items-center gap-2 text-white/25">
                    <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-[#C9A84C]" />
                    <p className="text-xs">Rendering AR…</p>
                  </div>
                </div>
              )}

              {/* AR Caption editor */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-white/35">Arabic Caption</label>
                  <button onClick={() => setArCaption(generateCardCaption('ar', activeTab, signal, calendar, pot, webinar))}
                    className="text-[9px] text-[#C9A84C]/60 hover:text-[#C9A84C] transition-colors">↺ Reset</button>
                </div>
                <textarea
                  value={arCaption}
                  onChange={e => setArCaption(e.target.value)}
                  rows={8}
                  dir="rtl"
                  className="w-full bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/75 leading-relaxed resize-none focus:outline-none focus:border-[#C9A84C]/50 font-['Cairo',sans-serif]"
                  placeholder="سيتم توليد الكابشن تلقائياً…"
                />
              </div>
            </div>

            {/* ── English preview ─────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-3 min-w-0" style={{ maxWidth: 320 }}>
              {/* Header */}
              <div className="flex items-center gap-2 self-stretch justify-between">
                <span className="text-[10px] font-mono text-white/25 tracking-wide">EN · English</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25">
                  1080 × 1350
                </span>
              </div>

              {/* Card image */}
              {activeTab === 'webinar' && aiWebinarImage ? (
                <img src={aiWebinarImage} alt="EN Webinar" className="rounded-2xl shadow-2xl border border-blue-500/20 w-full" />
              ) : enDataUrl ? (
                <img src={enDataUrl} alt="EN Card" className="rounded-2xl shadow-2xl border border-blue-500/20 w-full" />
              ) : (
                <div className="rounded-2xl bg-[#0D1B2A] border border-white/10 flex items-center justify-center w-full"
                  style={{ aspectRatio: '1080/1350' }}>
                  <div className="flex flex-col items-center gap-2 text-white/25">
                    <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-blue-500" />
                    <p className="text-xs">Rendering EN…</p>
                  </div>
                </div>
              )}

              {/* EN Caption editor */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-white/35">English Caption</label>
                  <button onClick={() => setEnCaption(generateCardCaption('en', activeTab, signal, calendar, pot, webinar))}
                    className="text-[9px] text-blue-400/60 hover:text-blue-400 transition-colors">↺ Reset</button>
                </div>
                <textarea
                  value={enCaption}
                  onChange={e => setEnCaption(e.target.value)}
                  rows={8}
                  className="w-full bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/75 leading-relaxed resize-none focus:outline-none focus:border-blue-500/50"
                  placeholder="Caption will be auto-generated…"
                />
              </div>
            </div>

          </div>
          <p className="mt-5 text-xs text-white/15 text-center">
            Cards update automatically as you edit · Captions are editable
          </p>
        </div>
      </div>

      {/* ── Metricool Modal ──────────────────────────────────────────────────── */}
      {metricoolOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setMetricoolOpen(false)}>
          <div className="glass rounded-2xl w-full max-w-md p-8 space-y-6 border border-purple-500/20 shadow-2xl"
            onClick={e => e.stopPropagation()}>
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
                <span className="text-sm uppercase tracking-widest">Connecting to Metricool…</span>
              </div>
            ) : mcSuccess ? (
              <div className="py-10 text-center space-y-4">
                <div className="text-4xl">✓</div>
                <p className="font-bold text-green-400 uppercase tracking-widest text-sm">Post Sent Successfully!</p>
                <p className="text-white/40 text-xs">Check your Metricool planner dashboard to confirm.</p>
                <button onClick={() => { setMetricoolOpen(false); setMcSuccess(false); }} className="btn-primary px-8">Done</button>
              </div>
            ) : (
              <>
                {/* Language selector */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Card Language</label>
                  <div className="flex gap-2">
                    {(['ar', 'en'] as const).map(l => (
                      <button key={l} onClick={() => setPublishLang(l)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                          publishLang === l
                            ? l === 'ar' ? 'bg-[#C9A84C]/20 border-[#C9A84C]/60 text-[#C9A84C]' : 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                        }`}>
                        {l === 'ar' ? '🇸🇦 Arabic' : '🇬🇧 English'}
                      </button>
                    ))}
                  </div>
                </div>

                {mcBrands.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40">Brand</label>
                    <select value={mcSelectedBrand?.id ?? ''}
                      onChange={e => { const b = mcBrands.find(b => String(b.id) === e.target.value); if (b) handleBrandChange(b); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500">
                      {mcBrands.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                )}

                {mcSelectedBrand && (() => {
                  const nets = getConnectedNetworks(mcSelectedBrand);
                  return nets.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Networks</label>
                      <div className="flex flex-wrap gap-2">
                        {nets.map(({ key, label, handle }) => {
                          const selected = mcSelectedNetworks.includes(key);
                          return (
                            <button key={key} onClick={() => toggleNetwork(key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selected ? 'bg-purple-500/30 border-purple-500/60 text-purple-300' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}>
                              {label}<span className="ml-1.5 font-normal opacity-60">@{handle}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Caption Preview</label>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white/70 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap"
                    dir={publishLang === 'ar' ? 'rtl' : 'ltr'}>
                    {publishLang === 'ar' ? arCaption : enCaption}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">
                    Schedule Date &amp; Time <span className="text-white/20">(leave blank to post now)</span>
                  </label>
                  <input type="datetime-local" value={mcScheduledAt} onChange={e => setMcScheduledAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500" />
                </div>

                {mcError && (
                  <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle size={14} /><span>{mcError}</span>
                  </div>
                )}

                <button onClick={handleMetricoolSend}
                  disabled={mcLoading || mcSelectedNetworks.length === 0}
                  className="w-full py-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {mcLoading
                    ? <><Loader2 className="animate-spin" size={16} /> Sending…</>
                    : <><Radio size={16} /> {mcScheduledAt ? 'Schedule Post' : 'Post Now'}</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Telegram language picker modal ──────────────────────────────────── */}
      {tgLangModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setTgLangModalOpen(false)}>
          <div className="glass rounded-2xl w-full max-w-sm p-7 space-y-5 border border-[#C9A84C]/20 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send size={18} className="text-[#C9A84C]" />
                <h3 className="font-bold text-base tracking-tight">Send to Telegram</h3>
              </div>
              <button onClick={() => setTgLangModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Select Card Language</label>
              <div className="flex gap-3">
                {(['ar', 'en'] as const).map(l => (
                  <button key={l} onClick={() => setPublishLang(l)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                      publishLang === l
                        ? l === 'ar' ? 'bg-[#C9A84C]/20 border-[#C9A84C]/60 text-[#C9A84C]' : 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}>
                    {l === 'ar' ? '🇸🇦 Arabic' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-white/40">Caption Preview</label>
              <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-xs text-white/65 leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap"
                dir={publishLang === 'ar' ? 'rtl' : 'ltr'}>
                {publishLang === 'ar' ? arCaption : enCaption}
              </div>
            </div>

            <button onClick={handlePublish} disabled={publishing}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C20', borderColor: '#C9A84C60', border: '1px solid', color: '#C9A84C' }}>
              {publishing
                ? <><div className="w-4 h-4 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" /> Posting…</>
                : <><Send size={15} /> Send {publishLang === 'ar' ? 'Arabic' : 'English'} Card</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Off-screen canvases — AR + EN, invisible, render at full 1080×1350 ── */}
      <div aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        {/* Arabic version */}
        <BrandedCanvas
          backgroundImage={null} storyImage={null} headline=""
          accentColor={activeBrand.accentColor}
          logoUrl={brandSettings?.logoUrl || ''}
          tagline={brandSettings?.fixedTagline || ''}
          disclaimer={brandSettings?.footerDisclaimer || ''}
          language="ar"
          width={1080} height={1350}
          brandId="marsad-alsouq"
          cardType={activeTab}
          cardLang="ar"
          cardData={activeTab === 'calendar' ? { ...calendar, events: calendar.events.filter(e => !(e as any)._hidden) } : currentCardData}
          onExport={setArDataUrl}
        />
        {/* English version */}
        <BrandedCanvas
          backgroundImage={null} storyImage={null} headline=""
          accentColor={activeBrand.accentColor}
          logoUrl={brandSettings?.logoUrl || ''}
          tagline={brandSettings?.fixedTagline || ''}
          disclaimer={brandSettings?.footerDisclaimer || ''}
          language="ar"
          width={1080} height={1350}
          brandId="marsad-alsouq"
          cardType={activeTab}
          cardLang="en"
          cardData={activeTab === 'calendar' ? { ...calendar, events: calendar.events.filter(e => !(e as any)._hidden) } : currentCardData}
          onExport={setEnDataUrl}
        />
      </div>
    </div>
  );
}
