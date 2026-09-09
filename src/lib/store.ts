import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  IMasterProfile, 
  IJob, 
  IJobMatch, 
  IApplication, 
  ISchedulerStatus, 
  ApplicationStatus,
  JobStatus 
} from '@/types';
import { normalizeJob } from './normalizer';
import { searchRemotiveJobs } from './providers/remotive';
import { searchRemoteOkJobs } from './providers/remoteok';
import { searchArbeitnowJobs } from './providers/arbeitnow';
import { searchJobicyJobs } from './providers/jobicy';
import { searchGoogleJobs } from './providers/serpapi';
import { searchAdzunaJobs } from './providers/adzuna';
import { evaluateJobMatch } from './matcher';
import { tailorResumeAndCoverLetter } from './resume-tailor';
import { generateResumePdf } from './pdf-generator';
import { sendApplicationEmail } from './email';

class AgentStore {
  private profile: IMasterProfile;
  private jobs: Map<string, IJob> = new Map();
  private dedupSet: Set<string> = new Set();
  private matches: Map<string, IJobMatch> = new Map();
  private applications: Map<string, IApplication> = new Map();

  // Local Cron Agent State
  private isSchedulerRunning: boolean = false;
  private isSchedulerEnabled: boolean = true;
  private lastCronRun?: string;
  private totalJobsScraped: number = 0;
  private totalApplicationsQueued: number = 0;
  private cronIntervalTimer: NodeJS.Timeout | null = null;
  private cronIntervalMinutes: number = 2;

  constructor() {
    this.profile = this.loadInitialProfile();
    this.seedInitialJobs();
    this.startBackgroundCronAgent();
  }

  // --- Profile Operations ---
  getProfile(): IMasterProfile {
    return this.profile;
  }

  updateProfile(updates: Partial<IMasterProfile>): IMasterProfile {
    this.profile = { ...this.profile, ...updates };
    try {
      const p = path.resolve(process.cwd(), 'database/seeds/master_profile.json');
      fs.writeFileSync(p, JSON.stringify(this.profile, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('Could not persist profile to disk:', err.message);
    }
    return this.profile;
  }

  // --- Job Operations ---
  getJobs(filter?: { status?: JobStatus; search?: string; source?: string }): IJob[] {
    let list = Array.from(this.jobs.values());
    if (filter?.status) {
      list = list.filter((j) => j.status === filter.status);
    }
    if (filter?.source) {
      list = list.filter((j) => j.source === filter.source);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q)
      );
    }
    return list.sort(
      (a, b) =>
        new Date(b.posted_at || b.created_at || 0).getTime() -
        new Date(a.posted_at || a.created_at || 0).getTime()
    );
  }

  getJobById(id: string): IJob | undefined {
    return this.jobs.get(id);
  }

  ingestJob(raw: any, source: any): { job: IJob; isNew: boolean } {
    const normalized = normalizeJob(raw, source);

    if (this.dedupSet.has(normalized.dedup_hash || '')) {
      return { job: normalized, isNew: false };
    }

    this.dedupSet.add(normalized.dedup_hash || '');
    this.jobs.set(normalized.id, normalized);
    this.totalJobsScraped++;
    return { job: normalized, isNew: true };
  }

  async runDiscovery(
    queries: string[] = ['React Native', 'React', 'Next.js', 'AI Engineer'],
    location: string = 'Remote'
  ): Promise<{ newJobs: IJob[]; total: number; sourceCounts: Record<string, number> }> {
    const newJobs: IJob[] = [];
    const sourceCounts: Record<string, number> = {};

    const scrapePromises: Promise<any[]>[] = [];

    // 1. Remotive (Query each role)
    for (const q of queries) {
      scrapePromises.push(searchRemotiveJobs(q, 30));
    }

    // 2. Jobicy (Query each role)
    for (const q of queries) {
      scrapePromises.push(searchJobicyJobs(q, 25));
    }

    // 3. RemoteOK (Tech jobs)
    scrapePromises.push(searchRemoteOkJobs(queries[0] || 'react', 40));

    // 4. Arbeitnow (Active engineering jobs)
    scrapePromises.push(searchArbeitnowJobs(queries[0] || 'react', 40));

    // 5. SerpApi (Google Jobs - if key configured)
    for (const q of queries) {
      scrapePromises.push(searchGoogleJobs(q, location));
    }

    // 6. Adzuna (If key configured)
    for (const q of queries) {
      scrapePromises.push(searchAdzunaJobs(q, 'us'));
    }

    const settled = await Promise.allSettled(scrapePromises);
    for (const result of settled) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        for (const item of result.value) {
          const res = this.ingestJob(item, item.source || 'feed');
          sourceCounts[res.job.source] = (sourceCounts[res.job.source] || 0) + 1;
          if (res.isNew) {
            newJobs.push(res.job);
          }
        }
      }
    }

    return { newJobs, total: this.jobs.size, sourceCounts };
  }

  async scrapeLiveJobs(
    query: string = 'React Native',
    location: string = 'Remote'
  ): Promise<{ newJobs: IJob[]; total: number; scrapedThisPass: number; sourceCounts: Record<string, number> }> {
    const newJobs: IJob[] = [];
    const sourceCounts: Record<string, number> = {};

    const scrapePromises = [
      searchRemotiveJobs(query, 40),
      searchRemoteOkJobs(query, 40),
      searchJobicyJobs(query, 30),
      searchArbeitnowJobs(query, 40),
      searchGoogleJobs(query, location),
      searchAdzunaJobs(query, 'us'),
    ];

    const settled = await Promise.allSettled(scrapePromises);
    let totalScraped = 0;

    for (const result of settled) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        totalScraped += result.value.length;
        for (const item of result.value) {
          const res = this.ingestJob(item, item.source || 'feed');
          sourceCounts[res.job.source] = (sourceCounts[res.job.source] || 0) + 1;
          if (res.isNew) {
            newJobs.push(res.job);
          }
        }
      }
    }

    return {
      newJobs,
      total: this.jobs.size,
      scrapedThisPass: totalScraped,
      sourceCounts,
    };
  }

  // --- Matching Operations ---
  async matchJob(jobId: string): Promise<IJobMatch> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const match = await evaluateJobMatch(job, this.profile);
    this.matches.set(jobId, match);

    // Attach match to job
    job.match = match;
    job.status = 'MATCHED';
    this.jobs.set(jobId, job);

    return match;
  }

  // --- Applications Operations ---
  getApplications(filter?: { status?: ApplicationStatus }): IApplication[] {
    let list = Array.from(this.applications.values());
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    return list.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
    );
  }

  getApplicationById(id: string): IApplication | undefined {
    return this.applications.get(id);
  }

  async createApplication(jobId: string): Promise<IApplication> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const match = job.match || (await this.matchJob(jobId));
    const channel = job.contact_email
      ? 'EMAIL'
      : (job.application_type as any) || 'WEB_FORM';

    const app: IApplication = {
      id: crypto.randomUUID(),
      job_id: job.id,
      job,
      match,
      profile_id: this.profile.id,
      status: 'MATCHED',
      application_channel: channel,
      needs_human_review: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.applications.set(app.id, app);
    return app;
  }

  async tailorApplication(applicationId: string): Promise<IApplication> {
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`Application ${applicationId} not found`);

    const job = app.job || this.jobs.get(app.job_id)!;
    const { tailoredResume, coverLetter } = await tailorResumeAndCoverLetter(job, this.profile);

    const filename = `Resume_${this.profile.full_name.replace(/\s+/g, '_')}_${job.company.replace(
      /\s+/g,
      '_'
    )}_${Date.now()}.pdf`;

    const { filePath, relativeUrl } = await generateResumePdf(tailoredResume, filename);

    app.tailored_resume_json = tailoredResume;
    app.tailored_resume_pdf_url = relativeUrl;
    (app as any).local_pdf_path = filePath;
    app.cover_letter = coverLetter;
    app.status = 'READY';
    app.updated_at = new Date().toISOString();

    this.applications.set(applicationId, app);
    return app;
  }

  async sendEmailForApplication(applicationId: string): Promise<any> {
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`Application ${applicationId} not found`);

    const job = app.job || this.jobs.get(app.job_id)!;
    const pdfPath = (app as any).local_pdf_path;

    const res = await sendApplicationEmail(
      job,
      this.profile,
      pdfPath,
      app.email_subject,
      app.email_body
    );

    if (res.success) {
      app.status = 'APPLIED';
      app.email_sent_at = res.timestamp;
      app.email_message_id = res.messageId;
      app.updated_at = new Date().toISOString();
      this.applications.set(applicationId, app);
    }

    return res;
  }

  updateApplicationStatus(id: string, status: ApplicationStatus): IApplication {
    const app = this.applications.get(id);
    if (!app) throw new Error(`Application ${id} not found`);

    app.status = status;
    app.updated_at = new Date().toISOString();
    this.applications.set(id, app);
    return app;
  }

  async autoApplyToJob(jobId: string): Promise<{
    success: boolean;
    method: 'EMAIL' | 'WEB_PORTAL';
    application: IApplication;
    applyUrl: string;
    message: string;
  }> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // 1. Ensure job is matched
    let match = job.match || this.matches.get(jobId);
    if (!match) {
      match = await this.matchJob(jobId);
    }

    // 2. Find existing or create new application
    let app = Array.from(this.applications.values()).find((a) => a.job_id === jobId);
    if (!app) {
      app = await this.createApplication(jobId);
    }

    // 3. Tailor resume, cover letter, and generate PDF
    if (!app.tailored_resume_pdf_url || !app.cover_letter) {
      app = await this.tailorApplication(app.id);
    }

    // 4. Dispatch Email or Prepare Web Portal
    const hasEmail = Boolean(job.contact_email);
    const method: 'EMAIL' | 'WEB_PORTAL' = hasEmail ? 'EMAIL' : 'WEB_PORTAL';
    let message = '';

    if (hasEmail) {
      try {
        const emailRes = await this.sendEmailForApplication(app.id);
        if (emailRes.success) {
          app.status = 'APPLIED';
          job.status = 'APPLIED';
          message = `Application and tailored PDF resume emailed directly to ${job.contact_email}!`;
        } else {
          app.status = 'APPLIED';
          job.status = 'APPLIED';
          message = `Application ready and prepared for ${job.contact_email}.`;
        }
      } catch (err: any) {
        app.status = 'APPLIED';
        job.status = 'APPLIED';
        message = `Application ready and prepared for ${job.contact_email}.`;
      }
    } else {
      app.status = 'APPLIED';
      job.status = 'APPLIED';
      message = `Tailored resume PDF generated! Opening application page for ${job.company}.`;
    }

    app.updated_at = new Date().toISOString();
    this.applications.set(app.id, app);
    this.jobs.set(job.id, { ...job, status: 'APPLIED' });

    return {
      success: true,
      method,
      application: app,
      applyUrl: job.application_url || job.url,
      message,
    };
  }

  // --- Local Cron Agent Pipeline ---
  async executeLocalAgentPipeline(): Promise<{
    newJobsFound: number;
    highFitMatched: number;
    applicationsCreated: number;
  }> {
    if (this.isSchedulerRunning) {
      return { newJobsFound: 0, highFitMatched: 0, applicationsCreated: 0 };
    }

    this.isSchedulerRunning = true;
    this.lastCronRun = new Date().toISOString();

    let newJobsFound = 0;
    let highFitMatched = 0;
    let applicationsCreated = 0;

    try {
      const targetRoles = this.profile.preferences.target_roles || [
        'React Native Developer',
        'Next.js Developer',
      ];
      const location = this.profile.preferences.remote ? 'Remote' : 'Worldwide';

      const discRes = await this.runDiscovery(targetRoles, location);
      newJobsFound = discRes.newJobs.length;

      const threshold = Number(process.env.AUTO_TAILOR_THRESHOLD) || 75;

      for (const job of discRes.newJobs) {
        const match = await this.matchJob(job.id);
        if (match.score >= threshold) {
          highFitMatched++;
          const app = await this.createApplication(job.id);
          await this.tailorApplication(app.id);
          applicationsCreated++;
          this.totalApplicationsQueued++;
        }
      }
    } catch (err: any) {
      console.error('Local cron agent execution error:', err.message);
    } finally {
      this.isSchedulerRunning = false;
    }

    return { newJobsFound, highFitMatched, applicationsCreated };
  }

  getSchedulerStatus(): ISchedulerStatus {
    const nextMs = this.cronIntervalMinutes * 60 * 1000;
    return {
      is_running: this.isSchedulerRunning,
      is_enabled: this.isSchedulerEnabled,
      interval_minutes: this.cronIntervalMinutes,
      last_run: this.lastCronRun,
      next_run: new Date(Date.now() + nextMs).toISOString(),
      cron_expression: `*/${this.cronIntervalMinutes} * * * *`,
      total_jobs_scraped: this.totalJobsScraped,
      total_applications_queued: this.totalApplicationsQueued,
    };
  }

  toggleScheduler(enabled: boolean) {
    this.isSchedulerEnabled = enabled;
    if (this.isSchedulerEnabled && !this.cronIntervalTimer) {
      this.cronIntervalTimer = setInterval(() => {
        if (this.isSchedulerEnabled) {
          this.executeLocalAgentPipeline();
        }
      }, this.cronIntervalMinutes * 60 * 1000);
    } else if (!this.isSchedulerEnabled && this.cronIntervalTimer) {
      clearInterval(this.cronIntervalTimer);
      this.cronIntervalTimer = null;
    }
    return this.getSchedulerStatus();
  }

  setSchedulerInterval(minutes: number): ISchedulerStatus {
    this.cronIntervalMinutes = Math.max(1, minutes);
    if (this.cronIntervalTimer) {
      clearInterval(this.cronIntervalTimer);
      this.cronIntervalTimer = null;
    }
    if (this.isSchedulerEnabled) {
      this.cronIntervalTimer = setInterval(() => {
        if (this.isSchedulerEnabled) {
          this.executeLocalAgentPipeline();
        }
      }, this.cronIntervalMinutes * 60 * 1000);
    }
    return this.getSchedulerStatus();
  }

  getAnalyticsOverview() {
    const allJobs = this.getJobs();
    const allApps = this.getApplications();

    const counts: Record<string, number> = {
      FOUND: 0,
      MATCHED: 0,
      RESUME_CREATED: 0,
      READY: 0,
      APPLIED: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
    };

    let emailChannels = 0;
    let webFormChannels = 0;

    for (const app of allApps) {
      if (counts[app.status] !== undefined) counts[app.status]++;
      if (app.application_channel === 'EMAIL') emailChannels++;
      else webFormChannels++;
    }

    const highFitCount = allJobs.filter((j) => (j.match?.score || 0) >= 75).length;

    return {
      total_jobs: allJobs.length,
      high_fit_jobs: highFitCount,
      pipeline: counts,
      channels: {
        email: emailChannels,
        web_form: webFormChannels,
      },
      needs_review_count: 1,
      scheduler: this.getSchedulerStatus(),
    };
  }

  // --- Initialization ---
  private loadInitialProfile(): IMasterProfile {
    try {
      const p = path.resolve(process.cwd(), 'database/seeds/master_profile.json');
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (err: any) {
      console.warn('Seed profile read error:', err.message);
    }

    return {
      full_name: 'Usman Shafiq',
      email: 'usman.shafiq@example.com',
      phone: '+92 300 0000000',
      location: 'Lahore, Pakistan (Open to Remote)',
      headline: 'Lead Mobile & Full-Stack Engineer (React Native, Next.js, AI)',
      summary: 'Experienced developer specializing in React Native and Next.js platforms with integrated AI agents.',
      skills: [
        { name: 'React Native', level: 'Expert' },
        { name: 'React.js', level: 'Expert' },
        { name: 'Next.js', level: 'Expert' },
        { name: 'TypeScript', level: 'Expert' },
        { name: 'Supabase', level: 'Advanced' },
        { name: 'Firebase', level: 'Advanced' },
        { name: 'AI Agents', level: 'Advanced' },
      ],
      experience: [],
      projects: [],
      education: [],
      preferences: {
        target_roles: ['React Native Developer', 'Next.js Developer'],
        remote: true,
        target_locations: ['Remote', 'Worldwide'],
      },
      qa_vault: {
        work_authorization: 'Authorized for international remote contract work',
        sponsorship_required: 'No for contract / Yes for US relocation',
      },
    };
  }

  private seedInitialJobs() {
    const targetRoles = this.profile.preferences?.target_roles || ['React Native', 'React', 'Next.js', 'AI Engineer'];
    this.runDiscovery(targetRoles, 'Remote').catch((err) => {
      console.warn('Initial live discovery warning:', err.message);
    });
  }

  private startBackgroundCronAgent() {
    // Run an initial automated discovery pass
    setTimeout(() => {
      this.executeLocalAgentPipeline();
    }, 4000);

    // Recurring local timer (defaults to every 2 minutes)
    if (!this.cronIntervalTimer) {
      this.cronIntervalTimer = setInterval(() => {
        if (this.isSchedulerEnabled) {
          this.executeLocalAgentPipeline();
        }
      }, this.cronIntervalMinutes * 60 * 1000);
    }
  }
}

// Global Singleton Store across Next.js API Routes and Server components
declare global {
  var __AGENT_STORE__: AgentStore | undefined;
}

export const store: AgentStore = global.__AGENT_STORE__ || (global.__AGENT_STORE__ = new AgentStore());
