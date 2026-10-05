const fs = require('fs');
const path = require('path');

const jobsPath = path.resolve(__dirname, '../database/jobs.json');
const appsPath = path.resolve(__dirname, '../database/applications.json');

const NON_TECH_REGEX = /\b(radiologist|physician|practitioner|doctor|veterinar\w*|nurse|nursing|dentist|dental|therapist|therapy|surgeon|pharmac\w*|medical|clinical|healthcare|radiology|paramedic|optometrist|chiropractor|attorney|lawyer|paralegal|accounting|auditor|realtor|mechanic|cook|chef|barista|driver)\b/i;

function stripAntiBotWatermarks(text) {
  if (!text) return '';
  let str = text;
  str = str.replace(
    /Please mention the word\s+[*_]*[A-Za-z0-9_-]+[*_]*\s+and tag\s+[A-Za-z0-9+/=]+\s+when applying[^\n.]*(?:\.|\n|$)/gi,
    ''
  );
  str = str.replace(
    /Please mention the word\s+[*_]*[A-Za-z0-9_-]+[*_]*\s+when applying[^\n.]*(?:\.|\n|$)/gi,
    ''
  );
  str = str.replace(
    /This is a beta feature to avoid spam applicants\.?\s*Companies can search these words to find applicants that read this and see they're human\.?/gi,
    ''
  );
  str = str.replace(/\(?#?R[A-Za-z0-9+/=]{14,}\)?/g, '');
  return str.trim();
}

function cleanBody(body) {
  if (!body) return '';
  let str = stripAntiBotWatermarks(body);
  str = str.replace(/\b(?:I\s+(?:fully\s+)?)?(?:ADVOCATED|BECKON|PERSPICACIOUS|METICULOUS)\s*(?:\([^)]*#?R[A-Za-z0-9+/=]+[^)]*\))?/gi, '');
  str = str.replace(/\(?#?R[A-Za-z0-9+/=]{14,}\)?/g, '');
  return str.trim();
}

// 1. Process Jobs
let jobsRemoved = 0;
let jobsCleaned = 0;
if (fs.existsSync(jobsPath)) {
  const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  const cleanedJobs = [];

  for (const job of jobs) {
    if (NON_TECH_REGEX.test(job.title)) {
      console.log(`Removing non-tech job: "${job.title}" at "${job.company}" (${job.id})`);
      jobsRemoved++;
      continue;
    }
    const origDesc = job.description || '';
    const cleanDesc = stripAntiBotWatermarks(origDesc);
    if (origDesc !== cleanDesc) {
      jobsCleaned++;
      job.description = cleanDesc;
    }
    cleanedJobs.push(job);
  }

  fs.writeFileSync(jobsPath, JSON.stringify(cleanedJobs, null, 2), 'utf8');
  console.log(`Jobs processed: ${cleanedJobs.length} kept, ${jobsRemoved} non-tech removed, ${jobsCleaned} honeypots cleaned.`);
}

// 2. Process Applications
let appsRemoved = 0;
let appsCleaned = 0;
if (fs.existsSync(appsPath)) {
  const apps = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
  const cleanedApps = [];

  for (const app of apps) {
    const jobTitle = app.job?.title || '';
    if (NON_TECH_REGEX.test(jobTitle)) {
      console.log(`Removing non-tech application: "${jobTitle}" at "${app.job?.company}" (${app.id})`);
      appsRemoved++;
      continue;
    }
    if (app.cover_letter) {
      const cleanCl = cleanBody(app.cover_letter);
      if (cleanCl !== app.cover_letter) {
        appsCleaned++;
        app.cover_letter = cleanCl;
      }
    }
    if (app.email_body) {
      app.email_body = cleanBody(app.email_body);
    }
    cleanedApps.push(app);
  }

  fs.writeFileSync(appsPath, JSON.stringify(cleanedApps, null, 2), 'utf8');
  console.log(`Applications processed: ${cleanedApps.length} kept, ${appsRemoved} non-tech removed, ${appsCleaned} honeypots cleaned.`);
}
