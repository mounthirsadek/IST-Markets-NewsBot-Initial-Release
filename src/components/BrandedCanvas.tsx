import { useEffect, useRef } from 'react';
import marsadIconUrl from '../assets/marsad-icon.svg';

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
  onExport?: (dataUrl: string) => void;
}

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

/** Draw a rounded rectangle path (does NOT fill or stroke — caller does that) */
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

// ── Marsad Al Souq canvas renderer ─────────────────────────────────────────
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

  // Pre-load Cairo so canvas text renders correctly
  try { await document.fonts.load('900 60px Cairo'); } catch { /* ignore */ }

  // ── OUTER MATTE ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#070E1A';
  ctx.fillRect(0, 0, width, height);

  // ── INNER CARD (clip) ─────────────────────────────────────────────────────
  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.clip();

  // Navy gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0,   '#152035');
  bgGrad.addColorStop(0.5, '#0D1B2A');
  bgGrad.addColorStop(1,   '#070E1A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // ── STORY IMAGE (middle zone) ─────────────────────────────────────────────
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

    // Fade-out gradient at bottom of image (into text area)
    const fadeGrad = ctx.createLinearGradient(0, imgZoneY + imgZoneH * 0.55, 0, imgZoneY + imgZoneH);
    fadeGrad.addColorStop(0, 'rgba(10,20,34,0)');
    fadeGrad.addColorStop(1, 'rgba(10,20,34,0.97)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(cardX, imgZoneY, cardW, imgZoneH);
  }

  ctx.restore(); // end card clip

  // ── SCOPE ICON (top-right of card) ───────────────────────────────────────
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

  // ── HEADER: brand name ────────────────────────────────────────────────────
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

  // Thin gold rule under header
  const ruleY = cardY + 34 + Math.round(width * 0.052) * 1.1 + 8;
  ctx.strokeStyle = gold + '40';
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(cardX + pad, ruleY);
  ctx.lineTo(cardX + cardW - pad, ruleY);
  ctx.stroke();

  // ── HEADLINE ─────────────────────────────────────────────────────────────
  const headlineStartY = imgZoneY + imgZoneH - 20;
  const fontSize  = Math.round(width * 0.062);
  const lineH     = fontSize * 1.26;
  const maxLineW  = cardW - pad * 2;

  ctx.font          = `700 ${fontSize}px Cairo, Arial, sans-serif`;
  ctx.direction     = 'rtl';
  ctx.textAlign     = 'right';
  ctx.textBaseline  = 'top';

  // Word-wrap
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

  // ── GOLD ACCENT BAR below headline ───────────────────────────────────────
  const barY  = headlineStartY + lines.length * lineH + fontSize * 0.4;
  const barW  = cardW * 0.07;
  const barH  = height * 0.004;
  ctx.fillStyle = gold;
  ctx.fillRect(cardX + cardW - pad - barW, barY, barW, barH);

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = cardY + cardH - 110;
  const footerH = 100;

  // Subtle footer separator
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

  // Date — right side (Arabic locale)
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.font         = `400 ${Math.round(width * 0.020)}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'rtl';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.55)';
  ctx.fillText(dateStr, cardX + cardW - pad, footerY + footerH * 0.38);

  // IST Markets logo — center
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

  // "بدعم من" — left side
  ctx.font         = `400 ${Math.round(width * 0.019)}px Cairo, Arial, sans-serif`;
  ctx.direction    = 'ltr';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(255,255,255,0.32)';
  ctx.fillText('بدعم من IST Markets', cardX + pad, footerY + footerH * 0.62);

  // ── CARD BORDER (subtle gold glow) ────────────────────────────────────────
  ctx.save();
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.strokeStyle = gold2 + '22';
  ctx.lineWidth   = 1.2;
  ctx.stroke();
  ctx.restore();
}

// ── Main component ──────────────────────────────────────────────────────────
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
        await renderMarsad(ctx, width, height, {
          backgroundImage, storyImage, headline, accentColor,
          logoUrl, logoSize, logoPosition, tagline,
          disclaimer, disclaimer2, language, width, height, brandId, onExport,
        });
        if (onExport) onExport(canvas.toDataURL('image/jpeg', 0.92));
        return;
      }

      // ── IST Markets (default) theme ───────────────────────────────────────
      const pad     = width * 0.06;
      const isRTL   = language === 'ar';
      const textX   = isRTL ? width - pad : pad;
      const footerH = height * 0.12;
      const footerY = height - footerH;

      // LAYER 1: Dark base
      ctx.fillStyle = '#111114';
      ctx.fillRect(0, 0, width, height);

      // LAYER 2: AI Story Image — FULL BLEED
      if (storyImage) {
        const img = await loadImg(storyImage);
        if (img.width > 0) {
          const { dw, dh, dx, dy } = coverFit(img, width, height);
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }

      // LAYER 3: Brand Template (tint or fallback)
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

      // LAYER 4: Gradients
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

      // LAYER 5: Logo
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

      // LAYER 6: Headline (upper third)
      const aspectRatio = width / height;
      const baseDim  = aspectRatio > 1.3
        ? Math.min(width, height * 1.3)
        : width;
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
        ctx.fillStyle = (i === lines.length - 1 && lines.length > 1)
          ? accentColor
          : '#ffffff';
        ctx.fillText(line, textX, headlineY + i * lineH);
      });

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      const headlineEndY = headlineY + lines.length * lineH;

      // LAYER 7: Accent bar + Tagline
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

      // LAYER 8: Footer disclaimers
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
          if (ctx.measureText(test).width > width * 0.84 && cur) {
            lines.push(cur);
            cur = word;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      };

      const line1Lines = disclaimer  ? wrapDisclaimer(disclaimer)  : [];
      const line2Lines = disclaimer2 ? wrapDisclaimer(disclaimer2) : [];
      const allFtLines = [...line1Lines, ...line2Lines];

      const ftTotalH = allFtLines.length * ftLineH;
      const ftStartY = footerY + (footerH - ftTotalH) / 2 + ftLineH / 2;

      allFtLines.forEach((line, i) => {
        const isLine2 = i >= line1Lines.length;
        ctx.fillStyle = isLine2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.80)';
        ctx.fillText(line, width / 2, ftStartY + i * ftLineH);
      });

      // Export
      if (onExport) {
        onExport(canvas.toDataURL('image/jpeg', 0.92));
      }
    };

    render();
  }, [backgroundImage, storyImage, headline, accentColor, logoUrl, tagline, disclaimer, language, width, height, brandId, onExport]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full object-contain rounded-xl shadow-2xl"
    />
  );
}
