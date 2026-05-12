// ── Marsad Al Souq Card Types ─────────────────────────────────────────────────

export type CardType = 'signal' | 'calendar' | 'proof-of-trades' | 'webinar';

// ── Signal Card ───────────────────────────────────────────────────────────────
export interface SignalData {
  pair: string;           // "NZDUSD", "XAUUSD"
  direction: 'BUY' | 'SELL';
  assetType: 'Forex' | 'Crypto' | 'Indices' | 'Commodities';
  timeframe: string;      // "H1", "H4", "D1", "W1"
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: string;        // "1:2.50" — auto-calculated in UI
  setupNotes?: string;    // Arabic setup description
  chartImage?: string;    // base64 data URL from file upload
}

// ── Economic Calendar Card ────────────────────────────────────────────────────
export interface CalendarEvent {
  time: string;           // "14:30"
  country: string;        // "US" | "EUR" | "GBP" etc.
  event: string;          // event name (may be English from FMP)
  actual?: string;
  forecast?: string;
  previous?: string;
  impact: 'high' | 'medium' | 'low';
  result?: 'beat' | 'miss' | 'neutral';  // derived from actual vs forecast
}

export interface CalendarData {
  date: string;           // "2024-01-15" ISO date
  events: CalendarEvent[];
}

// ── Proof of Trades Card ──────────────────────────────────────────────────────
export interface TradeEntry {
  id: string;             // unique key for React lists
  symbol: string;         // "XAUUSD"
  direction: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  closePrice: number;
  profit: number;         // positive or negative
}

export interface ProofOfTradesData {
  period: string;         // "أبريل 2024"
  trades: TradeEntry[];
  totalProfit: number;    // auto-summed from trades
  screenshotImage?: string; // optional MT5 screenshot base64
}

// ── Webinar / Event Card ──────────────────────────────────────────────────────
export interface WebinarData {
  title: string;          // Arabic event title
  subtitle?: string;      // optional subtitle
  dateAr: string;         // "الثلاثاء، ١٥ يناير ٢٠٢٥"
  timeAr: string;         // "٧:٠٠ مساءً"
  platform: string;       // "تيليغرام" | "زوم" | "يوتيوب"
  bookingUrl: string;     // generates QR code
  qrDataUrl?: string;     // base64 QR image (fetched from /api/marsad/qrcode)
  tags?: string[];        // ["مجاني", "تحليل فني"]
  hostName?: string;      // presenter name
}
