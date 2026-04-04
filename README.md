# IST Markets NewsBot

> An institutional-grade AI-powered news automation platform for IST Markets — aggregates financial news from 16+ RSS sources, rewrites content with Gemini AI, generates branded canvas images, and schedules posts to Metricool.

---

## Overview

IST Markets NewsBot is a full-stack internal tool built for the IST Markets content team. It streamlines the entire news-to-social workflow:

1. **Fetch** — Pull financial news from 16 RSS/API sources across General, Energy, Crypto, Central Banks, and Arabic categories
2. **Review** — Filter, search, and curate articles with a safety classification engine
3. **Rewrite** — AI-powered rewriting in English and Arabic using Google Gemini
4. **Brand** — Generate pixel-perfect branded canvas images (1080×1080, Stories, Landscape)
5. **Schedule** — Publish directly to Instagram, Facebook, Twitter, and TikTok via Metricool

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Express.js + tsx (Node.js) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | Google Gemini API (`@google/genai`) |
| Image Gen | Gemini Imagen / Canvas API |
| Image Hosting | Imgur Anonymous Upload API |
| Scheduling | Metricool API v2 |
| RSS Parsing | fast-xml-parser |
| State | Zustand |
| Charts | Recharts |
| 2FA | otplib + QRCode |

---

## Features

### News Feed
- Fetch from **16 RSS sources** including Bloomberg, CNBC, MarketWatch, ZeroHedge, CoinDesk, CoinTelegraph, Bitcoin Magazine, BBC Business, BBC Arabic, RT Arabic, Federal Reserve, ECB, and more
- **FMP (Financial Modeling Prep)** API integration for curated financial articles
- **Fetch All** button — fetches from every source simultaneously with a live progress bar
- **Safety Filter Engine** — classifies articles as `safe`, `conditional`, or `unsafe` based on asset references and political keyword detection
- **Advanced Filters** — filter by date, theme, source, or keyword search
- Articles sorted newest → oldest

### Editor
- AI rewrite in **English and Arabic** with tone control
- **Gemini image generation** for story visuals
- **Branded Canvas** rendering with:
  - Logo with configurable size and position (Top Left / Top Center / Top Right / Bottom Left / Bottom Center / Bottom Right)
  - Arabic RTL text support (`ctx.direction = 'rtl'`)
  - Dual footer disclaimer lines
  - Accent color theming
  - Adjustable header gradient opacity
- Multi-format support: Instagram Post (1:1), Story (9:16), Twitter/X (16:9), LinkedIn
- Download EN/AR branded images
- **Save Draft** to Firestore (compressed to stay under 1MB limit)
- **Metricool integration** — select brand, choose networks, pick schedule time, publish

### Brand Settings
- Upload company logo
- Set logo position and size
- Configure accent color
- Set tagline and dual-line footer disclaimer
- Background image upload
- Live canvas preview

### Other Pages
- **Dashboard** — article stats, trending assets, recent activity
- **Calendar** — scheduled post calendar view
- **Archive** — processed article history
- **Audit Logs** — action history per user
- **Admin** — user management
- **2FA Setup** — TOTP-based two-factor authentication

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project (Firestore + Auth enabled)
- Google Gemini API key
- Metricool account with API access

### Installation

```bash
git clone https://github.com/mounthirsadek/IST-Markets-NewsBot-Initial-Release.git
cd IST-Markets-NewsBot-Initial-Release
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your_gemini_api_key
FMP_API_KEY=your_fmp_api_key
METRICOOL_API_KEY=your_metricool_api_key
GOOGLE_APPLICATION_CREDENTIALS=./path-to-firebase-service-account.json
```

### Run Locally

```bash
npm run dev
```

The app runs on `http://localhost:3000` (Express serves both the API and Vite frontend in dev mode).

### Build for Production

```bash
npm run build
```

---

## Project Structure

```
IST-Markets-NewsBot/
├── server.ts                  # Express backend — API routes, RSS fetching, Metricool
├── src/
│   ├── components/
│   │   ├── BrandedCanvas.tsx  # HTML5 Canvas image renderer
│   │   └── Layout.tsx         # App shell & navigation
│   ├── pages/
│   │   ├── NewsFeed.tsx       # News review & fetch
│   │   ├── Editor.tsx         # AI rewrite & image generation
│   │   ├── BrandSettings.tsx  # Brand identity config
│   │   ├── Dashboard.tsx      # Analytics overview
│   │   ├── Calendar.tsx       # Post schedule calendar
│   │   ├── Archive.tsx        # Processed articles
│   │   ├── AuditLogs.tsx      # Action audit trail
│   │   ├── Admin.tsx          # User management
│   │   └── Login.tsx          # Auth + 2FA
│   ├── services/
│   │   ├── geminiService.ts   # Gemini AI integration
│   │   └── metricoolService.ts# Metricool API integration
│   ├── store.ts               # Zustand global state
│   ├── firebase.ts            # Firebase client config
│   └── lib/api.ts             # Authenticated fetch helper
├── DOCS/                      # PRD, deployment checklist, test plan
├── .env.example               # Environment variable template
└── firestore.rules            # Firestore security rules
```

---

## RSS Sources

| Category | Sources |
|---|---|
| General | Bloomberg, Yahoo Finance, CNBC Markets, BBC Business, MarketWatch, Zero Hedge |
| Energy | OilPrice.com |
| Crypto | CoinDesk, CoinTelegraph, CryptoSlate, Bitcoin Magazine |
| Central Banks | Federal Reserve, ECB |
| Arabic | BBC Arabic Business, RT Arabic Business |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/news/fetch` | Fetch from FMP API |
| GET | `/api/news/fetch-rss?source=X` | Fetch from RSS source |
| GET | `/api/news/sources` | List all RSS sources |
| POST | `/api/upload-brand-asset` | Upload image to Imgur |
| POST | `/api/metricool/schedule` | Schedule post via Metricool |
| GET | `/api/metricool/brands` | Fetch Metricool brands |

---

## License

Private — IST Markets internal use only.
