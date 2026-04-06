import { useEffect, useRef } from 'react';

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
  onExport
}: BrandedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = async () => {
      const pad     = width * 0.06;
      const isRTL   = language === 'ar';
      const textX   = isRTL ? width - pad : pad;
      const footerH = height * 0.12;
      const footerY = height - footerH;
      const stripeW = Math.max(4, width * 0.004);

      // ── LAYER 1: Dark base ─────────────────────────────────────────
      ctx.fillStyle = '#111114';
      ctx.fillRect(0, 0, width, height);

      // ── LAYER 2: AI Story Image — FULL BLEED ──────────────────────
      if (storyImage) {
        const img = await loadImg(storyImage);
        if (img.width > 0) {
          const { dw, dh, dx, dy } = coverFit(img, width, height);
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }

      // ── LAYER 3: Brand Template (tint or fallback) ─────────────────
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

      // ── LAYER 4: Gradients ─────────────────────────────────────────

      // 4A — Top gradient: covers text area (lightened for less dark header)
      const ar = width / height;
      const textAreaBottom = ar > 1.3 ? height * 0.58 : height * 0.44;
      const topGrad = ctx.createLinearGradient(0, 0, 0, textAreaBottom);
      topGrad.addColorStop(0,    'rgba(0,0,0,0.62)');
      topGrad.addColorStop(0.35, 'rgba(0,0,0,0.50)');
      topGrad.addColorStop(0.70, 'rgba(0,0,0,0.20)');
      topGrad.addColorStop(1,    'rgba(0,0,0,0.00)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, textAreaBottom);

      // 4B — Bottom gradient: smooth fade to bottom covering footer area too
      const botGrad = ctx.createLinearGradient(0, height * 0.70, 0, height);
      botGrad.addColorStop(0,    'rgba(0,0,0,0.00)');
      botGrad.addColorStop(0.45, 'rgba(0,0,0,0.40)');
      botGrad.addColorStop(1,    'rgba(0,0,0,0.75)');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, height * 0.70, width, height - height * 0.70);

      // 4C — Subtle radial vignette (corners dark, center bright)
      const vig = ctx.createRadialGradient(
        width / 2, height * 0.60, height * 0.28,
        width / 2, height * 0.60, height * 0.90
      );
      vig.addColorStop(0, 'rgba(0,0,0,0.00)');
      vig.addColorStop(1, 'rgba(0,0,0,0.40)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);

      // ── LAYER 5: Vertical accent stripe — removed ──────────────────

      // ── LAYER 6: Logo ───────────────────────────────────────────────
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

      // ── LAYER 7: Headline (upper third) ────────────────────────────
      // Scale font by the shorter dimension so landscape formats don't overflow
      const aspectRatio = width / height;
      const baseDim  = aspectRatio > 1.3
        ? Math.min(width, height * 1.3)   // landscape: scale down to avoid overflow
        : width;                           // portrait / square: normal
      const fontSize   = baseDim * 0.062;
      const lineH      = fontSize * 1.22;
      // Landscape formats start headline higher (canvas is short)
      const headlineY  = aspectRatio > 1.3 ? height * 0.12 : height * 0.17;
      const maxLineW   = width - pad * 2;

      ctx.font         = `bold ${fontSize}px Inter, Arial, sans-serif`;
      ctx.direction    = isRTL ? 'rtl' : 'ltr';
      ctx.textAlign    = isRTL ? 'right' : 'left';
      ctx.textBaseline = 'top';

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

      // Strong text shadow for readability over any image
      ctx.shadowColor   = 'rgba(0,0,0,0.90)';
      ctx.shadowBlur    = 22;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;

      lines.forEach((line, i) => {
        // Last line uses accent color for visual punch (Bloomberg/Reuters style)
        ctx.fillStyle = (i === lines.length - 1 && lines.length > 1)
          ? accentColor
          : '#ffffff';
        ctx.fillText(line, textX, headlineY + i * lineH);
      });

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      const headlineEndY = headlineY + lines.length * lineH;

      // ── LAYER 8: Accent bar + Tagline ──────────────────────────────
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

      // ── LAYER 9: Footer (no background — merged with image) ─────────
      const ftSize  = width * 0.018;
      const ftLineH = ftSize * 1.55;

      ctx.font         = `${ftSize}px Inter, Arial, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // Helper: word-wrap a disclaimer string into canvas lines
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
        // Line 2 block rendered slightly dimmer
        const isLine2 = i >= line1Lines.length;
        ctx.fillStyle = isLine2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.80)';
        ctx.fillText(line, width / 2, ftStartY + i * ftLineH);
      });

      // ── Export ──────────────────────────────────────────────────────
      if (onExport) {
        onExport(canvas.toDataURL('image/jpeg', 0.92));
      }
    };

    render();
  }, [backgroundImage, storyImage, headline, accentColor, logoUrl, tagline, disclaimer, language, width, height, onExport]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full object-contain rounded-xl shadow-2xl"
    />
  );
}
