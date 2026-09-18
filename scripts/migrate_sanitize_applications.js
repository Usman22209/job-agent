const fs = require('fs');
const path = require('path');

function sanitizeEmailBody(rawBody, profile) {
  if (!rawBody || typeof rawBody !== 'string') return '';
  let body = rawBody.trim();

  // 1. Strip any markdown divider "---" and everything following it (which was the old double-appended footer)
  const dividerRegex = /\n\s*---\s*\n([\s\S]*)$/;
  const dividerMatch = body.match(dividerRegex);
  if (dividerMatch) {
    body = body.substring(0, dividerMatch.index).trim();
  }

  // 2. If multiple closing sign-offs exist in the text, keep only up to the first one
  const closingRegex = /\n\s*(sincerely|best regards|warm regards|kind regards|with regards|cheers),/gi;
  const closings = [];
  let match;
  while ((match = closingRegex.exec(body)) !== null) {
    closings.push(match);
  }
  if (closings.length > 1) {
    const secondClosing = closings[1];
    if (secondClosing && secondClosing.index !== undefined) {
      body = body.substring(0, secondClosing.index).trim();
    }
  }

  // 3. Ensure a closing exists; if missing, add a clean candidate closing
  const hasClosing = /(sincerely|best regards|warm regards|kind regards),/i.test(body);
  if (!hasClosing && profile) {
    const sign = [
      'Sincerely,',
      profile.full_name,
      [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '),
    ].filter(Boolean).join('\n');
    body = `${body}\n\n${sign}`;
  }

  // 4. Ensure a single clean resume attachment notice exists before the closing
  const hasAttachmentMention = /attached\s+(my\s+)?(tailored\s+)?resume|resume\s+(is\s+)?attached/i.test(body);
  if (!hasAttachmentMention) {
    const closingMatch = body.match(/\n\s*(sincerely|best regards|warm regards|kind regards),/i);
    if (closingMatch && closingMatch.index !== undefined) {
      body = body.substring(0, closingMatch.index).trim() + '\n\nPlease find my tailored resume attached for your review.\n\n' + body.substring(closingMatch.index).trim();
    } else {
      body += '\n\nPlease find my tailored resume attached for your review.';
    }
  }

  return body;
}

function cleanFile(filePath, profilePath) {
  if (!fs.existsSync(filePath)) {
    console.log("File not found:", filePath);
    return;
  }
  let profile = null;
  if (profilePath && fs.existsSync(profilePath)) {
    try {
      profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    } catch (e) {}
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let apps = [];
  try {
    apps = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse JSON:", filePath, e.message);
    return;
  }

  let modifiedCount = 0;
  for (const app of apps) {
    if (app.email_body) {
      const cleaned = sanitizeEmailBody(app.email_body, profile || app.tailored_resume_json);
      if (cleaned !== app.email_body) {
        app.email_body = cleaned;
        modifiedCount++;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(apps, null, 2), 'utf8');
  console.log(`Sanitized ${modifiedCount} applications in ${filePath} (Total: ${apps.length})`);
}

const targetPath = process.argv[2] || path.resolve(__dirname, '../database/applications.json');
const profilePath = process.argv[3] || path.resolve(__dirname, '../database/seeds/master_profile.json');
cleanFile(targetPath, profilePath);
