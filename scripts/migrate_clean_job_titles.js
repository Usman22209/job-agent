/**
 * Database Migration Script: Clean HTML Entities and URLs from Job Titles & Applications
 *
 * Scans database/jobs.json and database/applications.json:
 * 1. Decodes all hex, decimal, and named HTML entities (&#x2F; -> /, &#x27; -> ', etc.)
 * 2. Cleans company names (strips parenthetical URLs)
 * 3. Sanitizes job titles so URLs (e.g. https://e123insurtech.com) are replaced with clean role names
 * 4. Sanitizes email subjects and bodies so raw URLs are never used in place of titles
 */

const fs = require('fs');
const path = require('path');

function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return '';
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
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}

function cleanCompany(rawCompany) {
  if (!rawCompany || typeof rawCompany !== 'string') return 'Tech Startup';
  let company = decodeHtmlEntities(rawCompany).replace(/<[^>]+>/g, '').trim();
  company = company.replace(/\s*\((?:https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app))[^)]*\)/gi, '').trim();
  company = company.replace(/^["'“”‘’\-\|\/:\s]+|["'“”‘’\-\|\/:\s]+$/g, '').trim();
  return company || 'Tech Startup';
}

function cleanJobTitle(rawTitle, company) {
  if (!rawTitle || typeof rawTitle !== 'string') return 'Software Engineer';

  let title = decodeHtmlEntities(rawTitle).replace(/<[^>]+>/g, '').trim();

  if (title.includes('|')) {
    const parts = title.split('|').map((p) => p.trim()).filter(Boolean);
    const isUrlPart = (p) =>
      /^https?:\/\//i.test(p) ||
      /^www\./i.test(p) ||
      /^[a-z0-9-]+\.(com|io|ai|co|org|net|tech|dev|app)/i.test(p);
    const isMetaPart = (p) =>
      /^(remote|onsite|hybrid|full-?time|part-?time|contract|relocation|visa|\$|€|£)/i.test(p);
    const isRole = (p) =>
      /\b(engineer|developer|architect|lead|cto|designer|manager|fullstack|full-stack|backend|back-end|frontend|front-end|devops|sre|data|ml|ai|mobile|ios|android|product|qa|analyst|specialist)\b/i.test(p);

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

  title = title.replace(/^(?:Role|Position|Job Title|Hiring|We are hiring a?|Looking for a?):\s*/i, '').trim();

  const urlCheck =
    /^(https?:\/\/|www\.)/i.test(title) ||
    /^[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)(?:\/.*)?$/i.test(title);

  if (urlCheck) {
    return 'Software Engineer';
  }

  title = title.replace(/\((?:https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app))[^)]*\)/gi, '').trim();
  title = title.replace(/^["'“”‘’\-\|\/:\s]+|["'“”‘’\-\|\/:\s]+$/g, '').trim();

  if (company && title.toLowerCase() === company.toLowerCase()) {
    return 'Software Engineer';
  }

  if (title.length < 2 || title.length > 100) {
    return 'Software Engineer';
  }

  return title;
}

function sanitizeSubject(rawSubject, title, profileName) {
  if (!rawSubject) return `Application for ${title} — ${profileName || 'Applicant'}`;
  let sub = decodeHtmlEntities(rawSubject).trim();
  if (/https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)/i.test(sub)) {
    sub = sub.replace(/https?:\/\/[^\s—–-]+/gi, title);
    sub = sub.replace(/[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)/gi, title);
  }
  return sub.replace(/\s+/g, ' ').trim();
}

function sanitizeBody(rawBody, title) {
  if (!rawBody) return '';
  let body = decodeHtmlEntities(rawBody).trim();
  const safeTitle = title || 'Software Engineer';
  body = body.replace(/in the https?:\/\/[^\s]+ role/gi, `in the ${safeTitle} role`);
  body = body.replace(/in the [a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app) role/gi, `in the ${safeTitle} role`);
  body = body.replace(/for the https?:\/\/[^\s]+ position/gi, `for the ${safeTitle} position`);
  body = body.replace(/for the [a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app) position/gi, `for the ${safeTitle} position`);
  return body;
}

function migrateDirectory(baseDir) {
  console.log(`\n========================================`);
  console.log(`Checking directory: ${baseDir}`);
  console.log(`========================================`);

  const jobsPath = path.join(baseDir, 'database', 'jobs.json');
  const appsPath = path.join(baseDir, 'database', 'applications.json');

  if (fs.existsSync(jobsPath)) {
    try {
      const rawJobs = fs.readFileSync(jobsPath, 'utf8');
      const jobs = JSON.parse(rawJobs);
      let updatedCount = 0;

      for (const job of jobs) {
        const oldTitle = job.title;
        const oldCompany = job.company;

        job.company = cleanCompany(job.company);
        job.title = cleanJobTitle(job.title, job.company);
        job.description = decodeHtmlEntities(job.description || '');

        if (oldTitle !== job.title || oldCompany !== job.company) {
          updatedCount++;
        }
      }

      fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), 'utf8');
      console.log(`[Jobs Migration] Sanitized ${updatedCount} / ${jobs.length} jobs in ${jobsPath}`);
    } catch (e) {
      console.error(`[Jobs Migration Error] ${jobsPath}:`, e.message);
    }
  } else {
    console.log(`[Jobs Migration] File not found: ${jobsPath}`);
  }

  if (fs.existsSync(appsPath)) {
    try {
      const rawApps = fs.readFileSync(appsPath, 'utf8');
      const apps = JSON.parse(rawApps);
      let updatedCount = 0;

      for (const app of apps) {
        let changed = false;
        let cleanTitle = 'Software Engineer';
        let cleanComp = 'Hiring Team';

        if (app.job) {
          const oldJobTitle = app.job.title;
          app.job.company = cleanCompany(app.job.company);
          app.job.title = cleanJobTitle(app.job.title, app.job.company);
          cleanTitle = app.job.title;
          cleanComp = app.job.company;
          if (oldJobTitle !== app.job.title) changed = true;
        }

        if (app.email_subject) {
          const oldSub = app.email_subject;
          app.email_subject = sanitizeSubject(app.email_subject, cleanTitle);
          if (oldSub !== app.email_subject) changed = true;
        }

        if (app.email_body) {
          const oldBody = app.email_body;
          app.email_body = sanitizeBody(app.email_body, cleanTitle);
          if (oldBody !== app.email_body) changed = true;
        }

        if (app.cover_letter) {
          const oldCover = app.cover_letter;
          app.cover_letter = sanitizeBody(app.cover_letter, cleanTitle);
          if (oldCover !== app.cover_letter) changed = true;
        }

        if (changed) updatedCount++;
      }

      fs.writeFileSync(appsPath, JSON.stringify(apps, null, 2), 'utf8');
      console.log(`[Apps Migration] Sanitized ${updatedCount} / ${apps.length} applications in ${appsPath}`);
    } catch (e) {
      console.error(`[Apps Migration Error] ${appsPath}:`, e.message);
    }
  } else {
    console.log(`[Apps Migration] File not found: ${appsPath}`);
  }
}

// Support passing directories via CLI arguments or default to current directory
const targetDirs = process.argv.slice(2);
if (targetDirs.length === 0) {
  migrateDirectory(process.cwd());
} else {
  for (const dir of targetDirs) {
    migrateDirectory(dir);
  }
}
