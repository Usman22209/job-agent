import crypto from 'crypto';
import { IJob, ATSPlatform, JobSource } from '@/types';

/**
 * Decodes all HTML entities including named, decimal, and hex encoded entities.
 * Examples: &#x2F; -> '/', &#x27; -> "'", &amp; -> '&', &quot; -> '"'
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
      try {
        const code = parseInt(hex, 16);
        return String.fromCharCode(code);
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        const code = parseInt(dec, 10);
        return String.fromCharCode(code);
      } catch {
        return '';
      }
    });
}

/**
 * Sanitizes company names by decoding HTML entities and stripping parenthetical URLs.
 */
export function cleanCompany(rawCompany: string): string {
  if (!rawCompany) return 'Tech Startup';
  let company = decodeHtmlEntities(rawCompany).replace(/<[^>]+>/g, '').trim();
  // Strip parenthetical URLs or domain mentions, e.g. "Acme (https://acme.com)" -> "Acme"
  company = company.replace(/\s*\((?:https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app))[^)]*\)/gi, '').trim();
  // Strip leading/trailing quotation marks or dashes
  company = company.replace(/^["'“”‘’\-\|\/:\s]+|["'“”‘’\-\|\/:\s]+$/g, '').trim();
  return company || 'Tech Startup';
}

/**
 * Sanitizes job titles to ensure URLs, raw links, and unescaped entities are NEVER used as titles.
 * If title is a URL or website (e.g. https://e123insurtech.com), returns a clean professional fallback.
 */
export function cleanJobTitle(rawTitle: string, company?: string): string {
  if (!rawTitle) return 'Software Engineer';

  let title = decodeHtmlEntities(rawTitle).replace(/<[^>]+>/g, '').trim();

  // If title has multiple piped segments (e.g. "Staff Platform Engineer | REMOTE (US) | Full-time")
  if (title.includes('|')) {
    const parts = title.split('|').map((p) => p.trim()).filter(Boolean);
    const isUrlPart = (p: string) =>
      /^https?:\/\//i.test(p) ||
      /^www\./i.test(p) ||
      /^[a-z0-9-]+\.(com|io|ai|co|org|net|tech|dev|app)/i.test(p);
    const isMetaPart = (p: string) =>
      /^(remote|onsite|hybrid|full-?time|part-?time|contract|relocation|visa|\$|€|£)/i.test(p);
    const isRole = (p: string) =>
      /\b(engineer|developer|architect|lead|cto|designer|manager|fullstack|full-stack|backend|back-end|frontend|front-end|devops|sre|data|ml|ai|mobile|ios|android|product|qa|analyst|specialist)\b/i.test(p);

    // Prioritize part that matches role keywords and is not a URL
    const rolePart = parts.find((p) => !isUrlPart(p) && isRole(p));
    if (rolePart) {
      title = rolePart;
    } else {
      const nonMeta = parts.filter((p) => !isUrlPart(p) && !isMetaPart(p) && p.toLowerCase() !== company?.toLowerCase());
      if (nonMeta.length > 0) {
        title = nonMeta[0];
      } else {
        title = parts[0];
      }
    }
  }

  // Strip prefixes like "Role:", "Position:", "Job Title:", "Hiring:"
  title = title.replace(/^(?:Role|Position|Job Title|Hiring|We are hiring a?|Looking for a?):\s*/i, '').trim();

  // If title is or starts with a URL or raw domain (e.g. "https://e123insurtech.com" or "e123insurtech.com")
  const urlCheck =
    /^(https?:\/\/|www\.)/i.test(title) ||
    /^[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)(?:\/.*)?$/i.test(title);

  if (urlCheck) {
    return 'Software Engineer';
  }

  // If title contains a URL embedded in parentheses or brackets, remove the URL
  title = title.replace(/\((?:https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app))[^)]*\)/gi, '').trim();

  // Clean edge punctuation: quotes, brackets, pipes, dashes
  title = title.replace(/^["'“”‘’\-\|\/:\s]+|["'“”‘’\-\|\/:\s]+$/g, '').trim();

  // If the resulting title is identical to the company name, fallback to 'Software Engineer'
  if (company && title.toLowerCase() === company.toLowerCase()) {
    return 'Software Engineer';
  }

  // If title is too short, pure symbols, or abnormally long
  if (title.length < 2 || title.length > 100) {
    return 'Software Engineer';
  }

  return title;
}

export function cleanHtmlText(text: string): string {
  if (!text) return '';
  let str = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '); // Replace tags with space so adjacent text and emails never merge

  str = decodeHtmlEntities(str);

  // Strip any HTML tags that were previously escaped with &lt; &gt;
  str = str.replace(/<[^>]+>/g, ' ');

  return str
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export function normalizeJob(raw: any, source: JobSource): IJob {
  const company = cleanCompany(raw.company || raw.company_name || 'Confidential');
  const title = cleanJobTitle(raw.title || raw.job_title || raw.position || 'Software Engineer', company);
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
  let rawContact = raw.contact_email || extractEmail(rawDesc) || extractEmail(description);
  if (!rawContact && applicationUrl && applicationUrl.toLowerCase().startsWith('mailto:')) {
    rawContact = applicationUrl;
  }
  if (!rawContact && url && url.toLowerCase().startsWith('mailto:')) {
    rawContact = url;
  }
  const contactEmail = sanitizeContactEmail(rawContact);

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

// Set of recognized ICANN top-level domains & common extensions
const KNOWN_VALID_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
  'io', 'ai', 'co', 'tech', 'dev', 'app', 'xyz', 'me', 'us', 'uk', 'ca', 'de', 'fr', 'in', 'au', 'eu',
  'nl', 'se', 'ch', 'es', 'it', 'br', 'ru', 'jp', 'pl', 'nz', 'be', 'ae', 'sg', 'hk', 'ie', 'no', 'fi',
  'dk', 'at', 'cz', 'pt', 'ro', 'za', 'gr', 'il', 'tr', 'cl', 'mx', 'ar', 'co.uk', 'com.au', 'co.nz',
  'org.uk', 'gov.uk', 'ac.uk', 'com.br', 'com.do', 'co.in', 'gen.in', 'firm.in', 'net.in', 'org.in',
  'one', 'ly', 'gg', 'cc', 'to', 'fm', 'sh', 'so', 'vc', 'is', 'pro', 'design', 'agency', 'careers',
  'group', 'cloud', 'digital', 'global', 'systems', 'consulting', 'software', 'network', 'media', 'world',
  'link', 'fyi', 'care', 'health', 'law', 'run', 'space', 'bio', 'partners', 'business', 'technology',
  'solutions', 'company', 'center', 'team', 'ventures', 'capital', 'finance', 'fund', 'exchange', 'market',
  'services', 'management', 'enterprises', 'holdings', 'industries', 'estate', 'properties', 'energy',
  'studio', 'works', 'life', 'live', 'today', 'news', 'press', 'info', 'biz', 'mobi', 'name', 'tv', 'ws'
]);

// Common base TLDs where trailing text erroneously gets glued (e.g. .comproduct -> .com + product)
// MUST BE SORTED BY LENGTH DESCENDING so longer TLDs (e.g. 'care', 'com') match before prefixes (e.g. 'ca', 'co')
const BASE_GLUED_TLDS = [
  'co.uk', 'com.au', 'co.nz', 'org.uk', 'gov.uk', 'ac.uk', 'com.br', 'com.do', 'co.in',
  'care', 'tech', 'info', 'health', 'space',
  'com', 'org', 'net', 'edu', 'gov', 'app', 'dev', 'xyz', 'law', 'run', 'bio', 'biz',
  'io', 'ai', 'co', 'me', 'us', 'uk', 'de', 'ca', 'fr', 'in', 'au', 'eu'
];

export function sanitizeContactEmail(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  let cleaned = decodeHtmlEntities(raw).trim();
  cleaned = cleaned.replace(/^(?:mailto:|<|&lt;|%3c|3c|["'“”‘’(\[\{:;\s])+/i, '');
  cleaned = cleaned.replace(/(?:>|&gt;|%3e|3e|["'“”‘’\)\]\}:;,\s\.])+$/i, '');

  const atParts = cleaned.split('@');
  if (atParts.length !== 2) return undefined;
  const user = atParts[0].trim().toLowerCase();
  let domain = atParts[1].trim().toLowerCase();
  domain = domain.split('/')[0].split('?')[0].replace(/[\),;:\s.]+$/, '');

  const lastDot = domain.lastIndexOf('.');
  if (lastDot === -1) return undefined;

  let tld = domain.slice(lastDot + 1);
  if (!KNOWN_VALID_TLDS.has(tld)) {
    // Check if it starts with a known base TLD glued with a word (e.g. 'comproduct' -> 'com')
    const matchedBase = BASE_GLUED_TLDS.find(b => !b.includes('.') && tld.startsWith(b) && tld.length > b.length);
    if (matchedBase) {
      domain = domain.slice(0, lastDot + 1) + matchedBase;
    } else {
      return undefined;
    }
  }

  const JUNK_DOMAINS = [
    'example.com', 'sentry.io', 'schema.org', 'w3.org', 'github.com',
    'google.com', 'apple.com', 'remoteok.com', 'jobicy.com', 'remotive.com',
    'arbeitnow.com', 'domain.com', 'company.com', 'test.com', 'ycombinator.com'
  ];
  if (JUNK_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return undefined;

  const JUNK_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];
  if (JUNK_EXTENSIONS.some(ext => domain.endsWith(ext))) return undefined;

  if (user.startsWith('noreply') || user.startsWith('no-reply') || user.startsWith('donotreply')) return undefined;
  if (!/^[a-z0-9._%+-]+$/i.test(user)) return undefined;

  return `${user}@${domain}`;
}

export function extractEmail(text: string): string | undefined {
  if (!text) return undefined;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const matches = text.match(emailRegex);
  if (!matches || matches.length === 0) return undefined;

  const sanitized = matches
    .map((m) => sanitizeContactEmail(m))
    .filter((e): e is string => Boolean(e));

  if (sanitized.length === 0) return undefined;

  const unique = Array.from(new Set(sanitized));

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
    'contact',
    'hello',
    'founder',
  ];

  const priority = unique.find((email) => {
    const user = email.split('@')[0].toLowerCase();
    return HIRING_PREFIXES.some((p) => user.startsWith(p));
  });

  return priority || unique[0];
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
