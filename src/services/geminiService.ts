import { GoogleGenAI, Type } from "@google/genai";
import axios from 'axios';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const OPENING_HOOKS = [
  "Here's what's moving markets today —",
  "Traders are watching closely as...",
  "Market alert:",
  "The numbers are in —",
  "What every Forex trader needs to know right now:",
  "A key development just hit the tape —",
  "Eyes on the market:",
  "Breaking through resistance —"
];

const CLOSING_HOOKS = [
  "Here's why it matters for Forex traders.",
  "Watch this space — the move could accelerate into the next session.",
  "Analysts say the impact will be felt across multiple currency pairs.",
  "Positioning ahead of tomorrow's session will be critical.",
  "This is the data point markets have been waiting for.",
  "The ripple effects are already being priced in."
];

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

export const checkSafety = async (content: string): Promise<{ safe: boolean; reason?: string }> => {
  const prompt = `
    Analyze the following financial news content for safety. 
    Flag content that is:
    1. Prohibited financial advice (guaranteeing returns).
    2. Hate speech or harassment.
    3. Misleading or false market manipulation.
    4. Explicit or inappropriate content.
    
    Content: ${content}
    
    Return JSON: { "safe": boolean, "reason": string | null }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          safe: { type: Type.BOOLEAN },
          reason: { type: Type.STRING, nullable: true }
        },
        required: ["safe"]
      }
    }
  });

  return JSON.parse(response.text || '{"safe": false}');
};

export const rewriteArticle = async (
  articleTitle: string, 
  articleContent: string
): Promise<StoryContent> => {
  const prompt = `
    You are a Senior Forex Editor for IST Markets. 
    Transform the following news into a polished editorial story for Instagram in both English and Arabic.

    Original Headline: ${articleTitle}
    Original Body: ${articleContent}

    STRICT GUIDELINES:
    1. Tone: Professional, engaging, and authoritative.
    2. Length: 3 to 5 sentences per version.
    3. Audience: Forex and Commodity traders.
    4. NO guaranteed return claims or financial advice.
    5. NO political bias.
    6. Light CTA at the end.

    ENGLISH STRUCTURE:
    - Opening Hook: Select one from: ${OPENING_HOOKS.join(' | ')}
    - Core News Body: Concise summary of the event.
    - Market Context: Why it matters for traders.
    - Closing Hook: Select one from: ${CLOSING_HOOKS.join(' | ')}

    ARABIC STYLE:
    - Not a literal translation.
    - Use natural Arabic financial media style (e.g., "تشهد الأسواق...", "ترقب حذر...").
    - Preserve numbers and asset notation (e.g., BTC, USD, 100k) in standard format.
    - Full RTL compatibility.

    OUTPUT FORMAT (JSON ONLY):
    {
      "en": { "headline": "...", "caption": "...", "hashtags": ["...", "..."] },
      "ar": { "headline": "...", "caption": "...", "hashtags": ["...", "..."] }
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          en: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              caption: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["headline", "caption", "hashtags"]
          },
          ar: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              caption: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["headline", "caption", "hashtags"]
          }
        },
        required: ["en", "ar"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateVisualBrief = async (headline: string, caption: string): Promise<string> => {
  // Step 1: Extract structured visual components from the news
  const extractPrompt = `
From this financial news headline and caption, extract the following in JSON:
1. "subjectName": The main financial asset in UPPERCASE (e.g., GOLD, BTC, OIL, EUR, AAPL, S&P500, PDS). Use the ticker or short name.
2. "mainElement": A physical 3D object representing this asset (e.g., "shiny gold bars", "bitcoin coin with circuit details", "oil barrel", "euro banknotes stack", "stock certificate with rising arrow", "drilling rig"). Be specific and visual.
3. "sentiment": One of "bullish", "bearish", or "neutral" based on the news tone.

Headline: ${headline}
Caption: ${caption}

Return ONLY valid JSON. Example: {"subjectName":"GOLD","mainElement":"shiny gold bars","sentiment":"bullish"}
`;

  let subjectName = 'MARKETS';
  let mainElement = 'gold coins and a rising arrow chart';
  let sentiment   = 'neutral';

  try {
    const extractRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: extractPrompt
    });
    const raw = extractRes.text || '{}';
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      const data = JSON.parse(match[0]);
      if (data.subjectName)  subjectName  = String(data.subjectName).toUpperCase();
      if (data.mainElement)  mainElement  = String(data.mainElement);
      if (data.sentiment)    sentiment    = String(data.sentiment);
    }
  } catch {
    // fallback values already set
  }

  // Step 2: Build the IST Markets branded template prompt
  const moodMap: Record<string, string> = {
    bullish: 'optimistic, energetic, upward momentum, green glowing accents',
    bearish: 'tense, dramatic, downward pressure, red glowing accents',
    neutral: 'professional, analytical, balanced, silver and white accents',
  };
  const mood = moodMap[sentiment] ?? moodMap.neutral;

  return `A professional financial advertisement poster. Vibrant deep purple gradient background (#3d0066 to #150033). In the center foreground: a cinematic 3D rendered composition of ${mainElement} leaning against large bold 3D metallic silver letters spelling "${subjectName}". The ${mainElement} has subtle purple reflective lighting. Background features elegant thin white abstract wave lines and floating light particles. Overall mood: ${mood}. Studio-quality lighting, sharp shadows, cinematic depth of field, 8K resolution, minimalist corporate luxury style. Photorealistic render. No captions, no overlaid text, no news headlines — only the 3D composition.`;
};

// Valid aspect ratios supported by Imagen 4
const VALID_IMAGEN_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];

export const generateStoryImage = async (brief: string, aspectRatio = '1:1'): Promise<string> => {
  const ratio = VALID_IMAGEN_RATIOS.includes(aspectRatio) ? aspectRatio : '1:1';

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-fast-generate-001',
    prompt: brief,
    config: {
      numberOfImages: 1,
      aspectRatio: ratio
    }
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (imageBytes) {
    return `data:image/png;base64,${imageBytes}`;
  }

  throw new Error("Failed to generate image");
};

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

export const generateSocialCaption = async (headline: string, caption: string): Promise<SocialPackage> => {
  const prompt = `
    Convert the following news article into a social media caption package for Instagram.
    
    Headline: ${headline}
    Editorial Caption: ${caption}
    
    Requirements:
    1. Opening Hook: A punchy, attention-grabbing first line.
    2. Article Summary: A concise 2-3 sentence summary of the key news.
    3. CTA: A clear call to action (e.g., "Check the link in bio for full analysis", "Join our Telegram for real-time signals").
    4. Hashtags: 5-7 relevant hashtags (mix of asset names and market themes).
    
    Provide the output in both English and natural, professional Arabic.
    For Arabic: Keep links and handles unchanged. Ensure RTL formatting.
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "en": { "hook": "...", "summary": "...", "cta": "...", "hashtags": ["...", "..."] },
      "ar": { "hook": "...", "summary": "...", "cta": "...", "hashtags": ["...", "..."] }
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          en: {
            type: Type.OBJECT,
            properties: {
              hook: { type: Type.STRING },
              summary: { type: Type.STRING },
              cta: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["hook", "summary", "cta", "hashtags"]
          },
          ar: {
            type: Type.OBJECT,
            properties: {
              hook: { type: Type.STRING },
              summary: { type: Type.STRING },
              cta: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["hook", "summary", "cta", "hashtags"]
          }
        },
        required: ["en", "ar"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const publishToInstagram = async (
  imageUrl: string, 
  caption: string, 
  instagramId: string, 
  accessToken: string
): Promise<{ success: boolean; postId?: string; error?: string }> => {
  try {
    // 1. Create Media Container
    // Note: Meta API requires a public URL for the image.
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
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
};
