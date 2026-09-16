import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  IMasterProfile, 
  IJob, 
  IJobMatch, 
  IApplication, 
  ISchedulerStatus, 
  IAutonomousStatus,
  AutonomousLoopState,
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
import { browserAutoApply } from './browser-agent';
import { generateAIExpandedSearchKeywords } from './ai/ai-search-expander';

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

  // --- Auto-Apply Queue Agent State ---
  private applyQueue: string[] = [];  // ordered job IDs to process
  private isAgentRunning: boolean = false;
  private currentlyProcessingJobId: string | null = null;
  private agentLog: { jobId: string; jobTitle: string; status: string; message: string; timestamp: string }[] = [];
  private agentTimer: NodeJS.Timeout | null = null;

  // --- Autonomous Loop Mode State ---
  private isAutonomousMode: boolean = true;
  private autonomousState: AutonomousLoopState = 'IDLE';
  private dailyApplicationLimit: number = 40;
  private applicationsToday: number = 0;
  private lastDayReset: string = new Date().toISOString().slice(0, 10);
  private autonomousCooldownMinutes: number = 5;
  private nextAutonomousCycleAt: string | null = null;
  private autonomousCooldownTimer: NodeJS.Timeout | null = null;
  private emailOnlyMode: boolean = true;

  // --- AI Keyword & Continuous Discovery State ---
  private triedAiKeywords: string[] = [];

  // --- Comprehensive Major Tech Fields & Markets ---
  public readonly MAJOR_FIELDS: string[] = [
    'react-native',
    'full-stack',
    'frontend',
    'backend',
    'nodejs',
    'python',
    'mobile',
    'ai',
    'software-engineer',
    'javascript',
    'typescript',
    'cloud',
    'devops',
  ];

  public readonly MAJOR_MARKETS: { name: string; geoCode: string }[] = [
    { name: 'Worldwide / Anywhere', geoCode: 'anywhere' },
    { name: 'USA / North America', geoCode: 'usa' },
    { name: 'Europe & UK (EMEA)', geoCode: 'emea' },
    { name: 'Latin America (LATAM)', geoCode: 'latam' },
    { name: 'Asia-Pacific (APAC)', geoCode: 'apac' },
    { name: 'Canada', geoCode: 'canada' },
    { name: 'United Kingdom', geoCode: 'uk' },
  ];

  // --- Adaptive Multi-Region & Role Discovery Matrix (legacy fallback) ---
  private searchPoolIndex: number = 0;
  private searchRegionIndex: number = 0;

  private readonly SEARCH_ROLE_POOLS: string[][] = [
    ['React Native', 'React', 'Next.js', 'TypeScript'],
    ['Full Stack Developer', 'Software Engineer', 'Frontend Developer'],
    ['Node.js', 'NestJS', 'FastAPI', 'Backend Engineer'],
    ['Mobile Developer', 'Mobile Engineer', 'Android', 'iOS'],
    ['AI Engineer', 'LLM Engineer', 'Applied AI', 'Python Developer'],
    ['Web Developer', 'JavaScript Engineer', 'API Developer']
  ];

  private readonly SEARCH_REGIONS: { name: string; geoCode: string }[] = [
    { name: 'Worldwide / Anywhere', geoCode: 'anywhere' },
    { name: 'USA / North America', geoCode: 'usa' },
    { name: 'Europe & UK (EMEA)', geoCode: 'emea' },
    { name: 'Latin America (LATAM)', geoCode: 'latam' },
    { name: 'Asia-Pacific (APAC)', geoCode: 'apac' },
    { name: 'Canada', geoCode: 'canada' },
    { name: 'United Kingdom', geoCode: 'uk' }
  ];


  constructor() {
    this.profile = this.loadInitialProfile();
    this.loadPersistedData();
    this.loadQueueFromDisk();
    if (this.emailOnlyMode) {
      this.purgeNonEmailJobs();
    }
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
    const appsByJobId = new Map(
      Array.from(this.applications.values()).map((a) => [a.job_id, a])
    );

    return list
      .map((j) => {
        const app = appsByJobId.get(j.id);
        if (app) {
          return {
            ...j,
            status: app.status === 'APPLIED' ? 'APPLIED' : j.status,
            application_id: app.id,
            tailored_resume_pdf_url: app.tailored_resume_pdf_url,
          };
        }
        return j;
      })
      .sort(
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

    // In Email-Only Mode, ignore any jobs that do not provide a direct contact email
    if (this.emailOnlyMode && !normalized.contact_email) {
      if (normalized.dedup_hash) {
        this.dedupSet.add(normalized.dedup_hash);
      }
      return { job: normalized, isNew: false };
    }

    if (this.dedupSet.has(normalized.dedup_hash || '')) {
      const existing = Array.from(this.jobs.values()).find(
        (j) => j.dedup_hash === normalized.dedup_hash
      );
      return { job: existing || normalized, isNew: false };
    }

    this.dedupSet.add(normalized.dedup_hash || '');
    this.jobs.set(normalized.id, normalized);
    this.totalJobsScraped++;
    this.saveJobsToDisk();
    return { job: normalized, isNew: true };
  }

  async runDiscovery(
    queries: string[] = ['React Native', 'React', 'Next.js', 'AI Engineer'],
    location: string = 'Worldwide',
    geoCode?: string
  ): Promise<{ newJobs: IJob[]; total: number; sourceCounts: Record<string, number> }> {
    const newJobs: IJob[] = [];
    const sourceCounts: Record<string, number> = {};

    const scrapePromises: Promise<any[]>[] = [];

    // 1. Remotive (Query each role)
    for (const q of queries) {
      scrapePromises.push(searchRemotiveJobs(q, 30));
    }

    // 2. Jobicy (Query each role with optional region geoCode)
    for (const q of queries) {
      scrapePromises.push(searchJobicyJobs(q, 25, geoCode));
    }

    // 3. RemoteOK (Query top roles)
    for (const q of queries.slice(0, 2)) {
      scrapePromises.push(searchRemoteOkJobs(q, 35));
    }

    // 4. Arbeitnow (Active engineering jobs)
    scrapePromises.push(searchArbeitnowJobs(queries[0] || 'react', 35));

    // 5. SerpApi (Google Jobs - if key configured)
    for (const q of queries.slice(0, 2)) {
      scrapePromises.push(searchGoogleJobs(q, location));
    }

    // 6. Adzuna (If key configured)
    for (const q of queries.slice(0, 2)) {
      scrapePromises.push(searchAdzunaJobs(q, geoCode || 'us'));
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

  async sweepAllMarketsAndFields(customKeywords?: string[]): Promise<{
    newJobs: IJob[];
    total: number;
    sourceCounts: Record<string, number>;
  }> {
    const newJobs: IJob[] = [];
    const sourceCounts: Record<string, number> = {};
    const scrapePromises: Promise<any[]>[] = [];

    const fieldsToSearch =
      customKeywords && customKeywords.length > 0 ? customKeywords : this.MAJOR_FIELDS;
    const marketsToSearch = this.MAJOR_MARKETS;

    console.log(
      `[Sweep Engine] 🌐 Sweeping ${fieldsToSearch.length} fields across ${marketsToSearch.length} markets for direct email jobs...`
    );

    // 1. Jobicy (Batch query tags paired with geos)
    for (let i = 0; i < fieldsToSearch.length; i++) {
      const field = fieldsToSearch[i];
      const market = marketsToSearch[i % marketsToSearch.length].geoCode;
      scrapePromises.push(searchJobicyJobs(field, 35, market));
    }
    // General high-yield Jobicy tech queries
    scrapePromises.push(searchJobicyJobs('', 40, 'anywhere'));
    scrapePromises.push(searchJobicyJobs('react', 35, 'usa'));
    scrapePromises.push(searchJobicyJobs('full-stack', 35, 'emea'));
    scrapePromises.push(searchJobicyJobs('mobile', 35, 'anywhere'));

    // 2. RemoteOK: query top tags
    const remoteOkTags =
      customKeywords && customKeywords.length > 0
        ? customKeywords.slice(0, 8)
        : ['react', 'javascript', 'node', 'python', 'mobile', 'engineer', 'frontend', 'backend', 'fullstack', 'ai'];
    for (const tag of remoteOkTags) {
      scrapePromises.push(searchRemoteOkJobs(tag, 40));
    }

    // 3. Remotive: active software development jobs
    scrapePromises.push(searchRemotiveJobs('', 50));
    if (customKeywords && customKeywords.length > 0) {
      for (const q of customKeywords.slice(0, 4)) {
        scrapePromises.push(searchRemotiveJobs(q, 30));
      }
    } else {
      scrapePromises.push(searchRemotiveJobs('React Native', 30));
      scrapePromises.push(searchRemotiveJobs('Node', 30));
      scrapePromises.push(searchRemotiveJobs('AI', 30));
    }

    // 4. Arbeitnow: active engineering jobs feed
    scrapePromises.push(searchArbeitnowJobs('engineering', 50));
    scrapePromises.push(searchArbeitnowJobs('react', 50));

    // 5. SerpApi & Adzuna (if configured)
    scrapePromises.push(searchGoogleJobs('remote full stack developer', 'Worldwide'));
    scrapePromises.push(searchAdzunaJobs('react developer', 'us'));

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

    console.log(
      `[Sweep Engine] ✓ Sweep completed. Found ${newJobs.length} brand-new email jobs (Total in DB: ${this.jobs.size}).`
    );
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
    this.saveApplicationsToDisk();
    return app;
  }

  async tailorApplication(applicationId: string): Promise<IApplication> {
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`Application ${applicationId} not found`);

    const job = app.job || this.jobs.get(app.job_id)!;

    console.log(`[Tailor] Starting resume + cover letter tailoring for "${job.title}" at ${job.company}...`);
    const { tailoredResume, coverLetter } = await tailorResumeAndCoverLetter(job, this.profile);

    const filename = `Resume_${this.profile.full_name.replace(/\s+/g, '_')}_${job.company.replace(
      /\s+/g,
      '_'
    )}_${Date.now()}.pdf`;

    console.log(`[Tailor] Generating ATS-optimized PDF: ${filename}`);
    const { filePath, relativeUrl } = await generateResumePdf(tailoredResume, filename);

    // Generate a job-specific email draft using the AI cover letter as the body
    const emailSubject = `Application for ${job.title} — ${this.profile.full_name}`;
    const emailBody = `${coverLetter}\n\n---\nPlease find my tailored resume attached for your review.\n\nBest regards,\n${this.profile.full_name}\n${this.profile.email} | ${this.profile.phone}`;

    app.tailored_resume_json = tailoredResume;
    app.tailored_resume_pdf_url = relativeUrl;
    (app as any).local_pdf_path = filePath;
    app.cover_letter = coverLetter;
    app.email_subject = emailSubject;
    app.email_body = emailBody;
    app.status = 'READY';
    app.updated_at = new Date().toISOString();

    console.log(`[Tailor] ✓ Application ready for "${job.title}" — resume, cover letter, and email draft generated.`);

    this.applications.set(applicationId, app);
    this.saveApplicationsToDisk();
    return app;
  }

  async sendEmailForApplication(applicationId: string): Promise<any> {
    const app = this.applications.get(applicationId);
    if (!app) throw new Error(`Application ${applicationId} not found`);

    const job = app.job || this.jobs.get(app.job_id)!;
    const pdfPath = (app as any).local_pdf_path;

    console.log(`[Email] Preparing personalized email for "${job.title}" at ${job.company}...`);
    console.log(`[Email] Using ${app.email_subject ? 'tailored' : 'default'} email draft. PDF: ${pdfPath ? 'attached' : 'none'}`);

    const res = await sendApplicationEmail(
      job,
      this.profile,
      pdfPath,
      app.email_subject,
      app.email_body
    );

    // Save the final email content back to the application for UI display
    app.email_subject = res.subject;
    app.email_body = res.body;

    if (res.success) {
      app.status = 'APPLIED';
      app.email_sent_at = res.timestamp;
      app.email_message_id = res.messageId;
      app.updated_at = new Date().toISOString();
      this.applications.set(applicationId, app);

      const j = this.jobs.get(app.job_id);
      if (j) {
        j.status = 'APPLIED';
        this.jobs.set(app.job_id, j);
      }
      this.saveApplicationsToDisk();
      this.saveJobsToDisk();
      console.log(`[Email] ✓ Application email sent to ${res.recipient} for "${job.title}" (${res.mode})`);
    } else {
      console.error(`[Email] ✗ Failed to send email for "${job.title}": ${res.error}`);
    }

    return res;
  }

  updateApplicationStatus(id: string, status: ApplicationStatus): IApplication {
    const app = this.applications.get(id);
    if (!app) throw new Error(`Application ${id} not found`);

    app.status = status;
    app.updated_at = new Date().toISOString();
    this.applications.set(id, app);

    if (status === 'APPLIED') {
      const j = this.jobs.get(app.job_id);
      if (j) {
        j.status = 'APPLIED';
        this.jobs.set(app.job_id, j);
      }
    }
    this.saveApplicationsToDisk();
    this.saveJobsToDisk();
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
    let method: 'EMAIL' | 'WEB_PORTAL' = hasEmail ? 'EMAIL' : 'WEB_PORTAL';
    let message = '';

    if (hasEmail) {
      try {
        const emailRes = await this.sendEmailForApplication(app.id);
        if (emailRes.success) {
          app.status = 'APPLIED';
          job.status = 'APPLIED';
          if (emailRes.mode === 'LIVE_SMTP') {
            message = `Application & tailored PDF resume emailed directly to ${job.contact_email}! A copy was BCC'd to ${this.profile.email}.`;
          } else {
            message = `[SIMULATION MODE] Application prepared for ${job.contact_email} (Sandbox Mode — configure SMTP in .env.local for live dispatch).`;
          }
        } else {
          app.status = 'READY';
          message = `Email dispatch to ${job.contact_email} reported an issue: ${emailRes.error || 'SMTP check needed'}`;
        }
      } catch (err: any) {
        console.error('Error in sendEmailForApplication:', err);
        app.status = 'READY';
        message = `Email dispatch error: ${err.message}`;
      }
    } else {
      // If Email-Only mode is active, skip web portal automation cleanly
      if (this.emailOnlyMode) {
        return {
          success: false,
          method: 'WEB_PORTAL',
          application: app,
          applyUrl: job.application_url || job.url,
          message: `Skipped web portal application (Email-only mode is active).`,
        };
      }
      // Web portal jobs: try Playwright browser automation
      console.log(`[Agent Queue] Web portal job — attempting browser automation for ${job.company}...`);
      const pdfPath = (app as any).local_pdf_path;
      try {
        const browserResult = await browserAutoApply(job, this.profile, pdfPath, app.cover_letter);

        if (browserResult.success) {
          app.status = 'APPLIED';
          job.status = 'APPLIED';
          method = 'WEB_PORTAL';
          message = browserResult.message;
          // Store screenshot URL for proof
          if (browserResult.screenshotUrl) {
            app.browser_screenshot_url = browserResult.screenshotUrl;
          }
          console.log(`[Agent Queue] ✓ Browser auto-applied: "${job.title}" — ${browserResult.formFieldsFilled?.length || 0} fields filled`);
        } else {
          // Browser couldn't fully submit — mark as READY for manual action
          app.status = 'READY';
          job.status = 'MATCHED';
          message = browserResult.message;
          if (browserResult.screenshotUrl) {
            app.browser_screenshot_url = browserResult.screenshotUrl;
          }
          console.log(`[Agent Queue] ⚠ Browser needs manual action: ${browserResult.message}`);
        }
      } catch (browserErr: any) {
        console.error(`[Agent Queue] Browser automation error: ${browserErr.message}`);
        app.status = 'READY';
        job.status = 'MATCHED';
        message = `Browser automation failed: ${browserErr.message}. Apply manually at: ${job.application_url || job.url}`;
      }
    }

    app.updated_at = new Date().toISOString();
    this.applications.set(app.id, app);
    this.jobs.set(job.id, {
      ...job,
      status: app.status === 'APPLIED' ? 'APPLIED' : job.status,
    });
    this.saveApplicationsToDisk();
    this.saveJobsToDisk();

    return {
      success: true,
      method,
      application: app,
      applyUrl: job.application_url || job.url,
      message,
    };
  }

  // --- Auto-Apply Queue Agent ---

  addToQueue(jobId: string): { success: boolean; queueLength: number; message: string } {
    const job = this.jobs.get(jobId);
    if (!job) return { success: false, queueLength: this.applyQueue.length, message: 'Job not found' };
    if (job.status === 'APPLIED') return { success: false, queueLength: this.applyQueue.length, message: 'Job already applied' };
    if (this.applyQueue.includes(jobId)) return { success: false, queueLength: this.applyQueue.length, message: 'Job already in queue' };

    this.applyQueue.push(jobId);
    job.status = 'MATCHED';
    this.jobs.set(jobId, job);
    this.saveQueueToDisk();
    this.saveJobsToDisk();
    return { success: true, queueLength: this.applyQueue.length, message: `Added "${job.title}" to queue (#${this.applyQueue.length})` };
  }

  addAllToQueue(onlyEmail?: boolean): { added: number; skipped: number; queueLength: number } {
    let added = 0;
    let skipped = 0;
    const filterEmail = onlyEmail !== undefined ? onlyEmail : this.emailOnlyMode;
    const allJobs = Array.from(this.jobs.values());
    for (const job of allJobs) {
      if (job.status === 'APPLIED' || this.applyQueue.includes(job.id)) {
        skipped++;
        continue;
      }
      if (filterEmail && !job.contact_email) {
        skipped++;
        continue;
      }
      this.applyQueue.push(job.id);
      job.status = 'MATCHED';
      this.jobs.set(job.id, job);
      added++;
    }
    this.saveQueueToDisk();
    this.saveJobsToDisk();
    return { added, skipped, queueLength: this.applyQueue.length };
  }

  purgePortalJobsFromQueue(): { removed: number; remaining: number } {
    const portalJobIds: string[] = [];
    const newQueue: string[] = [];

    for (const jobId of this.applyQueue) {
      const job = this.jobs.get(jobId);
      if (job && !job.contact_email) {
        portalJobIds.push(jobId);
        if (job.status === 'MATCHED') {
          job.status = 'DISCOVERED';
          this.jobs.set(jobId, job);
        }
      } else {
        newQueue.push(jobId);
      }
    }

    this.applyQueue = newQueue;
    this.saveQueueToDisk();
    this.saveJobsToDisk();
    console.log(`[Agent Queue] Purged ${portalJobIds.length} web portal jobs from queue. ${this.applyQueue.length} email jobs remaining.`);
    return { removed: portalJobIds.length, remaining: this.applyQueue.length };
  }

  purgeNonEmailJobs(): { purged: number; remaining: number } {
    let purged = 0;
    for (const [id, job] of Array.from(this.jobs.entries())) {
      // Keep only jobs that have a contact email or have already been applied to
      if (!job.contact_email && job.status !== 'APPLIED') {
        this.jobs.delete(id);
        purged++;
      }
    }

    const origQueueLen = this.applyQueue.length;
    this.applyQueue = this.applyQueue.filter((id) => {
      const j = this.jobs.get(id);
      return j && Boolean(j.contact_email);
    });

    if (purged > 0 || this.applyQueue.length !== origQueueLen) {
      this.saveJobsToDisk();
      this.saveQueueToDisk();
      console.log(`[Store] Purged ${purged} non-email jobs from database. Remaining jobs in DB: ${this.jobs.size}, Queue: ${this.applyQueue.length}`);
    }

    return { purged, remaining: this.jobs.size };
  }

  removeFromQueue(jobId: string): { success: boolean; queueLength: number } {
    const idx = this.applyQueue.indexOf(jobId);
    if (idx === -1) return { success: false, queueLength: this.applyQueue.length };
    this.applyQueue.splice(idx, 1);

    // Revert status if it was set to MATCHED just for queue
    const job = this.jobs.get(jobId);
    if (job && job.status === 'MATCHED') {
      job.status = 'DISCOVERED';
      this.jobs.set(jobId, job);
      this.saveJobsToDisk();
    }
    this.saveQueueToDisk();
    return { success: true, queueLength: this.applyQueue.length };
  }

  moveAppliedToQueue(): { success: boolean; movedCount: number; queueLength: number } {
    let movedCount = 0;
    this.jobs.forEach((job, jobId) => {
      if (job.status === 'APPLIED') {
        job.status = 'MATCHED';
        this.jobs.set(jobId, job);
        if (!this.applyQueue.includes(jobId)) {
          this.applyQueue.unshift(jobId);
          movedCount++;
        }
      }
    });

    this.applications.forEach((app, appId) => {
      if (app.status === 'APPLIED') {
        app.status = 'READY';
        this.applications.set(appId, app);
      }
    });

    this.saveJobsToDisk();
    this.saveApplicationsToDisk();
    this.saveQueueToDisk();
    console.log(`[Store] Moved ${movedCount} applied jobs back to queue. New queue length: ${this.applyQueue.length}`);
    return { success: true, movedCount, queueLength: this.applyQueue.length };
  }

  reloadFromDisk(): void {
    this.loadPersistedData();
    this.loadQueueFromDisk();
    this.loadAutonomousConfigFromDisk();
  }

  getQueueStatus(): {
    isRunning: boolean;
    queue: string[];
    currentJobId: string | null;
    currentJobTitle: string | null;
    queueLength: number;
    log: { jobId: string; jobTitle: string; status: string; message: string; timestamp: string }[];
    autonomous: IAutonomousStatus;
  } {
    const currentJob = this.currentlyProcessingJobId ? this.jobs.get(this.currentlyProcessingJobId) : null;
    return {
      isRunning: this.isAgentRunning,
      queue: [...this.applyQueue],
      currentJobId: this.currentlyProcessingJobId,
      currentJobTitle: currentJob?.title || null,
      queueLength: this.applyQueue.length,
      log: this.agentLog.slice(-20),  // last 20 entries
      autonomous: this.getAutonomousStatus(),
    };
  }

  // --- Autonomous Loop Helpers & Configuration ---
  private checkDailyLimitReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastDayReset !== today) {
      this.lastDayReset = today;
      this.applicationsToday = 0;
      this.saveAutonomousConfigToDisk();
      console.log(`[Autonomous Loop] Daily application count reset for ${today}.`);
    }
  }

  getAutonomousStatus(): IAutonomousStatus {
    this.checkDailyLimitReset();
    const currentPool = this.SEARCH_ROLE_POOLS[this.searchPoolIndex % this.SEARCH_ROLE_POOLS.length];
    const currentRegion = this.SEARCH_REGIONS[this.searchRegionIndex % this.SEARCH_REGIONS.length];

    return {
      is_autonomous: this.isAutonomousMode,
      state: this.autonomousState,
      applications_today: this.applicationsToday,
      daily_limit: this.dailyApplicationLimit,
      cooldown_minutes: this.autonomousCooldownMinutes,
      next_cycle_at: this.nextAutonomousCycleAt,
      email_only: this.emailOnlyMode,
      current_region: currentRegion.name,
      current_roles: currentPool,
    };
  }

  setEmailOnlyMode(enabled: boolean): boolean {
    this.emailOnlyMode = enabled;
    this.saveAutonomousConfigToDisk();
    console.log(`[Autonomous Loop] Email-only applications mode set to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.emailOnlyMode;
  }

  toggleAutonomousMode(enabled: boolean): IAutonomousStatus {
    this.isAutonomousMode = enabled;
    console.log(`[Autonomous Loop] Mode set to: ${enabled ? 'ENABLED' : 'PAUSED'}`);
    if (!enabled) {
      if (this.autonomousCooldownTimer) {
        clearTimeout(this.autonomousCooldownTimer);
        this.autonomousCooldownTimer = null;
      }
      this.nextAutonomousCycleAt = null;
      if (this.autonomousState === 'COOLDOWN' || this.autonomousState === 'DISCOVERING') {
        this.autonomousState = 'IDLE';
      }
    } else {
      // If turned ON, start applying if we have queue items or schedule immediate discovery
      if (!this.isAgentRunning && this.applyQueue.length > 0) {
        console.log(`[Autonomous Loop] Auto-starting application worker with ${this.applyQueue.length} jobs in queue...`);
        this.startAgent();
      } else if (!this.isAgentRunning && this.applyQueue.length === 0 && !this.isSchedulerRunning) {
        console.log('[Autonomous Loop] Scheduling immediate discovery cycle...');
        this.scheduleAutonomousCycle(0.05); // ~3 seconds
      }
    }
    this.saveAutonomousConfigToDisk();
    return this.getAutonomousStatus();
  }

  setAutonomousConfig(config: { dailyLimit?: number; cooldownMinutes?: number; emailOnly?: boolean }): IAutonomousStatus {
    if (typeof config.dailyLimit === 'number' && config.dailyLimit > 0) {
      this.dailyApplicationLimit = config.dailyLimit;
    }
    if (typeof config.cooldownMinutes === 'number' && config.cooldownMinutes > 0) {
      this.autonomousCooldownMinutes = config.cooldownMinutes;
    }
    if (typeof config.emailOnly === 'boolean') {
      this.emailOnlyMode = config.emailOnly;
    }
    this.saveAutonomousConfigToDisk();
    return this.getAutonomousStatus();
  }

  private scheduleAutonomousCycle(delayMinutes?: number): void {
    if (!this.isAutonomousMode) return;
    if (this.autonomousCooldownTimer) {
      clearTimeout(this.autonomousCooldownTimer);
      this.autonomousCooldownTimer = null;
    }
    const waitMinutes = delayMinutes ?? this.autonomousCooldownMinutes;
    const waitMs = Math.max(1000, Math.round(waitMinutes * 60 * 1000));
    this.autonomousState = 'COOLDOWN';
    this.nextAutonomousCycleAt = new Date(Date.now() + waitMs).toISOString();
    console.log(`[Autonomous Loop] Cooldown active. Next discovery cycle scheduled at ${this.nextAutonomousCycleAt} (${waitMinutes}m)`);

    this.autonomousCooldownTimer = setTimeout(async () => {
      this.autonomousCooldownTimer = null;
      this.nextAutonomousCycleAt = null;
      if (!this.isAutonomousMode) return;
      console.log('[Autonomous Loop] Cooldown elapsed. Starting autonomous job discovery & tailoring...');
      try {
        await this.executeLocalAgentPipeline();
      } catch (err: any) {
        console.error('[Autonomous Loop] Cycle execution error:', err.message);
        this.scheduleAutonomousCycle();
      }
    }, waitMs);
  }

  startAgent(): { success: boolean; message: string } {
    if (this.isAgentRunning) {
      return { success: false, message: 'Agent is already running' };
    }
    if (this.applyQueue.length === 0) {
      return { success: false, message: 'Queue is empty. Add jobs to the queue first.' };
    }
    this.isAgentRunning = true;
    if (this.isAutonomousMode) {
      this.autonomousState = 'APPLYING';
    }
    console.log(`[Agent Queue] Started. ${this.applyQueue.length} jobs in queue.`);
    // Kick off the first processing
    this.processNextInQueue();
    return { success: true, message: `Agent started. Processing ${this.applyQueue.length} jobs sequentially.` };
  }

  stopAgent(): { success: boolean; message: string } {
    const wasRunning = this.isAgentRunning;
    this.isAgentRunning = false;
    this.currentlyProcessingJobId = null;
    if (this.agentTimer) {
      clearTimeout(this.agentTimer);
      this.agentTimer = null;
    }
    if (this.autonomousCooldownTimer) {
      clearTimeout(this.autonomousCooldownTimer);
      this.autonomousCooldownTimer = null;
    }
    this.nextAutonomousCycleAt = null;
    this.autonomousState = 'IDLE';
    this.saveQueueToDisk();
    console.log('[Agent Queue] Stopped by user.');
    return { success: true, message: wasRunning ? 'Agent stopped. Current job will finish but no more will be processed.' : 'Agent is already stopped.' };
  }

  private async processNextInQueue(): Promise<void> {
    if (!this.isAgentRunning) {
      this.currentlyProcessingJobId = null;
      return;
    }

    this.checkDailyLimitReset();

    if (this.applyQueue.length === 0) {
      this.isAgentRunning = false;
      this.currentlyProcessingJobId = null;
      console.log('[Agent Queue] All jobs in queue processed.');

      if (this.isAutonomousMode) {
        console.log(`[Autonomous Loop] ⚡ Queue is empty! Triggering instant all-market & field sweep for fresh email jobs...`);
        this.sweepAndReplenishQueue();
      } else {
        this.autonomousState = 'IDLE';
      }
      return;
    }

    if (this.applicationsToday >= this.dailyApplicationLimit) {
      console.log(`[Autonomous Loop] Daily application limit reached (${this.dailyApplicationLimit}). Pausing applications until tomorrow.`);
      this.isAgentRunning = false;
      this.currentlyProcessingJobId = null;
      if (this.isAutonomousMode) {
        this.scheduleAutonomousCycle(60); // Check again in 60 minutes
      }
      return;
    }

    const jobId = this.applyQueue.shift()!;
    this.currentlyProcessingJobId = jobId;
    if (this.isAutonomousMode) {
      this.autonomousState = 'APPLYING';
    }
    this.saveQueueToDisk();

    const job = this.jobs.get(jobId);
    const jobTitle = job?.title || 'Unknown';

    // Fast-skip portal jobs in Email-only mode without wasting browser automation time
    if (this.emailOnlyMode && (!job || !job.contact_email)) {
      console.log(`[Agent Queue] ⏭ Skipping web portal job "${jobTitle}" (Email-only mode active).`);
      this.agentLog.push({
        jobId,
        jobTitle,
        status: 'skipped',
        message: 'Skipped web portal application (Email-only mode active).',
        timestamp: new Date().toISOString(),
      });
      this.currentlyProcessingJobId = null;
      this.saveQueueToDisk();
      this.processNextInQueue();
      return;
    }

    console.log(`[Agent Queue] Processing: "${jobTitle}" (${jobId})`);

    try {
      const result = await this.autoApplyToJob(jobId);
      const isActuallyApplied = result.application.status === 'APPLIED';
      if (isActuallyApplied) {
        this.applicationsToday++;
        this.saveAutonomousConfigToDisk();
      }
      this.agentLog.push({
        jobId,
        jobTitle,
        status: isActuallyApplied ? 'success' : 'manual_needed',
        message: result.message,
        timestamp: new Date().toISOString(),
      });
      if (isActuallyApplied) {
        console.log(`[Agent Queue] ✓ Applied (${this.applicationsToday}/${this.dailyApplicationLimit} today): "${jobTitle}" via ${result.method}`);
      } else {
        console.log(`[Agent Queue] 📋 Prepared (Action Needed): "${jobTitle}" — ${result.message}`);
      }
    } catch (err: any) {
      this.agentLog.push({
        jobId,
        jobTitle,
        status: 'error',
        message: err.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      console.error(`[Agent Queue] ✗ Failed: "${jobTitle}" — ${err.message}`);
    }

    this.currentlyProcessingJobId = null;

    // Longer delay 12-20 seconds between jobs to allow proper processing & avoid rate limits
    if (this.isAgentRunning && this.applyQueue.length > 0) {
      // Proactive background prefetch: if queue is running low (<= 2 jobs left), trigger background replenish
      if (this.applyQueue.length <= 2 && !this.isSchedulerRunning && this.isAutonomousMode) {
        console.log(`[Autonomous Loop] Queue running low (${this.applyQueue.length} jobs remaining). Initiating background prefetch...`);
        this.sweepAndReplenishQueue().catch((err) =>
          console.warn('[Autonomous Loop] Background prefetch warning:', err.message)
        );
      }

      const delayMs = Math.floor(Math.random() * 8000) + 12000; // 12-20s
      console.log(`[Agent Queue] Waiting ${(delayMs / 1000).toFixed(1)}s before next job... (${this.applyQueue.length} remaining)`);
      this.agentTimer = setTimeout(() => {
        this.processNextInQueue();
      }, delayMs);
    } else {
      this.isAgentRunning = false;
      console.log('[Agent Queue] Queue complete.');
      if (this.isAutonomousMode) {
        console.log(`[Autonomous Loop] ⚡ Queue complete! Triggering instant all-market & field sweep for fresh email jobs...`);
        this.sweepAndReplenishQueue();
      } else {
        this.autonomousState = 'IDLE';
      }
    }
  }

  // --- Auto-Replenishing Discovery & Application Pipeline ---
  async sweepAndReplenishQueue(): Promise<{
    newJobsFound: number;
    highFitMatched: number;
    applicationsCreated: number;
  }> {
    if (this.isSchedulerRunning) {
      console.log('[Autonomous Loop] Sweep already running in background.');
      return { newJobsFound: 0, highFitMatched: 0, applicationsCreated: 0 };
    }

    this.isSchedulerRunning = true;
    this.lastCronRun = new Date().toISOString();
    if (this.isAutonomousMode && !this.isAgentRunning) {
      this.autonomousState = 'DISCOVERING';
    }

    let newJobsFound = 0;
    let highFitMatched = 0;
    let applicationsCreated = 0;

    try {
      console.log('[Autonomous Loop] ⚡ Initiating Comprehensive Multi-Field & Multi-Market Email Discovery Sweep...');
      const sweepRes = await this.sweepAllMarketsAndFields();
      let candidates = sweepRes.newJobs;
      newJobsFound = candidates.length;

      // If standard sweep returned NO new jobs, trigger Gemini AI Dynamic Keyword Expansion!
      if (candidates.length === 0) {
        console.log('[Autonomous Loop] 🧠 Standard fields returned 0 new jobs. Triggering Gemini AI Dynamic Keyword & Market Expansion...');
        try {
          const aiKeywords = await generateAIExpandedSearchKeywords(this.profile, this.triedAiKeywords);
          this.triedAiKeywords.push(...aiKeywords);
          if (this.triedAiKeywords.length > 80) {
            this.triedAiKeywords = this.triedAiKeywords.slice(-50);
          }

          console.log(`[Autonomous Loop] 🚀 Launching targeted sweep with AI-expanded keywords: [${aiKeywords.join(', ')}]`);
          const aiSweepRes = await this.sweepAllMarketsAndFields(aiKeywords);
          candidates = aiSweepRes.newJobs;
          newJobsFound += candidates.length;
        } catch (aiErr: any) {
          console.warn('[Autonomous Loop] AI Keyword Expansion notice:', aiErr.message);
        }
      }

      console.log(`[Autonomous Loop] Discovery completed: ${newJobsFound} brand-new email positions found.`);

      const threshold = Number(process.env.AUTO_TAILOR_THRESHOLD) || 75;

      for (const job of candidates) {
        // Double check email presence
        if (this.emailOnlyMode && !job.contact_email) continue;

        const match = await this.matchJob(job.id);
        if (match.score >= threshold) {
          highFitMatched++;
          const app = await this.createApplication(job.id);
          await this.tailorApplication(app.id);
          applicationsCreated++;
          this.totalApplicationsQueued++;

          if (!this.applyQueue.includes(job.id) && job.status !== 'APPLIED') {
            this.applyQueue.push(job.id);
            job.status = 'MATCHED';
            this.jobs.set(job.id, job);
          }
        }
      }

      // Also ensure any unapplied email jobs in database are enqueued
      if (this.applyQueue.length === 0) {
        for (const job of Array.from(this.jobs.values())) {
          if (this.emailOnlyMode && !job.contact_email) continue;
          if (job.status === 'MATCHED' && !this.applyQueue.includes(job.id)) {
            const existingApp = Array.from(this.applications.values()).find((a) => a.job_id === job.id);
            if (!existingApp || existingApp.status !== 'APPLIED') {
              this.applyQueue.push(job.id);
            }
          }
        }
      }

      this.saveJobsToDisk();
      this.saveQueueToDisk();

      // If jobs were queued, immediately auto-launch the agent worker if not already running!
      if (this.applyQueue.length > 0) {
        console.log(`[Autonomous Loop] ✓ Auto-replenished queue with ${this.applyQueue.length} fresh email jobs! Resuming processing.`);
        if (!this.isAgentRunning) {
          this.startAgent();
        }
      } else {
        console.log(`[Autonomous Loop] All active email jobs applied. Entering ${this.autonomousCooldownMinutes}m cooldown before next sweep.`);
        if (this.isAutonomousMode) {
          this.scheduleAutonomousCycle();
        }
      }
    } catch (err: any) {
      console.error('[Autonomous Loop] Sweep and replenish error:', err.message);
      if (this.isAutonomousMode && !this.isAgentRunning && this.applyQueue.length === 0) {
        this.scheduleAutonomousCycle();
      }
    } finally {
      this.isSchedulerRunning = false;
      if (this.isAutonomousMode) {
        if (this.isAgentRunning) {
          this.autonomousState = 'APPLYING';
        } else if (this.autonomousCooldownTimer) {
          this.autonomousState = 'COOLDOWN';
        } else {
          this.autonomousState = 'IDLE';
        }
      }
    }

    return { newJobsFound, highFitMatched, applicationsCreated };
  }

  // --- Local Cron Agent Pipeline (Delegates to sweepAndReplenishQueue) ---
  async executeLocalAgentPipeline(): Promise<{
    newJobsFound: number;
    highFitMatched: number;
    applicationsCreated: number;
  }> {
    return this.sweepAndReplenishQueue();
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

  // --- Persistence & Initialization ---
  private loadPersistedData() {
    try {
      const jobsPath = path.resolve(process.cwd(), 'database/jobs.json');
      if (fs.existsSync(jobsPath)) {
        const savedJobs: IJob[] = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
        for (const j of savedJobs) {
          this.jobs.set(j.id, j);
          if (j.dedup_hash) this.dedupSet.add(j.dedup_hash);
        }
        console.log(`[Store Persistence] Loaded ${this.jobs.size} jobs from disk.`);
      }
    } catch (e: any) {
      console.warn('[Store Persistence] Error loading jobs.json:', e.message);
    }

    try {
      const appsPath = path.resolve(process.cwd(), 'database/applications.json');
      if (fs.existsSync(appsPath)) {
        const savedApps: IApplication[] = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
        for (const app of savedApps) {
          this.applications.set(app.id, app);
          if (app.job) {
            this.jobs.set(app.job.id, {
              ...app.job,
              status: app.status === 'APPLIED' ? 'APPLIED' : (app.job.status || 'MATCHED'),
            });
            if (app.job.dedup_hash) this.dedupSet.add(app.job.dedup_hash);
          } else if (this.jobs.has(app.job_id)) {
            const j = this.jobs.get(app.job_id)!;
            if (app.status === 'APPLIED') {
              j.status = 'APPLIED';
              this.jobs.set(app.job_id, j);
            }
          }
        }
        console.log(`[Store Persistence] Loaded ${this.applications.size} applications from disk.`);
      }
    } catch (e: any) {
      console.warn('[Store Persistence] Error loading applications.json:', e.message);
    }

    this.loadAutonomousConfigFromDisk();
  }

  private saveApplicationsToDisk() {
    try {
      const dir = path.resolve(process.cwd(), 'database');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, 'applications.json');
      const apps = Array.from(this.applications.values());
      fs.writeFileSync(p, JSON.stringify(apps, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[Store Persistence] Failed to persist applications to disk:', err.message);
    }
  }

  private saveJobsToDisk() {
    try {
      const dir = path.resolve(process.cwd(), 'database');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, 'jobs.json');
      const jobsList = Array.from(this.jobs.values());
      fs.writeFileSync(p, JSON.stringify(jobsList, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[Store Persistence] Failed to persist jobs to disk:', err.message);
    }
  }

  private saveQueueToDisk() {
    try {
      const dir = path.resolve(process.cwd(), 'database');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, 'queue.json');
      fs.writeFileSync(p, JSON.stringify(this.applyQueue, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[Store Persistence] Failed to persist queue to disk:', err.message);
    }
  }

  private loadQueueFromDisk() {
    try {
      const queuePath = path.resolve(process.cwd(), 'database/queue.json');
      if (fs.existsSync(queuePath)) {
        const saved: string[] = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        this.applyQueue = saved.filter((id) => this.jobs.has(id));  // only keep valid job IDs
        console.log(`[Store Persistence] Loaded ${this.applyQueue.length} queued jobs from disk.`);
      }
    } catch (e: any) {
      console.warn('[Store Persistence] Error loading queue.json:', e.message);
    }
  }

  private saveAutonomousConfigToDisk() {
    try {
      const dir = path.resolve(process.cwd(), 'database');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, 'autonomous_config.json');
      const data = {
        isAutonomousMode: this.isAutonomousMode,
        dailyApplicationLimit: this.dailyApplicationLimit,
        autonomousCooldownMinutes: this.autonomousCooldownMinutes,
        applicationsToday: this.applicationsToday,
        lastDayReset: this.lastDayReset,
        emailOnlyMode: this.emailOnlyMode,
      };
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[Store Persistence] Failed to persist autonomous config to disk:', err.message);
    }
  }

  private loadAutonomousConfigFromDisk() {
    try {
      const p = path.resolve(process.cwd(), 'database/autonomous_config.json');
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (typeof data.isAutonomousMode === 'boolean') this.isAutonomousMode = data.isAutonomousMode;
        if (typeof data.dailyApplicationLimit === 'number') this.dailyApplicationLimit = data.dailyApplicationLimit;
        if (typeof data.autonomousCooldownMinutes === 'number') this.autonomousCooldownMinutes = data.autonomousCooldownMinutes;
        if (typeof data.applicationsToday === 'number') this.applicationsToday = data.applicationsToday;
        if (typeof data.lastDayReset === 'string') this.lastDayReset = data.lastDayReset;
        if (typeof data.emailOnlyMode === 'boolean') this.emailOnlyMode = data.emailOnlyMode;
        console.log(`[Store Persistence] Loaded autonomous configuration from disk.`);
      }
    } catch (e: any) {
      console.warn('[Store Persistence] Error loading autonomous_config.json:', e.message);
    }
    this.checkDailyLimitReset();
  }

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
      full_name: 'Talha Sadiq',
      email: 'talhasadiq320@gmail.com',
      phone: '+92 345 6601101',
      location: 'Pakistan (Open to Remote Worldwide)',
      headline: 'AI-Powered Full Stack Developer | Mobile, Web & LLM Engineering',
      summary: 'Full Stack Developer with 8 years of production experience in React Native, Node.js, and React, now expanding into AI engineering and automation.',
      skills: [
        { name: 'React Native', level: 'Expert' },
        { name: 'Node.js', level: 'Expert' },
        { name: 'React', level: 'Expert' },
        { name: 'TypeScript', level: 'Expert' },
        { name: 'Claude Code & Cursor AI', level: 'Advanced' },
        { name: 'OpenAI & Gemini API', level: 'Advanced' },
        { name: 'REST APIs & Microservices', level: 'Expert' },
      ],
      experience: [],
      projects: [],
      education: [],
      preferences: {
        target_roles: ['Full Stack Developer', 'AI Engineer', 'React Native Developer'],
        remote: true,
        target_locations: ['Remote', 'Worldwide'],
      },
      qa_vault: {
        work_authorization: 'Authorized for international remote contract work',
        sponsorship_required: 'No for contract / Open to US relocation sponsorship',
      },
    };
  }

  private seedInitialJobs() {
    this.sweepAndReplenishQueue().catch((err) => {
      console.warn('Initial multi-market discovery warning:', err.message);
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
