#!/usr/bin/env python3
"""
Marsad Al Souq — Arabic News Card Template (PERMANENT STANDARD)
----------------------------------------------------------------
Inputs: headline_line1, headline_line2, subhead, caption, category,
        impact_heading, asset reactions (list), photo_path, date_ar
Output: 1080x1620 Arabic RTL news card SVG + PNG

Design Standard (adopted 24 April 2026):
• 10px outer matte frame, rounded inner card (rx=14)
• Full Arabic RTL — no English content
• Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) for dates/times
• Brand header (right): scope ring + "مرصد السوق" + sub-tag
• Headline: up to two lines, right-anchored, 48px bold
• Footer: date (right) + IST Markets logo image + "بدعم من" (text BEFORE logo in RTL)
• NO scope icon in footer — scope only lives with Marsad brand in header
"""

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageEnhance
import base64, io, cairosvg, os

def shape(t):  # Reshape Arabic + BIDI so SVG renders without direction attr
    return get_display(arabic_reshaper.reshape(t))

def prep_photo(src_path, out_w=920, out_h=520):
    """Crop/resize cover-fit + slight tonal treatment. Returns base64 JPEG."""
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    # cover fit
    scale = max(out_w/sw, out_h/sh)
    nw, nh = int(sw*scale), int(sh*scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    x0, y0 = (nw-out_w)//2, (nh-out_h)//2
    im = im.crop((x0, y0, x0+out_w, y0+out_h))
    im = ImageEnhance.Color(im).enhance(0.92)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode()

def build_news_card(
    headline_line1,         # e.g. "ترامب يمدد وقف إطلاق النار"
    headline_line2,         # e.g. "بين إسرائيل ولبنان"
    subhead,                # e.g. "ثلاثة أسابيع إضافية · الإعلان عبر منصة «تروث سوشيال»"
    caption,                # e.g. "إعلان عبر «تروث سوشيال» · تمديد وقف إطلاق النار"
    figure_name,            # e.g. "دونالد ترامب"
    category,               # e.g. "جيوسياسي"
    impact_heading,         # usually "التأثير على الأسواق"
    assets,                 # list of 4 dicts: {"name":"الذهب","reaction":"ارتفاع الملاذ الآمن","dir":"up"/"down"}
    photo_path,
    date_ar,                # e.g. "٢٤ أبريل ٢٠٢٦ · ١٤:٣٠ ت.غ"
    out_svg, out_png,
    ist_logo_b64_path="/sessions/vibrant-fervent-galileo/mnt/MarselAlsouq/Arabic-Design-System/templates/ist_logo_white_b64.txt",
):
    with open(ist_logo_b64_path) as f:
        ist_b64 = f.read().strip()

    photo_b64 = prep_photo(photo_path)

    brand      = shape("مرصد السوق")
    section    = shape("قسم الأخبار")
    breaking   = shape("عاجل")
    news_tag   = shape("أخبار عاجلة")
    disclaim   = shape("للأغراض التعليمية فقط · ليست نصيحة مالية · إدارة المخاطر مسؤوليتك")
    poweredby  = shape("بدعم من")

    # Asset arrows: up = green triangle, down = red triangle
    def asset_block(x, a):
        color = "#10B981" if a["dir"] == "up" else "#DC2626"
        arrow = "▲" if a["dir"] == "up" else "▼"
        return f'''
    <g transform="translate({x}, 60)">
      <text x="0" y="0" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#F5F4EF">{shape(a["name"])}</text>
      <text x="0" y="28" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="12" fill="#9BA3AF">{shape(a["reaction"])}</text>
      <text x="0" y="60" font-family="Arial, sans-serif" font-size="16" fill="{color}">{arrow}</text>
    </g>'''

    assets_svg = "".join(asset_block(x, a) for x, a in zip([620, 420, 220, 20], assets))

    SVG = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1620" viewBox="0 0 1080 1620" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="25%" r="90%">
      <stop offset="0%" stop-color="#152035"/>
      <stop offset="60%" stop-color="#0D1B2A"/>
      <stop offset="100%" stop-color="#070E1A"/>
    </radialGradient>
    <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#C9A84C" stop-opacity="0"/>
      <stop offset="50%" stop-color="#C9A84C" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="breakingPill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#B91C1C"/>
    </linearGradient>
    <linearGradient id="impactGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0A1628"/>
      <stop offset="100%" stop-color="#0D1B2A"/>
    </linearGradient>
    <clipPath id="photoClip"><rect x="0" y="0" width="920" height="520" rx="10"/></clipPath>
    <clipPath id="cardFrame"><rect x="10" y="10" width="1060" height="1600" rx="14"/></clipPath>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1080" height="1620" fill="#070E1A"/>

  <g clip-path="url(#cardFrame)">
    <rect x="10" y="10" width="1060" height="1600" fill="url(#bg)"/>

    <!-- Brand header (right) -->
    <g transform="translate(910, 80)">
      <circle cx="45" cy="45" r="42" fill="none" stroke="#C9A84C" stroke-width="1.6"/>
      <circle cx="45" cy="45" r="25" fill="none" stroke="#C9A84C" stroke-width="0.9" opacity="0.38"/>
      <line x1="1" y1="45" x2="33" y2="45" stroke="#C9A84C" stroke-width="1" opacity="0.75"/>
      <line x1="57" y1="45" x2="89" y2="45" stroke="#C9A84C" stroke-width="1" opacity="0.75"/>
      <line x1="45" y1="1" x2="45" y2="33" stroke="#C9A84C" stroke-width="1" opacity="0.75"/>
      <line x1="45" y1="57" x2="45" y2="89" stroke="#C9A84C" stroke-width="1" opacity="0.75"/>
      <path d="M 25 68 Q 42 60 55 50 Q 66 42 72 36" fill="none" stroke="#C9A84C" stroke-width="1.4" opacity="0.7" stroke-linecap="round"/>
      <circle cx="72" cy="36" r="2.5" fill="#C9A84C" filter="url(#glow)"/>
      <circle cx="45" cy="45" r="2" fill="#C9A84C" filter="url(#glow)"/>
    </g>
    <text x="880" y="115" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="38" fill="#C9A84C">{brand}</text>
    <text x="880" y="148" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#9BA3AF">{section}</text>

    <!-- Breaking row -->
    <g transform="translate(820, 250)">
      <rect x="0" y="0" width="140" height="44" rx="22" fill="url(#breakingPill)"/>
      <circle cx="30" cy="22" r="7" fill="#FFFFFF"/>
      <text x="125" y="30" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF">{breaking}</text>
    </g>
    <g transform="translate(620, 250)">
      <rect x="0" y="4" width="180" height="36" rx="4" fill="none" stroke="#C9A84C" stroke-width="1" opacity="0.7"/>
      <text x="165" y="28" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="15" fill="#E8C574">{shape(category)}</text>
    </g>
    <text x="80" y="278" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#9BA3AF">{news_tag}</text>

    <!-- Photo + caption -->
    <g transform="translate(80, 330)" clip-path="url(#photoClip)">
      <image x="0" y="0" width="920" height="520" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,{photo_b64}"/>
    </g>
    <rect x="80" y="330" width="6" height="520" fill="#C9A84C"/>
    <g transform="translate(80, 330)">
      <rect x="150" y="6" width="12" height="12" fill="#DC2626" rx="6"/>
      <text x="170" y="18" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="16" fill="#C9A84C">{shape(figure_name)}</text>
    </g>
    <g transform="translate(80, 850)">
      <rect x="0" y="0" width="920" height="40" fill="#0D1B2A" opacity="0.85"/>
      <text x="890" y="32" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#E8C574">{shape(caption)}</text>
    </g>

    <!-- Headline -->
    <line x1="80" y1="890" x2="1000" y2="890" stroke="url(#goldLine)" stroke-width="1"/>
    <text x="1000" y="955" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="48" fill="#F5F4EF">{shape(headline_line1)}</text>
    <text x="1000" y="1015" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="48" fill="#F5F4EF">{shape(headline_line2)}</text>
    <text x="1000" y="1075" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="22" fill="#9BA3AF">{shape(subhead)}</text>
    <rect x="80" y="925" width="6" height="110" fill="#C9A84C"/>

    <!-- Market impact -->
    <g transform="translate(80, 1150)">
      <rect x="0" y="0" width="920" height="250" rx="10" fill="url(#impactGrad)" stroke="#1A2744" stroke-width="1"/>
      <rect x="0" y="0" width="920" height="6" fill="#C9A84C"/>
      <text x="892" y="50" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="24" fill="#C9A84C">{shape(impact_heading)}</text>
      {assets_svg}
    </g>

    <!-- FOOTER: date (right) + IST logo + بدعم من (left) on SAME line — بدعم من BEFORE logo in RTL -->
    <g transform="translate(0, 1450)">
      <text x="1000" y="45" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#E8C574">{shape(date_ar)}</text>
      <image x="80" y="10" width="240" height="60" preserveAspectRatio="xMinYMid meet" opacity="0.95" href="data:image/png;base64,{ist_b64}"/>
      <text x="350" y="45" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#C9A84C" opacity="0.9">{poweredby}</text>
    </g>

    <text x="540" y="1560" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="12" fill="#9BA3AF" opacity="0.75">{disclaim}</text>
  </g>
</svg>'''

    with open(out_svg, "w", encoding="utf-8") as f:
        f.write(SVG)
    cairosvg.svg2png(url=out_svg, write_to=out_png, output_width=1080, output_height=1620)
    print(f"✓ {out_svg}  ({os.path.getsize(out_svg)} bytes)")
    print(f"✓ {out_png}  ({os.path.getsize(out_png)} bytes)")


# Example usage — Trump ceasefire news
if __name__ == "__main__":
    build_news_card(
        headline_line1="ترامب يمدد وقف إطلاق النار",
        headline_line2="بين إسرائيل ولبنان",
        subhead="ثلاثة أسابيع إضافية · الإعلان عبر منصة «تروث سوشيال»",
        caption="إعلان عبر «تروث سوشيال» · تمديد وقف إطلاق النار",
        figure_name="دونالد ترامب",
        category="جيوسياسي",
        impact_heading="التأثير على الأسواق",
        assets=[
            {"name":"الدولار الأمريكي","reaction":"دخول جو المخاطرة","dir":"down"},
            {"name":"النفط","reaction":"تراجع علاوة المخاطر","dir":"down"},
            {"name":"الذهب","reaction":"انحسار الملاذ الآمن","dir":"down"},
            {"name":"الشيكل الإسرائيلي","reaction":"قوة أمام الدولار","dir":"up"},
        ],
        photo_path="/sessions/vibrant-fervent-galileo/mnt/MarselAlsouq/Image (3).jpg",
        date_ar="٢٤ أبريل ٢٠٢٦ · ١٤:٣٠ ت.غ",
        out_svg="/tmp/test_news_AR.svg",
        out_png="/tmp/test_news_AR.png",
    )
