# 🤖 AI Job Search, Resume Customization & Application Agent Platform

An autonomous, full-cycle Job Application Operating System built with **NestJS**, **Next.js 14/15**, **Supabase/PostgreSQL**, and a self-hosted **Local Cron Agent**.

---

## 🌟 Key Highlights

- **Local Cron Agent (Zero External Dependencies)**:
  - Replaces external tools like n8n with an embedded, resilient background cron runner (`@nestjs/schedule`).
  - Periodically searches for jobs matching candidate preferences, normalizes fields, and removes duplicates.
- **Strict Zero-Hallucination Policy**:
  - The AI tailoring engine **never fabricates** fake past employers, fake titles, fake degrees, or unlisted technologies.
  - It strictly re-weights, re-orders, and refines verified achievements from the candidate's Master Profile.
- **Primary & Free Application Channel (Direct Email)**:
  - Automatically identifies company hiring contacts from job listings.
  - Generates personalized cover letters and dynamic email bodies.
  - Attaches ATS-optimized PDF resumes generated on-the-fly.
- **Web Form & ATS Inspection (Astra / Playwright Ready)**:
  - Detects Greenhouse, Lever, Workday, and custom HTML application forms.
  - Features a **Human-in-the-Loop Safeguard**: high-risk screening questions (e.g. visa sponsorship, salary, clearances) are flagged for human review before final submission.
- **Modern Glassmorphic Command Center**:
  - Next.js dark-mode UI with live pipeline Kanban board, candidate profile editor, and agent settings.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              JOB SOURCES                               │
│  Google Jobs (SerpApi) │ Adzuna API │ LinkedIn/Indeed (Apify) │ Feeds   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        JOB COLLECTOR & NORMALIZER                      │
│      Standardizes job listings, strips duplicates, extracts emails     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       AI JOB ↔ RESUME MATCHING                         │
│  Scores compatibility (0-100), detects skill overlaps & missing skills │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AI RESUME & COVER LETTER TAILORING                   │
│   Re-weights skills, rephrases summary & bullets WITHOUT inventing fake │
│   experience; outputs ATS-optimized PDF and personalized cover letter  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────┐                         ┌───────────────────────┐
│     EMAIL CHANNEL     │                         │   WEB / ATS CHANNEL   │
│   (Primary & Free)    │                         │  (Astra / Playwright) │
│                       │                         │                       │
│ • Detects hiring email│                         │ • Form detection      │
│ • Custom cover email  │                         │ • Greenhouse/Lever/etc│
│ • Attaches custom PDF │                         │ • Safe Q&A auto-fill  │
│ • Gmail / SMTP send   │                         │ • Human-in-the-loop   │
└───────────────────────┘                         └───────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   APPLICATION TRACKER & DASHBOARD                      │
│  Real-time Kanban (Found -> Matched -> Ready -> Applied -> Interview)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
job-agent/
├── apps/
│   ├── backend/                      # NestJS API & Local Cron Orchestrator
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── jobs/             # Job collectors, normalizer, deduplicator
│   │   │   │   ├── matcher/          # AI Job-to-Resume matching engine
│   │   │   │   ├── resume/           # Profile & PDF Resume tailor (zero hallucination)
│   │   │   │   ├── email/            # Free email application engine (Gmail / SMTP)
│   │   │   │   ├── browser-agent/    # Web form inspector & Playwright worker
│   │   │   │   ├── applications/     # Kanban pipeline & lifecycle manager
│   │   │   │   ├── scheduler/        # Self-hosted Local Cron Agent
│   │   │   │   └── analytics/        # Overview statistics & metrics
│   │   └── package.json
│   │
│   └── dashboard/                    # Next.js 14/15 Modern Web Command Center
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx          # Overview KPIs & Agent controls
│       │   │   ├── jobs/page.tsx     # Discovered jobs feed & matcher results
│       │   │   ├── applications/     # Interactive Kanban pipeline
│       │   │   ├── profile/page.tsx  # Master Resume & QA Vault editor
│       │   │   └── settings/page.tsx # Local Cron & API keys configuration
│       │   └── lib/api-client.ts     # Typed REST client
│       └── package.json
│
├── database/
│   ├── schema.sql                    # PostgreSQL / Supabase complete schema
│   └── seeds/master_profile.json     # Usman Shafiq candidate profile & QA vault
│
├── packages/
│   └── shared/                       # Shared TypeScript interfaces & DTOs
│
├── storage/                          # Auto-generated tailored PDFs and review screenshots
│   ├── resumes/
│   └── screenshots/
│
└── package.json                      # Monorepo workspace definition
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js >= 18.x
- npm / pnpm / yarn

### 2. Installation
```bash
# In repository root:
npm install
```

### 3. Start Backend (NestJS + Local Cron Agent)
```bash
# Runs on http://localhost:3001
npm run dev:backend
```

### 4. Start Dashboard (Next.js Command Center)
```bash
# Runs on http://localhost:3000
npm run dev:dashboard
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Configuration

Copy `apps/backend/.env.example` to `apps/backend/.env`:

```env
PORT=3001

# AI Provider (Optional: fallback local rubric evaluator runs if key is omitted)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o

# Job Search APIs (Optional: high-fidelity seed feed runs out of the box)
SERPAPI_API_KEY=your-serpapi-key
ADZUNA_APP_ID=your-adzuna-id
ADZUNA_APP_KEY=your-adzuna-key

# Email Outreach (Primary & Free Channel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=usman.shafiq@gmail.com
SMTP_PASS=your-gmail-app-password
SENDER_EMAIL=usman.shafiq@gmail.com
SENDER_NAME="Usman Shafiq"

# Local Background Agent Settings
CRON_SCHEDULE="0 */6 * * *"
CRON_ENABLED=true
AUTO_TAILOR_THRESHOLD=75
```

---

## 🛡️ Safeguards & Verification

1. **Anti-Hallucination**: Tailored resumes only re-weight skills, select relevant projects, and refine bullets from `master_profile.json`. No unverified claims are added.
2. **Human-in-the-Loop**: Questions relating to legal work authorization, sponsorship requirements, or salary demands pause execution and stage the application for human review before submission.
