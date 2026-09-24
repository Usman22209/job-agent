const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
console.log(`[Candidate Sync] Processing agent directory: ${targetDir}`);

// 1. Read profile
let profile = null;
const masterProfilePath = path.join(targetDir, 'database/master_profile.json');
const seedProfilePath = path.join(targetDir, 'database/seeds/master_profile.json');

if (fs.existsSync(masterProfilePath)) {
  try {
    profile = JSON.parse(fs.readFileSync(masterProfilePath, 'utf8'));
    console.log(`[Candidate Sync] Loaded profile from ${masterProfilePath}`);
  } catch (e) {
    console.warn('Error reading master_profile.json:', e.message);
  }
}

if (!profile && fs.existsSync(seedProfilePath)) {
  try {
    profile = JSON.parse(fs.readFileSync(seedProfilePath, 'utf8'));
    console.log(`[Candidate Sync] Loaded profile from ${seedProfilePath}`);
  } catch (e) {
    console.warn('Error reading seed profile:', e.message);
  }
}

// 2. Read .env.local for SENDER_NAME and SENDER_EMAIL
const envPath = path.join(targetDir, '.env.local');
let envSenderName = '';
let envSenderEmail = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const nameMatch = envContent.match(/SENDER_NAME\s*=\s*["']?([^"'\r\n]+)["']?/);
  const emailMatch = envContent.match(/SENDER_EMAIL\s*=\s*["']?([^"'\r\n]+)["']?/) || envContent.match(/SMTP_USER\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (nameMatch) envSenderName = nameMatch[1].trim();
  if (emailMatch) envSenderEmail = emailMatch[1].trim();
}

const activeName = (envSenderName || profile?.full_name || 'Candidate').trim();
const activeEmail = (envSenderEmail || profile?.email || '').trim();

console.log(`[Candidate Sync] Active Candidate: "${activeName}" <${activeEmail}>`);

// 3. Process applications.json
const appsPath = path.join(targetDir, 'database/applications.json');
if (!fs.existsSync(appsPath)) {
  console.log(`[Candidate Sync] No applications.json found at ${appsPath}. Done.`);
  process.exit(0);
}

let apps = [];
try {
  apps = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
} catch (e) {
  console.error(`Failed to parse ${appsPath}:`, e.message);
  process.exit(1);
}

let updatedCount = 0;
const candidateSlug = activeName.toLowerCase().replace(/\s+/g, '_');

for (const app of apps) {
  let changed = false;

  // Fix email subject
  if (app.email_subject) {
    let sub = app.email_subject;
    if (/[—–-]\s*[A-Za-z\s.']+$/i.test(sub)) {
      sub = sub.replace(/[—–-]\s*[A-Za-z\s.']+$/i, `— ${activeName}`);
    } else if (!sub.toLowerCase().includes(activeName.toLowerCase())) {
      sub = `${sub} — ${activeName}`;
    }
    if (sub !== app.email_subject) {
      app.email_subject = sub;
      changed = true;
    }
  }

  // Fix email body if it has mismatched candidate info
  if (app.email_body) {
    let body = app.email_body;
    if (activeName.toLowerCase() !== 'talha sadiq') {
      body = body.replace(/Talha\s+Sadiq/gi, activeName);
      if (activeEmail) {
        body = body.replace(/talhasadiq320@gmail\.com/gi, activeEmail);
      }
      body = body.replace(/\+92\s*345\s*6601101/g, profile?.phone || '');
      body = body.replace(/linkedin\.com\/in\/talhagaba/gi, profile?.qa_vault?.linkedin || '');
      body = body.replace(/github\.com\/shtalhagaba/gi, profile?.qa_vault?.github || '');
      body = body.replace(/behance\.com\/shtalhagaba/gi, '');
    }
    if (body !== app.email_body) {
      app.email_body = body;
      changed = true;
    }
  }

  // Fix cover letter if present
  if (app.cover_letter && activeName.toLowerCase() !== 'talha sadiq') {
    let cl = app.cover_letter.replace(/Talha\s+Sadiq/gi, activeName);
    if (cl !== app.cover_letter) {
      app.cover_letter = cl;
      changed = true;
    }
  }

  // Check tailored resume json
  if (app.tailored_resume_json) {
    if (app.tailored_resume_json.full_name && app.tailored_resume_json.full_name !== activeName) {
      app.tailored_resume_json.full_name = activeName;
      changed = true;
    }
    if (app.tailored_resume_json.contact_line && activeName.toLowerCase() !== 'talha sadiq') {
      app.tailored_resume_json.contact_line = `${activeEmail} | ${profile?.phone || ''} | ${profile?.location || ''}`.replace(/\s*\|\s*\|\s*/g, ' | ').replace(/^\|\s*|\s*\|$/g, '');
      changed = true;
    }
  }

  // If application is not yet APPLIED, check if PDF belonged to another candidate
  if (app.status !== 'APPLIED') {
    const localPdf = app.local_pdf_path;
    if (localPdf && !localPdf.toLowerCase().includes(candidateSlug)) {
      delete app.local_pdf_path;
      app.tailored_resume_pdf_url = undefined;
      app.cover_letter = undefined;
      app.status = 'MATCHED';
      changed = true;
    }
  }

  if (changed) {
    updatedCount++;
  }
}

fs.writeFileSync(appsPath, JSON.stringify(apps, null, 2), 'utf8');
console.log(`[Candidate Sync] Successfully synchronized ${updatedCount} applications to "${activeName}" (Total: ${apps.length})`);
