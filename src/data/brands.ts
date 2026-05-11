// ── Brand Registry ─────────────────────────────────────────────────────────
// Add new brands here. All brand-aware UI and canvas rendering read from this file.

export interface BrandConfig {
  id: string;
  name: string;
  nameAr?: string;
  accentColor: string;
  bgColor: string;
  canvasWidth: number;
  canvasHeight: number;
  /** Primary language for AI generation and canvas layout */
  language: 'en' | 'ar' | 'both';
  /** Key used in the MySQL settings table */
  settingsKey: string;
  telegramEnabled: boolean;
  instagramEnabled: boolean;
  /** Default settings when no DB record exists yet */
  defaults: {
    fixedTagline: string;
    footerDisclaimer: string;
    backgroundStyle: string;
  };
}

export const BRANDS: BrandConfig[] = [
  {
    id: 'ist-markets',
    name: 'IST Markets',
    accentColor: '#f27d26',
    bgColor: '#111114',
    canvasWidth: 1080,
    canvasHeight: 1080,
    language: 'both',
    settingsKey: 'brand-ist-markets',
    telegramEnabled: false,
    instagramEnabled: true,
    defaults: {
      fixedTagline: 'IST MARKETS | Institutional Grade Analysis',
      footerDisclaimer: 'Trading involves risk. Past performance is not indicative of future results.',
      backgroundStyle: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    },
  },
  {
    id: 'marsad-alsouq',
    name: 'Marsad Al Souq',
    nameAr: 'مرصد السوق',
    accentColor: '#C9A84C',
    bgColor: '#0D1B2A',
    canvasWidth: 1080,
    canvasHeight: 1620,
    language: 'ar',
    settingsKey: 'brand-marsad-alsouq',
    telegramEnabled: true,
    instagramEnabled: true,
    defaults: {
      fixedTagline: 'مرصد السوق | تحليل مؤسسي متخصص',
      footerDisclaimer: 'التداول ينطوي على مخاطر. الأداء السابق لا يضمن النتائج المستقبلية.',
      backgroundStyle: 'linear-gradient(180deg, #152035 0%, #0D1B2A 50%, #070E1A 100%)',
    },
  },
];

export const DEFAULT_BRAND_ID = 'ist-markets';

export const getBrand = (id: string): BrandConfig =>
  BRANDS.find(b => b.id === id) ?? BRANDS[0];
