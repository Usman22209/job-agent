import { IJob } from '@/types';

export function getMockJobs(): Partial<IJob>[] {
  return [
    {
      source: 'feed',
      source_id: 'mock-rn-01',
      title: 'React Native & Mobile Engineer',
      company: 'Veloce Health Technologies',
      location: 'Remote (Worldwide)',
      is_remote: true,
      salary_min: 55000,
      salary_max: 80000,
      currency: 'USD',
      description: `We are looking for an experienced React Native Developer to lead mobile app features for our digital clinic platform.
Requirements:
- Strong experience with React Native, TypeScript, and Redux Toolkit
- Experience with Supabase, Firebase (Cloud Messaging, Auth), and RESTful APIs
- Offline-first caching experience is a strong plus
- Good understanding of mobile UI/UX and native performance optimizations
- Must be comfortable with asynchronous remote work and Git workflows.

To apply directly, email us your resume and past projects at careers@velocehealth.io with subject 'Application for React Native Engineer'.`,
      url: 'https://velocehealth.io/careers/react-native',
      application_url: 'mailto:careers@velocehealth.io',
      contact_email: 'careers@velocehealth.io',
      application_type: 'EMAIL',
      posted_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      source: 'serpapi',
      source_id: 'mock-next-02',
      title: 'Full Stack Next.js & AI Developer',
      company: 'Synthetix Cloud Labs',
      location: 'Remote',
      is_remote: true,
      salary_min: 65000,
      salary_max: 95000,
      currency: 'USD',
      description: `Synthetix is building next-generation workflow automations. We need a Full Stack Developer proficient in Next.js 14/15, TypeScript, Tailwind CSS, and AI LLM integrations.
Requirements:
- Proven experience with Next.js (App Router, Server Actions, SSR)
- Solid foundation in Node.js, NestJS, and PostgreSQL (Supabase/Prisma)
- Hands-on experience integrating OpenAI, Anthropic, or agentic automation frameworks (Playwright/Puppeteer)
- Ability to build clean, responsive dashboards with modern design aesthetics.

Apply via our direct recruitment email: hiring@synthetixlabs.ai or through our careers portal.`,
      url: 'https://synthetixlabs.ai/careers/fullstack-ai',
      application_url: 'mailto:hiring@synthetixlabs.ai',
      contact_email: 'hiring@synthetixlabs.ai',
      application_type: 'EMAIL',
      posted_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      source: 'adzuna',
      source_id: 'mock-ats-03',
      title: 'Senior Frontend Developer (React / TypeScript)',
      company: 'HyperFlow Networks',
      location: 'London, UK (Remote)',
      is_remote: true,
      salary_min: 60000,
      salary_max: 85000,
      currency: 'USD',
      description: `Join HyperFlow as a Senior React Engineer. You will spearhead our client-facing web applications.
Stack: React 18, TypeScript, Vite, Tailwind CSS, GraphQL, Jest.
Application requires filling out our Greenhouse job board application. Please submit your resume, portfolio link, and work authorization status.`,
      url: 'https://boards.greenhouse.io/hyperflow/jobs/4092182001',
      application_url: 'https://boards.greenhouse.io/hyperflow/jobs/4092182001',
      contact_email: 'recruiting@hyperflow.net',
      application_type: 'ATS',
      ats_platform: 'Greenhouse',
      posted_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      source: 'apify',
      source_id: 'mock-rn-04',
      title: 'Mobile Engineer (React Native & Firebase)',
      company: 'Pulse Mobility',
      location: 'Remote',
      is_remote: true,
      salary_min: 50000,
      salary_max: 75000,
      currency: 'USD',
      description: `Pulse Mobility is hiring a React Native developer to help expand our rider and driver applications.
Required:
- 3+ years experience with React Native and TypeScript
- Firebase backend integration (Firestore, Cloud Functions)
- Experience deploying to Google Play Store and Apple App Store
- Send resumes directly to: talent@pulsemobility.co`,
      url: 'https://pulsemobility.co/jobs/mobile-engineer',
      application_url: 'mailto:talent@pulsemobility.co',
      contact_email: 'talent@pulsemobility.co',
      application_type: 'EMAIL',
      posted_at: new Date(Date.now() - 3600000 * 36).toISOString(),
    },
    {
      source: 'serpapi',
      source_id: 'mock-ats-05',
      title: 'Frontend Engineer (Design Systems & React)',
      company: 'Aether Dynamics',
      location: 'San Francisco, CA (Remote)',
      is_remote: true,
      salary_min: 70000,
      salary_max: 100000,
      currency: 'USD',
      description: `Aether Dynamics is looking for a Frontend Engineer with deep expertise in React, TypeScript, and modern component architectures.
You will build sleek web interfaces, optimize bundle sizes, and collaborate with product teams.
Apply through our Lever posting: https://jobs.lever.co/aetherdynamics/fe-dev`,
      url: 'https://jobs.lever.co/aetherdynamics/fe-dev',
      application_url: 'https://jobs.lever.co/aetherdynamics/fe-dev',
      application_type: 'ATS',
      ats_platform: 'Lever',
      posted_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
  ];
}
