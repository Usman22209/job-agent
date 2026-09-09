import axios from 'axios';
import { IJob, IMasterProfile, IJobMatch, MatchClassification } from '@/types';
import { callGeminiWithPersistentRetry } from './ai/gemini';

export async function evaluateJobMatch(job: IJob, profile: IMasterProfile): Promise<IJobMatch> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your-gemini-api-key') {
    try {
      return await evaluateWithGemini(job, profile, geminiKey);
    } catch (err: any) {
      console.warn(`Gemini match failed (${err.message}). Falling back.`);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your-openai-api-key') {
    try {
      return await evaluateWithLLM(job, profile, apiKey);
    } catch (err: any) {
      console.warn(`OpenAI match failed (${err.message}). Using local rubric matching engine.`);
    }
  }

  return evaluateWithRubric(job, profile);
}

async function evaluateWithGemini(job: IJob, profile: IMasterProfile, apiKey: string): Promise<IJobMatch> {
  const prompt = `You are an expert technical recruiter and AI Job Matching Agent.
Evaluate the candidate's master profile against the job posting.

Candidate Profile:
Name: ${profile.full_name}
Skills: ${profile.skills.map((s) => s.name).join(', ')}
Summary: ${profile.summary}

Job Posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location} (Remote: ${job.is_remote})
Description: ${job.description}

Respond ONLY in valid JSON matching this schema:
{
  "score": <integer from 0 to 100>,
  "classification": <"EXCELLENT" | "GOOD" | "POSSIBLE" | "SKIP">,
  "matching_skills": [<array of matched skill names>],
  "missing_skills": [<array of missing skill names that the job asks for>],
  "recommendation": <"APPLY" | "REVIEW" | "SKIP">,
  "reasoning": <short 2-sentence explanation of fit and trade-offs>
}`;

  const result = await callGeminiWithPersistentRetry(
    apiKey,
    prompt,
    'Evaluate candidate job match in JSON',
    3,
    true
  );

  const parsed = JSON.parse(result.text);
  return {
    job_id: job.id,
    score: Math.min(100, Math.max(0, parsed.score)),
    classification: parsed.classification as MatchClassification,
    matching_skills: Array.isArray(parsed.matching_skills) ? parsed.matching_skills : [],
    missing_skills: Array.isArray(parsed.missing_skills) ? parsed.missing_skills : [],
    recommendation: parsed.recommendation || 'REVIEW',
    reasoning: parsed.reasoning || '',
    created_at: new Date().toISOString(),
  };
}

async function evaluateWithLLM(job: IJob, profile: IMasterProfile, apiKey: string): Promise<IJobMatch> {
  const prompt = `
You are an expert technical recruiter and AI Job Matching Agent.
Evaluate the candidate's master profile against the job posting.

Candidate Profile:
Name: ${profile.full_name}
Skills: ${profile.skills.map((s) => s.name).join(', ')}
Summary: ${profile.summary}

Job Posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location} (Remote: ${job.is_remote})
Description: ${job.description}

Respond ONLY in valid JSON with this exact structure:
{
  "score": <integer from 0 to 100>,
  "classification": <"EXCELLENT" | "GOOD" | "POSSIBLE" | "SKIP">,
  "matching_skills": [<array of matched skill names>],
  "missing_skills": [<array of missing skill names that the job asks for>],
  "recommendation": <"APPLY" | "REVIEW" | "SKIP">,
  "reasoning": <short 2-sentence explanation of fit and trade-offs>
}
`;

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 18000,
    }
  );

  const parsed = JSON.parse(response.data.choices[0].message.content);
  return {
    job_id: job.id,
    score: Math.min(100, Math.max(0, parsed.score)),
    classification: parsed.classification,
    matching_skills: parsed.matching_skills || [],
    missing_skills: parsed.missing_skills || [],
    recommendation: parsed.recommendation || 'REVIEW',
    reasoning: parsed.reasoning || 'Automated LLM match assessment.',
    created_at: new Date().toISOString(),
  };
}

function evaluateWithRubric(job: IJob, profile: IMasterProfile): IJobMatch {
  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of profile.skills) {
    const sName = skill.name.toLowerCase();
    if (jobText.includes(sName)) {
      matchedSkills.push(skill.name);
    }
  }

  const keyTechs = [
    'AWS',
    'Kubernetes',
    'Docker',
    'GraphQL',
    'Python',
    'Go',
    'Kafka',
    'Java',
    'C#',
    'Swift',
    'Kotlin',
    'Flutter',
  ];

  for (const tech of keyTechs) {
    if (jobText.includes(tech.toLowerCase()) && !matchedSkills.includes(tech)) {
      missingSkills.push(tech);
    }
  }

  let baseScore = 52;
  const titleLower = job.title.toLowerCase();
  if (titleLower.includes('react native')) baseScore += 28;
  else if (titleLower.includes('next.js') || titleLower.includes('react')) baseScore += 24;
  else if (titleLower.includes('full stack') || titleLower.includes('frontend')) baseScore += 18;

  baseScore += Math.min(24, matchedSkills.length * 5);
  baseScore -= Math.min(15, missingSkills.length * 4);
  if (job.is_remote) baseScore += 6;

  const score = Math.min(96, Math.max(35, baseScore));

  let classification: MatchClassification = 'SKIP';
  let recommendation: 'APPLY' | 'REVIEW' | 'SKIP' = 'SKIP';

  if (score >= 90) {
    classification = 'EXCELLENT';
    recommendation = 'APPLY';
  } else if (score >= 75) {
    classification = 'GOOD';
    recommendation = 'APPLY';
  } else if (score >= 60) {
    classification = 'POSSIBLE';
    recommendation = 'REVIEW';
  } else {
    classification = 'SKIP';
    recommendation = 'SKIP';
  }

  const reasoning = `Candidate profile strongly aligns with required ${matchedSkills.slice(0, 3).join(', ')} competencies. ${
    missingSkills.length > 0 ? `Lacks explicitly listed ${missingSkills.slice(0, 2).join(', ')} experience.` : 'No critical skill gaps identified.'
  }`;

  return {
    job_id: job.id,
    score,
    classification,
    matching_skills: matchedSkills,
    missing_skills: missingSkills,
    recommendation,
    reasoning,
    created_at: new Date().toISOString(),
  };
}
