import axios from 'axios';
import { auth } from '../firebase';

// ── Shared proxy helper ───────────────────────────────────────────────────────
// All AI calls go through the backend. The Gemini API key never reaches the browser.
async function callAI<T>(endpoint: string, body: object): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api/ai/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `AI call failed: ${res.statusText}`);
  }
  return res.json();
}

// ── Exported types ────────────────────────────────────────────────────────────
export interface StoryContent {
  en: {
    headline: string;
    caption: string;
    hashtags: string[];
  };
  ar: {
    headline: string;
    caption: string;
    hashtags: string[];
  };
}

export interface SocialCaption {
  hook: string;
  summary: string;
  cta: string;
  hashtags: string[];
}

export interface SocialPackage {
  en: SocialCaption;
  ar: SocialCaption;
}

// ── AI Functions (all proxied through backend) ────────────────────────────────

export const checkSafety = (content: string) =>
  callAI<{ safe: boolean; reason?: string }>('check-safety', { content });

export const rewriteArticle = (articleTitle: string, articleContent: string) =>
  callAI<StoryContent>('rewrite', { articleTitle, articleContent });

export const generateHookContent = (articleTitle: string, articleContent: string) =>
  callAI<StoryContent>('generate-hook', { articleTitle, articleContent });

export const generateVisualBrief = (headline: string, caption: string) =>
  callAI<string>('visual-brief', { headline, caption });

export const generateStoryImage = async (brief: string, aspectRatio = '1:1'): Promise<string> => {
  const result = await callAI<{ imageData: string }>('generate-image', { brief, aspectRatio });
  return result.imageData;
};

export const generateSocialCaption = (headline: string, caption: string) =>
  callAI<SocialPackage>('social-caption', { headline, caption });

// ── Instagram publish (no AI key — uses user-provided access token) ───────────
export const publishToInstagram = async (
  imageUrl: string,
  caption: string,
  instagramId: string,
  accessToken: string
): Promise<{ success: boolean; postId?: string; error?: string }> => {
  try {
    const containerResponse = await axios.post(`https://graph.facebook.com/v19.0/${instagramId}/media`, {
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken
    });

    const creationId = containerResponse.data.id;

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

    const publishResponse = await axios.post(`https://graph.facebook.com/v19.0/${instagramId}/media_publish`, {
      creation_id: creationId,
      access_token: accessToken
    });

    return { success: true, postId: publishResponse.data.id };
  } catch (error: any) {
    console.error("Instagram Publish Failed:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
};
