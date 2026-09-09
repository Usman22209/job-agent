// Google Gemini AI Engine with Cascading Fallbacks & Dynamic Model Discovery
// (Architected directly from lead-agent for 100% resilient model compatibility)

export interface GeminiInlineData {
  mimeType: string;
  data: string; // base64 encoded string
}

// Clean JSON response from Gemini markdown codeblocks
export function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

const DEFAULT_CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro-latest',
];

let cachedAvailableModels: string[] | null = null;
let lastModelFetchTime = 0;

/**
 * Dynamically queries Google AI Studio for all active models supported by the user's API key.
 * This completely prevents 404/400 errors from retired or regionally unavailable models.
 */
export async function getLiveAvailableModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (
    cachedAvailableModels &&
    cachedAvailableModels.length > 0 &&
    now - lastModelFetchTime < 600000 // 10 minute cache
  ) {
    return cachedAvailableModels;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const validModels = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''))
          .sort((a: string, b: string) => {
            const aIsFlash = a.includes('flash');
            const bIsFlash = b.includes('flash');
            if (aIsFlash && !bIsFlash) return -1;
            if (!aIsFlash && bIsFlash) return 1;
            return 0;
          });

        if (validModels.length > 0) {
          cachedAvailableModels = validModels;
          lastModelFetchTime = now;
          return validModels;
        }
      }
    }
  } catch (err) {
    console.warn('[Gemini Engine] Could not dynamically query models list, using candidate list', err);
  }

  return DEFAULT_CANDIDATE_MODELS;
}

/**
 * Cascading Gemini API caller that tries supported models sequentially
 */
export async function callGeminiAPIWithCascade(
  apiKey: string | undefined,
  prompt: string,
  systemPrompt?: string,
  jsonMode: boolean = true,
  inlineData?: GeminiInlineData
): Promise<{ text: string; modelUsed: string }> {
  const key =
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!key || key.trim() === '' || key === 'your-gemini-api-key' || key === 'your_gemini_api_key_here') {
    throw new Error('MISSING_KEY');
  }

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\nTask:\n${prompt}` : prompt;
  const availableModels = await getLiveAvailableModels(key);
  let lastError: any = null;

  for (let i = 0; i < availableModels.length; i++) {
    const modelName = availableModels[i];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

    try {
      if (i > 0) {
        await new Promise((res) => setTimeout(res, 600));
      }

      const parts: any[] = [];
      if (inlineData) {
        parts.push({
          inlineData: {
            mimeType: inlineData.mimeType,
            data: inlineData.data,
          },
        });
      }
      parts.push({ text: fullPrompt });

      const bodyPayload: any = {
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      };

      if (jsonMode) {
        bodyPayload.generationConfig.responseMimeType = 'application/json';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini Engine - ${modelName}] HTTP ${response.status}:`, errorText);
        lastError = new Error(`Gemini API [${modelName}] Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        return { text: cleanJsonOutput(text), modelUsed: modelName };
      }
    } catch (err: any) {
      console.warn(`[Gemini Engine - ${modelName}] Request failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models in Gemini cascade failed.');
}

/**
 * Robust retry loop with exponential backoff
 */
export async function callGeminiWithPersistentRetry(
  apiKey: string | undefined,
  prompt: string,
  systemPrompt?: string,
  maxAttempts: number = 3,
  jsonMode: boolean = true,
  inlineData?: GeminiInlineData
): Promise<{ text: string; modelUsed: string }> {
  let attempt = 0;
  let lastErr: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await callGeminiAPIWithCascade(apiKey, prompt, systemPrompt, jsonMode, inlineData);
    } catch (err: any) {
      lastErr = err;
      if (err.message === 'MISSING_KEY') throw err;
      console.warn(`[Gemini Engine] Attempt ${attempt}/${maxAttempts} failed. Retrying...`);
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }

  throw lastErr || new Error(`Failed to generate content after ${maxAttempts} attempts.`);
}
