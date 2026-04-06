import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import axios from "axios";
import FormData from "form-data";
import { XMLParser } from "fast-xml-parser";
import * as otplib from 'otplib';
const authenticator = (otplib as any).default?.authenticator || (otplib as any).authenticator;
import QRCode from 'qrcode';
import { createHash, randomUUID } from 'crypto';

dotenv.config();

// Prevent unhandled rejections from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UnhandledRejection] at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Firebase config (from file or env) ───────────────────────────────────────
let firebaseConfig: any = {
  projectId:          process.env.FIREBASE_PROJECT_ID     || "gen-lang-client-0496295225",
  apiKey:             process.env.FIREBASE_API_KEY         || "AIzaSyCmDyrfBN1d-xfxoB1xOovN2Rk_5raSM4o",
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID   || "ai-studio-f9d94947-60fa-40c0-a175-bb63facfc5e2",
};

if (fs.existsSync('./firebase-applet-config.json')) {
  const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  firebaseConfig = { ...firebaseConfig, ...cfg };
}

const FIREBASE_API_KEY  = firebaseConfig.apiKey;
const FIRESTORE_PROJECT = firebaseConfig.projectId;
const FIRESTORE_DB      = firebaseConfig.firestoreDatabaseId || '(default)';
const FIRESTORE_BASE    = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/${FIRESTORE_DB}/documents`;

console.log(`🔥 Using Firebase project: ${FIRESTORE_PROJECT} / DB: ${FIRESTORE_DB}`);

// ── Firestore REST helpers ────────────────────────────────────────────────────
// Convert a JS value to a Firestore REST API typed value
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number')           return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')           return { stringValue: val };
  if (val instanceof Date)               return { timestampValue: val.toISOString() };
  if (Array.isArray(val))                return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object')           return { mapValue: { fields: toFirestoreFields(val) } };
  return { stringValue: String(val) };
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

// Convert a Firestore REST typed value back to a JS value
function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ('nullValue'      in val) return null;
  if ('booleanValue'   in val) return val.booleanValue;
  if ('integerValue'   in val) return Number(val.integerValue);
  if ('doubleValue'    in val) return val.doubleValue;
  if ('stringValue'    in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue'     in val) return (val.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue'       in val) return fromFirestoreFields(val.mapValue?.fields || {});
  return null;
}

function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = fromFirestoreValue(v);
  return obj;
}

function docToData(doc: any): any {
  const id = (doc.name || '').split('/').pop();
  return { id, ...fromFirestoreFields(doc.fields || {}) };
}

// Firestore REST client (uses user's id token for auth)
class FirestoreREST {
  private token: string;
  constructor(token: string) { this.token = token; }

  private headers() {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  async getDoc(collection: string, docId: string): Promise<{ exists: boolean; data: () => any; id: string }> {
    try {
      const r = await axios.get(`${FIRESTORE_BASE}/${collection}/${docId}`, { headers: this.headers() });
      return { exists: true, data: () => fromFirestoreFields(r.data.fields || {}), id: docId };
    } catch (e: any) {
      if (e.response?.status === 404) return { exists: false, data: () => null, id: docId };
      throw e;
    }
  }

  async setDoc(collection: string, docId: string, data: Record<string, any>): Promise<void> {
    await axios.patch(
      `${FIRESTORE_BASE}/${collection}/${docId}`,
      { fields: toFirestoreFields(data) },
      { headers: this.headers() }
    );
  }

  async updateDoc(collection: string, docId: string, data: Record<string, any>): Promise<void> {
    const fields = toFirestoreFields(data);
    const mask   = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    await axios.patch(
      `${FIRESTORE_BASE}/${collection}/${docId}?${mask}`,
      { fields },
      { headers: this.headers() }
    );
  }

  async addDoc(collection: string, data: Record<string, any>): Promise<string> {
    const docId = randomUUID();
    await this.setDoc(collection, docId, data);
    return docId;
  }

  async newId(collection: string): Promise<string> {
    return randomUUID();
  }

  async query(collection: string, filters: { field: string; op: string; value: any }[] = [], orderBy?: string, limit?: number): Promise<any[]> {
    const structuredQuery: any = {
      from: [{ collectionId: collection }],
    };

    if (filters.length > 0) {
      const opMap: Record<string, string> = { '==': 'EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL' };
      const conditions = filters.map(f => ({
        fieldFilter: {
          field:    { fieldPath: f.field },
          op:       opMap[f.op] || 'EQUAL',
          value:    toFirestoreValue(f.value),
        }
      }));
      structuredQuery.where = conditions.length === 1
        ? conditions[0]
        : { compositeFilter: { op: 'AND', filters: conditions } };
    }

    if (orderBy) structuredQuery.orderBy = [{ field: { fieldPath: orderBy }, direction: 'DESCENDING' }];
    if (limit)   structuredQuery.limit = limit;

    const r = await axios.post(
      `${FIRESTORE_BASE}:runQuery`,
      { structuredQuery },
      { headers: this.headers() }
    );

    return (r.data || [])
      .filter((item: any) => item.document)
      .map((item: any) => docToData(item.document));
  }

  async getDocs(collection: string): Promise<any[]> {
    try {
      const r = await axios.get(`${FIRESTORE_BASE}/${collection}`, { headers: this.headers() });
      return (r.data?.documents || []).map(docToData);
    } catch (e: any) {
      if (e.response?.status === 404) return [];
      throw e;
    }
  }
}

// ── Firebase Auth REST (token verification) ───────────────────────────────────
async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string; [k: string]: any }> {
  const r = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    { idToken }
  );
  const user = r.data?.users?.[0];
  if (!user) throw new Error('User not found');
  return { uid: user.localId, email: user.email, ...user };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // RBAC Middleware
  const checkAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const user = await verifyIdToken(idToken);
      req.user      = user;
      req.idToken   = idToken;
      req.db        = new FirestoreREST(idToken);
      next();
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  const checkRole = (roles: string[]) => {
    return async (req: any, res: any, next: any) => {
      try {
        const userDoc = await req.db.getDoc('users', req.user.uid);
        const userData = userDoc.data();
        if (!userData || !roles.includes(userData.role)) {
          return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
        req.userData = userData;
        next();
      } catch {
        return res.status(403).json({ error: "Forbidden" });
      }
    };
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── Brand Asset Upload (server-side proxy to bypass CORS) ─────────────
  app.post("/api/upload-brand-asset", checkAuth, async (req: any, res: any) => {
    try {
      const { dataUrl } = req.body;
      if (!dataUrl) {
        return res.status(400).json({ error: "Missing dataUrl" });
      }

      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: "Invalid data URL format" });
      }
      const mimeType = matches[1];
      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');

      // Upload to Imgur (anonymous, free, no user auth required)
      const imgurClientId = process.env.IMGUR_CLIENT_ID || '546c25a59c58ad7';
      const b64 = buffer.toString('base64');
      const postData = `image=${encodeURIComponent(b64)}&type=base64`;

      const imgurRes = await axios.post('https://api.imgur.com/3/image', postData, {
        headers: {
          Authorization: `Client-ID ${imgurClientId}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });

      const url = imgurRes.data?.data?.link;
      if (!url) throw new Error('Imgur upload failed — no link returned');

      res.json({ url });
    } catch (error: any) {
      console.error("Brand asset upload failed:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Instagram Publishing Logic
  const publishToInstagram = async (imageUrl: string, caption: string, instagramId: string, accessToken: string) => {
    try {
      // 1. Create Media Container
      const containerResponse = await axios.post(`https://graph.facebook.com/v19.0/${instagramId}/media`, {
        image_url: imageUrl,
        caption: caption,
        access_token: accessToken
      });

      const creationId = containerResponse.data.id;

      // 2. Wait for container to be ready (simplified polling)
      let status = 'IN_PROGRESS';
      let attempts = 0;
      while (status === 'IN_PROGRESS' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const statusResponse = await axios.get(`https://graph.facebook.com/v19.0/${creationId}`, {
          params: { fields: 'status_code', access_token: accessToken }
        });
        status = statusResponse.data.status_code;
        attempts++;
      }

      if (status !== 'FINISHED') {
        throw new Error(`Media container failed with status: ${status}`);
      }

      // 3. Publish Media
      const publishResponse = await axios.post(`https://graph.facebook.com/v19.0/${instagramId}/media_publish`, {
        creation_id: creationId,
        access_token: accessToken
      });

      return { success: true, postId: publishResponse.data.id };
    } catch (error: any) {
      console.error("Instagram Publish Failed:", error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  };

  // Instagram Metrics Pulling Logic
  const fetchInstagramMetrics = async (postId: string, accessToken: string) => {
    try {
      const response = await axios.get(`https://graph.facebook.com/v19.0/${postId}/insights`, {
        params: {
          metric: 'impressions,reach,likes,comments,saves',
          access_token: accessToken
        }
      });
      
      const metrics: any = {};
      response.data.data.forEach((m: any) => {
        metrics[m.name] = m.values[0].value;
      });
      return metrics;
    } catch (error: any) {
      console.error(`Failed to fetch metrics for post ${postId}:`, error.response?.data || error.message);
      return null;
    }
  };

  // Metrics Pulling Task — skipped (requires server-side Firestore token)
  setInterval(async () => {
    // Metrics pulling skipped in REST mode
    try {
      void 0;
    } catch (error) {
      console.error("Metrics Pulling Error:", error);
    }
  }, 6 * 60 * 60 * 1000);

  // Scheduler Polling (Every 1 minute) — skipped in REST mode (no server token)
  setInterval(async () => {
    // Scheduler requires a service account token to query Firestore server-side.
    // Stories are scheduled via Metricool directly. Skipping local scheduler.
    console.log("Scheduler: skipped (using Metricool for scheduling)");
  }, 60 * 60 * 1000); // run once per hour just to log

  // Scheduler is handled entirely by Metricool — no local scheduler needed.

  // ─── RSS News Sources ─────────────────────────────────────────────────────
  const RSS_SOURCES: Record<string, { label: string; url: string; category: string }> = {
    'bloomberg':     { label: 'Bloomberg Markets',         url: 'https://feeds.bloomberg.com/markets/news.rss',                                          category: 'General'       },
    'yahoo':         { label: 'Yahoo Finance',             url: 'https://finance.yahoo.com/rss/topfinstories',                                           category: 'General'       },
    'cnbc':          { label: 'CNBC Markets',              url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',                                  category: 'General'       },
    'bbc':           { label: 'BBC Business',               url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                                     category: 'General'       },
    'marketwatch':   { label: 'MarketWatch',               url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',                      category: 'General'       },
    'zerohedge':     { label: 'Zero Hedge',                url: 'https://cms.zerohedge.com/fullrss2.xml',                                                 category: 'General'       },
    'oilprice':      { label: 'OilPrice.com',              url: 'https://oilprice.com/rss/main',                                                          category: 'Energy'        },
    'coindesk':      { label: 'CoinDesk',                  url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                                        category: 'Crypto'        },
    'cointelegraph': { label: 'CoinTelegraph',             url: 'https://cointelegraph.com/rss',                                                          category: 'Crypto'        },
    'cryptoslate':   { label: 'CryptoSlate',               url: 'https://cryptoslate.com/feed/',                                                          category: 'Crypto'        },
    'bitcoinmagazine':{ label: 'Bitcoin Magazine',         url: 'https://bitcoinmagazine.com/.rss/full/',                                                 category: 'Crypto'        },
    'fed':           { label: 'Federal Reserve',           url: 'https://www.federalreserve.gov/feeds/press_all.xml',                                     category: 'Central Banks' },
    'ecb':           { label: 'ECB',                       url: 'https://www.ecb.europa.eu/rss/press.html',                                               category: 'Central Banks' },
    'bbc_ar':        { label: 'BBC عربي — اقتصاد',        url: 'https://feeds.bbci.co.uk/arabic/business/rss.xml',                                       category: 'Arabic'        },
    'rt_ar':         { label: 'RT عربي — اقتصاد',         url: 'https://arabic.rt.com/rss/business/',                                                    category: 'Arabic'        },
  };

  const fetchRSSFeed = async (sourceKey: string): Promise<{ title: string; content: string; url: string; date: string; source: string }[]> => {
    const src = RSS_SOURCES[sourceKey];
    if (!src) throw new Error(`Unknown RSS source: ${sourceKey}`);

    const response = await axios.get(src.url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
      },
      responseType: 'text',
      maxRedirects: 5,
    });

    // Guard against non-XML responses (e.g. HTML error pages)
    const contentType = (response.headers['content-type'] || '').toLowerCase();
    const body = String(response.data || '');
    if (!body.trim().startsWith('<') && !body.includes('<rss') && !body.includes('<feed')) {
      throw new Error(`Non-XML response received from ${src.label} (content-type: ${contentType})`);
    }

    let result: any;
    try {
      const parser = new XMLParser({ ignoreAttributes: false, textNodeName: '#text', processEntities: false });
      result = parser.parse(body);
    } catch (parseErr: any) {
      throw new Error(`XML parse failed for ${src.label}: ${parseErr.message}`);
    }

    // Support RSS 2.0 and Atom feeds
    const items: any[] = result?.rss?.channel?.item || result?.feed?.entry || [];
    const itemArr = Array.isArray(items) ? items : [items];

    return itemArr.slice(0, 15).map((item: any) => {
      const title   = (typeof item.title === 'object' ? item.title?.['#text'] : item.title) || '';
      const content = item['content:encoded'] || (typeof item.description === 'object' ? item.description?.['#text'] : item.description) || item.summary?.['#text'] || item.summary || '';
      const link    = (typeof item.link === 'object' ? item.link?.['@_href'] || item.link?.['#text'] : item.link) || (typeof item.guid === 'object' ? item.guid?.['#text'] : item.guid) || '';
      const date    = item.pubDate || item.published || item.updated || new Date().toISOString();
      return { title: String(title).trim(), content: String(content).replace(/<[^>]*>/g, ' ').trim(), url: String(link).trim(), date: String(date).trim(), source: src.label };
    }).filter(i => i.title && i.url);
  };

  // News Fetching Engine & Safety Filter Logic
  const ASSETS = ["BTC", "ETH", "GOLD", "OIL", "EUR", "USD", "GBP", "JPY", "FED", "INFLATION", "CPI", "GDP", "OPEC", "S&P 500", "NASDAQ"];
  const POLITICAL_REJECTION = ["ELECTION", "SENATE", "PARLIAMENT", "CABINET", "WHITE HOUSE", "COUP", "PROTEST", "SCANDAL", "CORRUPTION"];
  const MARKET_IMPACT_PHRASES = ["MARKET IMPACT", "PRICE ACTION", "INVESTOR SENTIMENT", "ECONOMIC OUTLOOK", "TRADING VOLUME"];

  const classifyTheme = (text: string): string => {
    const t = text.toUpperCase();
    if (t.includes("OIL") || t.includes("GAS") || t.includes("OPEC")) return "Energy Markets";
    if (t.includes("GOLD") || t.includes("SILVER")) return "Precious Metals";
    if (t.includes("FED") || t.includes("INTEREST RATE")) return "Fed Policy";
    if (t.includes("BITCOIN") || t.includes("ETH") || t.includes("CRYPTO")) return "Crypto Markets";
    if (t.includes("EUR") || t.includes("USD") || t.includes("FOREX")) return "Forex Markets";
    if (t.includes("INFLATION") || t.includes("CPI")) return "Inflation Watch";
    return "Market Update";
  };

  const runSafetyFilter = (headline: string, body: string): { status: "safe" | "unsafe" | "conditional", reason?: string } => {
    const h = headline.toUpperCase();
    const b = body.toUpperCase();

    // Stage 1: Direct Asset Reference Check
    const hasAsset = ASSETS.some(asset => h.includes(asset));
    if (hasAsset) return { status: "safe" };

    // Stage 2: Political Keyword Rejection
    const hasPolitical = POLITICAL_REJECTION.some(word => h.includes(word));
    if (hasPolitical) {
      // Stage 3: Body Rescue Check
      const impactCount = MARKET_IMPACT_PHRASES.filter(phrase => b.includes(phrase)).length;
      if (impactCount >= 2) return { status: "conditional", reason: "Political context with high market impact" };
      return { status: "unsafe", reason: "Political keyword detected without direct asset reference or sufficient market impact" };
    }

    return { status: "safe" }; // Default to safe if no political keywords found
  };

  // News Fetching Endpoint
  app.get("/api/news/fetch", checkAuth, async (req, res) => {
    try {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "FMP_API_KEY is not configured in environment variables." });
      }

      const sessionId = randomUUID();

      // Fetch news from Financial Modeling Prep API
      // Using the fmp/articles endpoint for broad financial news
      const fmpResponse = await axios.get(`https://financialmodelingprep.com/stable/fmp-articles`, {
        params: {
          limit: 10,
          apikey: apiKey
        }
      });

      const rawNews = Array.isArray(fmpResponse.data) ? fmpResponse.data : (fmpResponse.data.content || []);

      if (!Array.isArray(rawNews)) {
        throw new Error("Unexpected response format from FMP API");
      }

      const db = req.db as FirestoreREST;
      let approvedCount = 0;
      let rejectedCount = 0;

      for (const article of rawNews) {
        const title = article.title || "No Title";
        const content = article.content || article.body || "No Content";
        const url = article.link || article.url || `https://financialmodelingprep.com/news/${Date.now()}`;
        const source = article.site || article.source || "FMP";
        const date = article.date || article.publishedDate || new Date().toISOString();

        const safety = runSafetyFilter(title, content);
        const theme = classifyTheme(title + " " + content);
        const assets = ASSETS.filter(a => (title + " " + content).toUpperCase().includes(a));

        const normalizedArticle = {
          headline: title,
          article_body: content,
          article_url: url,
          source_name: source,
          published_at_source: date,
          session_id: sessionId,
          theme,
          asset_tags: assets,
          safety_status: safety.status,
          rejection_reason: safety.reason || null,
          status: safety.status === "unsafe" ? "rejected" : "pending"
        };

        // Prevent duplicates
        const existing = await db.query('news', [{ field: 'article_url', op: '==', value: url }]);
        if (existing.length === 0) {
          await db.addDoc('news', normalizedArticle);
          safety.status === "unsafe" ? rejectedCount++ : approvedCount++;
        }
      }

      // Create fetch session
      await db.setDoc('fetch_sessions', sessionId, {
        id: sessionId,
        fetched_by: "system",
        fetched_at: new Date().toISOString(),
        total_articles: rawNews.length,
        approved_articles: approvedCount,
        rejected_articles: rejectedCount
      });

      res.json({ message: "News fetching completed", approved: approvedCount, rejected: rejectedCount, sessionId });
    } catch (error) {
      console.error("Fetch failed", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // RSS News Fetching Endpoint
  app.get("/api/news/fetch-rss", checkAuth, async (req: any, res: any) => {
    const sourceKey = (req.query.source as string) || 'bloomberg';
    try {
      if (!RSS_SOURCES[sourceKey]) {
        return res.status(400).json({ error: `Unknown source: ${sourceKey}` });
      }

      const sessionId = randomUUID();
      const rawItems  = await fetchRSSFeed(sourceKey);
      const db        = req.db as FirestoreREST;
      let approvedCount = 0;
      let rejectedCount = 0;

      for (const item of rawItems) {
        const safety = runSafetyFilter(item.title, item.content);
        const theme  = classifyTheme(item.title + ' ' + item.content);
        const assets = ASSETS.filter(a => (item.title + ' ' + item.content).toUpperCase().includes(a));

        const normalizedArticle = {
          headline:            item.title,
          article_body:        item.content,
          article_url:         item.url,
          source_name:         item.source,
          source_key:          sourceKey,
          published_at_source: item.date,
          session_id:          sessionId,
          theme,
          asset_tags:          assets,
          safety_status:       safety.status,
          rejection_reason:    safety.reason || null,
          status:              safety.status === 'unsafe' ? 'rejected' : 'pending',
        };

        const existing = await db.query('news', [{ field: 'article_url', op: '==', value: item.url }]);
        if (existing.length === 0) {
          await db.addDoc('news', normalizedArticle);
          safety.status === 'unsafe' ? rejectedCount++ : approvedCount++;
        }
      }

      await db.setDoc('fetch_sessions', sessionId, {
        id: sessionId, source: sourceKey,
        fetched_by: req.user.uid,
        fetched_at: new Date().toISOString(),
        total_articles: rawItems.length,
        approved_articles: approvedCount,
        rejected_articles: rejectedCount,
      });

      res.json({ message: 'RSS fetch completed', source: sourceKey, approved: approvedCount, rejected: rejectedCount, sessionId });
    } catch (error: any) {
      console.error(`RSS fetch failed [${sourceKey}]:`, error.message);
      res.status(500).json({ error: `Failed to fetch from ${RSS_SOURCES[sourceKey]?.label || sourceKey}: ${error.message}` });
    }
  });

  // RSS Sources List (for frontend dropdown)
  app.get("/api/news/sources", checkAuth, (req, res) => {
    res.json(RSS_SOURCES);
  });

  // Audit Log Helper
  const logAction = async (db: FirestoreREST, userId: string, actionType: string, entityType: string, entityId: string, beforeData: any = null, afterData: any = null) => {
    try {
      await db.addDoc('audit_logs', {
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        before_data: beforeData,
        after_data: afterData,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Audit logging failed", error);
    }
  };

  // Example Audit Logged Endpoint
  app.post("/api/news/articles/:id/select", checkAuth, async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.uid;
    const db = req.db as FirestoreREST;
    try {
      const article = await db.getDoc('news', id);
      if (!article.exists) return res.status(404).json({ error: "Article not found" });

      const beforeData = article.data();
      await db.updateDoc('news', id, { status: 'processed' });
      const afterData = { ...beforeData, status: 'processed' };

      await logAction(db, userId, 'SELECT_ARTICLE', 'news', id, beforeData, afterData);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Selection failed" });
    }
  });

  // Dashboard Metrics Endpoint
  app.get("/api/dashboard/metrics", checkAuth, async (req: any, res) => {
    try {
      const db = req.db as FirestoreREST;
      const stories = await db.getDocs('stories');
      const news    = await db.getDocs('news');

      const metrics = {
        totalNews: news.length,
        totalStories: stories.length,
        publishedCount: stories.filter(d => d.status === 'published').length,
        rejectionRate: 0,
        themeDistribution: {} as any,
        formatDistribution: {} as any,
        productionTrend: [] as any,
      };

      const rejectedNews = news.filter(d => d.status === 'rejected').length;
      metrics.rejectionRate = news.length > 0 ? (rejectedNews / news.length) * 100 : 0;

      stories.forEach(d => {
        const theme = d.theme || 'Unknown';
        metrics.themeDistribution[theme] = (metrics.themeDistribution[theme] || 0) + 1;
        const format = d.format || 'Post';
        metrics.formatDistribution[format] = (metrics.formatDistribution[format] || 0) + 1;
      });

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Audit Logs Endpoint
  app.get("/api/audit-logs", checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    try {
      const db = req.db as FirestoreREST;
      const logs = await db.query('audit_logs', [], 'created_at', 100);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // User Management Endpoints
  app.get("/api/users", checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    try {
      const db = req.db as FirestoreREST;
      const users = await db.getDocs('users');
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:uid/role", checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    const { uid } = req.params;
    const { role } = req.body;
    const targetRoles = ['viewer', 'editor', 'senior-editor', 'admin', 'super-admin'];
    const db = req.db as FirestoreREST;

    if (!targetRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (req.userData.role === 'admin' && role === 'super-admin') {
      return res.status(403).json({ error: "Admins cannot manage Super Admins" });
    }

    try {
      await db.updateDoc('users', uid, { role });
      await db.addDoc('audit_logs', {
        action_type: 'USER_ROLE_UPDATE',
        entity_type: 'USER',
        entity_id: uid,
        details: `Role updated to ${role} by ${req.user.email}`,
        created_at: new Date().toISOString(),
        user_id: req.user.uid
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // 2FA Endpoints
  app.post("/api/auth/2fa/setup", checkAuth, async (req: any, res: any) => {
    const db = req.db as FirestoreREST;
    const secret  = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, 'NewsBot', secret);
    try {
      const qrCodeUrl = await QRCode.toDataURL(otpauth);
      await db.updateDoc('users', req.user.uid, { temp_2fa_secret: secret });
      res.json({ qrCodeUrl, secret });
    } catch (error) {
      res.status(500).json({ error: "Failed to setup 2FA" });
    }
  });

  app.post("/api/auth/2fa/verify", checkAuth, async (req: any, res: any) => {
    const db = req.db as FirestoreREST;
    const { token } = req.body;
    const userDoc  = await db.getDoc('users', req.user.uid);
    const userData = userDoc.data();
    const secret   = userData?.temp_2fa_secret || userData?.two_factor_secret;
    if (!secret) return res.status(400).json({ error: "2FA not setup" });

    const isValid = authenticator.check(token, secret);
    if (isValid) {
      await db.updateDoc('users', req.user.uid, {
        two_factor_enabled: true,
        two_factor_secret: secret,
        temp_2fa_secret: null,
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid token" });
    }
  });

  app.post("/api/auth/2fa/check", async (req: any, res: any) => {
    const { idToken, token } = req.body;
    try {
      const user    = await verifyIdToken(idToken);
      const tempDb  = new FirestoreREST(idToken);
      const userDoc = await tempDb.getDoc('users', user.uid);
      const userData = userDoc.data();

      if (!userData?.two_factor_enabled) return res.json({ success: true });

      const isValid = authenticator.check(token, userData.two_factor_secret);
      res.json({ success: isValid });
    } catch (error) {
      res.status(401).json({ error: "Invalid session" });
    }
  });

  // ─── Metricool API Proxy ────────────────────────────────────────────────────
  const METRICOOL_BASE = 'https://app.metricool.com/api';

  const metricoolHeaders = () => ({
    'X-Mc-Auth': process.env.METRICOOL_USER_TOKEN!,
    'Content-Type': 'application/json',
  });

  // List all Metricool brands for this account
  app.get('/api/metricool/brands', checkAuth, async (req: any, res: any) => {
    try {
      const userId = process.env.METRICOOL_USER_ID;
      if (!userId || !process.env.METRICOOL_USER_TOKEN) {
        return res.status(500).json({ error: 'Metricool credentials not configured' });
      }
      const response = await axios.get(`${METRICOOL_BASE}/admin/simpleProfiles`, {
        params: { userId },
        headers: metricoolHeaders(),
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Metricool brands fetch failed:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data?.message || error.message });
    }
  });

  // List connected social accounts for a specific brand
  app.get('/api/metricool/accounts/:blogId', checkAuth, async (req: any, res: any) => {
    try {
      const userId = process.env.METRICOOL_USER_ID;
      const { blogId } = req.params;
      const response = await axios.get(`${METRICOOL_BASE}/admin/profiles-auth`, {
        params: { userId, blogId },
        headers: metricoolHeaders(),
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Metricool accounts fetch failed:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data?.message || error.message });
    }
  });

  // Schedule a post via Metricool
  app.post('/api/metricool/schedule', checkAuth, async (req: any, res: any) => {
    try {
      const { blogId, networks, imageUrl, caption, scheduledAt } = req.body;

      if (!blogId || !networks?.length || !imageUrl || !caption) {
        return res.status(400).json({ error: 'Missing required fields: blogId, networks, imageUrl, caption' });
      }

      // Map network names to ProviderStatus objects
      const providers = (networks as string[]).map((network: string) => ({ network }));

      // publicationDate: DateTimeInfo — use brand timezone Asia/Dubai or provided scheduledAt
      const pubDate = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      // Format as local datetime string (API applies timezone separately)
      const dateTimeStr = `${pubDate.getFullYear()}-${pad(pubDate.getMonth() + 1)}-${pad(pubDate.getDate())}T${pad(pubDate.getHours())}:${pad(pubDate.getMinutes())}:00`;

      const payload = {
        text: caption,
        publicationDate: {
          dateTime: dateTimeStr,
          timezone: 'Asia/Dubai',
        },
        providers,
        media: [imageUrl],
        autoPublish: true,
        targetBrandId: Number(blogId),
      };

      const response = await axios.post(`${METRICOOL_BASE}/v2/scheduler/posts`, payload, {
        params: { userId: process.env.METRICOOL_USER_ID, blogId: Number(blogId) },
        headers: metricoolHeaders(),
      });
      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Metricool schedule failed:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data?.message || error.message });
    }
  });

  // Login Activity Logging
  app.post("/api/auth/login-activity", checkAuth, async (req: any, res: any) => {
    const { status, ip, userAgent } = req.body;
    const db = req.db as FirestoreREST;
    try {
      await db.addDoc('login_activity', {
        user_id: req.user.uid,
        email: req.user.email,
        status,
        ip,
        userAgent,
        created_at: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to log activity" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
