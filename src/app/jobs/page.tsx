'use client';

import React, { useEffect, useState } from 'react';
import { 
  Briefcase, 
  Search, 
  Filter, 
  ExternalLink, 
  Mail, 
  CheckCircle2, 
  RefreshCw,
  Building,
  MapPin,
  DollarSign,
  Zap,
  Clock
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { IJob, ISchedulerStatus } from '@/types';

export default function JobsPage() {
  const [jobs, setJobs] = useState<IJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<ISchedulerStatus | null>(null);

  const fetchJobs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await AgentApi.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchScheduler = async () => {
    try {
      const status = await AgentApi.getSchedulerStatus();
      setSchedulerStatus(status);
    } catch (err) {
      console.error('Error fetching scheduler status:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchScheduler();

    // Auto-refresh jobs list every 30 seconds to show newly scraped jobs
    const interval = setInterval(() => {
      fetchJobs(true);
      fetchScheduler();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleApplyNow = async (job: IJob) => {
    try {
      setApplyingJobId(job.id);
      const res = await AgentApi.applyNow(job.id);
      
      // Update local status to APPLIED
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'APPLIED' } : j))
      );

      setActionSuccess(res.message || 'Application submitted successfully!');

      // If web application portal, open the application URL in a new tab
      if (res.method === 'WEB_PORTAL' && res.applyUrl) {
        window.open(res.applyUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      console.error('Apply failed:', err);
      setActionSuccess('Application attempt failed. Please check connection.');
    } finally {
      setApplyingJobId(null);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    try {
      if (minutes === 0) {
        await AgentApi.toggleScheduler(false);
      } else {
        await AgentApi.toggleScheduler(true);
        await AgentApi.setSchedulerInterval(minutes);
      }
      await fetchScheduler();
    } catch (err) {
      console.error('Failed to change interval:', err);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSource = selectedSource === 'all' || job.source === selectedSource;

    return matchesSearch && matchesSource;
  });

  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'remotive':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'remoteok':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'arbeitnow':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'jobicy':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'serpapi':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'adzuna':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="p-8 lg:p-10 max-w-6xl mx-auto space-y-7">
      {/* Clean Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Live Job Board
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {filteredJobs.length} Jobs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-platform scraper with 1-click tailored application.
          </p>
        </div>

        {/* Auto-Scraping Indicator & Simple Interval Switch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-medium text-slate-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-600 font-semibold">Auto-Scraping:</span>
            <select
              value={schedulerStatus?.is_enabled === false ? '0' : String(schedulerStatus?.interval_minutes || 2)}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="bg-transparent font-bold text-brand-600 focus:outline-none cursor-pointer"
            >
              <option value="2">Every 2 min</option>
              <option value="5">Every 5 min</option>
              <option value="10">Every 10 min</option>
              <option value="0">Paused</option>
            </select>
          </div>

          <button
            onClick={() => fetchJobs()}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-2xs"
            title="Refresh Jobs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="hover:underline text-emerald-700 font-semibold ml-2">Dismiss</button>
        </div>
      )}

      {/* Simple Search & Source Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search jobs by title, company, or stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-2xs transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-2xs font-medium"
          >
            <option value="all">All Platforms ({jobs.length})</option>
            <option value="remotive">Remotive</option>
            <option value="remoteok">RemoteOK</option>
            <option value="arbeitnow">Arbeitnow</option>
            <option value="jobicy">Jobicy</option>
            <option value="serpapi">Google Jobs</option>
          </select>
        </div>
      </div>

      {/* Job Cards List */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
          <span>Loading live positions...</span>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-8 space-y-2">
          <Briefcase className="h-9 w-9 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No jobs match your search</h3>
          <p className="text-xs text-slate-500">The background scraper will auto-discover new positions every 2 minutes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const isApplied = job.status === 'APPLIED';
            const isApplying = applyingJobId === job.id;
            const hasEmail = Boolean(job.contact_email);

            return (
              <div
                key={job.id}
                className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 sm:p-6 transition-all shadow-2xs space-y-3.5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-slate-900">
                        {job.title}
                      </h2>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase ${getSourceBadgeStyle(job.source)}`}>
                        {job.source}
                      </span>
                      {hasEmail ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Mail className="h-3 w-3" />
                          <span>Direct Email</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Building className="h-3.5 w-3.5 text-slate-400" />
                        {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {job.location}
                      </span>
                      {job.salary_min ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          <DollarSign className="h-3 w-3" />
                          ${job.salary_min.toLocaleString()} - ${job.salary_max?.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* 1-Button Apply Action */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    {isApplied ? (
                      <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Applied</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApplyNow(job)}
                        disabled={isApplying}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-2xs transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isApplying ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Applying...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 text-amber-300" />
                            <span>Apply Now</span>
                          </>
                        )}
                      </button>
                    )}

                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors shadow-2xs"
                      title="View Original Job Page"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Clean Plain-Text Description Snippet */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-sans">
                  {job.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
