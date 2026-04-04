# Changelog

All notable changes to IST Markets NewsBot are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-04-04 — Initial Release

### Added — News Feed

- **16 RSS news sources** across 5 categories (General, Energy, Crypto, Central Banks, Arabic)
  - General: Bloomberg Markets, Yahoo Finance, CNBC Markets, BBC Business, MarketWatch, Zero Hedge
  - Energy: OilPrice.com
  - Crypto: CoinDesk, CoinTelegraph, CryptoSlate, Bitcoin Magazine
  - Central Banks: Federal Reserve, ECB
  - Arabic: BBC Arabic Business, RT Arabic Business
- **FMP (Financial Modeling Prep)** integration as a primary general financial news source
- **Source dropdown** with `<optgroup>` category labels for organized source selection
- **Fetch All** button — iterates through all 16 sources sequentially with a live progress bar showing current source and completion count
- **Advanced filter bar** with:
  - Keyword search (matches headline, body, asset tags, source name)
  - Date picker — filter articles by a specific day
  - Theme dropdown — filter by article theme (Market Update, Crypto Markets, Forex Markets, etc.)
  - Source dropdown — filter by source name
  - Active filter badge showing count of applied filters
  - Clear All button
  - Live article count display
- **Newest-first sorting** applied client-side after Firestore fetch
- **Safety classification engine** — classifies every article as `safe`, `conditional`, or `unsafe`:
  - Stage 1: Direct asset reference check (BTC, ETH, GOLD, OIL, EUR, USD, etc.)
  - Stage 2: Political keyword rejection (ELECTION, COUP, SCANDAL, etc.)
  - Stage 3: Body rescue — conditional pass if ≥2 market-impact phrases found
- **Deduplication** — articles already in Firestore are skipped (matched by URL)
- **Manual Entry** modal for creating articles without an external source

### Added — Editor

- **AI Rewrite** using Google Gemini for both English and Arabic outputs
- **AI image generation** via Gemini Imagen — contextual story image for each article
- **Visual Brief** generation — structured analysis of the article for editors
- **Safety re-check** button — re-runs article through the safety filter
- **Branded Canvas** image rendering on HTML5 Canvas:
  - Multi-layer compositing: dark base → story image → brand template → gradients → vignette → logo → headline → tagline → footer
  - Word-wrap for both headline and tagline
  - Accent color on final headline line (Bloomberg/Reuters style)
  - Strong text shadows for readability over any background
- **Multi-format output**: Instagram Post (1080×1080), Instagram Story (1080×1920), Twitter/X (1920×1080), LinkedIn Post (1080×1080)
- **Download** branded images in EN and AR independently
- **Full Preview** modal for full-resolution canvas preview
- **Save Draft** to Firestore (canvas compressed to max 540px / JPEG 0.52 to stay under 1MB Firestore document limit)
- **Metricool scheduling modal**:
  - Dynamic brand fetch from Metricool API
  - Per-brand connected network display (Instagram, Facebook, Twitter, TikTok)
  - Canvas image upload to Imgur (anonymous API) to get a public URL
  - Schedule date/time picker
  - POST to Metricool `/v2/scheduler/posts` with correct `ScheduledPost` schema

### Added — Brand Settings

- Logo upload with live preview
- **Logo position selector** with 6 options: Top Left, Top Center, Top Right, Bottom Left, Bottom Center, Bottom Right
- Logo size control (in pixels at 1080px reference resolution, scales proportionally)
- Accent color picker
- Fixed tagline input
- **Dual footer disclaimer** — Footer Line 1 (primary, 80% opacity) and Footer Line 2 (optional, 55% opacity)
- Background image upload
- Live canvas preview reflecting all settings

### Added — Backend (server.ts)

- Express server with Vite middleware for unified dev server
- Firebase Admin SDK integration (Firestore)
- `checkAuth` middleware — validates Firebase ID tokens on all protected routes
- **RSS fetch engine** (`fetchRSSFeed`):
  - Axios with browser-like User-Agent to avoid bot blocks
  - `fast-xml-parser` with `processEntities: false` (prevents entity expansion limit errors)
  - Supports both RSS 2.0 (`<item>`) and Atom (`<entry>`) feed formats
  - Non-XML response guard (rejects HTML error pages before parsing)
  - XML parse wrapped in try-catch for clean error reporting
  - Strips HTML tags from article content
  - Returns up to 15 items per source
- **Imgur upload endpoint** (`/api/upload-brand-asset`) — anonymous image hosting via Imgur API
- **Metricool endpoints**:
  - `GET /api/metricool/brands` — fetches all brands from Metricool
  - `POST /api/metricool/schedule` — schedules a post with image, caption, networks, and time
- **Global crash protection**:
  - `process.on('unhandledRejection')` — logs and survives unexpected promise rejections
  - `process.on('uncaughtException')` — logs and survives unexpected thrown errors
- `GET /api/news/sources` — returns RSS source list for frontend sync

### Added — Auth & Security

- Firebase Authentication with email/password
- **TOTP-based 2FA** using `otplib` — QR code setup, verification on login
- Firestore security rules restricting reads/writes to authenticated users
- All API routes protected by `checkAuth` Firebase token validation

### Added — Other Pages

- **Dashboard** — article stats, trending assets chart, recent session activity
- **Calendar** — visual calendar of scheduled posts
- **Archive** — processed and published article history
- **Audit Logs** — per-user action audit trail
- **Admin** — user listing and role management

---

### Fixed — Canvas Rendering

- **Arabic text direction** — added `ctx.direction = 'rtl'` and `ctx.textAlign = 'right'` for proper BiDi rendering of Arabic headlines and taglines
- **Logo size ignored** — `logoSize` from Brand Settings was not being passed to `BrandedCanvas`; fixed prop threading through `Editor.tsx`
- **Header gradient too dark** — reduced top gradient opacity from `0.88` to `0.62` so background images remain visible in the header area
- **Orange border line** — removed accent color vertical stripe from canvas left/right edge
- **Orange separator line** — removed accent color line between footer and image body
- **Footer dark overlay** — removed `rgba(0,0,0,0.82)` footer background rect; footer now merges seamlessly with the image via extended bottom gradient

### Fixed — RSS Sources

- Removed dead sources: Financial Times (`feeds.ft.com` — ENOTFOUND), Investing.com (`feeds.investing.com` — ENOTFOUND), Al Arabiya (`www.alarabiya.net` — ENOTFOUND), Sky News Arabia (`/rss/business` — 404)
- Fixed Forbes URL (`/real-time/feed2/` → blocked by Cloudflare 403) — replaced with CNBC Markets
- Fixed Reuters URL (`feeds.reuters.com` — DNS dead since 2020) — replaced with BBC Business
- Fixed ZeroHedge URL (`www.zerohedge.com/fullrss2.xml` — 404) — corrected to `cms.zerohedge.com/fullrss2.xml`
- Fixed Al Jazeera Arabic (`/xml/atom/economics.xml` — 404) — replaced with BBC Arabic Business
- Fixed RT Arabic (`/rss/economy/` — 404) — corrected to `/rss/business/`
- Added `processEntities: false` to XMLParser — resolved entity expansion limit errors on Forbes (1004 entities) and ZeroHedge (1074 entities)

### Fixed — Metricool Integration

- Fixed 404 error — wrong endpoint `/planner/post`; corrected to `/v2/scheduler/posts`
- Fixed 400 BAD_REQUEST — removed invalid `status: 'PENDING'` field from `providers` array; correct schema is `[{ network }]`
- Fixed empty brand dropdown — brand data uses `label` not `name` field
- Fixed missing networks — networks are embedded in brand object fields, not from a separate endpoint; added `getConnectedNetworks(brand)` helper

### Fixed — Firestore

- Fixed 1.77MB document overflow (Firestore 1MB limit) — canvas images now compressed to max 540px width at JPEG quality 0.52 before storing as base64

### Fixed — Image Upload

- Firebase Storage bucket did not exist — replaced with Imgur anonymous upload API
- Tried and rejected: 0x0.st (503), ImgBB (400), Catbox.moe (socket hang up); Imgur anonymous upload confirmed working

---

## [Unreleased] — Upcoming

- Scheduled auto-fetch (cron job) for all RSS sources
- Push notification when new articles arrive
- Article rejection reason display in News Feed
- Multi-brand support in Editor
- Performance analytics per post (Metricool stats)
- Dark/light theme toggle
