#!/usr/bin/env python3
"""Rebuild NAVY NZDUSD SELL signal card — full Arabic RTL, 10px frame,
correct RTL card order (الدخول first / right, وقف الخسارة middle, جني الأرباح left),
setup on right / R:R on left, and footer lockup = date + "بدعم من" + IST logo on SAME line.
"""

import arabic_reshaper
from bidi.algorithm import get_display
import cairosvg
import os

OUT_SVG = "/sessions/vibrant-fervent-galileo/mnt/MarselAlsouq/MarsadAlSouq_Signal_NZDUSD_SELL.svg"
OUT_PNG = "/sessions/vibrant-fervent-galileo/mnt/MarselAlsouq/MarsadAlSouq_Signal_NZDUSD_SELL.png"

def s(txt):
    return get_display(arabic_reshaper.reshape(txt))

# IST logo base64
with open("/sessions/vibrant-fervent-galileo/ist_logo_white_b64.txt") as f:
    ist_b64 = f.read().strip()

# Pre-shape Arabic
brand        = s("مرصد السوق")
brand_sub    = s("مرصد الأسواق المالية")
forex_tag    = s("فوركس")
timeframe    = s("الساعة ١")
signal_tag   = s("إشارة تداول")
pair_ar      = s("نيوزيلندي / أمريكي")
sell_ar      = s("بيع")
chart_hdr    = s("NZD/USD · الساعة ١ · الإعداد الفني")
chart_range  = s("٠٣ إلى ٢٣ أبريل ٢٠٢٦")
trendline    = s("خط اتجاه صاعد")
supply       = s("منطقة عرض")
entry_badge  = s("دخول")
sl_badge     = s("وقف")
tp_badge     = s("هدف")
levels_hdr   = s("مستويات الصفقة")
entry_lbl    = s("الدخول")
sl_lbl       = s("وقف الخسارة")
tp_lbl       = s("جني الأرباح")
market_note  = s("من السوق")
sl_pips      = s("٤٨٫٦ نقطة مخاطرة")
tp_pips      = s("٣٩٫٤ نقطة هدف")
rr_lbl       = s("المخاطرة / المكافأة")
rr_val       = s("١ : ٠٫٨١")
setup_lbl    = s("النموذج")
setup_val    = s("كسر خط الاتجاه · رفض منطقة عرض")
date_ar      = s("٢٣ أبريل ٢٠٢٦")
disclaim_ar  = s("للأغراض التعليمية فقط · ليست نصيحة مالية · إدارة المخاطر مسؤوليتك")
poweredby    = s("بدعم من")

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
    <linearGradient id="sellPill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#B91C1C"/>
    </linearGradient>
    <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="targetFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#DC2626" stop-opacity="0"/>
      <stop offset="100%" stop-color="#DC2626" stop-opacity="0.25"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="cardFrame">
      <rect x="10" y="10" width="1060" height="1600" rx="14"/>
    </clipPath>
  </defs>

  <!-- Outer matte frame -->
  <rect width="1080" height="1620" fill="#070E1A"/>

  <g clip-path="url(#cardFrame)">
    <rect x="10" y="10" width="1060" height="1600" fill="url(#bg)"/>
    <circle cx="10" cy="10" r="480" fill="#C9A84C" opacity="0.04"/>
    <circle cx="1070" cy="1610" r="430" fill="#C9A84C" opacity="0.03"/>

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
    <text x="880" y="148" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#E8C574">{brand_sub}</text>

    <line x1="40" y1="215" x2="1040" y2="215" stroke="url(#goldLine)" stroke-width="1"/>

    <!-- Ticker row -->
    <g transform="translate(760, 250)">
      <rect x="170" y="0" width="110" height="32" rx="4" fill="none" stroke="#C9A84C" stroke-width="1" opacity="0.6"/>
      <text x="225" y="21" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="14" fill="#E8C574">{forex_tag}</text>
      <rect x="70" y="0" width="90" height="32" rx="4" fill="none" stroke="#9BA3AF" stroke-width="1" opacity="0.5"/>
      <text x="115" y="21" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="13" fill="#F5F4EF">{timeframe}</text>
    </g>
    <text x="80" y="272" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="16" fill="#9BA3AF">{signal_tag}</text>

    <!-- Pair + SELL -->
    <text x="1000" y="380" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="96" fill="#F5F4EF" letter-spacing="-2">NZDUSD</text>
    <text x="1000" y="415" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="18" fill="#9BA3AF">{pair_ar}</text>

    <g transform="translate(80, 330)">
      <rect x="0" y="0" width="220" height="60" rx="8" fill="url(#sellPill)"/>
      <path d="M 26 18 L 38 36 L 50 18 Z" fill="#FFFFFF"/>
      <text x="195" y="45" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="34" fill="#FFFFFF">{sell_ar}</text>
    </g>

    <!-- Chart -->
    <g transform="translate(80, 460)">
      <rect x="0" y="0" width="920" height="420" rx="10" fill="#0A1220" stroke="#1A2744" stroke-width="1"/>
      <text x="900" y="28" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="13" fill="#C9A84C">{chart_hdr}</text>
      <text x="20" y="28" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="12" fill="#6B7280">{chart_range}</text>

      <g stroke="#1F2937" stroke-width="0.5" opacity="0.7">
        <line x1="60" y1="80" x2="860" y2="80"/>
        <line x1="60" y1="140" x2="860" y2="140"/>
        <line x1="60" y1="200" x2="860" y2="200"/>
        <line x1="60" y1="260" x2="860" y2="260"/>
        <line x1="60" y1="320" x2="860" y2="320"/>
        <line x1="60" y1="380" x2="860" y2="380"/>
      </g>

      <g font-family="Montserrat, Arial, sans-serif" font-size="9" fill="#6B7280" text-anchor="start">
        <text x="870" y="83">0.5930</text>
        <text x="870" y="143">0.5890</text>
        <text x="870" y="203">0.5850</text>
        <text x="870" y="263">0.5810</text>
        <text x="870" y="323">0.5770</text>
        <text x="870" y="383">0.5730</text>
      </g>

      <g font-family="Cairo, Amiri, Arial, sans-serif" font-size="10" fill="#6B7280" text-anchor="middle">
        <text x="100" y="400">{s("٠٧ أبريل")}</text>
        <text x="240" y="400">{s("١١ أبريل")}</text>
        <text x="380" y="400">{s("١٥ أبريل")}</text>
        <text x="520" y="400">{s("١٩ أبريل")}</text>
        <text x="660" y="400">{s("٢٢ أبريل")}</text>
        <text x="790" y="400">{s("٢٣ أبريل")}</text>
      </g>

      <path d="M 70 350 L 95 360 L 120 340 L 145 310 L 170 270 L 200 240 L 235 220 L 275 200 L 315 185 L 355 170 L 395 160 L 430 150 L 470 140 L 510 145 L 540 130 L 575 150 L 610 135 L 640 115 L 675 140 L 705 120 L 735 110 L 770 130 L 795 170 L 815 190 L 860 200 L 860 390 L 70 390 Z"
            fill="url(#chartGrad)" opacity="0.5"/>

      <line x1="180" y1="310" x2="790" y2="170" stroke="#C9A84C" stroke-width="2" opacity="0.85" stroke-linecap="round"/>
      <text x="200" y="325" font-family="Cairo, Amiri, Arial, sans-serif" font-size="11" fill="#C9A84C" opacity="0.9">{trendline}</text>

      <rect x="440" y="100" width="50" height="35" fill="#DC2626" opacity="0.22" stroke="#DC2626" stroke-width="0.8" stroke-opacity="0.5"/>
      <rect x="670" y="100" width="55" height="35" fill="#DC2626" opacity="0.22" stroke="#DC2626" stroke-width="0.8" stroke-opacity="0.5"/>
      <text x="465" y="96" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-size="10" fill="#FCA5A5">{supply}</text>

      <path d="M 70 350 L 95 360 L 120 340 L 145 310 L 170 270 L 200 240 L 235 220 L 275 200 L 315 185 L 355 170 L 395 160 L 430 150 L 470 140 L 510 145 L 540 130 L 575 150 L 610 135 L 640 115 L 675 140 L 705 120 L 735 110 L 770 130 L 795 170 L 815 190"
            fill="none" stroke="#F5F4EF" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>

      <g>
        <rect x="203" y="236" width="4" height="14" fill="#C9A84C" opacity="0.7"/>
        <rect x="278" y="196" width="4" height="14" fill="#C9A84C" opacity="0.7"/>
        <rect x="358" y="166" width="4" height="14" fill="#C9A84C" opacity="0.7"/>
        <rect x="433" y="146" width="4" height="14" fill="#C9A84C" opacity="0.7"/>
        <rect x="513" y="141" width="4" height="14" fill="#DC2626" opacity="0.6"/>
        <rect x="578" y="146" width="4" height="14" fill="#DC2626" opacity="0.6"/>
        <rect x="643" y="111" width="4" height="14" fill="#C9A84C" opacity="0.7"/>
        <rect x="678" y="136" width="4" height="14" fill="#DC2626" opacity="0.6"/>
        <rect x="708" y="116" width="4" height="14" fill="#C9A84C" opacity="0.7"/>
        <rect x="773" y="126" width="4" height="14" fill="#DC2626" opacity="0.7"/>
        <rect x="798" y="166" width="4" height="14" fill="#DC2626" opacity="0.8"/>
        <rect x="818" y="186" width="4" height="18" fill="#DC2626" opacity="0.9"/>
      </g>

      <line x1="60" y1="192" x2="860" y2="192" stroke="#C9A84C" stroke-width="1" stroke-dasharray="4 4" opacity="0.8"/>
      <rect x="2" y="181" width="58" height="22" rx="3" fill="#C9A84C"/>
      <text x="31" y="197" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="12" fill="#0D1B2A">{entry_badge}</text>

      <line x1="60" y1="120" x2="860" y2="120" stroke="#DC2626" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>
      <rect x="2" y="109" width="58" height="22" rx="3" fill="#DC2626"/>
      <text x="31" y="125" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="12" fill="#FFFFFF">{sl_badge}</text>

      <line x1="60" y1="252" x2="860" y2="252" stroke="#059669" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>
      <rect x="2" y="241" width="58" height="22" rx="3" fill="#059669"/>
      <text x="31" y="257" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="12" fill="#FFFFFF">{tp_badge}</text>

      <path d="M 825 195 Q 835 220 830 245" fill="none" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="830,252 824,240 836,240" fill="#DC2626"/>
      <rect x="810" y="252" width="50" height="15" fill="url(#targetFade)" opacity="0.7"/>
    </g>

    <line x1="40" y1="920" x2="1040" y2="920" stroke="url(#goldLine)" stroke-width="1"/>

    <!-- Levels section title (right-anchored) -->
    <text x="1000" y="965" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="18" fill="#C9A84C">{levels_hdr}</text>

    <!-- ============ RTL ORDER: الدخول (right) · وقف الخسارة (middle) · جني الأرباح (left) ============ -->

    <!-- الدخول (rightmost - first in RTL reading) -->
    <g transform="translate(706, 1000)">
      <rect x="0" y="0" width="294" height="130" rx="8" fill="#111827" stroke="#1A2744" stroke-width="1"/>
      <rect x="0" y="0" width="294" height="6" fill="#C9A84C"/>
      <text x="274" y="40" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="16" fill="#E8C574">{entry_lbl}</text>
      <text x="274" y="85" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="32" fill="#F5F4EF">0.58714</text>
      <text x="274" y="115" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="12" fill="#C9A84C">{market_note}</text>
    </g>

    <!-- وقف الخسارة (middle) -->
    <g transform="translate(393, 1000)">
      <rect x="0" y="0" width="295" height="130" rx="8" fill="#111827" stroke="#1A2744" stroke-width="1"/>
      <rect x="0" y="0" width="295" height="6" fill="#DC2626"/>
      <text x="275" y="40" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="16" fill="#FCA5A5">{sl_lbl}</text>
      <text x="275" y="85" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="32" fill="#F5F4EF">0.59200</text>
      <text x="275" y="115" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="12" fill="#DC2626">{sl_pips}</text>
    </g>

    <!-- جني الأرباح (leftmost - last in RTL reading) -->
    <g transform="translate(80, 1000)">
      <rect x="0" y="0" width="295" height="130" rx="8" fill="#111827" stroke="#1A2744" stroke-width="1"/>
      <rect x="0" y="0" width="295" height="6" fill="#059669"/>
      <text x="275" y="40" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="16" fill="#6EE7B7">{tp_lbl}</text>
      <text x="275" y="85" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="32" fill="#F5F4EF">0.58320</text>
      <text x="275" y="115" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="12" fill="#059669">{tp_pips}</text>
    </g>

    <!-- ============ Setup (RIGHT) + R:R (LEFT) ============ -->
    <g transform="translate(80, 1170)">
      <!-- النموذج (right) -->
      <text x="920" y="20" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="14" fill="#9BA3AF">{setup_lbl}</text>
      <text x="920" y="52" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#F5F4EF">{setup_val}</text>
      <!-- المخاطرة / المكافأة (left) -->
      <text x="0" y="20" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="14" fill="#9BA3AF">{rr_lbl}</text>
      <text x="0" y="52" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="24" fill="#E8C574">{rr_val}</text>
    </g>

    <line x1="40" y1="1260" x2="1040" y2="1260" stroke="url(#goldLine)" stroke-width="1"/>

    <!-- ============ FOOTER: date (right) | IST logo + "بدعم من" (left) — unified standard, no duplicate scope ============ -->
    <!-- RTL reading order on left cluster: بدعم من (right of logo) → IST logo (left) -->
    <g transform="translate(0, 1310)">
      <!-- Date (right side of footer) -->
      <text x="1000" y="45" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#E8C574">{date_ar}</text>

      <!-- IST Markets logo (far LEFT — no scope duplicate per BRAND_STANDARDS_AR §5) -->
      <image x="80" y="10" width="240" height="60" preserveAspectRatio="xMinYMid meet" opacity="0.95" href="data:image/png;base64,{ist_b64}"/>

      <!-- "بدعم من" — BEFORE the logo in RTL (to the right of the logo) -->
      <text x="350" y="45" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#C9A84C" opacity="0.9">{poweredby}</text>
    </g>

    <!-- Disclaimer (small, below footer) -->
    <text x="540" y="1430" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="12" fill="#9BA3AF" opacity="0.75">{disclaim_ar}</text>
  </g>
</svg>
'''

with open(OUT_SVG, "w", encoding="utf-8") as f:
    f.write(SVG)

print(f"SVG written: {OUT_SVG}  ({os.path.getsize(OUT_SVG)} bytes)")

cairosvg.svg2png(url=OUT_SVG, write_to=OUT_PNG, output_width=1080, output_height=1620)
print(f"PNG rendered: {OUT_PNG}  ({os.path.getsize(OUT_PNG)} bytes)")
