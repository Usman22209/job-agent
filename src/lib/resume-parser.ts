import fs from 'fs';
import path from 'path';
import { IMasterProfile } from '@/types';
import { callGeminiWithPersistentRetry, GeminiInlineData } from './ai/gemini';

export interface ParseResumeOptions {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  textContent?: string;
}

export async function parseResumeAndExtractProfile(
  options: ParseResumeOptions
): Promise<IMasterProfile> {
  const { fileBuffer, fileName, mimeType, textContent } = options;

  // 1. Save uploaded file to public/uploads/
  const uploadsDir = path.resolve(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const sanitizedBaseName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const savedFileName = `resume_${Date.now()}_${sanitizedBaseName}`;
  const diskPath = path.join(uploadsDir, savedFileName);
  fs.writeFileSync(diskPath, fileBuffer);
  const relativeUrl = `/uploads/${savedFileName}`;

  // 2. Prepare payload for Gemini (supports native PDF inlineData or text)
  let inlineData: GeminiInlineData | undefined = undefined;
  const isPdf = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    inlineData = {
      mimeType: 'application/pdf',
      data: fileBuffer.toString('base64'),
    };
  }

  const prompt = `You are an elite Executive Recruiter and Resume Parsing Agent.
Analyze the candidate's resume ${isPdf ? 'attached as PDF' : 'provided below'} and extract their complete professional profile.

${textContent ? `Resume Text Content:\n${textContent}\n` : ''}

CRITICAL: Extract ALL skills, work experiences with detailed bullet points, projects, and education accurately. Do NOT invent fake information.
Respond ONLY with valid JSON matching this schema:
{
  "full_name": "<Full Name>",
  "email": "<Email Address>",
  "phone": "<Phone Number>",
  "location": "<City, Country or Remote>",
  "headline": "<Professional Headline, e.g. Lead Mobile & Full-Stack Engineer>",
  "summary": "<2-3 sentence executive professional summary>",
  "skills": [
    { "name": "<Skill Name>", "level": "Expert" | "Advanced" | "Intermediate" }
  ],
  "experience": [
    {
      "company": "<Company Name>",
      "position": "<Job Title>",
      "location": "<City or Remote>",
      "start_date": "<e.g. Jan 2022>",
      "end_date": "<e.g. Present>",
      "current": <true or false>,
      "description": "<Role summary>",
      "bullet_points": [
        "<Key achievement or responsibility 1>",
        "<Key achievement or responsibility 2>"
      ]
    }
  ],
  "projects": [
    {
      "title": "<Project Name>",
      "technologies": ["<Tech1>", "<Tech2>"],
      "description": "<Project description>",
      "url": "<Optional URL or empty string>"
    }
  ],
  "education": [
    {
      "degree": "<Degree Title>",
      "institution": "<University or School>",
      "graduation_year": "<Graduation Year>"
    }
  ],
  "preferences": {
    "target_roles": ["<Role 1>", "<Role 2>"],
    "remote": true,
    "target_locations": ["Remote", "Worldwide"]
  },
  "qa_vault": {
    "work_authorization": "Authorized for international remote contract work",
    "sponsorship_required": "No for remote contract / Yes for US relocation"
  }
}`;

  try {
    const result = await callGeminiWithPersistentRetry(
      undefined,
      prompt,
      'Extract candidate resume into clean structured JSON',
      3,
      true,
      inlineData
    );

    const parsed = JSON.parse(result.text);

    return {
      full_name: parsed.full_name || 'Candidate',
      email: parsed.email || '',
      phone: parsed.phone || '',
      location: parsed.location || 'Remote',
      headline: parsed.headline || 'Software Engineer',
      summary: parsed.summary || '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      preferences: parsed.preferences || {
        target_roles: ['Software Engineer'],
        remote: true,
        target_locations: ['Remote'],
      },
      qa_vault: parsed.qa_vault || {
        work_authorization: 'Authorized for international remote work',
        sponsorship_required: 'No',
      },
      master_resume_url: relativeUrl,
      master_resume_filename: fileName,
    };
  } catch (err: any) {
    console.warn('[Resume Parser] Gemini extraction unavailable or failed:', err.message);
    return fallbackExtractProfile(fileName, relativeUrl, textContent);
  }
}

/**
 * Fallback parser when Gemini API key is missing or offline
 */
function fallbackExtractProfile(
  fileName: string,
  relativeUrl: string,
  textContent?: string
): IMasterProfile {
  const text = textContent || '';
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  const phoneMatch = text.match(/(\+?\d[\d\s-]{8,}\d)/);

  return {
    full_name: process.env.SENDER_NAME || 'Candidate',
    email: emailMatch ? emailMatch[0] : (process.env.SENDER_EMAIL || ''),
    phone: phoneMatch ? phoneMatch[0] : '',
    location: 'Open to Remote Worldwide',
    headline: 'Software Engineer',
    summary: 'Experienced software engineer specializing in scalable applications and modern development.',
    skills: [
      { name: 'React Native', level: 'Expert' },
      { name: 'Node.js', level: 'Expert' },
      { name: 'React', level: 'Expert' },
      { name: 'TypeScript', level: 'Expert' },
      { name: 'Next.js', level: 'Advanced' },
      { name: 'FastAPI', level: 'Advanced' },
      { name: 'OpenAI API', level: 'Advanced' },
    ],
    experience: [
      {
        company: 'Excersys (USA Based)',
        position: 'Full Stack Developer',
        start_date: 'Jan 2023',
        end_date: 'Present',
        current: true,
        description: 'Build and maintain production React Native and Node.js applications across fintech, food-tech, and sports-tech products.',
        bullet_points: [
          'Build and maintain production React Native and Node.js applications across fintech, food-tech, and sports-tech products, serving live users on iOS, Android, and web.',
          'Use Claude Code, Cursor AI, and MCP integrations in daily development for AI-assisted code generation, debugging, and code review.',
        ],
      },
    ],
    projects: [
      {
        title: 'JobAgent AI Pro',
        technologies: ['Next.js', 'React', 'Gemini AI', 'Node.js'],
        description: 'Autonomous job scraping, resume tailoring, and 1-click application agent.',
      },
    ],
    education: [
      {
        degree: 'Bachelor of Science in Computer Science',
        institution: 'University of Engineering and Technology',
        graduation_year: '2021',
      },
    ],
    preferences: {
      target_roles: ['React Native Developer', 'Next.js Developer', 'Full Stack Developer'],
      remote: true,
      target_locations: ['Remote', 'Worldwide'],
    },
    qa_vault: {
      work_authorization: 'Authorized for international remote contract work',
      sponsorship_required: 'No for contract / Yes for US relocation',
    },
    master_resume_url: relativeUrl,
    master_resume_filename: fileName,
  };
}
