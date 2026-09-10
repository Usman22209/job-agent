import { GoogleGenAI } from '@google/genai';

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

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
];

export async function getLiveAvailableModels(apiKey: string): Promise<string[]> {
  return CANDIDATE_MODELS;
}

/**
 * Cascading Gemini API caller using the official @google/genai SDK
 * with automatic model failover and multimodal PDF support.
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

  const ai = new GoogleGenAI({ apiKey: key });
  let lastError: any = null;

  for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
    const model = CANDIDATE_MODELS[i];

    try {
      if (i > 0) {
        await new Promise((res) => setTimeout(res, 500));
      }

      const contents: any[] = [];
      if (inlineData) {
        contents.push({
          inlineData: {
            mimeType: inlineData.mimeType,
            data: inlineData.data,
          },
        });
      }
      contents.push(prompt);

      const config: any = {
        temperature: 0.2,
      };

      if (jsonMode) {
        config.responseMimeType = 'application/json';
      }

      if (systemPrompt) {
        config.systemInstruction = systemPrompt;
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });

      const text = response.text || '';
      if (text) {
        return { text: cleanJsonOutput(text), modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Gemini Engine] Model ${model} notice: ${err.message?.slice(0, 100) || err}. Switching candidate...`);
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
