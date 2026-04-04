import { auth } from '../firebase';

const getAuthHeader = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricoolBrand {
  id: number;
  label: string;            // brand display name
  picture?: string;
  instagram?: string | null;
  facebook?: string | null;
  facebookPageId?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  linkedinCompany?: string | null;
  [key: string]: any;
}

// Networks that support image posting
export const NETWORK_DISPLAY: Record<string, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  twitter:   'Twitter / X',
  tiktok:    'TikTok',
};

export const getConnectedNetworks = (brand: MetricoolBrand) =>
  Object.entries(NETWORK_DISPLAY)
    .filter(([key]) => brand[key])
    .map(([key, label]) => ({ key, label, handle: brand[key] as string }));

export interface SchedulePayload {
  blogId: number;
  networks: string[];   // e.g. ['instagram', 'facebook']
  imageUrl: string;     // must be a publicly accessible URL
  caption: string;
  scheduledAt?: string; // ISO string — undefined means "now"
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const fetchMetricoolBrands = async (): Promise<MetricoolBrand[]> => {
  const headers = await getAuthHeader();
  const res = await fetch('/api/metricool/brands', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch Metricool brands');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data ?? []);
};

export const scheduleToMetricool = async (payload: SchedulePayload): Promise<{ success: boolean; data: any }> => {
  const headers = await getAuthHeader();
  const res = await fetch('/api/metricool/schedule', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to schedule post on Metricool');
  }
  return res.json();
};
