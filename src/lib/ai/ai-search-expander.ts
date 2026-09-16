import { callGeminiWithPersistentRetry } from './gemini';
import { IMasterProfile } from '@/types';

/**
 * Dynamically brainstorms fresh, trending tech keywords, niche job titles,
 * and emerging market tags using Gemini AI when the standard search sweep
 * produces no new jobs.
 */
export async function generateAIExpandedSearchKeywords(
  profile: IMasterProfile,
  previouslyTriedKeywords: string[] = []
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  // Fallback list of curated, high-demand secondary tech roles if AI is offline
  const STATIC_SECONDARY_KEYWORDS = [
    'software-engineer',
    'cloud-engineer',
    'devops',
    'lead-engineer',
    'staff-engineer',
    'founding-engineer',
    'agentic-ai',
    'llm-engineer',
    'mobile-developer',
    'react-native-developer',
    'full-stack-engineer',
    'typescript-developer',
    'node-developer',
    'python-engineer',
    'fastapi-developer',
    'distributed-systems',
  ];

  if (!apiKey || apiKey === 'your-gemini-api-key' || apiKey === 'your_gemini_api_key_here') {
    console.log('[AI Search Expander] No Gemini API key configured. Using curated secondary keywords.');
    return STATIC_SECONDARY_KEYWORDS.filter((k) => !previouslyTriedKeywords.includes(k)).slice(0, 10);
  }

  const prompt = `
You are an expert autonomous tech recruiter and global job market strategist.
The candidate has the following profile:
- Primary Headline: ${profile.headline}
- Target Roles: ${profile.preferences.target_roles.join(', ')}
- Core Skills: ${profile.skills.slice(0, 15).map((s) => s.name).join(', ')}
- Location Preference: ${profile.preferences.target_locations.join(', ')}

The autonomous job agent has already searched the standard job tags:
Already searched: ${previouslyTriedKeywords.slice(-30).join(', ')}

Task:
Generate 12 fresh, trending, high-yield job search keywords, niche titles, and emerging market tags that this candidate is highly qualified for, which global companies and tech startups are actively hiring for right now on remote job boards (Jobicy, RemoteOK, Remotive, etc.).
Format each keyword as lowercase alphanumeric with hyphens (e.g. "founding-fullstack-engineer", "lead-react-native", "agentic-ai", "generative-ai-engineer", "mobile-app-architect").

Return a JSON array of 12 string keywords ONLY:
["keyword-1", "keyword-2", ...]
`.trim();

  const systemPrompt =
    'You are a specialized JSON-only assistant. You only output valid JSON arrays of strings, with no markdown code fences or conversational text.';

  try {
    const result = await callGeminiWithPersistentRetry(apiKey, prompt, systemPrompt, 3, true);
    let parsed: any;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      // Clean possible wrapper
      const cleaned = result.text.replace(/^[^{\[]*/, '').replace(/[^}\]]*$/, '');
      parsed = JSON.parse(cleaned);
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = parsed
        .map((k) => String(k).trim().toLowerCase().replace(/[^a-z0-9\-]+/g, '-'))
        .filter((k) => k.length > 2 && !previouslyTriedKeywords.includes(k));

      if (sanitized.length > 0) {
        console.log(`[AI Search Expander] 🧠 Gemini (${result.modelUsed}) generated ${sanitized.length} fresh search keywords:`, sanitized);
        return sanitized;
      }
    }
  } catch (err: any) {
    console.warn(`[AI Search Expander] Gemini keyword generation warning (${err.message}). Using fallback list.`);
  }

  // Fallback if Gemini returned empty or error
  return STATIC_SECONDARY_KEYWORDS.filter((k) => !previouslyTriedKeywords.includes(k)).slice(0, 10);
}
