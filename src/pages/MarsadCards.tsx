import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Download, RefreshCw, Plus, Trash2, Zap, Calendar, TrendingUp, Radio, ChevronRight } from 'lucide-react';
import { useBrandStore } from '../context/BrandContext';
import { fetchWithAuth } from '../lib/api';
import BrandedCanvas from '../components/BrandedCanvas';
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
const PLATFORMS   = ['تيليغرام', 'زوم', 'يوتيوب', 'أخرى'];

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
  return { title: '', dateAr: '', timeAr: '', platform: 'تيليغرام', bookingUrl: '', tags: [] };
}
function emptyCalendar(): CalendarData {
  return { date: TODAY, events: [] };
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS: { id: CardType; label: string; icon: typeof Zap; color: string }[] = [
  { id: 'signal',          label: 'إشارة تداول',       icon: TrendingUp, color: '#C9A84C' },
  { id: 'calendar',        label: 'الأجندة الاقتصادية', icon: Calendar,   color: '#2AABEE' },
  { id: 'proof-of-trades', label: 'إثبات الصفقات',     icon: Zap,        color: '#10B981' },
  { id: 'webinar',         label: 'إعلان ندوة',        icon: Radio,      color: '#A855F7' },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function MarsadCards() {
  const { activeBrand } = useBrandStore();
  const { toast, show: showToast } = useToast();

  const [activeTab, setActiveTab]   = useState<CardType>('signal');
  const [brandSettings, setBrandSettings] = useState<any>({});
  const [cardDataUrl, setCardDataUrl]      = useState<string>('');
  const [publishing, setPublishing]        = useState(false);

  // Per-tab data
  const [signal,  setSignal]  = useState<SignalData>(emptySignal());
  const [calendar, setCalendar] = useState<CalendarData>(emptyCalendar());
  const [pot,     setPot]     = useState<ProofOfTradesData>(emptyPOT());
  const [webinar, setWebinar] = useState<WebinarData>(emptyWebinar());

  // Calendar fetch
  const [calLoading, setCalLoading] = useState(false);
  // Webinar QR
  const [qrLoading, setQrLoading] = useState(false);
  // New tag input
  const [newTag, setNewTag] = useState('');

  // ── Load brand settings (for logo) ───────────────────────────────────────
  useEffect(() => {
    fetchWithAuth(`/api/settings/${activeBrand.settingsKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.value) setBrandSettings(d.value); })
      .catch(() => {});
  }, [activeBrand.settingsKey]);

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
      showToast('success', `تم جلب ${events.length} حدث`);
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setCalLoading(false);
    }
  }, [calendar.date, showToast]);

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

  // ── Download PNG ──────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!cardDataUrl) return showToast('info', 'انتظر تحميل البطاقة…');
    const a = document.createElement('a');
    a.href = cardDataUrl;
    a.download = `marsad-${activeTab}-${Date.now()}.jpg`;
    a.click();
  }, [cardDataUrl, activeTab, showToast]);

  // ── Publish to Telegram ───────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!cardDataUrl) return showToast('info', 'انتظر تحميل البطاقة…');
    setPublishing(true);
    try {
      // Convert data URL → blob → upload
      const blob = await (await fetch(cardDataUrl)).blob();
      const form = new FormData();
      form.append('file', blob, `marsad-${activeTab}.jpg`);

      const upRes = await fetchWithAuth('/api/upload-brand-asset', { method: 'POST', body: form, headers: {} as any });
      if (!upRes.ok) throw new Error('فشل رفع الصورة');
      const { url } = await upRes.json();

      const caption = activeTab === 'signal'
        ? `${signal.pair} ${signal.direction}\nدخول: ${signal.entry}  |  وقف: ${signal.stopLoss}  |  هدف: ${signal.takeProfit}\nالنسبة: ${signal.rrRatio}${signal.setupNotes ? '\n' + signal.setupNotes : ''}`
        : activeTab === 'calendar'
          ? `الأجندة الاقتصادية — ${calendar.date}`
          : activeTab === 'proof-of-trades'
            ? `إثبات الصفقات — ${pot.period}\nالإجمالي: ${pot.totalProfit >= 0 ? '+' : ''}${pot.totalProfit} $`
            : `${webinar.title}\n${webinar.dateAr}  |  ${webinar.timeAr}\n${webinar.bookingUrl}`;

      const tgRes = await fetchWithAuth('/api/telegram/send', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: url, caption, brandId: activeBrand.id }),
      });
      if (!tgRes.ok) throw new Error((await tgRes.json()).error);
      showToast('success', 'تم النشر على تيليغرام ✓');
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setPublishing(false);
    }
  }, [cardDataUrl, activeTab, signal, calendar, pot, webinar, activeBrand.id, showToast]);

  // ── Image file → base64 ───────────────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  // ── Current card data for canvas ─────────────────────────────────────────
  const currentCardData = activeTab === 'signal' ? signal
    : activeTab === 'calendar' ? calendar
    : activeTab === 'proof-of-trades' ? pot
    : webinar;

  // ── Preview scale ─────────────────────────────────────────────────────────
  const PREVIEW_W = 360;
  const scale = PREVIEW_W / 1080;

  const accent = activeBrand.accentColor;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div dir="rtl" className="flex flex-col h-full overflow-hidden bg-[#0a0a0a] text-white">

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
              onClick={() => setActiveTab(tab.id)}
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
                <label className="block text-xs text-white/40 mb-2">الأداة المالية</label>
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
                  placeholder="أو اكتب رمزاً (EURUSD…)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Asset type */}
              <div>
                <label className="block text-xs text-white/40 mb-2">نوع الأصل</label>
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
                  <label className="block text-xs text-white/40 mb-2">الاتجاه</label>
                  <div className="flex gap-2">
                    {(['BUY','SELL'] as const).map(d => (
                      <button key={d}
                        onClick={() => setSignal(s => ({ ...s, direction: d }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                          signal.direction === d
                            ? d === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                            : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}>
                        {d === 'BUY' ? '▲ شراء' : '▼ بيع'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2">الإطار الزمني</label>
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
                  { label: 'سعر الدخول', key: 'entry',     color: '#C9A84C' },
                  { label: 'وقف الخسارة', key: 'stopLoss', color: '#EF4444' },
                  { label: 'جني الأرباح', key: 'takeProfit',color: '#10B981' },
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
                <span className="text-xs text-white/50">نسبة المخاطرة:</span>
                <span className="font-bold text-[#C9A84C] font-mono">{signal.rrRatio}</span>
              </div>

              {/* Setup notes */}
              <div>
                <label className="block text-xs text-white/40 mb-2">ملاحظات الإعداد (اختياري)</label>
                <textarea
                  value={signal.setupNotes || ''}
                  onChange={e => setSignal(s => ({ ...s, setupNotes: e.target.value }))}
                  placeholder="اكتب وصفاً للإشارة بالعربية…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Chart image upload */}
              <div>
                <label className="block text-xs text-white/40 mb-2">لقطة الرسم البياني (اختياري)</label>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-3 hover:border-[#C9A84C]/50 transition-colors">
                  <ChevronRight size={16} className="text-white/30" />
                  <span className="text-sm text-white/40">
                    {signal.chartImage ? 'تم رفع الصورة ✓' : 'اضغط لرفع لقطة الشاشة'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) setSignal(s => ({ ...s, chartImage: undefined }));
                      if (f) { const b64 = await fileToBase64(f); setSignal(s => ({ ...s, chartImage: b64 })); }
                    }} />
                </label>
              </div>
            </>
          )}

          {/* ── CALENDAR FORM ─────────────────────────────────────────────── */}
          {activeTab === 'calendar' && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-white/40 mb-2">التاريخ</label>
                  <input type="date"
                    value={calendar.date}
                    onChange={e => setCalendar(c => ({ ...c, date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2AABEE]"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={fetchCalendar} disabled={calLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2AABEE]/20 border border-[#2AABEE]/40 text-[#2AABEE] rounded-xl text-sm font-medium hover:bg-[#2AABEE]/30 transition-colors disabled:opacity-50">
                    <RefreshCw size={14} className={calLoading ? 'animate-spin' : ''} />
                    {calLoading ? 'جارٍ الجلب…' : 'جلب البيانات'}
                  </button>
                </div>
              </div>

              {calendar.events.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-white/40">الأحداث ({calendar.events.length}) — اختر ما يُعرض</label>
                    <div className="flex gap-1">
                      {(['high','medium','low'] as const).map(imp => (
                        <button key={imp}
                          onClick={() => setCalendar(c => ({ ...c, events: c.events.map(ev => ev.impact === imp ? { ...ev, _hidden: !(ev as any)._hidden } : ev) as CalendarEvent[] }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            imp === 'high' ? 'bg-red-500/20 text-red-400' : imp === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                          {imp === 'high' ? 'عالي' : imp === 'medium' ? 'متوسط' : 'منخفض'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
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
                        <span className="text-[10px] text-white/30 font-mono">{ev.time}</span>
                        <span className="text-[10px] text-white/30">{ev.country}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {calendar.events.length === 0 && (
                <div className="text-center py-8 text-white/20 text-sm">
                  اضغط "جلب البيانات" لتحميل أحداث اليوم
                </div>
              )}
            </>
          )}

          {/* ── PROOF OF TRADES FORM ──────────────────────────────────────── */}
          {activeTab === 'proof-of-trades' && (
            <>
              <div>
                <label className="block text-xs text-white/40 mb-2">الفترة الزمنية</label>
                <input
                  value={pot.period}
                  onChange={e => setPot(p => ({ ...p, period: e.target.value }))}
                  placeholder="مثال: أبريل 2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#10B981]"
                />
              </div>

              {/* Screenshot upload */}
              <div>
                <label className="block text-xs text-white/40 mb-2">لقطة شاشة MT5 (اختياري)</label>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-3 hover:border-[#10B981]/50 transition-colors">
                  <span className="text-sm text-white/40">
                    {pot.screenshotImage ? 'تم رفع الصورة ✓' : 'اضغط لرفع لقطة الشاشة'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) { const b64 = await fileToBase64(f); setPot(p => ({ ...p, screenshotImage: b64 })); }
                    }} />
                </label>
              </div>

              {/* Trade rows */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-white/40">الصفقات ({pot.trades.length})</label>
                  <button
                    onClick={() => setPot(p => ({ ...p, trades: [...p.trades, emptyTrade()] }))}
                    className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#10B981]/80">
                    <Plus size={12} /> إضافة صفقة
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
                          placeholder="الرمز"
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
                          { label: 'الحجم', key: 'lots', step: '0.01' },
                          { label: 'الدخول', key: 'entryPrice', step: '0.01' },
                          { label: 'الإغلاق', key: 'closePrice', step: '0.01' },
                          { label: 'الربح $', key: 'profit', step: '0.01' },
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
                  <span className="text-xs text-white/50">الإجمالي:</span>
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
                <label className="block text-xs text-white/40 mb-2">عنوان الندوة *</label>
                <textarea
                  value={webinar.title}
                  onChange={e => setWebinar(w => ({ ...w, title: e.target.value }))}
                  placeholder="اكتب عنوان الندوة بالعربية…"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#A855F7]"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">عنوان فرعي (اختياري)</label>
                <input
                  value={webinar.subtitle || ''}
                  onChange={e => setWebinar(w => ({ ...w, subtitle: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#A855F7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-2">التاريخ (عربي)</label>
                  <input
                    value={webinar.dateAr}
                    onChange={e => setWebinar(w => ({ ...w, dateAr: e.target.value }))}
                    placeholder="الثلاثاء، ١٥ يناير"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2">الوقت (عربي)</label>
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
                <label className="block text-xs text-white/40 mb-2">المنصة</label>
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
                <label className="block text-xs text-white/40 mb-2">رابط التسجيل (سيتحوّل لرمز QR)</label>
                <input
                  value={webinar.bookingUrl}
                  onChange={e => setWebinar(w => ({ ...w, bookingUrl: e.target.value }))}
                  placeholder="https://t.me/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#A855F7]"
                  dir="ltr"
                />
                {qrLoading && <p className="text-xs text-white/30 mt-1">جارٍ توليد QR…</p>}
                {webinar.qrDataUrl && (
                  <div className="mt-2 flex justify-center">
                    <img src={webinar.qrDataUrl} alt="QR" className="w-20 h-20 rounded-lg border border-[#C9A84C]/30" />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs text-white/40 mb-2">الوسوم</label>
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
                    placeholder="أضف وسماً…"
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
                <label className="block text-xs text-white/40 mb-2">اسم المقدِّم (اختياري)</label>
                <input
                  value={webinar.hostName || ''}
                  onChange={e => setWebinar(w => ({ ...w, hostName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </>
          )}

          {/* ── Action buttons ────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-[#0a0a0a] pb-1">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <Download size={15} />
              تحميل PNG
            </button>
            <button onClick={handlePublish} disabled={publishing}
              style={{ backgroundColor: accent + '20', borderColor: accent + '60', color: accent }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50">
              <Send size={15} />
              {publishing ? 'جارٍ النشر…' : 'نشر على تيليغرام'}
            </button>
          </div>
        </div>

        {/* ── Preview panel ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start py-8 px-4 bg-[#060606]">
          <div className="mb-4 text-xs text-white/25 font-mono tracking-wide">معاينة البطاقة • 1080 × 1620</div>

          {/* Scaled canvas wrapper */}
          <div
            className="relative shadow-2xl rounded-xl overflow-hidden"
            style={{
              width:  PREVIEW_W,
              height: Math.round(PREVIEW_W * (1620 / 1080)),
            }}
          >
            <div
              style={{
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
                width: 1080,
                height: 1620,
              }}
            >
              <BrandedCanvas
                backgroundImage={null}
                storyImage={null}
                headline=""
                accentColor={activeBrand.accentColor}
                logoUrl={brandSettings?.logoUrl || ''}
                tagline=""
                disclaimer=""
                language="ar"
                width={1080}
                height={1620}
                brandId="marsad-alsouq"
                cardType={activeTab}
                cardData={
                  activeTab === 'calendar'
                    ? { ...calendar, events: calendar.events.filter(e => !(e as any)._hidden) }
                    : currentCardData
                }
                onExport={setCardDataUrl}
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-white/20 text-center max-w-[300px]">
            البطاقة تُحدَّث تلقائياً عند تغيير البيانات
          </p>
        </div>
      </div>
    </div>
  );
}
