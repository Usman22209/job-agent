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

  const body = `Hi ${job.company} Hiring Team,

I am writing to submit my application for the ${job.title} position.

My technical background is centered on ${topSkills}. ${expSnippet}

I have attached my tailored resume for your review. I would welcome the opportunity to discuss how my hands-on background can support ${job.company}'s upcoming milestones.

Best regards,

${profile.full_name}
${profile.email} | ${profile.phone}
LinkedIn: https://linkedin.com/in/talhagaba | GitHub: https://github.com/shtalhagaba`;

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

      // BCC the candidate so a copy is automatically preserved in their personal inbox
      if (senderEmail && senderEmail !== recipient) {
        mailOptions.bcc = senderEmail;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email Dispatch] Successfully sent application for "${job.title}" at "${job.company}" to "${recipient}" (BCC: "${senderEmail}"). MessageId: ${info.messageId}`);

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
        recipient,
        subject,
        body,
        mode: 'LIVE_SMTP',
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  // Sandbox simulation mode
  console.log(`[Email Dispatch] Simulation mode for "${recipient}" (No valid SMTP configured).`);
  return {
    success: true,
    messageId: `sandbox-msg-${Date.now()}`,
    recipient,
    subject,
    body,
    mode: 'SANDBOX_SIMULATED',
    timestamp: new Date().toISOString(),
  };
}

export async function sendTestEmail(targetRecipient?: string): Promise<{ success: boolean; message: string; messageId?: string }> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER?.replace(/^["']|["']$/g, '');
  const pass = process.env.SMTP_PASS?.replace(/^["']|["']$/g, '')?.replace(/\s+/g, '');
  const senderEmail = process.env.SENDER_EMAIL?.replace(/^["']|["']$/g, '') || 'talhasadiq320@gmail.com';
  const senderName = process.env.SENDER_NAME?.replace(/^["']|["']$/g, '') || 'Talha Sadiq';
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

All job applications sent to employers will automatically BCC this email address so you have a live record in your inbox.

Happy Job Hunting!
- Job Agent Engine`,
  });

  return {
    success: true,
    message: `Test email successfully sent to ${recipient}!`,
    messageId: info.messageId,
  };
}
