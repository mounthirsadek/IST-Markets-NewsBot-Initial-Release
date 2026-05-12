# Install — telegram-arabic-marsadalsouq

The Cowork system folder `.claude/skills/` is read-only inside this session, so the
skill couldn't be auto-installed. Copy this folder into the user skills directory
once and it will become callable in every future session.

## One-time install

### macOS / Linux

```bash
cp -R "/path/to/MarselAlsouq/telegram-arabic-marsadalsouq" ~/.claude/skills/
```

### Windows PowerShell

```powershell
Copy-Item -Recurse `
  -Path "C:\path\to\MarselAlsouq\telegram-arabic-marsadalsouq" `
  -Destination "$HOME\.claude\skills\"
```

After copying once and reopening Cowork, the skill becomes callable in every future
session and triggers automatically on relevant phrases.

---

## What the skill does

Generates Marsad Al Souq (مرصد السوق) Arabic visual cards for Telegram /
Instagram / Facebook. Four canonical card types:

| Card | Trigger phrases (Arabic + English) |
|---|---|
| Signal (إشارة تداول) | "اعمل إشارة"، "trading signal"، "buy/sell setup" |
| News (أخبار / عاجل) | "خبر عاجل"، "news card arabic"، "breaking" |
| Proof of Trades (إثبات الصفقات) | "إثبات صفقات"، "proof of trades"، "MT5 screenshot" |
| Economic Calendar (الأجندة الاقتصادية) | "أجندة اقتصادية"، "economic calendar"، "★★★ events" |

All cards are 1080 × 1620 (3:4), navy + gold, RTL Arabic, with the locked unified
header and footer.

---

## What the skill enforces

- **Brand colors:** navy `#152035`/`#0D1B2A`/`#070E1A` + gold `#C9A84C`/`#E8C574`
- **Forbidden:** purple anywhere
- **Layout:** 10px outer matte frame, inner card 1060×1600 with rx=14
- **Header:** scope icon + "مرصد السوق" + section subtitle (top-right) — never duplicated
- **Footer:** date right + IST Markets logo (x=80, w=240) + "بدعم من" (x=350) — left
- **Numerals:** Eastern Arabic (٠١٢٣٤٥٦٧٨٩) for dates; Latin (0-9) for prices
- **Glossary:** approved Arabic terms (شراء، بيع، الدخول، وقف الخسارة، جني الأرباح…)
- **BIDI:** every Arabic string must pass through `arabic_reshaper` + `bidi`

---

## Folder contents

- `SKILL.md` — the skill definition with frontmatter and full system prompt
- `INSTALL.md` — this file

---

## Reference files (read by the skill at runtime)

The skill expects these files to exist in the workspace:

```
mnt/MarselAlsouq/
├── Arabic-Design-System/
│   ├── BRAND_STANDARDS_AR.md
│   └── templates/
│       ├── Signal_Template_AR.py + Signal_Reference_AR.svg
│       ├── News_Template_AR.py + News_Reference_AR.svg
│       ├── ProofOfTrades_Template_AR.py + ProofOfTrades_Reference_AR.svg
│       ├── EconCalendar_Template_AR.py + EconCalendar_Reference_AR.svg
│       └── ist_logo_white_b64.txt
└── MarsadAlSouq_<CardType>_*.png  ← approved samples
```

These are already in place from the original brand build-out (April–May 2026).

---

## Dependencies (auto-installed in Cowork sandbox)

- python3
- arabic_reshaper
- python-bidi
- cairosvg

If missing in a future environment:
```bash
pip install arabic_reshaper python-bidi cairosvg --break-system-packages
```
