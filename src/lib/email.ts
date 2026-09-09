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
  const topSkills = profile.skills.slice(0, 4).map((s) => s.name).join(', ');

  const body = `Hi ${job.company} Hiring Team,

I am writing to submit my application for the ${job.title} position.

My technical background is centered on ${topSkills} with a proven record of engineering performant mobile applications and resilient full-stack architectures. At LifeLink, I architected cross-platform React Native systems maintaining 99.9% uptime and streamlined real-time data sync.

I have attached my tailored resume for your review. I would welcome the opportunity to discuss how my hands-on background can support ${job.company}'s upcoming milestones.

Best regards,

${profile.full_name}
${profile.email} | ${profile.phone}
Portfolio: https://github.com/Usman`;

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
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass && pass !== 'your-gmail-app-password') {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: recipient,
        subject,
        text: body,
        attachments,
      });

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
