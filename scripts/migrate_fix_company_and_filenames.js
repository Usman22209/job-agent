const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
console.log(`\n======================================================`);
console.log(`[Fix Company & Filenames] Processing: ${targetDir}`);
console.log(`======================================================`);

// 1. Standalone decodeHtmlEntities
function decodeHtmlEntities(text) {
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
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try { return String.fromCharCode(parseInt(dec, 10)); } catch { return ''; }
    });
}

// 2. Standalone cleanCompany
function cleanCompany(rawCompany) {
  if (!rawCompany) return 'Tech Startup';
  let company = decodeHtmlEntities(rawCompany).replace(/<[^>]+>/g, ' ').trim();

  // Strip parenthetical URLs or domain mentions
  company = company.replace(/\s*\(\s*(?:https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app|gg|run))[^)]*\)/gi, '').trim();

  // Strip standalone URLs
  company = company.replace(/https?:\/\/[^\s)]+/gi, '').trim();
  company = company.replace(/www\.[^\s)]+/gi, '').trim();
  company = company.replace(/\b[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app|gg|run)(?:\/[^\s)]*)?\b/gi, '').trim();

  // Replace slashes and backslashes with " & "
  company = company.replace(/[\/\\]+/g, ' & ').trim();

  // Strip non-company prose or sentence fragments
  if (
    company.length > 40 ||
    /^(hi[!.]|hello[!.]|we('re| are)|i('m| am)|location:|remote:|hiring:)/i.test(company) ||
    company.includes('. ') ||
    company.includes('! ')
  ) {
    const match = company.match(/(?:at|of|founder of|ceo of|co-founder of)\s+([A-Z][A-Za-z0-9\s&]{2,30}?)(?:\.|\s+is|\s+are|,|\!|$)/i);
    if (match && match[1] && match[1].trim().length >= 2) {
      company = match[1].trim();
    } else {
      const words = company.split(/\s+/).slice(0, 3).join(' ');
      if (words.length <= 25 && !/^(hi|hello|we|i|location|remote)/i.test(words)) {
        company = words;
      } else {
        company = 'Tech Startup';
      }
    }
  }

  company = company.replace(/^["'“”‘’\-\|\/:\s()\[\]{}]+|["'“”‘’\-\|\/:\s()\[\]{}]+$/g, '').trim();

  if (company.length > 35) {
    company = company.slice(0, 35).trim().replace(/^["'“”‘’\-\|\/:\s()\[\]{}]+|["'“”‘’\-\|\/:\s()\[\]{}]+$/g, '');
  }

  return company || 'Tech Startup';
}

// 3. Standalone cleanJobTitle
function cleanJobTitle(rawTitle, company) {
  if (!rawTitle) return 'Software Engineer';
  let title = decodeHtmlEntities(rawTitle).replace(/<[^>]+>/g, ' ').trim();

  if (title.includes('|')) {
    const parts = title.split('|').map(p => p.trim()).filter(Boolean);
    const isUrlPart = (p) => /^https?:\/\//i.test(p) || /^www\./i.test(p) || /^[a-z0-9-]+\.(com|io|ai|co|org|net|tech|dev|app)/i.test(p);
    const isRole = (p) => /\b(engineer|developer|architect|lead|cto|designer|manager|fullstack|full-stack|backend|back-end|frontend|front-end|devops|sre|data|ml|ai|mobile|ios|android|product|qa|analyst|specialist)\b/i.test(p);
    const rolePart = parts.find(p => !isUrlPart(p) && isRole(p));
    if (rolePart) {
      title = rolePart;
    } else {
      title = parts[0];
    }
  }

  title = title.replace(/^(?:Role|Position|Job Title|Hiring|We are hiring a?|Looking for a?):\s*/i, '').trim();
  title = title.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '').trim();
  title = title.replace(/https?:\/\/[^\s)]+/gi, '').trim();
  title = title.replace(/www\.[^\s)]+/gi, '').trim();

  if (/^(https?:\/\/|www\.)/i.test(title) || /^[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)(?:\/.*)?$/i.test(title)) {
    return 'Software Engineer';
  }

  if (title.includes('. ') || title.includes('! ')) {
    title = title.split(/[.!]\s+/)[0].trim();
  }

  title = title.replace(/^["'“”‘’\-\|\/:\s()\[\]{}]+|["'“”‘’\-\|\/:\s()\[\]{}]+$/g, '').trim();

  if (company && title.toLowerCase() === company.toLowerCase()) {
    return 'Software Engineer';
  }

  if (title.length < 2 || title.length > 60) {
    const roleMatch = title.match(/\b(Senior\s+|Staff\s+|Principal\s+|Lead\s+)?(Software Engineer|Full Stack Developer|Frontend Developer|Backend Developer|Mobile Engineer|React Native Developer|AI Engineer|DevOps Engineer|Data Engineer)\b/i);
    if (roleMatch) return roleMatch[0].trim();
    return 'Software Engineer';
  }

  return title;
}

// 4. Job Seeker Comment Detector
function isJobSeekerComment(text, firstLine = '') {
  if (!text) return false;
  const lower = text.toLowerCase();
  const firstLower = (firstLine || '').toLowerCase();

  if (
    firstLower.includes('seeking work') ||
    firstLower.includes('seeking freelancer') ||
    lower.startsWith('seeking work')
  ) {
    return true;
  }

  if (
    /(?:résumé\/cv|resume\/cv|my resume|my cv)/i.test(lower) &&
    /(?:willing to relocate|technologies:|open to (?:work|roles|joining|opportunities)|i am a|i'm a|i’m a|years of experience)/i.test(lower)
  ) {
    return true;
  }

  if (
    /location:\s*.*remote:\s*.*(?:willing to relocate|technologies:)/i.test(lower) ||
    /technologies:\s*.*(?:résumé\/cv|resume\/cv)/i.test(lower)
  ) {
    return true;
  }

  if (
    /^(?:hi[!.]|hello[!.]|hey[!.]|dear)\s+(?:i am|i'm|i’m|my name is|applied via|interested in your)/i.test(firstLine.trim()) &&
    !/(?:we are hiring|we're hiring|we are looking for|is hiring|looking to hire|join our team)/i.test(lower)
  ) {
    return true;
  }

  if (
    /^[A-Za-z\s]+with\s+\d+\+?\s+years of experience\b/i.test(firstLine.trim()) &&
    /(?:core skills:|highlights:|technologies:)/i.test(lower) &&
    !/(?:we are|we're|join us|our company|our team)/i.test(lower)
  ) {
    return true;
  }

  return false;
}

// 5. Clean jobs.json
const jobsPath = path.join(targetDir, 'database/jobs.json');
let jobSeekerJobIds = new Set();
let cleanedJobsCount = 0;
let seekerJobsCount = 0;

if (fs.existsSync(jobsPath)) {
  try {
    const rawJobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    const filteredJobs = [];

    for (const job of rawJobs) {
      const isSeeker = isJobSeekerComment(job.description || '', job.title || '') || isJobSeekerComment(job.company || '', '');
      if (isSeeker) {
        jobSeekerJobIds.add(job.id);
        seekerJobsCount++;
        continue; // Discard candidate pitch from jobs
      }

      const origCompany = job.company;
      const origTitle = job.title;
      job.company = cleanCompany(job.company);
      job.title = cleanJobTitle(job.title, job.company);

      if (origCompany !== job.company || origTitle !== job.title) {
        cleanedJobsCount++;
      }

      filteredJobs.push(job);
    }

    fs.writeFileSync(jobsPath, JSON.stringify(filteredJobs, null, 2), 'utf8');
    console.log(`[Jobs] Processed ${rawJobs.length} jobs: ${cleanedJobsCount} sanitized, ${seekerJobsCount} seeker postings filtered out.`);
  } catch (e) {
    console.error(`Error processing jobs.json:`, e.message);
  }
}

// 6. Clean applications.json
const appsPath = path.join(targetDir, 'database/applications.json');
if (fs.existsSync(appsPath)) {
  try {
    const rawApps = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
    const validApps = [];
    let resetCount = 0;
    let purgedSeekerApps = 0;

    for (const app of rawApps) {
      // Discard applications targeting job seeker comments
      if (jobSeekerJobIds.has(app.job_id) || isJobSeekerComment(app.job?.description || '', app.job?.title || '') || isJobSeekerComment(app.job?.company || '', '')) {
        purgedSeekerApps++;
        continue;
      }

      if (app.job) {
        app.job.company = cleanCompany(app.job.company);
        app.job.title = cleanJobTitle(app.job.title, app.job.company);
      }

      // Check if application suffered ENOENT or ENAMETOOLONG or has corrupt pdf path
      const hasEnoentOrNameTooLong =
        (app.notes && (app.notes.includes('ENOENT') || app.notes.includes('ENAMETOOLONG') || app.notes.includes('Needs Manual Submit'))) ||
        (app.logs && JSON.stringify(app.logs).includes('ENOENT')) ||
        (app.logs && JSON.stringify(app.logs).includes('ENAMETOOLONG')) ||
        (app.local_pdf_path && (app.local_pdf_path.includes('http') || app.local_pdf_path.length > 180));

      if (hasEnoentOrNameTooLong) {
        // Reset application so agent can properly re-tailor and auto-submit
        app.status = 'READY';
        app.tailored_resume_pdf_url = null;
        app.local_pdf_path = null;
        app.notes = 'Reset for automated re-tailoring and application';
        if (app.logs && Array.isArray(app.logs)) {
          app.logs = app.logs.filter(l => !l.message?.includes('ENOENT') && !l.message?.includes('ENAMETOOLONG'));
        }
        resetCount++;
      }

      validApps.push(app);
    }

    fs.writeFileSync(appsPath, JSON.stringify(validApps, null, 2), 'utf8');
    console.log(`[Applications] Processed ${rawApps.length} applications: ${resetCount} reset for clean re-apply, ${purgedSeekerApps} candidate pitch applications removed.`);
  } catch (e) {
    console.error(`Error processing applications.json:`, e.message);
  }
}

console.log(`[Fix Company & Filenames] Migration completed successfully!\n`);
