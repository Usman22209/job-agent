import axios from 'axios';
import { IJob, IMasterProfile, ITailoredResume } from '@/types';
import { callGeminiWithPersistentRetry } from './ai/gemini';

export async function tailorResumeAndCoverLetter(
  job: IJob,
  profile: IMasterProfile
): Promise<{ tailoredResume: ITailoredResume; coverLetter: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your-gemini-api-key') {
    try {
      return await tailorWithGemini(job, profile, geminiKey);
    } catch (err: any) {
      console.warn(`Gemini tailoring failed (${err.message}). Falling back.`);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your-openai-api-key') {
    try {
      return await tailorWithLLM(job, profile, apiKey);
    } catch (err: any) {
      console.warn(`OpenAI tailoring failed (${err.message}). Using deterministic rule-based tailoring engine.`);
    }
  }

  return tailorDeterministically(job, profile);
}

async function tailorWithGemini(
  job: IJob,
  profile: IMasterProfile,
  apiKey: string
): Promise<{ tailoredResume: ITailoredResume; coverLetter: string }> {
  const prompt = buildTailorPrompt(job, profile);
  const result = await callGeminiWithPersistentRetry(
    apiKey,
    prompt,
    'Tailor resume and draft personalized cover letter in JSON',
    3,
    true
  );

  const parsed = JSON.parse(result.text);
  return {
    tailoredResume: parsed.tailored_resume,
    coverLetter: parsed.cover_letter,
  };
}

function buildTailorPrompt(job: IJob, profile: IMasterProfile): string {
  return `
You are an expert ATS Resume Customizer and Career Strategist.
CRITICAL MANDATE - ZERO HALLUCINATION POLICY:
You must NEVER invent fake employers, fake job titles, fake degrees, or unlisted technologies.
Do NOT invent claims like "Worked at Google", "3 years AWS", "Kubernetes architect" if they are not in the candidate's master profile.
You may ONLY:
1. Reorder existing skills to highlight what this job posting asks for.
2. Rewrite the professional summary to directly address the job requirements using true past achievements.
3. Select and re-prioritize existing projects that demonstrate the relevant skills.
4. Refine bullet points from the candidate's existing experience to align with ATS keywords without changing facts.
5. Generate a personalized, compelling cover letter.

Candidate Master Profile:
Name: ${profile.full_name}
Contact: ${profile.email} | ${profile.phone} | ${profile.location}
Headline: ${profile.headline}
Summary: ${profile.summary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${JSON.stringify(profile.experience)}
Projects: ${JSON.stringify(profile.projects)}
Education: ${JSON.stringify(profile.education)}

Target Job Posting:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description}

Respond ONLY in valid JSON matching this schema:
{
  "tailored_resume": {
    "full_name": "${profile.full_name}",
    "contact_line": "${profile.email} • ${profile.phone} • ${profile.location}",
    "summary": "<tailored ATS-targeted summary strictly based on real experience>",
    "ordered_skills": ["<skill1>", "<skill2>", "<skill3>"],
    "experience": [
      {
        "company": "<actual company>",
        "position": "<actual position>",
        "period": "<actual period>",
        "bullet_points": ["<tailored bullet 1>", "<tailored bullet 2>"]
      }
    ],
    "selected_projects": [
      {
        "title": "<project title>",
        "technologies": ["<tech1>", "<tech2>"],
        "description": "<project description>"
      }
    ],
    "education": [
      {
        "degree": "<actual degree>",
        "institution": "<actual institution>",
        "year": "<actual year>"
      }
    ]
  },
  "cover_letter": "<Personalized, professional 3-paragraph cover letter for ${job.title} at ${job.company} from Usman Shafiq>"
}
`;
}

async function tailorWithLLM(
  job: IJob,
  profile: IMasterProfile,
  apiKey: string
): Promise<{ tailoredResume: ITailoredResume; coverLetter: string }> {
  const prompt = buildTailorPrompt(job, profile);

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
    }
  );

  const parsed = JSON.parse(response.data.choices[0].message.content);
  return {
    tailoredResume: parsed.tailored_resume,
    coverLetter: parsed.cover_letter,
  };
}

function tailorDeterministically(
  job: IJob,
  profile: IMasterProfile
): { tailoredResume: ITailoredResume; coverLetter: string } {
  const jobText = `${job.title} ${job.description}`.toLowerCase();

  // 1. Re-order skills by job relevance
  const prioritizedSkills: string[] = [];
  const remainingSkills: string[] = [];

  for (const skill of profile.skills) {
    if (jobText.includes(skill.name.toLowerCase())) {
      prioritizedSkills.push(skill.name);
    } else {
      remainingSkills.push(skill.name);
    }
  }

  const orderedSkills = [...prioritizedSkills, ...remainingSkills];

  // 2. Tailor summary
  const isMobile =
    jobText.includes('mobile') ||
    jobText.includes('react native') ||
    jobText.includes('ios') ||
    jobText.includes('android');
  const isFullStack =
    jobText.includes('full stack') ||
    jobText.includes('next.js') ||
    jobText.includes('backend');

  let summary = profile.summary;
  if (isMobile) {
    summary = `Lead Mobile & Full-Stack Engineer with 5+ years of experience specializing in React Native, TypeScript, Supabase, and high-performance cross-platform architectures. Proven success delivering production applications with real-time updates and seamless API integrations. Target role: ${job.title} at ${job.company}.`;
  } else if (isFullStack) {
    summary = `Senior Full-Stack Developer with deep expertise in Next.js, TypeScript, Node.js, and autonomous AI-driven systems. Strong background building mission-critical dashboards, REST/GraphQL APIs, and resilient data pipelines. Enthusiastic about bringing impactful solutions to ${job.company}.`;
  }

  // 3. Map experience bullets
  const experience = profile.experience.map((exp) => ({
    company: exp.company,
    position: exp.position,
    period: `${exp.start_date} - ${exp.end_date}`,
    bullet_points: exp.bullet_points,
  }));

  // 4. Select relevant projects
  const selectedProjects = profile.projects.map((proj) => ({
    title: proj.title,
    technologies: proj.technologies,
    description: proj.description,
  }));

  // 5. Map education
  const education = profile.education.map((edu) => ({
    degree: edu.degree,
    institution: edu.institution,
    year: edu.graduation_year,
  }));

  // 6. Generate tailored cover letter
  const topKeywords =
    prioritizedSkills.slice(0, 4).join(', ') ||
    'React Native, TypeScript, Next.js, and AI automation';
  const coverLetter = `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} role. With extensive hands-on engineering experience developing scalable mobile and web applications—particularly utilizing ${topKeywords}—I am confident in my ability to make an immediate, positive impact on your product roadmap.

Throughout my career, I have focused on architecting resilient, user-centric software. At LifeLink, I spearheaded cross-platform mobile delivery with React Native and Supabase, maintaining 99.9% uptime for vital services. Additionally, my work in AI automation and modern Next.js platforms enables me to rapidly engineer modern features and maintain rigorous code quality.

${job.company}'s work resonates strongly with my engineering philosophy. I welcome the opportunity to discuss how my background in ${
    prioritizedSkills[0] || 'software development'
  } and full-cycle execution aligns with your team's goals. Thank you for your time and consideration.

Sincerely,
${profile.full_name}
${profile.email} | ${profile.phone}
${profile.location}`;

  const tailoredResume: ITailoredResume = {
    full_name: profile.full_name,
    contact_line: `${profile.email} • ${profile.phone} • ${profile.location}`,
    summary,
    ordered_skills: orderedSkills,
    experience,
    selected_projects: selectedProjects,
    education,
  };

  return { tailoredResume, coverLetter };
}
