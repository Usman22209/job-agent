const fs = require('fs');
const path = require('path');

function sanitizeEmailBody(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') return '';
  let body = rawBody.trim();

  // 1. If there is a "---" divider followed by a second sign-off, strip the duplicate block
  const dividerRegex = /\n\s*---\s*\n([\s\S]*)$/;
  const dividerMatch = body.match(dividerRegex);
  if (dividerMatch) {
    const beforeDivider = body.substring(0, dividerMatch.index).trim();
    if (/(sincerely|best regards|regards|warm regards),/i.test(beforeDivider)) {
      body = beforeDivider;
    }
  }

  // 2. If multiple closing sign-offs exist, keep only the first valid one
  const closingRegex = /\n\s*(sincerely|best regards|warm regards|kind regards|with regards|cheers),/gi;
  const closings = [];
  let match;
  while ((match = closingRegex.exec(body)) !== null) {
    closings.push(match);
  }
  if (closings.length > 1) {
    const secondClosing = closings[1];
    if (secondClosing && secondClosing.index !== undefined) {
      body = body.substring(0, secondClosing.index).replace(/\n\s*---\s*$/g, '').trim();
    }
  }

  // 3. Ensure a single clean resume attachment notice exists before the closing
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

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log("File not found:", filePath);
    return;
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
      const cleaned = sanitizeEmailBody(app.email_body);
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
cleanFile(targetPath);
