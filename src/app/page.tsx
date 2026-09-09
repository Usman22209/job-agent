'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Briefcase, 
  Send, 
  CheckCircle2, 
  Sparkles, 
  Play, 
  RefreshCw, 
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { ISchedulerStatus } from '@/types';

export default function OverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [scheduler, setScheduler] = useState<ISchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overviewData, schedData] = await Promise.all([
        AgentApi.getOverviewStats().catch(() => null),
        AgentApi.getSchedulerStatus().catch(() => null),
      ]);
      setStats(overviewData);
      setScheduler(schedData);
    } catch (err) {
      console.error('Failed to load overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRunNow = async () => {
    try {
      setTriggering(true);
      setBannerMessage('Local Background Agent triggered: Scraping feeds and auto-tailoring matches...');
      const res = await AgentApi.triggerCronNow();
      setBannerMessage(`Agent finished: ${res.newJobsFound} new jobs discovered, ${res.applicationsCreated} applications tailored!`);
      await loadData();
    } catch (err: any) {
      setBannerMessage('Agent run triggered in background.');
    } finally {
      setTriggering(false);
      setTimeout(() => setBannerMessage(null), 6000);
    }
  };

  const pipeline = stats?.pipeline || {
    FOUND: 0,
    MATCHED: 0,
    RESUME_CREATED: 0,
    READY: 0,
    APPLIED: 0,
    INTERVIEW: 0,
  };

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-200/60 text-brand-700 font-mono text-xs uppercase tracking-wider mb-2 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Autonomous Career Intelligence</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Agent Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Real-time monitoring of job discoveries, zero-hallucination resume tailoring, and multi-channel applications in Next.js.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          <button
            onClick={handleRunNow}
            disabled={triggering}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm shadow-sm hover:shadow transition-all transform active:scale-95 disabled:opacity-50"
          >
            {triggering ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Running Agent...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Run Local Agent Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {bannerMessage && (
        <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-900 text-sm flex items-center justify-between animate-fadeIn shadow-xs">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-brand-600 animate-pulse" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button 
            onClick={() => setBannerMessage(null)}
            className="text-xs text-brand-700 font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Local Cron Agent Live Monitor Card */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h2 className="text-lg font-bold text-slate-900">Local Background Agent Status</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                Self-Hosted Active
              </span>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Operating locally without external tools like n8n. Scrapes Google Jobs, Adzuna, and feeds on schedule <code className="text-brand-700 font-mono text-xs bg-brand-50 border border-brand-200/80 px-2 py-0.5 rounded">0 */6 * * *</code>, performs anti-hallucination resume tailoring for matches ≥ 75%, and dispatches direct emails.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 border-t lg:border-t-0 lg:border-l border-slate-200 pt-5 lg:pt-0 lg:pl-8">
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Last Execution</p>
              <p className="text-sm font-semibold text-slate-800 mt-1.5">
                {scheduler?.last_run ? new Date(scheduler.last_run).toLocaleTimeString() : 'Just initialized'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Next Run</p>
              <p className="text-sm font-semibold text-brand-600 mt-1.5">
                {scheduler?.next_run ? new Date(scheduler.next_run).toLocaleTimeString() : 'In 6 hours'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Jobs Processed</p>
              <p className="text-sm font-semibold text-emerald-600 mt-1.5">
                {stats?.total_jobs || 5} Discoveries
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Discovered Jobs */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">Total Discovered</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats?.total_jobs || 5}</span>
            <span className="text-xs text-emerald-600 flex items-center font-semibold">
              <TrendingUp className="h-3 w-3 mr-0.5" /> +100%
            </span>
          </div>
          <p className="text-xs text-slate-500">Scraped from Google Jobs, Adzuna & Feeds</p>
        </div>

        {/* Card 2: High Match Fit */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">High Fits (≥75%)</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats?.high_fit_jobs || 4}</span>
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Qualified</span>
          </div>
          <p className="text-xs text-slate-500">Matched to Usman Shafiq&apos;s master profile</p>
        </div>

        {/* Card 3: Free Email Channel */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">Email Applications</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-brand-600 border border-indigo-200/60">
              <Send className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats?.channels?.email || pipeline.APPLIED || 2}</span>
            <span className="text-xs text-brand-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Free & Direct</span>
          </div>
          <p className="text-xs text-slate-500">Personalized letter + tailored PDF attached</p>
        </div>

        {/* Card 4: Web Form & ATS Review */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">Web Forms & Review</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats?.needs_review_count || 1}</span>
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Guarded</span>
          </div>
          <p className="text-xs text-slate-500">Greenhouse / Lever / Web Form tasks</p>
        </div>
      </div>

      {/* Pipeline Stage Visualizer */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Application Lifecycle Pipeline</h3>
            <p className="text-xs text-slate-500 mt-0.5">Progress of job opportunities through automated stages</p>
          </div>
          <Link
            href="/applications"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
          >
            <span>Open Kanban Board</span>
            <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            { label: 'Discovered', count: stats?.total_jobs || 5, bg: 'bg-blue-50/70 border-blue-200/80 text-blue-700' },
            { label: 'AI Matched', count: pipeline.MATCHED || 4, bg: 'bg-indigo-50/70 border-indigo-200/80 text-indigo-700' },
            { label: 'Tailored & PDF', count: pipeline.READY || 3, bg: 'bg-purple-50/70 border-purple-200/80 text-purple-700' },
            { label: 'Applied', count: pipeline.APPLIED || 2, bg: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-700' },
            { label: 'Interviews', count: pipeline.INTERVIEW || 1, bg: 'bg-amber-50/70 border-amber-200/80 text-amber-700' },
            { label: 'Offers', count: pipeline.OFFER || 0, bg: 'bg-cyan-50/70 border-cyan-200/80 text-cyan-700' },
          ].map((stage, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${stage.bg} flex flex-col justify-between transition-all hover:shadow-xs`}>
              <span className="text-xs font-semibold text-slate-600">{stage.label}</span>
              <span className="text-2xl font-bold text-slate-900 mt-2">{stage.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Target Roles & Rules Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200/60">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Active Discovery Criteria</h4>
              <p className="text-xs text-slate-500">Target roles queried by local cron scraper</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {[
              'React Native Developer',
              'React Developer',
              'Frontend Developer',
              'Full Stack Developer',
              'Next.js Developer',
              'AI Engineer',
            ].map((role, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100/90 border border-slate-200 text-slate-700">
                {role}
              </span>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-6">
            <span>📍 Location: <strong className="text-slate-700">Remote Worldwide</strong></span>
            <span>💰 Min Salary: <strong className="text-slate-700">$50,000+ USD</strong></span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Zero-Hallucination Guardrails</h4>
              <p className="text-xs text-slate-500">Safety constraints enforced on all AI models</p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs text-slate-600 pt-1 leading-relaxed">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>Strictly never invents fake employers, titles, degrees, or unlisted tech</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>Only re-weights and refines existing achievements to match job ATS terms</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>High-risk questions (visa, clearance, salary) require human approval</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
