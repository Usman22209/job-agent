-- PostgreSQL / Supabase Schema for AI Job Application Agent Platform
-- Supports: Jobs, Master Profile, AI Matches, Tailored Applications, Email Tracking & Browser Logs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Master Profile: Source of truth for candidate (anti-hallucination reference)
CREATE TABLE IF NOT EXISTS master_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    headline VARCHAR(255),
    summary TEXT,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    education JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{"target_roles": [], "remote": true, "min_salary": null}'::jsonb,
    qa_vault JSONB NOT NULL DEFAULT '{"work_authorization": "Yes", "sponsorship_required": "No", "clearance": "None"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Jobs: Aggregated & normalized job postings from all sources
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(100) NOT NULL, -- serpapi, adzuna, apify, feeds, direct
    source_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT FALSE,
    salary_min NUMERIC,
    salary_max NUMERIC,
    currency VARCHAR(10) DEFAULT 'USD',
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    application_url TEXT,
    contact_email VARCHAR(255),
    application_type VARCHAR(50) DEFAULT 'UNKNOWN', -- EMAIL, WEB_FORM, ATS, UNKNOWN
    ats_platform VARCHAR(100), -- Greenhouse, Lever, Workday, etc.
    posted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'DISCOVERED', -- DISCOVERED, MATCHED, SKIPPED, ARCHIVED
    dedup_hash VARCHAR(64) UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_dedup_hash ON jobs(dedup_hash);

-- 3. Job Matches: AI evaluation of candidate fit against job requirements
CREATE TABLE IF NOT EXISTS job_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES master_profile(id) ON DELETE SET NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    classification VARCHAR(50) NOT NULL, -- EXCELLENT (90-100), GOOD (75-89), POSSIBLE (60-74), SKIP (<60)
    matching_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendation VARCHAR(50) NOT NULL, -- APPLY, REVIEW, SKIP
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_matches_job_id ON job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_score ON job_matches(score DESC);

-- 4. Applications: Tailored resume, cover letter, application status & tracking
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES master_profile(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'FOUND', 
    -- Status pipeline: FOUND -> MATCHED -> RESUME_CREATED -> READY -> APPLIED -> INTERVIEW -> OFFER -> REJECTED
    application_channel VARCHAR(50) DEFAULT 'EMAIL', -- EMAIL, WEB_FORM, ATS, MANUAL
    tailored_resume_json JSONB,
    tailored_resume_pdf_url TEXT,
    cover_letter TEXT,
    email_subject TEXT,
    email_body TEXT,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_message_id VARCHAR(255),
    browser_session_logs JSONB DEFAULT '[]'::jsonb,
    needs_human_review BOOLEAN DEFAULT FALSE,
    human_review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);

-- 5. Email Logs: Audit trail for outbound email applications
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    has_attachment BOOLEAN DEFAULT TRUE,
    attachment_name VARCHAR(255),
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    error_message TEXT,
    provider_response JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Browser Tasks: Form detection, inspection, and Playwright execution logs
CREATE TABLE IF NOT EXISTS browser_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    detected_platform VARCHAR(100), -- Greenhouse, Lever, Workday, Generic
    form_fields JSONB DEFAULT '[]'::jsonb,
    answers_filled JSONB DEFAULT '{}'::jsonb,
    flagged_questions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, INSPECTED, AWAITING_APPROVAL, SUBMITTED, FAILED
    screenshots JSONB DEFAULT '[]'::jsonb,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
