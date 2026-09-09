// Core Types & Interfaces for AI Job Application Agent Platform

export type JobSource = 'remotive' | 'remoteok' | 'arbeitnow' | 'jobicy' | 'serpapi' | 'adzuna' | 'apify' | 'feed' | 'manual';
export type JobStatus = 'DISCOVERED' | 'MATCHED' | 'APPLIED' | 'SKIPPED' | 'ARCHIVED';
export type MatchClassification = 'EXCELLENT' | 'GOOD' | 'POSSIBLE' | 'SKIP';
export type ApplicationChannel = 'EMAIL' | 'WEB_FORM' | 'ATS' | 'MANUAL';
export type ApplicationStatus =
  | 'FOUND'
  | 'MATCHED'
  | 'RESUME_CREATED'
  | 'READY'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED';

export type ATSPlatform = 'Greenhouse' | 'Lever' | 'Workday' | 'BambooHR' | 'SmartRecruiters' | 'GenericForm' | 'DirectEmail' | 'Unknown';

export interface ISkill {
  name: string;
  category?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  keywords?: string[];
}

export interface IExperience {
  company: string;
  position: string;
  location?: string;
  start_date: string;
  end_date: string;
  current: boolean;
  description: string;
  bullet_points: string[];
}

export interface IProject {
  title: string;
  technologies: string[];
  description: string;
  url?: string;
}

export interface IEducation {
  degree: string;
  institution: string;
  graduation_year: string;
  location?: string;
}

export interface IUserPreferences {
  target_roles: string[];
  remote: boolean;
  target_locations: string[];
  min_salary?: number;
  currency?: string;
}

export interface IQaVault {
  [key: string]: string;
}

export interface IMasterProfile {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  skills: ISkill[];
  experience: IExperience[];
  projects: IProject[];
  education: IEducation[];
  preferences: IUserPreferences;
  qa_vault: IQaVault;
  master_resume_url?: string;
  master_resume_filename?: string;
}

export interface IJob {
  id: string;
  source: JobSource;
  source_id?: string;
  title: string;
  company: string;
  location: string;
  is_remote: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string;
  description: string;
  url: string;
  application_url?: string;
  contact_email?: string;
  application_type?: 'EMAIL' | 'WEB_FORM' | 'ATS' | 'UNKNOWN';
  ats_platform?: ATSPlatform;
  posted_at?: string;
  status: JobStatus;
  dedup_hash?: string;
  created_at?: string;
  match?: IJobMatch;
}

export interface IJobMatch {
  id?: string;
  job_id: string;
  score: number; // 0 - 100
  classification: MatchClassification;
  matching_skills: string[];
  missing_skills: string[];
  recommendation: 'APPLY' | 'REVIEW' | 'SKIP';
  reasoning: string;
  created_at?: string;
}

export interface ITailoredResume {
  full_name: string;
  contact_line: string;
  summary: string;
  ordered_skills: string[];
  experience: {
    company: string;
    position: string;
    period: string;
    bullet_points: string[];
  }[];
  selected_projects: {
    title: string;
    technologies: string[];
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
}

export interface IApplication {
  id: string;
  job_id: string;
  job?: IJob;
  match?: IJobMatch;
  profile_id?: string;
  status: ApplicationStatus;
  application_channel: ApplicationChannel;
  tailored_resume_json?: ITailoredResume;
  tailored_resume_pdf_url?: string;
  cover_letter?: string;
  email_subject?: string;
  email_body?: string;
  email_sent_at?: string;
  email_message_id?: string;
  needs_human_review: boolean;
  human_review_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IBrowserTask {
  id?: string;
  application_id: string;
  target_url: string;
  detected_platform: ATSPlatform;
  form_fields: {
    name: string;
    label: string;
    type: string;
    required: boolean;
    confidence: number;
  }[];
  answers_filled: Record<string, string>;
  flagged_questions: {
    question: string;
    context: string;
    proposed_answer?: string;
  }[];
  status: 'PENDING' | 'INSPECTED' | 'AWAITING_APPROVAL' | 'SUBMITTED' | 'FAILED';
  screenshots?: string[];
  error_log?: string;
}

export interface ISchedulerStatus {
  is_running: boolean;
  is_enabled?: boolean;
  interval_minutes?: number;
  last_run?: string;
  next_run?: string;
  cron_expression: string;
  total_jobs_scraped: number;
  total_applications_queued: number;
}
