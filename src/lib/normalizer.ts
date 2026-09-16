import crypto from 'crypto';
import { IJob, ATSPlatform, JobSource } from '@/types';

export function cleanHtmlText(text: string): string {
  if (!text) return '';
  let str = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ''); // Strip any tags created from unescaped &lt; &gt;

  return str
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export function normalizeJob(raw: any, source: JobSource): IJob {
  const title = (raw.title || raw.job_title || raw.position || 'Untitled Position').trim();
  const company = (raw.company || raw.company_name || 'Confidential').trim();
  const location = (raw.location || raw.job_location || raw.candidate_required_location || 'Remote').trim();
  const rawDesc = raw.description || raw.snippet || raw.jobDescription || '';
  const description = cleanHtmlText(rawDesc);
  const url = raw.url || raw.job_url || raw.link || '';
  const applicationUrl = raw.application_url || raw.apply_url || url;

  // Detect Remote
  const isRemote =
    Boolean(raw.is_remote) ||
    Boolean(raw.remote) ||
    location.toLowerCase().includes('remote') ||
    title.toLowerCase().includes('remote') ||
    description.toLowerCase().includes('100% remote') ||
    description.toLowerCase().includes('work from anywhere');

  // Extract Contact Email from description or fields
  let contactEmail = raw.contact_email || extractEmail(rawDesc) || extractEmail(description);
  if (!contactEmail && applicationUrl && applicationUrl.toLowerCase().startsWith('mailto:')) {
    contactEmail = applicationUrl.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
  }
  if (!contactEmail && url && url.toLowerCase().startsWith('mailto:')) {
    contactEmail = url.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
  }

  // Detect ATS Platform and Application Type
  const { platform, type } = detectApplicationType(applicationUrl, url, contactEmail);

  // Generate SHA-256 deduplication hash
  const dedupString = `${company.toLowerCase()}:${title.toLowerCase()}:${isRemote ? 'remote' : location.toLowerCase()}`;
  const dedupHash = crypto.createHash('sha256').update(dedupString).digest('hex');

  return {
    id: raw.id ? String(raw.id) : crypto.randomUUID(),
    source,
    source_id: raw.source_id ? String(raw.source_id) : undefined,
    title,
    company,
    location,
    is_remote: isRemote,
    salary_min: raw.salary_min ? Number(raw.salary_min) : null,
    salary_max: raw.salary_max ? Number(raw.salary_max) : null,
    currency: raw.currency || 'USD',
    description,
    url,
    application_url: applicationUrl,
    contact_email: contactEmail,
    application_type: type,
    ats_platform: platform,
    posted_at: raw.posted_at || new Date().toISOString(),
    status: 'DISCOVERED',
    dedup_hash: dedupHash,
    created_at: new Date().toISOString(),
  };
}

export function extractEmail(text: string): string | undefined {
  if (!text) return undefined;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const matches = text.match(emailRegex);
  if (!matches || matches.length === 0) return undefined;

  const JUNK_DOMAINS = [
    'example.com',
    'sentry.io',
    'schema.org',
    'w3.org',
    'github.com',
    'google.com',
    'apple.com',
    'remoteok.com',
    'jobicy.com',
    'remotive.com',
    'arbeitnow.com',
    'domain.com',
    'company.com',
    'test.com',
  ];

  const JUNK_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

  const cleaned = matches.map((raw) => {
    let email = raw.trim().toLowerCase();
    // Strip common HTML entity artifacts (e.g. 3Ccareers@... or %3Ccareers@...)
    email = email.replace(/^(?:3c|%3c|&lt;|<)+/i, '');
    email = email.replace(/(?:3e|%3e|&gt;|>)+$/i, '');
    email = email.replace(/^mailto:/i, '');
    return email;
  });

  const filtered = cleaned.filter((email) => {
    if (!email || !email.includes('@')) return false;
    if (JUNK_EXTENSIONS.some((ext) => email.endsWith(ext))) return false;
    const domain = email.split('@')[1];
    if (!domain || !domain.includes('.')) return false;
    if (JUNK_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))) return false;
    if (email.startsWith('noreply') || email.startsWith('no-reply') || email.startsWith('donotreply')) return false;
    return true;
  });

  if (filtered.length === 0) return undefined;

  // Prioritize emails with hiring/recruitment keywords
  const HIRING_PREFIXES = [
    'career',
    'job',
    'hiring',
    'talent',
    'recruit',
    'apply',
    'hr',
    'people',
    'team',
    'work',
    'candidate',
    'accommodat',
    'recruitment',
  ];

  const preferred = filtered.find((email) => {
    const userPart = email.split('@')[0];
    return HIRING_PREFIXES.some((p) => userPart.includes(p));
  });

  return preferred || filtered[0];
}

export function detectApplicationType(
  appUrl: string,
  origUrl: string,
  contactEmail?: string
): { platform: ATSPlatform; type: 'EMAIL' | 'ATS' | 'WEB_FORM' | 'UNKNOWN' } {
  const combined = `${appUrl} ${origUrl}`.toLowerCase();

  if (combined.includes('boards.greenhouse.io') || combined.includes('gh_jid')) {
    return { platform: 'Greenhouse', type: 'ATS' };
  }
  if (combined.includes('jobs.lever.co')) {
    return { platform: 'Lever', type: 'ATS' };
  }
  if (combined.includes('myworkdayjobs.com') || combined.includes('workday')) {
    return { platform: 'Workday', type: 'ATS' };
  }
  if (combined.includes('smartrecruiters.com')) {
    return { platform: 'SmartRecruiters', type: 'ATS' };
  }
  if (combined.includes('bamboohr.com')) {
    return { platform: 'BambooHR', type: 'ATS' };
  }

  // If hiring contact email is identified, email is preferred (free channel!)
  if (contactEmail) {
    return { platform: 'DirectEmail', type: 'EMAIL' };
  }

  if (appUrl && (appUrl.includes('/apply') || appUrl.includes('form') || appUrl.includes('job'))) {
    return { platform: 'GenericForm', type: 'WEB_FORM' };
  }

  return { platform: 'Unknown', type: 'UNKNOWN' };
}
