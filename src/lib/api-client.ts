import axios from 'axios';
import { 
  IJob, 
  IMasterProfile, 
  IApplication, 
  IJobMatch, 
  ISchedulerStatus,
  IBrowserTask
} from '@/types';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const AgentApi = {
  // Stats & Analytics
  async getOverviewStats() {
    const res = await apiClient.get('/analytics/overview');
    return res.data;
  },

  // Jobs
  async getJobs(params?: { status?: string; search?: string; source?: string }) {
    const res = await apiClient.get('/jobs', { params });
    return res.data as IJob[];
  },

  async triggerJobCollector(payload?: { queries?: string[]; location?: string; query?: string }) {
    const res = await apiClient.post('/jobs/collect', payload);
    return res.data;
  },

  async scrapeLive(query?: string, location?: string, autoQueue: boolean = true) {
    const res = await apiClient.post('/jobs/collect', { query, location, autoQueue });
    return res.data;
  },

  async matchJob(jobId: string) {
    const res = await apiClient.post(`/jobs/${jobId}/match`);
    return res.data as IJobMatch;
  },

  // Applications & Pipeline
  async getApplications(params?: { status?: string }) {
    const res = await apiClient.get('/applications', { params });
    return res.data as IApplication[];
  },

  async createApplication(jobId: string) {
    const res = await apiClient.post('/applications/create', { jobId });
    return res.data as IApplication;
  },

  async tailorResume(applicationId: string) {
    const res = await apiClient.post(`/applications/${applicationId}/tailor`);
    return res.data as IApplication;
  },

  async sendEmailApplication(applicationId: string) {
    const res = await apiClient.post(`/applications/${applicationId}/send-email`);
    return res.data;
  },

  async updateApplicationStatus(id: string, status: string) {
    const res = await apiClient.patch(`/applications/${id}/status`, { status });
    return res.data;
  },

  // On-Demand Custom Apply
  async customApply(payload: {
    title?: string;
    company?: string;
    description: string;
    recipientEmail: string;
    location?: string;
    autoSend?: boolean;
    customSubject?: string;
    customBody?: string;
  }) {
    const res = await apiClient.post('/custom-apply', payload);
    return res.data as {
      success: boolean;
      application: IApplication;
      emailResult?: any;
      coverLetter?: string;
      emailDraft?: { subject: string; body: string };
      pdfUrl?: string;
    };
  },

  async extractJobDetails(text: string) {
    const res = await apiClient.post('/custom-apply/extract', { text });
    return res.data as {
      title: string;
      company: string;
      email: string;
      location: string;
    };
  },

  async getCustomApplications() {
    const res = await apiClient.get('/custom-apply');
    return res.data as IApplication[];
  },

  // Browser Agent / Form Inspector
  async inspectForm(url: string) {
    const res = await apiClient.post('/browser-agent/inspect', { url });
    return res.data as IBrowserTask;
  },

  // Profile
  async getProfile(): Promise<IMasterProfile> {
    const res = await apiClient.get('/profile');
    return res.data;
  },

  async updateProfile(profile: Partial<IMasterProfile>) {
    const res = await apiClient.put('/profile', profile);
    return res.data;
  },

  async uploadResume(formData: FormData) {
    const res = await apiClient.post('/profile/upload-resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async uploadResumeText(text: string, fileName?: string) {
    const res = await apiClient.post('/profile/upload-resume', { text, fileName });
    return res.data;
  },

  // Scheduler / Local Cron Agent
  async getSchedulerStatus(): Promise<ISchedulerStatus> {
    const res = await apiClient.get('/scheduler');
    return res.data;
  },

  async toggleScheduler(enabled: boolean) {
    const res = await apiClient.post('/scheduler', { action: 'toggle', enabled });
    return res.data;
  },

  async applyNow(jobId: string) {
    const res = await apiClient.post(`/jobs/${jobId}/apply`);
    return res.data;
  },

  async triggerCronNow() {
    const res = await apiClient.post('/scheduler', { action: 'run-now' });
    return res.data;
  },

  async setSchedulerInterval(minutes: number) {
    const res = await apiClient.post('/scheduler', { action: 'setInterval', minutes });
    return res.data;
  },

  // Agent Queue
  async getAgentStatus() {
    const res = await apiClient.get('/agent');
    return res.data;
  },

  async startAgent() {
    const res = await apiClient.post('/agent', { action: 'start' });
    return res.data;
  },

  async stopAgent() {
    const res = await apiClient.post('/agent', { action: 'stop' });
    return res.data;
  },

  async addToQueue(jobId: string) {
    const res = await apiClient.post('/agent', { action: 'add', jobId });
    return res.data;
  },

  async addAllToQueue(emailOnly?: boolean) {
    const res = await apiClient.post('/agent', { action: 'addAll', emailOnly });
    return res.data;
  },

  async purgePortalJobs() {
    const res = await apiClient.post('/agent', { action: 'purgePortalJobs' });
    return res.data;
  },

  async setEmailOnly(enabled: boolean) {
    const res = await apiClient.post('/agent', { action: 'setEmailOnly', enabled });
    return res.data;
  },

  async removeFromQueue(jobId: string) {
    const res = await apiClient.post('/agent', { action: 'remove', jobId });
    return res.data;
  },

  async requeueApplied() {
    const res = await apiClient.post('/agent', { action: 'requeueApplied' });
    return res.data;
  },

  async reloadStore() {
    const res = await apiClient.post('/agent', { action: 'reload' });
    return res.data;
  },

  async resetDailyLimit() {
    const res = await apiClient.post('/agent', { action: 'resetDailyLimit' });
    return res.data;
  },

  async toggleAutonomous(enabled: boolean) {
    const res = await apiClient.post('/agent', { action: 'toggleAutonomous', enabled });
    return res.data;
  },

  async setAutonomousConfig(config: { dailyLimit?: number; cooldownMinutes?: number; emailOnly?: boolean }) {
    const res = await apiClient.post('/agent', { action: 'setAutonomousConfig', ...config });
    return res.data;
  },

  async purgeNonEmailJobs() {
    const res = await apiClient.post('/agent', { action: 'purgeNonEmailJobs' });
    return res.data;
  },

  async sweepMarkets() {
    const res = await apiClient.post('/agent', { action: 'sweepMarkets' });
    return res.data;
  },
};
