import nodemailer from 'nodemailer';
import fs from 'fs';
import { IJob, IMasterProfile } from '@/types';

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

export function generateEmailDraft(
  job: IJob,
  profile: IMasterProfile
): { subject: string; body: string } {
  const subject = `Application for ${job.title} — ${profile.full_name}`;
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

  const body = `Hi ${job.company} Hiring Team,

I am writing to submit my application for the ${job.title} position.

My technical background is centered on ${topSkills}. ${expSnippet}

I have attached my tailored resume for your review. I would welcome the opportunity to discuss how my hands-on background can support ${job.company}'s upcoming milestones.

${signLines.join('\n')}`;

  return { subject, body };
}

export async function sendApplicationEmail(
  job: IJob,
  profile: IMasterProfile,
  pdfPath?: string,
  overrideSubject?: string,
  overrideBody?: string
): Promise<EmailDispatchResult> {
  const recipient = job.contact_email;
  if (!recipient) {
    throw new Error(
      `Cannot send email application: Job "${job.title}" at "${job.company}" does not have a hiring contact email.`
    );
  }

  const { subject: defaultSub, body: defaultBody } = generateEmailDraft(job, profile);
  const subject = overrideSubject || defaultSub;
  const body = overrideBody || defaultBody;

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
