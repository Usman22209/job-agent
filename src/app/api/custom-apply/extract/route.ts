import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithPersistentRetry } from '@/lib/ai/gemini';
import { extractEmail, sanitizeContactEmail } from '@/lib/normalizer';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const trimmed = text.trim();

    // 1. Email detection with automatic normalization and glued-TLD sanitization
    const detectedEmail = extractEmail(trimmed) || '';

    let extracted = {
      title: '',
      company: '',
      email: detectedEmail,
      location: 'Remote',
    };

    // 2. Try Gemini extraction if available
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your-gemini-api-key') {
      try {
        const prompt = `Analyze this raw job description or email text and extract key metadata in JSON:
Text snippet:
"""
${trimmed.slice(0, 3000)}
"""

Extract and respond ONLY with valid JSON matching this schema:
{
  "title": "extracted or deduced Job Title (e.g. Senior React Native Developer)",
  "company": "extracted Company Name (or empty string if not found)",
  "email": "extracted contact/hiring email address if present in text, else empty string",
  "location": "extracted location (e.g. Remote, New York, US) or 'Remote'"
}`;

        const res = await callGeminiWithPersistentRetry(
          geminiKey,
          prompt,
          'Extract job title, company, email, location from text in JSON',
          2,
          true
        );

        const parsed = JSON.parse(res.text);
        if (parsed.title) extracted.title = parsed.title;
        if (parsed.company) extracted.company = parsed.company;
        if (parsed.email && !extracted.email) extracted.email = parsed.email;
        if (parsed.location) extracted.location = parsed.location;

        if (extracted.email) {
          extracted.email = sanitizeContactEmail(extracted.email) || '';
        }
        return NextResponse.json(extracted);
      } catch (e: any) {
        console.warn('[Extract API] Gemini extract failed, using regex fallback:', e.message);
      }
    }

    // 3. Fallback Heuristics
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!extracted.title && lines.length > 0) {
      for (const line of lines.slice(0, 5)) {
        if (line.length > 5 && line.length < 80 && !line.includes('@')) {
          extracted.title = line.replace(/^(Job Title|Position|Role|Title):?\s*/i, '');
          break;
        }
      }
    }

    if (extracted.email) {
      extracted.email = sanitizeContactEmail(extracted.email) || '';
    }
    return NextResponse.json(extracted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
