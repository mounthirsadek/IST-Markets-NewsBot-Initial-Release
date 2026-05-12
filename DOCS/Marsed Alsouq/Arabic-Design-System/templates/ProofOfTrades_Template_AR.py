#!/usr/bin/env python3
"""Marsad Al Souq — Proof of Trades card (1080x1620 AR).
Embeds the ACTUAL MT5 terminal screenshot (Image 4) inside the brand frame as proof.
"""

import arabic_reshaper
from bidi.algorithm import get_display
import cairosvg
import os

OUT_SVG = "/sessions/vibrant-fervent-galileo/mnt/MarselAlsouq/MarsadAlSouq_ProofOfTrades_AR.svg"
OUT_PNG = OUT_SVG.replace(".svg", ".png")

def s(t):
    return get_display(arabic_reshaper.reshape(t))

with open("/sessions/vibrant-fervent-galileo/ist_logo_white_b64.txt") as f:
    ist_b64 = f.read().strip()

with open("/sessions/vibrant-fervent-galileo/image4_b64.txt") as f:
    mt5_b64 = f.read().strip()

# ---------------- content ----------------
brand_title    = s("مرصد السوق")
brand_subtitle = s("قسم التداول")

title_main   = s("إثبات الصفقات")
title_sub    = s("لقطة حقيقية من منصة MT5 · حسابات مباشرة")

# Screenshot label / caption
shot_label   = s("لقطة شاشة · MetaTrader 5")

# Totals
total_label    = s("إجمالي الأرباح المحقَّقة")
total_value    = "2,698.78 USD"

period_label   = s("الفترة · ١٧–٢٤ أبريل ٢٠٢٦")

poweredby      = s("بدعم من")
date_ar        = s("٢٤ أبريل ٢٠٢٦")
disclaim       = s("للأغراض التعليمية فقط · النتائج الماضية لا تضمن النتائج المستقبلية · إدارة المخاطر مسؤوليتك")

# ---------------- Screenshot geometry ----------------
# Original image: 1170 x 554  →  aspect ratio ≈ 2.1119
IMG_W = 960
IMG_H = int(IMG_W / (1170 / 554))   # ≈ 454
IMG_X = (1080 - IMG_W) // 2          # = 60 — centered horizontally
IMG_Y = 560                          # below title + section label

# Card padding around the white screenshot (so it reads as a framed photo)
PAD   = 18
CARD_X = IMG_X - PAD
CARD_Y = IMG_Y - PAD
CARD_W = IMG_W + PAD * 2
CARD_H = IMG_H + PAD * 2

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
    <linearGradient id="totalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0F1F18"/>
      <stop offset="100%" stop-color="#0A1220"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shotShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dx="0" dy="6"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="cardFrame">
      <rect x="10" y="10" width="1060" height="1600" rx="14"/>
    </clipPath>
    <clipPath id="shotClip">
      <rect x="{IMG_X}" y="{IMG_Y}" width="{IMG_W}" height="{IMG_H}" rx="10"/>
    </clipPath>
  </defs>

  <!-- Outer matte frame (10px safe zone) -->
  <rect width="1080" height="1620" fill="#070E1A"/>

  <g clip-path="url(#cardFrame)">
    <rect x="10" y="10" width="1060" height="1600" fill="url(#bg)"/>
    <circle cx="10" cy="10" r="480" fill="#C9A84C" opacity="0.04"/>
    <circle cx="1070" cy="1610" r="430" fill="#1E88E5" opacity="0.04"/>

    <!-- ============ BRAND HEADER (right-anchored) ============ -->
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

    <!-- ============ TITLE BLOCK ============ -->
    <rect x="80" y="270" width="6" height="110" fill="#C9A84C"/>
    <text x="1000" y="325" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="800" font-size="64" fill="#F5F4EF">{title_main}</text>
    <text x="1000" y="370" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="22" fill="#9BA3AF">{title_sub}</text>

    <g transform="translate(780, 400)">
      <rect x="0" y="0" width="220" height="38" rx="6" fill="none" stroke="#C9A84C" stroke-width="1" opacity="0.65"/>
      <text x="200" y="26" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="16" fill="#E8C574">{period_label}</text>
    </g>

    <!-- Screenshot caption strip -->
    <g transform="translate(80, 470)">
      <circle cx="10" cy="18" r="5" fill="#1E88E5"/>
      <text x="26" y="24" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="16" fill="#C9A84C" letter-spacing="1">MT5 · LIVE ACCOUNT</text>
    </g>
    <text x="1000" y="494" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="22" fill="#C9A84C">{shot_label}</text>
    <line x1="80" y1="515" x2="1000" y2="515" stroke="#C9A84C" stroke-width="0.5" opacity="0.3"/>

    <!-- ============ MT5 SCREENSHOT (embedded as-is) ============ -->
    <!-- White card (the "screenshot frame") -->
    <rect x="{CARD_X}" y="{CARD_Y}" width="{CARD_W}" height="{CARD_H}" rx="14" fill="#FFFFFF" stroke="#C9A84C" stroke-width="1.5" filter="url(#shotShadow)"/>
    <!-- The actual MT5 terminal screenshot -->
    <image x="{IMG_X}" y="{IMG_Y}" width="{IMG_W}" height="{IMG_H}"
           preserveAspectRatio="xMidYMid meet"
           href="data:image/jpeg;base64,{mt5_b64}"
           clip-path="url(#shotClip)"/>

    <!-- Small "proof" seal at screenshot top-right corner -->
    <g transform="translate({IMG_X + IMG_W - 150}, {IMG_Y - 6})">
      <rect x="0" y="-18" width="140" height="32" rx="16" fill="#0D1B2A" stroke="#C9A84C" stroke-width="1"/>
      <circle cx="18" cy="-2" r="4" fill="#1E88E5"/>
      <text x="32" y="3" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="13" fill="#F5F4EF" letter-spacing="1">VERIFIED</text>
    </g>

    <!-- ============ TOTAL SUMMARY BOX ============ -->
    <g transform="translate(80, {CARD_Y + CARD_H + 30})">
      <rect x="0" y="0" width="920" height="110" rx="12" fill="url(#totalGrad)" stroke="#1E88E5" stroke-width="1.5"/>
      <rect x="0" y="0" width="920" height="5" fill="#1E88E5"/>

      <text x="890" y="48" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="700" font-size="22" fill="#C9A84C">{total_label}</text>
      <text x="890" y="82" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#9BA3AF">{s("من ٤ صفقات")}</text>

      <text x="30" y="72" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="44" fill="#1E88E5">{total_value}</text>
    </g>

    <!-- Horizontal gold line before footer -->
    <line x1="40" y1="1430" x2="1040" y2="1430" stroke="url(#goldLine)" stroke-width="1"/>

    <!-- ============ FOOTER: date (right) | IST logo + "بدعم من" (left) ============ -->
    <g transform="translate(0, 1460)">
      <text x="1000" y="45" text-anchor="end" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="600" font-size="17" fill="#E8C574">{date_ar}</text>
      <image x="80" y="10" width="240" height="60" preserveAspectRatio="xMinYMid meet" opacity="0.95" href="data:image/png;base64,{ist_b64}"/>
      <text x="350" y="45" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="500" font-size="15" fill="#C9A84C" opacity="0.9">{poweredby}</text>
    </g>

    <!-- Disclaimer -->
    <text x="540" y="1580" text-anchor="middle" font-family="Cairo, Amiri, Arial, sans-serif" font-weight="400" font-size="12" fill="#9BA3AF" opacity="0.75">{disclaim}</text>
  </g>
</svg>
'''

with open(OUT_SVG, "w", encoding="utf-8") as f:
    f.write(svg)

cairosvg.svg2png(url=OUT_SVG, write_to=OUT_PNG, output_width=1080, output_height=1620)
print("SVG:", os.path.getsize(OUT_SVG), "bytes")
print("PNG:", os.path.getsize(OUT_PNG), "bytes")
print("DONE")
