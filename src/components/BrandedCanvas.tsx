import { useEffect, useRef } from 'react';
import marsadIconUrl from '../assets/marsad-icon.svg';
import type { CardType, SignalData, CalendarData, CalendarEvent, ProofOfTradesData, TradeEntry, WebinarData } from '../types/marsad-cards';

interface BrandedCanvasProps {
  backgroundImage: string | null;
  storyImage: string | null;
  headline: string;
  accentColor: string;
  logoUrl: string;
  logoSize?: number;
  logoPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  tagline: string;
  disclaimer: string;
  disclaimer2?: string;
  language: 'en' | 'ar';
  width?: number;
  height?: number;
  brandId?: string;
  /** Card type for Marsad Al Souq specialized cards (signal / calendar / proof-of-trades / webinar) */
  cardType?: CardType;
  /** Typed data for the selected card type */
  cardData?: SignalData | CalendarData | ProofOfTradesData | WebinarData;
  onExport?: (dataUrl: string) => void;
}

// ── Core helpers ─────────────────────────────────────────────────────────────

const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });

const coverFit = (img: HTMLImageElement, cw: number, ch: number) => {
  const ir = img.width / img.height;
  const cr = cw / ch;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > cr) {
    dh = ch; dw = img.width * (ch / img.height);
    dx = (cw - dw) / 2; dy = 0;
  } else {
    dw = cw; dh = img.height * (cw / img.width);
    dx = 0; dy = (ch - dh) / 2;
  }
  return { dw, dh, dx, dy };
};

/** Draw a rounded rectangle path — does NOT fill or stroke */
const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
};

/** Wrap text into lines that fit within maxWidth; returns array of strings */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Shared Marsad frame / header / footer helpers ─────────────────────────────

const GOLD  = '#C9A84C';
const GOLD2 = '#E8C574';
const PAD   = 44;

/** Draw outer matte + inner navy gradient card; returns card bounds */
function drawMarsadBg(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const frame = 10, rx = 14;
  const cardX = frame, cardY = frame;
  const cardW = width  - frame * 2;
  const cardH = height - frame * 2;

  ctx.fillStyle = '#070E1A';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, rx);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0,   '#152035');
  bgGrad.addColorStop(0.5, '#0D1B2A');
  bgGrad.addColorStop(1,   '#070E1A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  return { cardX, cardY, cardW, cardH };
}

/** Scope icon + "مرصد السوق" + separator; returns ruleY */
async function drawMarsadScopeHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  cardX: number, cardY: number, cardW: number
): Promise<number> {
  const iconSize = 52;
  const iconX = cardX + cardW - PAD - iconSize;
  const iconY = cardY + 28;
  const iconImg = await loadImg(marsadIconUrl);
  if (iconImg.width > 0) {
    ctx.save();
    roundedRectPath(ctx, iconX, iconY, iconSize, iconSize, 10);
    ctx.clip();
    ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  }

  const fontSz = Math.round(width * 0.052);
  ctx.save();
  ctx.shadowColor  = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur   = 14;
  ctx.font         = `900 ${fontSz}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'rtl';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = GOLD;
  ctx.fillText('مرصد السوق', cardX + cardW - PAD, cardY + 34);
  ctx.restore();

  const ruleY = cardY + 34 + fontSz * 1.1 + 8;
  ctx.strokeStyle = GOLD + '40';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(cardX + PAD, ruleY);
  ctx.lineTo(cardX + cardW - PAD, ruleY);
  ctx.stroke();

  return ruleY;
}

/** Gold horizontal separator line */
function drawGoldRule(
  ctx: CanvasRenderingContext2D,
  cardX: number, y: number, cardW: number, opacity = 0.25
) {
  ctx.strokeStyle = GOLD + Math.round(opacity * 255).toString(16).padStart(2, '0');
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(cardX + PAD, y);
  ctx.lineTo(cardX + cardW - PAD, y);
  ctx.stroke();
}

/** Standard footer: separator + date (right) + logo (center) + "بدعم من" (left) */
async function drawMarsadFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  cardX: number, cardY: number, cardW: number, cardH: number,
  logoUrl: string
) {
  const footerY = cardY + cardH - 145;
  const footerH = 135;

  drawGoldRule(ctx, cardX, footerY, cardW, 0.18);

  // Date
  const dateStr = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.font         = `400 ${Math.round(width * 0.020)}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'rtl';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.55)';
  ctx.fillText(dateStr, cardX + cardW - PAD, footerY + footerH * 0.30);

  // Logo center
  if (logoUrl) {
    const logo = await loadImg(logoUrl);
    if (logo.width > 0) {
      const lh = 36, lw = (logo.width / logo.height) * lh;
      ctx.save();
      ctx.globalAlpha = 0.80;
      ctx.drawImage(logo, cardX + (cardW - lw) / 2, footerY + (footerH - lh) / 2, lw, lh);
      ctx.restore();
    }
  }

  // "بدعم من"
  ctx.font         = `400 ${Math.round(width * 0.019)}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'ltr';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.32)';
  ctx.fillText('بدعم من IST Markets', cardX + PAD, footerY + footerH * 0.70);

  // Card border
  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.strokeStyle = GOLD2 + '22';
  ctx.lineWidth   = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Draw a centered rounded pill; returns the rendered pill width */
function drawCenteredPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number, cy: number,
  fill: string, stroke: string, textColor: string,
  fontSize = 24, pillH = 52, rx = 14, paddingX = 28,
  fontWeight = '600', fontFamily = 'Cairo, Arial, sans-serif'
): number {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const tw = ctx.measureText(text).width;
  const pw = tw + paddingX * 2;
  const px = cx - pw / 2;
  const py = cy - pillH / 2;
  roundedRectPath(ctx, px, py, pw, pillH, rx);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
  return pw;
}

// ── Country flag colors for calendar ─────────────────────────────────────────
const COUNTRY_COLORS: Record<string, string> = {
  US: '#3C5D9C', EUR: '#003FA3', EU: '#003FA3',
  GB: '#012169', JP: '#BC002D', CH: '#D52B1E',
  CA: '#C8102E', AU: '#00008B', NZ: '#00247D',
  CN: '#DE2910', SA: '#006C35', AE: '#00732F',
  KW: '#007A3D', QA: '#8D1B3D',
};

// ══════════════════════════════════════════════════════════════════════════════
//  MARSAD SIGNAL CARD
// ══════════════════════════════════════════════════════════════════════════════

async function renderMarsadSignal(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  data: SignalData,
  logoUrl: string
) {
  try { await document.fonts.load('900 60px Cairo'); } catch { /* ignore */ }

  const { cardX, cardY, cardW, cardH } = drawMarsadBg(ctx, width, height);
  const cx = cardX + cardW / 2;

  await drawMarsadScopeHeader(ctx, width, cardX, cardY, cardW);

  // ── Asset type + Timeframe pills (y ≈ 175) ──────────────────────────────
  const pillY  = cardY + 185;
  const pillH  = 46;
  const pillGap = 14;

  ctx.font = `600 22px Cairo, Arial, sans-serif`;
  const assetW = ctx.measureText(data.assetType).width + 44;
  const tfW    = ctx.measureText(data.timeframe).width + 44;
  const totalPW = assetW + pillGap + tfW;
  let px = cx - totalPW / 2;

  // Asset pill (gold tint)
  roundedRectPath(ctx, px, pillY - pillH / 2, assetW, pillH, 10);
  ctx.fillStyle = GOLD + '1A'; ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(data.assetType, px + assetW / 2, pillY);

  px += assetW + pillGap;

  // Timeframe pill (blue tint)
  roundedRectPath(ctx, px, pillY - pillH / 2, tfW, pillH, 10);
  ctx.fillStyle = 'rgba(30,136,229,0.15)'; ctx.fill();
  ctx.strokeStyle = '#1E88E5'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#90CAF9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(data.timeframe, px + tfW / 2, pillY);

  // ── Pair name (y ≈ 255) ──────────────────────────────────────────────────
  ctx.font         = `900 88px Cairo, Arial, sans-serif`;
  ctx.direction    = 'ltr';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle    = '#FFFFFF';
  ctx.shadowColor  = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur   = 20;
  ctx.fillText(data.pair, cx, cardY + 240);
  ctx.shadowColor  = 'transparent'; ctx.shadowBlur = 0;

  // ── Direction pill (y ≈ 380) ─────────────────────────────────────────────
  const isBuy    = data.direction === 'BUY';
  const dirColor = isBuy ? '#10B981' : '#DC2626';
  const dirBg    = isBuy ? 'rgba(16,185,129,0.18)' : 'rgba(220,38,38,0.18)';
  const dirLabel = isBuy ? '▲   BUY  /  شراء' : '▼   SELL  /  بيع';
  ctx.font = `700 30px Cairo, Arial, sans-serif`;
  const dirW = ctx.measureText(dirLabel).width + 70;
  const dirH = 62;
  const dirX = cx - dirW / 2;
  const dirBaseY = cardY + 380;
  roundedRectPath(ctx, dirX, dirBaseY, dirW, dirH, 16);
  ctx.fillStyle = dirBg; ctx.fill();
  ctx.strokeStyle = dirColor; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = dirColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dirLabel, cx, dirBaseY + dirH / 2);

  // ── Chart zone (y = 465 → 985) ───────────────────────────────────────────
  const chartX = cardX + PAD;
  const chartY = cardY + 465;
  const chartW = cardW - PAD * 2;
  const chartH = 520;

  ctx.save();
  roundedRectPath(ctx, chartX, chartY, chartW, chartH, 10);
  ctx.clip();

  if (data.chartImage) {
    const img = await loadImg(data.chartImage);
    if (img.width > 0) {
      const { dw, dh, dx, dy } = coverFit(img, chartW, chartH);
      ctx.drawImage(img, chartX + dx, chartY + dy, dw, dh);
    }
  } else {
    ctx.fillStyle = '#0A1628';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const gy = chartY + (chartH / 6) * i;
      ctx.beginPath(); ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy); ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      const gx = chartX + (chartW / 8) * i;
      ctx.beginPath(); ctx.moveTo(gx, chartY); ctx.lineTo(gx, chartY + chartH); ctx.stroke();
    }
    ctx.font = `400 28px Cairo, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillText('لقطة الرسم البياني', chartX + chartW / 2, chartY + chartH / 2);
  }
  ctx.restore();

  // Chart border
  roundedRectPath(ctx, chartX, chartY, chartW, chartH, 10);
  ctx.strokeStyle = GOLD + '30'; ctx.lineWidth = 1; ctx.stroke();

  // ── 3 Level cards (y = 1005 → 1155) ─────────────────────────────────────
  // RTL visual order: Target (left) | Stop (middle) | Entry (right)
  const lcY   = cardY + 1005;
  const lcH   = 150;
  const avail = cardW - PAD * 2;
  const lcGap = 18;
  const lcW   = Math.floor((avail - lcGap * 2) / 3);

  const levels = [
    { label: 'هدف',  value: data.takeProfit, color: '#10B981', bg: 'rgba(16,185,129,0.12)',  x: cardX + PAD },
    { label: 'وقف',  value: data.stopLoss,   color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   x: cardX + PAD + lcW + lcGap },
    { label: 'دخول', value: data.entry,       color: GOLD,      bg: GOLD + '15',              x: cardX + PAD + (lcW + lcGap) * 2 },
  ];

  const decimals = (v: number) => v > 100 ? 2 : 4;

  for (const lv of levels) {
    roundedRectPath(ctx, lv.x, lcY, lcW, lcH, 12);
    ctx.fillStyle = lv.bg; ctx.fill();
    ctx.strokeStyle = lv.color; ctx.lineWidth = 1.2; ctx.stroke();

    // Label
    ctx.font = `600 22px Cairo, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = lv.color;
    ctx.direction = 'rtl';
    ctx.fillText(lv.label, lv.x + lcW / 2, lcY + 14);

    // Value
    ctx.font = `700 30px Cairo, Arial, sans-serif`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lv.value.toFixed(decimals(lv.value)), lv.x + lcW / 2, lcY + lcH * 0.65);
  }

  // ── Setup notes (optional, y ≈ 1175) ────────────────────────────────────
  let contentEndY = lcY + lcH + 20;
  if (data.setupNotes) {
    ctx.font = `500 26px Cairo, Arial, sans-serif`;
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const notes = wrapText(ctx, data.setupNotes, cardW - PAD * 2);
    notes.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, cardX + cardW - PAD, contentEndY + i * 36);
    });
    contentEndY += notes.slice(0, 3).length * 36 + 14;
  }

  // ── R:R ratio ─────────────────────────────────────────────────────────────
  ctx.font = `700 28px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;
  ctx.fillText(`نسبة المخاطرة:  ${data.rrRatio}`, cardX + cardW - PAD, contentEndY + 10);

  await drawMarsadFooter(ctx, width, cardX, cardY, cardW, cardH, logoUrl);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MARSAD ECONOMIC CALENDAR CARD
// ══════════════════════════════════════════════════════════════════════════════

async function renderMarsadCalendar(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  data: CalendarData,
  logoUrl: string
) {
  try { await document.fonts.load('900 60px Cairo'); } catch { /* ignore */ }

  const { cardX, cardY, cardW, cardH } = drawMarsadBg(ctx, width, height);
  const cx = cardX + cardW / 2;

  await drawMarsadScopeHeader(ctx, width, cardX, cardY, cardW);

  // ── Title (y ≈ 165) ──────────────────────────────────────────────────────
  ctx.font = `900 52px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;
  ctx.fillText('الأجندة الاقتصادية', cardX + cardW - PAD, cardY + 165);

  // ── Date pill (y ≈ 248) ──────────────────────────────────────────────────
  const dateDisplay = data.date
    ? new Date(data.date + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  drawCenteredPill(ctx, dateDisplay, cx, cardY + 270, '#0A1628', GOLD, GOLD, 22, 48, 24, 28);

  // ── Table ─────────────────────────────────────────────────────────────────
  const tableX  = cardX + PAD;
  const tableW  = cardW - PAD * 2;
  const tHdrY   = cardY + 315;
  const tHdrH   = 58;
  const rowH    = 98;
  const maxRows = 8;

  // Column widths (RTL layout — rightmost = time, leftmost = profit/actual)
  // Cols (left to right in canvas = right to left in Arabic reading):
  // [السابق 110] [التوقع 110] [الفعلي 110] [الحدث flex] [الدولة 90] [الوقت 85]
  const colW = { time: 85, country: 90, event: tableW - 85 - 90 - 110 - 110 - 110, actual: 110, forecast: 110, previous: 110 };
  // X positions (LTR in canvas)
  const col = {
    previous: tableX,
    forecast: tableX + colW.previous,
    actual:   tableX + colW.previous + colW.forecast,
    event:    tableX + colW.previous + colW.forecast + colW.actual,
    country:  tableX + colW.previous + colW.forecast + colW.actual + colW.event,
    time:     tableX + colW.previous + colW.forecast + colW.actual + colW.event + colW.country,
  };

  const colHeaders = [
    { label: 'السابق',  x: col.previous + colW.previous / 2 },
    { label: 'التوقع',  x: col.forecast + colW.forecast / 2 },
    { label: 'الفعلي',  x: col.actual   + colW.actual   / 2 },
    { label: 'الحدث',   x: col.event    + colW.event    / 2 },
    { label: 'الدولة',  x: col.country  + colW.country  / 2 },
    { label: 'الوقت',   x: col.time     + colW.time     / 2 },
  ];

  // Table header bg
  ctx.fillStyle = '#0A1628';
  ctx.fillRect(tableX, tHdrY, tableW, tHdrH);
  drawGoldRule(ctx, cardX, tHdrY, cardW, 0.20);
  drawGoldRule(ctx, cardX, tHdrY + tHdrH, cardW, 0.15);

  ctx.font = `600 21px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  for (const ch of colHeaders) {
    ctx.fillText(ch.label, ch.x, tHdrY + tHdrH / 2);
  }

  // Data rows
  const events = data.events.slice(0, maxRows);
  events.forEach((ev: CalendarEvent, i: number) => {
    const ry = tHdrY + tHdrH + i * rowH;
    const rowBg = i % 2 === 0 ? '#0A1628' : '#0E1C32';
    ctx.fillStyle = rowBg;
    ctx.fillRect(tableX, ry, tableW, rowH);

    // Impact stripe (left edge in canvas = least-significant side in RTL → swap to right edge for Arabic UX)
    const stripeColor = ev.impact === 'high' ? '#DC2626' : ev.impact === 'medium' ? '#F59E0B' : '#4B5563';
    ctx.fillStyle = stripeColor;
    ctx.fillRect(tableX + tableW - 4, ry, 4, rowH); // right edge (RTL "start")

    // Row separator
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(tableX, ry + rowH); ctx.lineTo(tableX + tableW, ry + rowH); ctx.stroke();

    const midY = ry + rowH / 2;

    // Time
    ctx.font = `500 20px Cairo, Arial, sans-serif`;
    ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.fillText(ev.time, col.time + colW.time / 2, midY);

    // Country flag (small square) + code
    const flagColor = COUNTRY_COLORS[ev.country] || '#374151';
    ctx.fillStyle = flagColor;
    const flagW = 28, flagH = 18;
    const flagX = col.country + (colW.country - flagW) / 2;
    ctx.fillRect(flagX, midY - flagH / 2, flagW, flagH);
    // Country code below flag
    ctx.font = `500 14px Cairo, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.fillText(ev.country, col.country + colW.country / 2, midY + flagH / 2 + 10);

    // Event name (truncated)
    ctx.font = `600 20px Cairo, Arial, sans-serif`;
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    const evLabel = ev.event.length > 28 ? ev.event.slice(0, 27) + '…' : ev.event;
    ctx.fillText(evLabel, col.event + colW.event - 6, midY);

    // Actual (color-coded)
    const actColor = ev.result === 'beat' ? '#10B981' : ev.result === 'miss' ? '#EF4444' : '#9CA3AF';
    ctx.font = `600 20px Cairo, Arial, sans-serif`;
    ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = actColor;
    ctx.fillText(ev.actual ?? '—', col.actual + colW.actual / 2, midY);

    // Forecast
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.fillText(ev.forecast ?? '—', col.forecast + colW.forecast / 2, midY);

    // Previous
    ctx.fillText(ev.previous ?? '—', col.previous + colW.previous / 2, midY);
  });

  // Bottom table line
  const tableEndY = tHdrY + tHdrH + events.length * rowH;
  drawGoldRule(ctx, cardX, tableEndY, cardW, 0.15);

  // ── Legend (y ≈ tableEndY + 20) ──────────────────────────────────────────
  const legendY = tableEndY + 35;
  const legendItems = [
    { label: 'أعلى من المتوقع', color: '#10B981' },
    { label: 'أدنى من المتوقع', color: '#EF4444' },
    { label: 'لم يصدر',         color: '#6B7280' },
  ];
  ctx.font = `400 20px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  let legX = cardX + cardW - PAD;
  for (const lg of legendItems) {
    const textW = ctx.measureText(lg.label).width;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(lg.label, legX, legendY);
    legX -= textW + 10;
    // dot
    ctx.beginPath();
    ctx.arc(legX, legendY, 6, 0, Math.PI * 2);
    ctx.fillStyle = lg.color; ctx.fill();
    legX -= 20;
  }

  await drawMarsadFooter(ctx, width, cardX, cardY, cardW, cardH, logoUrl);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MARSAD PROOF OF TRADES CARD
// ══════════════════════════════════════════════════════════════════════════════

async function renderMarsadProofOfTrades(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  data: ProofOfTradesData,
  logoUrl: string
) {
  try { await document.fonts.load('900 60px Cairo'); } catch { /* ignore */ }

  const { cardX, cardY, cardW, cardH } = drawMarsadBg(ctx, width, height);
  const cx = cardX + cardW / 2;

  await drawMarsadScopeHeader(ctx, width, cardX, cardY, cardW);

  // ── Title (y ≈ 165) ──────────────────────────────────────────────────────
  ctx.font = `900 52px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;
  ctx.fillText('إثبات الصفقات', cardX + cardW - PAD, cardY + 165);

  // Subtitle
  ctx.font = `400 24px Cairo, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('MetaTrader 5 · لقطة شاشة', cardX + cardW - PAD, cardY + 228);

  // Period pill
  if (data.period) {
    drawCenteredPill(ctx, data.period, cx, cardY + 282, '#0A1628', GOLD, GOLD, 22, 44, 22, 24);
  }

  // ── Screenshot zone (y = 315 → 575) ─────────────────────────────────────
  const ssX = cardX + PAD;
  const ssY = cardY + 310;
  const ssW = cardW - PAD * 2;
  const ssH = 265;

  if (data.screenshotImage) {
    ctx.save();
    roundedRectPath(ctx, ssX, ssY, ssW, ssH, 10);
    ctx.clip();
    const img = await loadImg(data.screenshotImage);
    if (img.width > 0) {
      const { dw, dh, dx, dy } = coverFit(img, ssW, ssH);
      ctx.drawImage(img, ssX + dx, ssY + dy, dw, dh);
    }
    ctx.restore();
  } else {
    roundedRectPath(ctx, ssX, ssY, ssW, ssH, 10);
    ctx.fillStyle = '#0A1628'; ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = GOLD + '40'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `400 24px Cairo, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillText('أرفق لقطة شاشة MT5', ssX + ssW / 2, ssY + ssH / 2);
  }

  roundedRectPath(ctx, ssX, ssY, ssW, ssH, 10);
  ctx.strokeStyle = GOLD + '25'; ctx.lineWidth = 1; ctx.stroke();

  // ── Separator ─────────────────────────────────────────────────────────────
  const sepY = ssY + ssH + 22;

  // Gold gradient line
  const goldLineGrad = ctx.createLinearGradient(ssX, 0, ssX + ssW, 0);
  goldLineGrad.addColorStop(0,   GOLD + '00');
  goldLineGrad.addColorStop(0.5, GOLD + '90');
  goldLineGrad.addColorStop(1,   GOLD + '00');
  ctx.strokeStyle = goldLineGrad; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ssX, sepY); ctx.lineTo(ssX + ssW, sepY); ctx.stroke();

  // ── Trade table ───────────────────────────────────────────────────────────
  const tableX  = cardX + PAD;
  const tableW  = cardW - PAD * 2;
  const tHdrY   = sepY + 16;
  const tHdrH   = 52;
  const rowH    = 80;
  const maxRows = 7;

  const colW2 = { symbol: 150, dir: 90, lots: 80, entry: 130, close: 130, profit: tableW - 150 - 90 - 80 - 130 - 130 };
  const col2 = {
    profit: tableX,
    close:  tableX + colW2.profit,
    entry:  tableX + colW2.profit + colW2.close,
    lots:   tableX + colW2.profit + colW2.close + colW2.entry,
    dir:    tableX + colW2.profit + colW2.close + colW2.entry + colW2.lots,
    symbol: tableX + colW2.profit + colW2.close + colW2.entry + colW2.lots + colW2.dir,
  };

  // Header bg
  ctx.fillStyle = '#0A1628';
  ctx.fillRect(tableX, tHdrY, tableW, tHdrH);

  const hdrs2 = [
    { label: 'الربح',   x: col2.profit + colW2.profit / 2 },
    { label: 'الإغلاق', x: col2.close  + colW2.close  / 2 },
    { label: 'الدخول',  x: col2.entry  + colW2.entry  / 2 },
    { label: 'الحجم',   x: col2.lots   + colW2.lots   / 2 },
    { label: 'الاتجاه', x: col2.dir    + colW2.dir    / 2 },
    { label: 'الرمز',   x: col2.symbol + colW2.symbol / 2 },
  ];

  ctx.font = `600 20px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  for (const h of hdrs2) ctx.fillText(h.label, h.x, tHdrY + tHdrH / 2);
  drawGoldRule(ctx, cardX, tHdrY + tHdrH, cardW, 0.15);

  // Trade rows
  const trades = data.trades.slice(0, maxRows);
  trades.forEach((t: TradeEntry, i: number) => {
    const ry = tHdrY + tHdrH + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? '#0A1628' : '#0D1A2E';
    ctx.fillRect(tableX, ry, tableW, rowH);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(tableX, ry + rowH); ctx.lineTo(tableX + tableW, ry + rowH); ctx.stroke();

    const midY = ry + rowH / 2;
    ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Symbol
    ctx.font = `600 20px Cairo, Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(t.symbol, col2.symbol + colW2.symbol / 2, midY);

    // Direction pill (small)
    const dColor = t.direction === 'BUY' ? '#10B981' : '#EF4444';
    const dBg    = t.direction === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)';
    const dW = 62, dH = 28;
    const dX = col2.dir + (colW2.dir - dW) / 2;
    roundedRectPath(ctx, dX, midY - dH / 2, dW, dH, 6);
    ctx.fillStyle = dBg; ctx.fill();
    ctx.strokeStyle = dColor; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.font = `600 14px Cairo, Arial, sans-serif`;
    ctx.fillStyle = dColor;
    ctx.fillText(t.direction, dX + dW / 2, midY);

    ctx.font = `500 19px Cairo, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.fillText(t.lots.toFixed(2), col2.lots + colW2.lots / 2, midY);

    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    const dec = (v: number) => v > 100 ? 2 : 4;
    ctx.fillText(t.entryPrice.toFixed(dec(t.entryPrice)), col2.entry + colW2.entry / 2, midY);
    ctx.fillText(t.closePrice.toFixed(dec(t.closePrice)), col2.close + colW2.close / 2, midY);

    ctx.font = `700 20px Cairo, Arial, sans-serif`;
    ctx.fillStyle = t.profit >= 0 ? '#10B981' : '#EF4444';
    ctx.fillText((t.profit >= 0 ? '+' : '') + t.profit.toFixed(2), col2.profit + colW2.profit / 2, midY);
  });

  // ── Total row ─────────────────────────────────────────────────────────────
  const totalY = tHdrY + tHdrH + trades.length * rowH + 6;
  const totalH = 72;

  const totalGrad = ctx.createLinearGradient(tableX, 0, tableX + tableW, 0);
  totalGrad.addColorStop(0,   '#0F2018');
  totalGrad.addColorStop(1,   '#0A1220');
  roundedRectPath(ctx, tableX, totalY, tableW, totalH, 10);
  ctx.fillStyle = totalGrad; ctx.fill();
  ctx.strokeStyle = GOLD + '30'; ctx.lineWidth = 1; ctx.stroke();

  ctx.font = `700 26px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.fillText('الإجمالي', tableX + tableW - 16, totalY + totalH / 2);

  ctx.font = `800 28px Cairo, Arial, sans-serif`;
  ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const totalColor = data.totalProfit >= 0 ? '#10B981' : '#EF4444';
  ctx.fillStyle = totalColor;
  const totalStr = (data.totalProfit >= 0 ? '+' : '') + data.totalProfit.toFixed(2) + ' $';
  ctx.fillText(totalStr, tableX + 16, totalY + totalH / 2);

  await drawMarsadFooter(ctx, width, cardX, cardY, cardW, cardH, logoUrl);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MARSAD WEBINAR / EVENT CARD
// ══════════════════════════════════════════════════════════════════════════════

async function renderMarsadWebinar(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  data: WebinarData,
  logoUrl: string
) {
  try { await document.fonts.load('900 60px Cairo'); } catch { /* ignore */ }

  const { cardX, cardY, cardW, cardH } = drawMarsadBg(ctx, width, height);
  const cx = cardX + cardW / 2;

  // Decorative corner glows
  const glowTR = ctx.createRadialGradient(cardX + cardW, cardY, 0, cardX + cardW, cardY, 380);
  glowTR.addColorStop(0, GOLD + '14'); glowTR.addColorStop(1, 'transparent');
  ctx.fillStyle = glowTR; ctx.fillRect(cardX, cardY, cardW, cardH);

  const glowBL = ctx.createRadialGradient(cardX, cardY + cardH, 0, cardX, cardY + cardH, 350);
  glowBL.addColorStop(0, '#1E88E5' + '0F'); glowBL.addColorStop(1, 'transparent');
  ctx.fillStyle = glowBL; ctx.fillRect(cardX, cardY, cardW, cardH);

  await drawMarsadScopeHeader(ctx, width, cardX, cardY, cardW);

  // ── Event badge (y ≈ 190) ────────────────────────────────────────────────
  drawCenteredPill(ctx, '🎙️  ندوة مباشرة', cx, cardY + 200, '#0A1628', GOLD, GOLD, 24, 54, 27, 32);

  // ── Event title (y ≈ 275) ────────────────────────────────────────────────
  ctx.font = `800 64px Cairo, Arial, sans-serif`;
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24;
  const titleLines = wrapText(ctx, data.title || 'عنوان الندوة', cardW - PAD * 3);
  titleLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, cx, cardY + 275 + i * 80);
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

  let contentY = cardY + 275 + titleLines.slice(0, 3).length * 80 + 16;

  // Subtitle
  if (data.subtitle) {
    ctx.font = `400 32px Cairo, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(data.subtitle, cx, contentY);
    contentY += 50;
  }

  // Gold divider
  contentY += 18;
  const dvGrad = ctx.createLinearGradient(cx - 200, 0, cx + 200, 0);
  dvGrad.addColorStop(0, GOLD + '00'); dvGrad.addColorStop(0.5, GOLD + 'AA'); dvGrad.addColorStop(1, GOLD + '00');
  ctx.strokeStyle = dvGrad; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 200, contentY); ctx.lineTo(cx + 200, contentY); ctx.stroke();
  contentY += 24;

  // ── Date pill ─────────────────────────────────────────────────────────────
  drawCenteredPill(ctx, '📅  ' + (data.dateAr || 'تاريخ الندوة'), cx, contentY + 30, '#0A1628', GOLD + '80', 'rgba(255,255,255,0.85)', 24, 56, 28, 28);
  contentY += 70;

  // ── Time pill ─────────────────────────────────────────────────────────────
  drawCenteredPill(ctx, '🕐  ' + (data.timeAr || 'وقت الندوة'), cx, contentY + 30, '#0A1628', '#1E88E580', 'rgba(255,255,255,0.85)', 24, 56, 28, 28);
  contentY += 70;

  // ── Platform badge ────────────────────────────────────────────────────────
  const platColor = data.platform === 'تيليغرام' ? '#2AABEE' : '#6B7280';
  drawCenteredPill(ctx, data.platform || 'تيليغرام', cx, contentY + 28, platColor + '20', platColor, platColor, 22, 46, 23, 24);
  contentY += 70;

  // ── QR Code (y ≈ contentY) ────────────────────────────────────────────────
  if (data.qrDataUrl) {
    const qrSize = 220;
    const qrX = cx - qrSize / 2;
    const qrY = contentY + 10;

    // Gold frame
    ctx.strokeStyle = GOLD + '60'; ctx.lineWidth = 2;
    roundedRectPath(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.stroke();
    ctx.fillStyle = '#0D1B2A';
    roundedRectPath(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();

    const qrImg = await loadImg(data.qrDataUrl);
    if (qrImg.width > 0) {
      ctx.save();
      roundedRectPath(ctx, qrX, qrY, qrSize, qrSize, 8);
      ctx.clip();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.restore();
    }

    // "امسح للتسجيل"
    ctx.font = `600 22px Cairo, Arial, sans-serif`;
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.fillText('امسح للتسجيل', cx, qrY + qrSize + 14);

    contentY = qrY + qrSize + 52;
  } else if (data.bookingUrl) {
    // Placeholder when QR not yet loaded
    const qrSize = 180;
    roundedRectPath(ctx, cx - qrSize / 2, contentY + 10, qrSize, qrSize, 10);
    ctx.fillStyle = '#0A1628'; ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = GOLD + '40'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `400 20px Cairo, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = GOLD + '60';
    ctx.fillText('رمز QR', cx, contentY + 10 + qrSize / 2);
    contentY += qrSize + 30;
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  if (data.tags && data.tags.length > 0) {
    ctx.font = `500 20px Cairo, Arial, sans-serif`;
    const tagH = 38, tagR = 10, tagGap = 10;
    let totalTagW = 0;
    const tagWidths = data.tags.map(t => { const w = ctx.measureText(t).width + 28; totalTagW += w + tagGap; return w; });
    totalTagW -= tagGap;
    let tx = cx - totalTagW / 2;
    const ty = contentY + 10;
    data.tags.forEach((tag: string, i: number) => {
      const tw = tagWidths[i];
      roundedRectPath(ctx, tx, ty, tw, tagH, tagR);
      ctx.fillStyle = GOLD + '18'; ctx.fill();
      ctx.strokeStyle = GOLD + '50'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tag, tx + tw / 2, ty + tagH / 2);
      tx += tw + tagGap;
    });
    contentY += tagH + 22;
  }

  // ── Host name ─────────────────────────────────────────────────────────────
  if (data.hostName) {
    ctx.font = `400 24px Cairo, Arial, sans-serif`;
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.fillText('يقدمها: ' + data.hostName, cx, contentY + 10);
  }

  await drawMarsadFooter(ctx, width, cardX, cardY, cardW, cardH, logoUrl);
}

// ── Marsad Al Souq NEWS canvas renderer (original — unchanged) ───────────────
async function renderMarsad(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  props: BrandedCanvasProps
) {
  const { storyImage, headline, logoUrl } = props;
  const gold  = '#C9A84C';
  const gold2 = '#E8C574';
  const frame = 10;
  const cardX = frame, cardY = frame;
  const cardW = width  - frame * 2;
  const cardH = height - frame * 2;
  const pad   = 44;

  try { await document.fonts.load('900 60px Cairo'); } catch { /* ignore */ }

  ctx.fillStyle = '#070E1A';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.clip();

  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0,   '#152035');
  bgGrad.addColorStop(0.5, '#0D1B2A');
  bgGrad.addColorStop(1,   '#070E1A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  const imgZoneY = cardY + 145;
  const imgZoneH = Math.round(cardH * 0.52);

  if (storyImage) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, imgZoneY, cardW, imgZoneH);
    ctx.clip();
    const img = await loadImg(storyImage);
    if (img.width > 0) {
      const { dw, dh, dx, dy } = coverFit(img, cardW, imgZoneH);
      ctx.drawImage(img, cardX + dx, imgZoneY + dy, dw, dh);
    }
    ctx.restore();

    const fadeGrad = ctx.createLinearGradient(0, imgZoneY + imgZoneH * 0.55, 0, imgZoneY + imgZoneH);
    fadeGrad.addColorStop(0, 'rgba(10,20,34,0)');
    fadeGrad.addColorStop(1, 'rgba(10,20,34,0.97)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(cardX, imgZoneY, cardW, imgZoneH);
  }

  ctx.restore();

  const iconSize = 52;
  const iconX = cardX + cardW - pad - iconSize;
  const iconY = cardY + 28;
  const iconImg = await loadImg(marsadIconUrl);
  if (iconImg.width > 0) {
    ctx.save();
    roundedRectPath(ctx, iconX, iconY, iconSize, iconSize, 10);
    ctx.clip();
    ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur    = 14;
  ctx.font          = `900 ${Math.round(width * 0.052)}px Cairo, Arial, sans-serif`;
  ctx.direction     = 'rtl';
  ctx.textAlign     = 'right';
  ctx.textBaseline  = 'top';
  ctx.fillStyle     = gold;
  ctx.fillText('مرصد السوق', cardX + cardW - pad, cardY + 34);
  ctx.restore();

  const ruleY = cardY + 34 + Math.round(width * 0.052) * 1.1 + 8;
  ctx.strokeStyle = gold + '40';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(cardX + pad, ruleY);
  ctx.lineTo(cardX + cardW - pad, ruleY);
  ctx.stroke();

  const headlineStartY = imgZoneY + imgZoneH - 20;
  const fontSize  = Math.round(width * 0.062);
  const lineH     = fontSize * 1.26;
  const maxLineW  = cardW - pad * 2;

  ctx.font          = `700 ${fontSize}px Cairo, Arial, sans-serif`;
  ctx.direction     = 'rtl';
  ctx.textAlign     = 'right';
  ctx.textBaseline  = 'top';

  const words = headline.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxLineW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  ctx.shadowColor   = 'rgba(0,0,0,0.92)';
  ctx.shadowBlur    = 24;
  ctx.shadowOffsetY = 3;

  lines.forEach((line, i) => {
    ctx.fillStyle = (i === lines.length - 1 && lines.length > 1) ? gold : '#ffffff';
    ctx.fillText(line, cardX + cardW - pad, headlineStartY + i * lineH);
  });

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetY = 0;

  const barY  = headlineStartY + lines.length * lineH + fontSize * 0.4;
  const barW  = cardW * 0.07;
  const barH  = height * 0.004;
  ctx.fillStyle = gold;
  ctx.fillRect(cardX + cardW - pad - barW, barY, barW, barH);

  const footerY = cardY + cardH - 110;
  const footerH = 100;

  const footerGrad = ctx.createLinearGradient(0, footerY - 30, 0, footerY);
  footerGrad.addColorStop(0, 'rgba(10,20,34,0)');
  footerGrad.addColorStop(1, 'rgba(10,20,34,0.55)');
  ctx.fillStyle = footerGrad;
  ctx.fillRect(cardX, footerY - 30, cardW, 30);

  ctx.strokeStyle = gold + '28';
  ctx.lineWidth   = 0.6;
  ctx.beginPath();
  ctx.moveTo(cardX + pad, footerY);
  ctx.lineTo(cardX + cardW - pad, footerY);
  ctx.stroke();

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.font         = `400 ${Math.round(width * 0.020)}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'rtl';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.55)';
  ctx.fillText(dateStr, cardX + cardW - pad, footerY + footerH * 0.38);

  if (logoUrl) {
    const logo = await loadImg(logoUrl);
    if (logo.width > 0) {
      const logoH2 = 36;
      const logoW2 = (logo.width / logo.height) * logoH2;
      ctx.save();
      ctx.globalAlpha = 0.80;
      ctx.drawImage(logo, cardX + (cardW - logoW2) / 2, footerY + (footerH - logoH2) / 2, logoW2, logoH2);
      ctx.restore();
    }
  }

  ctx.font         = `400 ${Math.round(width * 0.019)}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'ltr';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.32)';
  ctx.fillText('بدعم من IST Markets', cardX + pad, footerY + footerH * 0.62);

  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.strokeStyle = gold2 + '22';
  ctx.lineWidth   = 1.2;
  ctx.stroke();
  ctx.restore();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BrandedCanvas({
  backgroundImage,
  storyImage,
  headline,
  accentColor,
  logoUrl,
  logoSize,
  logoPosition = 'top-left',
  tagline,
  disclaimer,
  disclaimer2 = '',
  language,
  width = 1080,
  height = 1080,
  brandId,
  cardType,
  cardData,
  onExport
}: BrandedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = async () => {
      // ── Marsad Al Souq theme ──────────────────────────────────────────────
      if (brandId === 'marsad-alsouq') {
        if (cardType === 'signal' && cardData) {
          await renderMarsadSignal(ctx, width, height, cardData as SignalData, logoUrl);
        } else if (cardType === 'calendar' && cardData) {
          await renderMarsadCalendar(ctx, width, height, cardData as CalendarData, logoUrl);
        } else if (cardType === 'proof-of-trades' && cardData) {
          await renderMarsadProofOfTrades(ctx, width, height, cardData as ProofOfTradesData, logoUrl);
        } else if (cardType === 'webinar' && cardData) {
          await renderMarsadWebinar(ctx, width, height, cardData as WebinarData, logoUrl);
        } else {
          // Default: Marsad news card
          await renderMarsad(ctx, width, height, {
            backgroundImage, storyImage, headline, accentColor,
            logoUrl, logoSize, logoPosition, tagline,
            disclaimer, disclaimer2, language, width, height, brandId, onExport,
          });
        }
        if (onExport) onExport(canvas.toDataURL('image/jpeg', 0.92));
        return;
      }

      // ── IST Markets (default) theme ───────────────────────────────────────
      const pad     = width * 0.06;
      const isRTL   = language === 'ar';
      const textX   = isRTL ? width - pad : pad;
      const footerH = height * 0.12;
      const footerY = height - footerH;

      ctx.fillStyle = '#111114';
      ctx.fillRect(0, 0, width, height);

      if (storyImage) {
        const img = await loadImg(storyImage);
        if (img.width > 0) {
          const { dw, dh, dx, dy } = coverFit(img, width, height);
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }

      if (backgroundImage) {
        const img = await loadImg(backgroundImage);
        if (img.width > 0) {
          const { dw, dh, dx, dy } = coverFit(img, width, height);
          ctx.save();
          ctx.globalAlpha = storyImage ? 0.15 : 1.0;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
          if (!storyImage) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, width, height);
          }
        }
      }

      const ar = width / height;
      const textAreaBottom = ar > 1.3 ? height * 0.58 : height * 0.44;
      const topGrad = ctx.createLinearGradient(0, 0, 0, textAreaBottom);
      topGrad.addColorStop(0,    'rgba(0,0,0,0.62)');
      topGrad.addColorStop(0.35, 'rgba(0,0,0,0.50)');
      topGrad.addColorStop(0.70, 'rgba(0,0,0,0.20)');
      topGrad.addColorStop(1,    'rgba(0,0,0,0.00)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, textAreaBottom);

      const botGrad = ctx.createLinearGradient(0, height * 0.70, 0, height);
      botGrad.addColorStop(0,    'rgba(0,0,0,0.00)');
      botGrad.addColorStop(0.45, 'rgba(0,0,0,0.40)');
      botGrad.addColorStop(1,    'rgba(0,0,0,0.75)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, height * 0.70, width, height - height * 0.70);

      const vig = ctx.createRadialGradient(
        width / 2, height * 0.60, height * 0.28,
        width / 2, height * 0.60, height * 0.90
      );
      vig.addColorStop(0, 'rgba(0,0,0,0.00)');
      vig.addColorStop(1, 'rgba(0,0,0,0.40)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);

      if (logoUrl) {
        const logo = await loadImg(logoUrl);
        if (logo.width > 0) {
          const logoW   = logoSize ? logoSize * (width / 1080) : width * 0.22;
          const logoH   = (logo.height / logo.width) * logoW;
          const logoPad = width * 0.055;
          const pos = logoPosition || 'top-left';
          const isBottom  = pos.includes('bottom');
          const isCenter  = pos.includes('center');
          const isRight   = pos.includes('right');
          const logoY = isBottom ? height - logoPad - logoH : logoPad;
          let   logoX = logoPad;
          if (isCenter) logoX = (width - logoW) / 2;
          else if (isRight) logoX = width - logoPad - logoW;
          ctx.drawImage(logo, logoX, logoY, logoW, logoH);
        }
      }

      const aspectRatio = width / height;
      const baseDim  = aspectRatio > 1.3 ? Math.min(width, height * 1.3) : width;
      const fontSize   = baseDim * 0.062;
      const lineH      = fontSize * 1.22;
      const headlineY  = aspectRatio > 1.3 ? height * 0.12 : height * 0.17;
      const maxLineW   = width - pad * 2;

      ctx.font         = `bold ${fontSize}px Inter, Arial, sans-serif`;
      ctx.direction    = isRTL ? 'rtl' : 'ltr';
      ctx.textAlign    = isRTL ? 'right' : 'left';
      ctx.textBaseline = 'top';

      const words = headline.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const word of words) {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > maxLineW && cur) {
          lines.push(cur);
          cur = word;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);

      ctx.shadowColor   = 'rgba(0,0,0,0.90)';
      ctx.shadowBlur    = 22;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;

      lines.forEach((line, i) => {
        ctx.fillStyle = (i === lines.length - 1 && lines.length > 1) ? accentColor : '#ffffff';
        ctx.fillText(line, textX, headlineY + i * lineH);
      });

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      const headlineEndY = headlineY + lines.length * lineH;
      const barGap = fontSize * 0.45;
      const barY   = headlineEndY + barGap;
      const barW   = width * 0.07;
      const barHt  = height * 0.006;
      const barX   = isRTL ? width - pad - barW : pad;

      ctx.fillStyle = accentColor;
      ctx.fillRect(barX, barY, barW, barHt);

      const taglineSize = width * 0.020;
      ctx.shadowColor   = 'rgba(0,0,0,0.80)';
      ctx.shadowBlur    = 10;
      ctx.font          = `600 ${taglineSize}px Inter, Arial, sans-serif`;
      ctx.direction     = isRTL ? 'rtl' : 'ltr';
      ctx.fillStyle     = 'rgba(255,255,255,0.70)';
      ctx.textBaseline  = 'top';
      ctx.fillText(tagline.toUpperCase(), textX, barY + barHt + fontSize * 0.35);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      const ftSize  = width * 0.018;
      const ftLineH = ftSize * 1.55;
      ctx.font         = `${ftSize}px Inter, Arial, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      const wrapDisclaimer = (text: string): string[] => {
        const lines: string[] = [];
        let cur = '';
        for (const word of text.toUpperCase().split(' ')) {
          const test = cur ? cur + ' ' + word : word;
          if (ctx.measureText(test).width > width * 0.84 && cur) { lines.push(cur); cur = word; }
          else cur = test;
        }
        if (cur) lines.push(cur);
        return lines;
      };

      const line1Lines = disclaimer  ? wrapDisclaimer(disclaimer)  : [];
      const line2Lines = disclaimer2 ? wrapDisclaimer(disclaimer2) : [];
      const allFtLines = [...line1Lines, ...line2Lines];
      const ftTotalH   = allFtLines.length * ftLineH;
      const ftStartY   = footerY + (footerH - ftTotalH) / 2 + ftLineH / 2;

      allFtLines.forEach((line, i) => {
        const isLine2 = i >= line1Lines.length;
        ctx.fillStyle = isLine2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.80)';
        ctx.fillText(line, width / 2, ftStartY + i * ftLineH);
      });

      if (onExport) onExport(canvas.toDataURL('image/jpeg', 0.92));
    };

    render();
  }, [
    backgroundImage, storyImage, headline, accentColor, logoUrl, tagline,
    disclaimer, language, width, height, brandId, onExport,
    cardType,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(cardData),
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full object-contain rounded-xl shadow-2xl"
    />
  );
}
