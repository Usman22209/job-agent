import axios from 'axios';
import { IJob, IMasterProfile, ITailoredResume } from '@/types';
import { callGeminiWithPersistentRetry } from './ai/gemini';
import { cleanJobTitle, cleanCompany } from './normalizer';
import { sanitizeEmailBody } from './email';

export async function tailorResumeAndCoverLetter(
  job: IJob,
  profile: IMasterProfile
): Promise<{ tailoredResume: ITailoredResume; coverLetter: string }> {
  let result: { tailoredResume: ITailoredResume; coverLetter: string };

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your-gemini-api-key') {
    try {
      result = await tailorWithGemini(job, profile, geminiKey);
      return {
        tailoredResume: result.tailoredResume,
        coverLetter: sanitizeEmailBody(result.coverLetter, profile),
      };
    } catch (err: any) {
      console.warn(`Gemini tailoring failed (${err.message}). Falling back.`);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your-openai-api-key') {
    try {
      result = await tailorWithLLM(job, profile, apiKey);
      return {
        tailoredResume: result.tailoredResume,
        coverLetter: sanitizeEmailBody(result.coverLetter, profile),
      };
    } catch (err: any) {
      console.warn(`OpenAI tailoring failed (${err.message}). Using deterministic rule-based tailoring engine.`);
    }
  }

  result = tailorDeterministically(job, profile);
  return {
    tailoredResume: result.tailoredResume,
    coverLetter: sanitizeEmailBody(result.coverLetter, profile),
  };
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

export function buildContactLine(profile: IMasterProfile): string {
  const parts: string[] = [];
  if (profile.email) parts.push(profile.email);
  if (profile.phone) parts.push(profile.phone);
  if (profile.location) parts.push(profile.location);
  if (profile.qa_vault?.linkedin) parts.push(profile.qa_vault.linkedin.replace(/^https?:\/\//, ''));
  if (profile.qa_vault?.github) parts.push(profile.qa_vault.github.replace(/^https?:\/\//, ''));
  const portfolio = profile.qa_vault?.portfolio || profile.qa_vault?.website || profile.qa_vault?.behance;
  if (portfolio) {
    parts.push(portfolio.replace(/^https?:\/\//, ''));
  }
  return parts.join(' | ');
}

export function buildCandidateSignature(profile: IMasterProfile): string {
  const lines: string[] = [
    'Sincerely,',
    profile.full_name,
    [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '),
  ];
  const links: string[] = [];
  if (profile.qa_vault?.linkedin) links.push(`LinkedIn: ${profile.qa_vault.linkedin}`);
  if (profile.qa_vault?.github) links.push(`GitHub: ${profile.qa_vault.github}`);
  const portfolio = profile.qa_vault?.portfolio || profile.qa_vault?.website || profile.qa_vault?.behance;
  if (portfolio) {
    links.push(`Portfolio: ${portfolio}`);
  }
  if (links.length > 0) {
    lines.push(links.join(' | '));
  }
  return lines.join('\n');
}

function buildTailorPrompt(job: IJob, profile: IMasterProfile): string {
  const company = cleanCompany(job.company);
  const title = cleanJobTitle(job.title, company);
  const contactLine = buildContactLine(profile);
  const signature = buildCandidateSignature(profile);

  return `
You are an expert ATS Resume Customizer and Career Strategist.
CRITICAL MANDATE - ZERO HALLUCINATION POLICY:
You must NEVER invent fake employers, fake job titles, fake degrees, or unlisted technologies.
You must use ONLY the candidate's actual name, contact info, experience, projects, skills, and education provided in the Master Profile below.
NEVER insert third-party links, names, or unlisted credentials.

Candidate Master Profile:
Name: ${profile.full_name}
Contact: ${contactLine}
Headline: ${profile.headline}
Summary: ${profile.summary}
Skills: ${JSON.stringify(profile.skills)}
Experience: ${JSON.stringify(profile.experience)}
Projects: ${JSON.stringify(profile.projects)}
Education: ${JSON.stringify(profile.education)}

Target Job Posting:
Title: ${title}
Company: ${company}
Location: ${job.location}
Description: ${job.description}

Respond ONLY in valid JSON matching this schema:
{
  "tailored_resume": {
    "full_name": "${profile.full_name}",
    "headline": "${profile.headline}",
    "contact_line": "${contactLine}",
    "summary": "<tailored ATS-targeted summary strictly based on real experience>",
    "ordered_skills": ["<skill1>", "<skill2>", "<skill3>"],
    "skills_categories": [
      {
        "category": "<category name>",
        "skills": "<comma-separated list of candidate's actual skills in this category>"
      }
    ],
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
        "description": "<project description>",
        "url": "<project url if available>"
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
  "cover_letter": "<Personalized, professional 3-paragraph cover letter for ${title} at ${company} from ${profile.full_name}. End with candidate's actual signature: \\n${signature}>"
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

  for (const skill of (profile.skills || [])) {
    if (jobText.includes(skill.name.toLowerCase())) {
      prioritizedSkills.push(skill.name);
    } else {
      remainingSkills.push(skill.name);
    }
  }

  const orderedSkills = [...prioritizedSkills, ...remainingSkills];

  // 1b. Group into skills_categories from profile.skills
  const expertSkills = (profile.skills || []).filter(s => s.level === 'Expert').map(s => s.name);
  const advancedSkills = (profile.skills || []).filter(s => s.level === 'Advanced').map(s => s.name);
  const otherSkills = (profile.skills || []).filter(s => s.level !== 'Expert' && s.level !== 'Advanced').map(s => s.name);

  const skillsCategories: { category: string; skills: string }[] = [];
  if (expertSkills.length > 0) {
    skillsCategories.push({ category: 'Core Expertise & Technologies', skills: expertSkills.join(', ') });
  }
  if (advancedSkills.length > 0) {
    skillsCategories.push({ category: 'Frameworks, Tools & Platforms', skills: advancedSkills.join(', ') });
  }
  if (otherSkills.length > 0) {
    skillsCategories.push({ category: 'Additional Technical Proficiencies', skills: otherSkills.join(', ') });
  }
  if (skillsCategories.length === 0 && orderedSkills.length > 0) {
    skillsCategories.push({ category: 'Technical Skills', skills: orderedSkills.join(', ') });
  }

  // 2. Tailor summary strictly based on candidate's real profile
  let summary = profile.summary || '';
  if (!summary || summary.length < 20) {
    summary = `${profile.headline || 'Experienced Software Engineer'}. Proficient in ${orderedSkills.slice(0, 6).join(', ')}. Target role: ${job.title} at ${job.company}.`;
  } else {
    // Clean any previous target role suffix and append current target
    summary = `${summary.replace(/\s*Target role:.*$/i, '')} Target role: ${job.title} at ${job.company}.`;
  }

  // 3. Map experience bullets
  const experience = (profile.experience || []).map((exp) => ({
    company: exp.company,
    position: exp.position,
    period: `${exp.start_date} - ${exp.end_date}`,
    bullet_points: exp.bullet_points,
  }));

  // 4. Select relevant projects
  const selectedProjects = (profile.projects || []).map((proj) => ({
    title: proj.title,
    technologies: proj.technologies,
    description: proj.description,
    url: proj.url,
  }));

  // 5. Map education
  const education = (profile.education || []).map((edu) => ({
    degree: edu.degree,
    institution: edu.institution,
    year: edu.graduation_year,
  }));

  // 6. Generate tailored cover letter with candidate's actual signature
  const topKeywords =
    prioritizedSkills.slice(0, 4).join(', ') ||
    orderedSkills.slice(0, 4).join(', ') ||
    'modern software development and system architecture';
  const recentExp = profile.experience && profile.experience.length > 0 ? profile.experience[0] : null;
  const expSnippet = recentExp
    ? `At ${recentExp.company}, where I served as ${recentExp.position}, I led development across core product initiatives, delivering robust architectures, implementing reliable services, and driving quality.`
    : `Throughout my career, I have focused on architecting resilient, user-centric software.`;

  const signature = buildCandidateSignature(profile);

  const company = cleanCompany(job.company);
  const title = cleanJobTitle(job.title, company);

  const coverLetter = `Dear Hiring Team at ${company},

I am writing to express my strong interest in the ${title} role. With extensive hands-on engineering experience developing scalable software solutions—particularly utilizing ${topKeywords}—I am confident in my ability to make an immediate, positive impact on your product roadmap.

Throughout my career, I have focused on architecting resilient, high-performance software. ${expSnippet} Additionally, my practical work in modern technologies, automated workflows, and robust engineering practices enables me to rapidly engineer reliable features and maintain rigorous code quality.

${company}'s work resonates strongly with my engineering philosophy. I welcome the opportunity to discuss how my background in ${
    prioritizedSkills[0] || orderedSkills[0] || 'software development'
  } and full-cycle execution aligns with your team's goals. Thank you for your time and consideration.

${signature}`;

  const tailoredResume: ITailoredResume = {
    full_name: profile.full_name,
    headline: profile.headline,
    contact_line: buildContactLine(profile),
    summary,
    ordered_skills: orderedSkills,
    skills_categories: skillsCategories,
    experience,
    selected_projects: selectedProjects,
    education,
  };

  return { tailoredResume, coverLetter };
}
