#!/usr/bin/env python3
"""Marsad Al Souq — Economic Calendar card (1080x1620 AR, navy + gold).
High-impact (★★★) events filtered from today's calendar.
"""

import arabic_reshaper
from bidi.algorithm import get_display
import cairosvg
import os

OUT_SVG = "/sessions/vibrant-fervent-galileo/mnt/MarselAlsouq/MarsadAlSouq_EconCalendar_AR.svg"
OUT_PNG = OUT_SVG.replace(".svg", ".png")

def s(t):
    return get_display(arabic_reshaper.reshape(t))

with open("/sessions/vibrant-fervent-galileo/ist_logo_white_b64.txt") as f:
    ist_b64 = f.read().strip()

# ---------------- content ----------------
brand_title    = s("مرصد السوق")
brand_subtitle = s("قسم الاقتصاد")

title_main   = s("الأجندة الاقتصادية")
title_sub    = s("أهم أحداث اليوم · عالية التأثير (★★★)")

date_header  = s("الجمعة · ٢٤ أبريل ٢٠٢٦")

# Column headers — Arabic RTL (right to left visual order: time, flag, event, actual/forecast/prev)
col_time     = s("الوقت")
col_country  = s("الدولة")
col_event    = s("الحدث")
col_actual   = s("حالي")
col_forecast = s("تقدير")
col_previous = s("سابق")

# ---------------- Events (★★★ only) ----------------
# tone: "beat" (actual > forecast → green), "miss" (actual < forecast → red), "neutral" (near or N/A)
events = [
    {"time": "12:00", "cc": "DE", "evt": s("مؤشر IFO لمناخ الأعمال الألماني (أبريل)"),
     "actual": "84.4", "fcast": "85.7", "prev": "86.3", "tone": "miss"},
    {"time": "12:00", "cc": "DE", "evt": s("توقعات الأعمال الألماني (أبريل)"),
     "actual": "83.3", "fcast": "85.0", "prev": "85.9", "tone": "miss"},
    {"time": "12:00", "cc": "DE", "evt": s("مؤشر التقييم الحالي الألماني (أبريل)"),
     "actual": "85.4", "fcast": "86.2", "prev": "86.7", "tone": "miss"},
    {"time": "16:30", "cc": "CA", "evt": s("مبيعات التجزئة الأساسية (شهري · فبراير)"),
     "actual": "0.5%", "fcast": "0.8%", "prev": "1.0%", "tone": "miss"},
    {"time": "16:30", "cc": "CA", "evt": s("مبيعات التجزئة (شهري · فبراير)"),
     "actual": "0.7%", "fcast": "0.9%", "prev": "1.2%", "tone": "miss"},
    {"time": "18:00", "cc": "US", "evt": s("ميشيغان · ثقة المستهلك (أبريل)"),
     "actual": "49.8", "fcast": "47.6", "prev": "53.3", "tone": "beat"},
    {"time": "18:00", "cc": "US", "evt": s("ميشيغان · توقعات التضخم 5 سنوات"),
     "actual": "3.5%", "fcast": "3.4%", "prev": "3.2%", "tone": "beat"},
    {"time": "19:00", "cc": "CA", "evt": s("الموازنة العامة للحكومة (فبراير)"),
     "actual": "5.66B", "fcast": "—", "prev": "-5.07B", "tone": "beat"},
]

# ---------------- Mini flag builder ----------------
def flag_svg(cc, x, y, w=56, h=38):
    """Return SVG elements for a small rectangular national flag at (x,y)."""
    if cc == "DE":
        return f'''<rect x="{x}" y="{y}" width="{w}" height="{h/3}" fill="#000000"/>
<rect x="{x}" y="{y+h/3}" width="{w}" height="{h/3}" fill="#DD0000"/>
<rect x="{x}" y="{y+2*h/3}" width="{w}" height="{h/3}" fill="#FFCE00"/>
<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#C9A84C" stroke-width="0.8" opacity="0.5"/>'''
    if cc == "CA":
        return f'''<rect x="{x}" y="{y}" width="{w*0.25}" height="{h}" fill="#D52B1E"/>
<rect x="{x+w*0.25}" y="{y}" width="{w*0.5}" height="{h}" fill="#FFFFFF"/>
<rect x="{x+w*0.75}" y="{y}" width="{w*0.25}" height="{h}" fill="#D52B1E"/>
<circle cx="{x+w/2}" cy="{y+h/2}" r="7" fill="#D52B1E"/>
<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#C9A84C" stroke-width="0.8" opacity="0.5"/>'''
    if cc == "US":
        stripes = ''
        for i in range(7):
            if i % 2 == 0:
                stripes += f'<rect x="{x}" y="{y + i*h/13}" width="{w}" height="{h/13}" fill="#B22234"/>'
            else:
                stripes += f'<rect x="{x}" y="{y + i*h/13}" width="{w}" height="{h/13}" fill="#FFFFFF"/>'
        for i in range(6):
            stripes += f'<rect x="{x + w*7/13}" y="{y + (7+i)*h/13}" width="{w*6/13}" height="{h/13}" fill="{"#B22234" if i%2==0 else "#FFFFFF"}"/>'
            stripes += f'<rect x="{x}" y="{y + (7+i)*h/13}" width="{w*7/13}" height="{h/13}" fill="{"#FFFFFF" if i%2==0 else "#B22234"}"/>' if False else ''
        stripes += f'<rect x="{x}" y="{y}" width="{w*0.42}" height="{h*7/13}" fill="#3C3B6E"/>'
        stripes += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" stroke="#C9A84C" stroke-width="0.8" opacity="0.5"/>'
        return stripes
    # Fallback: code pill
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="#1A2744" stroke="#C9A84C" stroke-width="0.8"/><text x="{x+w/2}" y="{y+h*0.7}" text-anchor="middle" font-family="Montserrat, Arial" font-weight="800" font-size="14" fill="#F5F4EF">{cc}</text>'

# ---------------- Layout ----------------
TABLE_X     = 40
TABLE_W     = 1000
ROW_H       = 108
HEADER_Y    = 510
FIRST_ROW_Y = HEADER_Y + 58

# Colors
TONE = {
    "beat":    "#10B981",
    "miss":    "#DC2626",
    "neutral": "#9BA3AF",
}

# ---------------- SVG ----------------
svg = f'''<?xml version="1.0" encoding="UTF-8"?>
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
    <linearGradient id="headerRow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1A2744"/>
      <stop offset="100%" stop-color="#0F1B2E"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="cardFrame">
      <rect x="10" y="10" width="1060" height="1600" rx="14"/>
    </clipPath>
  </defs>

  <rect width="1080" height="1620" fill="#070E1A"/>

  <g clip-path="url(#cardFrame)">
    <rect x="10" y="10" width="1060" height="1600" fill="url(#bg)"/>
    <circle cx="10" cy="10" r="480" fill="#C9A84C" opacity="0.04"/>
    <circle cx="1070" cy="1610" r="430" fill="#1E88E5" opacity="0.04"/>

    <!-- ============ BRAND HEADER ============ -->
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
    <text x="890" y="122" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="46" fill="#C9A84C">{brand_title}</text>
    <text x="890" y="160" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="18" fill="#E8C574">{brand_subtitle}</text>
    <line x1="80" y1="215" x2="1000" y2="215" stroke="url(#goldLine)" stroke-width="1"/>

    <!-- ============ TITLE ============ -->
    <rect x="80" y="270" width="6" height="110" fill="#C9A84C"/>
    <text x="1000" y="325" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="60" fill="#F5F4EF">{title_main}</text>
    <text x="1000" y="365" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="22" fill="#9BA3AF">{title_sub}</text>

    <!-- Date pill -->
    <g transform="translate(760, 395)">
      <rect x="0" y="0" width="240" height="40" rx="6" fill="none" stroke="#C9A84C" stroke-width="1" opacity="0.65"/>
      <text x="220" y="27" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#E8C574">{date_header}</text>
    </g>

    <!-- ============ TABLE HEADER ============ -->
    <!-- Background bar for header row -->
    <rect x="{TABLE_X}" y="{HEADER_Y - 10}" width="{TABLE_W}" height="48" rx="8" fill="url(#headerRow)" stroke="#C9A84C" stroke-width="0.6"/>
    <!-- Column labels (RTL order): time (far right) | country | event | actual | forecast | previous (far left) -->
    <text x="990" y="{HEADER_Y + 21}" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#C9A84C">{col_time}</text>
    <text x="900" y="{HEADER_Y + 21}" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#C9A84C">{col_country}</text>
    <text x="750" y="{HEADER_Y + 21}" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#C9A84C">{col_event}</text>
    <text x="290" y="{HEADER_Y + 21}" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#C9A84C">{col_actual}</text>
    <text x="180" y="{HEADER_Y + 21}" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#C9A84C">{col_forecast}</text>
    <text x="80" y="{HEADER_Y + 21}" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="17" fill="#C9A84C">{col_previous}</text>
'''

# ---------------- Rows ----------------
for i, ev in enumerate(events):
    y = FIRST_ROW_Y + i * ROW_H
    tone_col = TONE[ev["tone"]]
    row_bg = "#0A1628" if i % 2 == 0 else "#0E1C32"

    svg += f'''
    <!-- Row {i+1} -->
    <g>
      <rect x="{TABLE_X}" y="{y}" width="{TABLE_W}" height="{ROW_H - 8}" rx="8" fill="{row_bg}" stroke="#1A2744" stroke-width="0.8"/>
      <!-- Tone stripe on right edge (RTL side) — used as severity indicator -->
      <rect x="{TABLE_X + TABLE_W - 4}" y="{y}" width="4" height="{ROW_H - 8}" rx="2" fill="{tone_col}"/>

      <!-- Time -->
      <text x="990" y="{y + 42}" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="22" fill="#F5F4EF">{ev["time"]}</text>
      <!-- 3 impact stars under time -->
      <text x="990" y="{y + 72}" text-anchor="end" font-family="Arial, sans-serif" font-weight="700" font-size="16" fill="#C9A84C">★ ★ ★</text>

      <!-- Flag + currency code -->
      {flag_svg(ev["cc"], 820, y + 22)}
      <text x="848" y="{y + 88}" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="15" fill="#E8C574" letter-spacing="1">{ev["cc"]}</text>

      <!-- Event name (Arabic, RTL) -->
      <text x="780" y="{y + 50}" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="22" fill="#F5F4EF">{ev["evt"]}</text>

      <!-- Actual / Forecast / Previous (centered columns) -->
      <!-- Actual (color-coded) -->
      <text x="290" y="{y + 50}" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="24" fill="{tone_col}">{ev["actual"]}</text>
      <text x="290" y="{y + 72}" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="11" fill="#9BA3AF" letter-spacing="1">A</text>
      <!-- Forecast -->
      <text x="180" y="{y + 50}" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="22" fill="#9BA3AF">{ev["fcast"]}</text>
      <text x="180" y="{y + 72}" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="11" fill="#6B7280" letter-spacing="1">F</text>
      <!-- Previous -->
      <text x="80" y="{y + 50}" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="500" font-size="20" fill="#6B7280">{ev["prev"]}</text>
      <text x="80" y="{y + 72}" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="11" fill="#4B5563" letter-spacing="1">P</text>
    </g>
'''

# ---------------- Legend + Footer ----------------
legend_y = FIRST_ROW_Y + len(events) * ROW_H + 10
svg += f'''
    <!-- Legend -->
    <g transform="translate(40, {legend_y})">
      <rect x="0" y="0" width="1000" height="40" rx="8" fill="#0A1628" stroke="#1A2744" stroke-width="0.8"/>
      <!-- Green beat -->
      <circle cx="960" cy="20" r="6" fill="#10B981"/>
      <text x="940" y="26" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="14" fill="#F5F4EF">{s("نتيجة فوق التوقعات")}</text>
      <!-- Red miss -->
      <circle cx="720" cy="20" r="6" fill="#DC2626"/>
      <text x="700" y="26" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="14" fill="#F5F4EF">{s("نتيجة دون التوقعات")}</text>
      <!-- Neutral -->
      <circle cx="460" cy="20" r="6" fill="#9BA3AF"/>
      <text x="440" y="26" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="14" fill="#F5F4EF">{s("قريب من التوقعات")}</text>
      <!-- A / F / P key -->
      <text x="180" y="26" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="13" fill="#9BA3AF">{s("A حالي · F تقدير · P سابق")}</text>
    </g>

    <!-- Horizontal gold line before footer -->
    <line x1="40" y1="1430" x2="1040" y2="1430" stroke="url(#goldLine)" stroke-width="1"/>

    <!-- FOOTER -->
    <g transform="translate(0, 1460)">
      <text x="1000" y="45" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#E8C574">{s("٢٤ أبريل ٢٠٢٦")}</text>
      <image x="80" y="10" width="240" height="60" preserveAspectRatio="xMinYMid meet" opacity="0.95" href="data:image/png;base64,{ist_b64}"/>
      <text x="350" y="45" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#C9A84C" opacity="0.9">{s("بدعم من")}</text>
    </g>

    <text x="540" y="1580" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="12" fill="#9BA3AF" opacity="0.75">{s("للأغراض التعليمية فقط · النتائج الماضية لا تضمن النتائج المستقبلية · إدارة المخاطر مسؤوليتك")}</text>
  </g>
</svg>
'''

with open(OUT_SVG, "w", encoding="utf-8") as f:
    f.write(svg)

cairosvg.svg2png(url=OUT_SVG, write_to=OUT_PNG, output_width=1080, output_height=1620)
print("SVG:", os.path.getsize(OUT_SVG), "bytes")
print("PNG:", os.path.getsize(OUT_PNG), "bytes")
print("DONE")
