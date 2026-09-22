import nodemailer from 'nodemailer';
import fs from 'fs';
import { IJob, IMasterProfile } from '@/types';
import { cleanJobTitle, cleanCompany, decodeHtmlEntities, sanitizeContactEmail } from './normalizer';

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  subject: string;
  body: string;
  mode: 'LIVE_SMTP' | 'SANDBOX_SIMULATED';
  timestamp: string;
  error?: string;
}

export function sanitizeEmailSubject(
  rawSubject: string,
  profile?: IMasterProfile,
  job?: IJob
): string {
  const company = job ? cleanCompany(job.company) : undefined;
  const cleanTitle = job ? cleanJobTitle(job.title, company) : 'Software Engineer';
  const name = profile?.full_name || 'Applicant';

  if (!rawSubject || typeof rawSubject !== 'string') {
    return `Application for ${cleanTitle} — ${name}`;
  }

  let sub = decodeHtmlEntities(rawSubject).trim();

  // If the subject contains a URL or domain in place of title (e.g. "Application for https://e123insurtech.com — Agha Ali")
  if (/https?:\/\/|[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)/i.test(sub)) {
    // Replace URL part with clean title
    sub = sub.replace(/https?:\/\/[^\s—–-]+/gi, cleanTitle);
    sub = sub.replace(/[a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app)/gi, cleanTitle);
  }

  // Remove any leftover entity artifacts or double dashes
  sub = sub.replace(/\s+/g, ' ').trim();
  return sub;
}

export function generateEmailDraft(
  job: IJob,
  profile: IMasterProfile
): { subject: string; body: string } {
  const company = cleanCompany(job.company);
  const title = cleanJobTitle(job.title, company);
  const subject = `Application for ${title} — ${profile.full_name}`;
  const topSkills =
    profile.skills?.slice(0, 5).map((s) => s.name).join(', ') ||
    'React Native, Node.js, Next.js, and AI integrations';

  const recentExp = profile.experience && profile.experience.length > 0 ? profile.experience[0] : null;
  const expSnippet = recentExp
    ? `Most recently as a ${recentExp.position} at ${recentExp.company}, I focused on engineering scalable applications, building resilient architectures, and integrating modern AI and automation workflows.`
    : `With over 8 years of production software engineering experience, I specialize in architecting high-performance mobile, web, and AI-enabled platforms.`;

  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.location) contactParts.push(profile.location);

  const links: string[] = [];
  if (profile.qa_vault?.linkedin) links.push(`LinkedIn: ${profile.qa_vault.linkedin}`);
  if (profile.qa_vault?.github) links.push(`GitHub: ${profile.qa_vault.github}`);
  if (profile.qa_vault?.portfolio || profile.qa_vault?.website || profile.qa_vault?.behance) {
    links.push(`Portfolio: ${profile.qa_vault.portfolio || profile.qa_vault.website || profile.qa_vault.behance}`);
  }

  const signLines = [
    'Best regards,',
    '',
    profile.full_name,
    contactParts.join(' | '),
    links.join(' | '),
  ].filter((l) => l !== undefined && l !== null);

  const body = `Hi ${company} Hiring Team,

I am writing to submit my application for the ${title} position.

My technical background is centered on ${topSkills}. ${expSnippet}

I have attached my tailored resume for your review. I would welcome the opportunity to discuss how my hands-on background can support ${company}'s upcoming milestones.

${signLines.join('\n')}`;

  return { subject, body };
}

export function sanitizeEmailBody(rawBody: string, profile?: IMasterProfile): string {
  if (!rawBody || typeof rawBody !== 'string') return '';
  let body = decodeHtmlEntities(rawBody).trim();

  // 1. Strip any URL mistakenly embedded in the role / position sentence
  body = body.replace(/in the https?:\/\/[^\s]+ role/gi, 'in the Software Engineer role');
  body = body.replace(/in the [a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app) role/gi, 'in the Software Engineer role');
  body = body.replace(/for the https?:\/\/[^\s]+ position/gi, 'for the Software Engineer position');
  body = body.replace(/for the [a-z0-9-]+\.(?:com|io|ai|co|org|net|tech|dev|app) position/gi, 'for the Software Engineer position');

  // 2. Strip any markdown divider "---" and everything following it (which was the old double-appended footer)
  const dividerRegex = /\n\s*---\s*\n([\s\S]*)$/;
  const dividerMatch = body.match(dividerRegex);
  if (dividerMatch) {
    body = body.substring(0, dividerMatch.index).trim();
  }

  // 3. If multiple closing sign-offs exist in the text, keep only up to the first one
  const closingRegex = /\n\s*(sincerely|best regards|warm regards|kind regards|with regards|cheers),/gi;
  const closings: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = closingRegex.exec(body)) !== null) {
    closings.push(match);
  }
  if (closings.length > 1) {
    const secondClosing = closings[1];
    if (secondClosing && secondClosing.index !== undefined) {
      body = body.substring(0, secondClosing.index).trim();
    }
  }

  // 4. Ensure a closing exists; if missing, add a clean candidate closing
  const hasClosing = /(sincerely|best regards|warm regards|kind regards),/i.test(body);
  if (!hasClosing && profile) {
    const sign = [
      'Sincerely,',
      profile.full_name,
      [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '),
    ].filter(Boolean).join('\n');
    body = `${body}\n\n${sign}`;
  }

  // 5. Ensure a single clean resume attachment notice exists before the closing
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

export async function sendApplicationEmail(
  job: IJob,
  profile: IMasterProfile,
  pdfPath?: string,
  overrideSubject?: string,
  overrideBody?: string
): Promise<EmailDispatchResult> {
  const rawRecipient = job.contact_email;
  const recipient = sanitizeContactEmail(rawRecipient);
  if (!recipient) {
    throw new Error(
      `Cannot send email application: Job "${job.title}" at "${job.company}" does not have a valid hiring contact email (raw: "${rawRecipient}").`
    );
  }
  job.contact_email = recipient;

  const { subject: defaultSub, body: defaultBody } = generateEmailDraft(job, profile);
  const subject = sanitizeEmailSubject(overrideSubject || defaultSub, profile, job);
  const rawBody = overrideBody || defaultBody;
  const body = sanitizeEmailBody(rawBody, profile);

  const senderEmail = process.env.SENDER_EMAIL || profile.email;
  const senderName = process.env.SENDER_NAME || profile.full_name;

  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: `${profile.full_name.replace(/\s+/g, '_')}_Resume.pdf`,
      path: pdfPath,
    });
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER?.replace(/^["']|["']$/g, '');
  const rawPass = process.env.SMTP_PASS?.replace(/^["']|["']$/g, '');
  const pass = rawPass?.replace(/\s+/g, '');

  if (host && user && pass && pass !== 'your-gmail-app-password') {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user, pass },
      });

      const mailOptions: any = {
        from: `"${senderName}" <${senderEmail}>`,
        replyTo: senderEmail,
        to: recipient,
        subject,
        text: body,
        attachments,
      };

      // BCC the candidate only if BCC_SENDER is explicitly set to 'true' (Gmail automatically preserves sent messages in Sent folder)
      if (process.env.BCC_SENDER === 'true' && senderEmail && senderEmail !== recipient) {
        mailOptions.bcc = senderEmail;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email Dispatch] Successfully sent application for "${job.title}" at "${job.company}" to "${recipient}"${mailOptions.bcc ? ` (BCC: "${senderEmail}")` : ''}. MessageId: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        recipient,
        subject,
        body,
        mode: 'LIVE_SMTP',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error(`[Email Dispatch] Failed to send email to "${recipient}":`, err.message);
      return {
        success: false,
        error: err.message,
        recipient,
        subject,
        body,
        mode: 'LIVE_SMTP',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Simulation mode
  console.log(`[Email Dispatch - SIMULATION] Would send application for "${job.title}" to "${recipient}" via SMTP`);
  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    recipient,
    subject,
    body,
    mode: 'SANDBOX_SIMULATED',
    timestamp: new Date().toISOString(),
  };
}

export async function sendTestEmail(targetRecipient?: string): Promise<{ success: boolean; messageId: string; recipient: string }> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER?.replace(/^["']|["']$/g, '');
  const pass = process.env.SMTP_PASS?.replace(/^["']|["']$/g, '')?.replace(/\s+/g, '');
  const senderEmail = process.env.SENDER_EMAIL?.replace(/^["']|["']$/g, '') || user || '';
  const senderName = process.env.SENDER_NAME?.replace(/^["']|["']$/g, '') || 'Applicant';
  const recipient = targetRecipient || senderEmail;

  if (!host || !user || !pass || pass === 'your-gmail-app-password') {
    throw new Error('SMTP credentials not configured in .env.local');
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    replyTo: senderEmail,
    to: recipient,
    subject: `Job Agent Live Test: Gmail SMTP Connected — ${new Date().toLocaleTimeString()}`,
    text: `Hi ${senderName},

This confirms that your Job Agent Gmail SMTP integration is 100% operational!

Configuration details:
• SMTP Host: ${host}
• Authenticated Gmail: ${user}
• Sender Address: ${senderEmail}
• Delivery Time: ${new Date().toISOString()}

Job applications sent to hiring teams will be dispatched directly through your configured Gmail account and saved in your Sent folder.

Happy Job Hunting!
- Job Agent Engine`,
  });

  return {
    success: true,
    messageId: info.messageId,
    recipient,
  };
}
