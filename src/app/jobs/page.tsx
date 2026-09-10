'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
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
  FileText,
  Layers,
  ArrowRight,
  Inbox,
  Loader2,
  Play,
  Square,
  Plus,
  PlusCircle,
  X,
  Clock
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { IJob, ISchedulerStatus } from '@/types';

type QueueColumn = 'discovered' | 'queue' | 'applied';

interface AgentStatus {
  isRunning: boolean;
  queue: string[];
  currentJobId: string | null;
  currentJobTitle: string | null;
  queueLength: number;
  log: { jobId: string; jobTitle: string; status: string; message: string; timestamp: string }[];
}

function getSourceBadgeStyle(source: string) {
  switch (source) {
    case 'remotive': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'remoteok': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'arbeitnow': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'jobicy': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'serpapi': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'adzuna': return 'bg-purple-50 text-purple-700 border-purple-200';
    default: return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

export default function QueueBoardPage() {
  const [jobs, setJobs] = useState<IJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<ISchedulerStatus | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [appliedResumeUrls, setAppliedResumeUrls] = useState<Record<string, string>>({});
  const [testingEmail, setTestingEmail] = useState(false);
  const [addingJobId, setAddingJobId] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);

  const fetchJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await AgentApi.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchAgentStatus = useCallback(async () => {
    try {
      const status = await AgentApi.getAgentStatus();
      setAgentStatus(status);
    } catch (err) {
      console.error('Error fetching agent status:', err);
    }
  }, []);

  const fetchScheduler = useCallback(async () => {
    try {
      const status = await AgentApi.getSchedulerStatus();
      setSchedulerStatus(status);
    } catch (err) {
      console.error('Error fetching scheduler status:', err);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchScheduler();
    fetchAgentStatus();

    // Faster polling when agent is running (5s), otherwise 15s
    const interval = setInterval(() => {
      fetchJobs(true);
      fetchAgentStatus();
      fetchScheduler();
    }, agentStatus?.isRunning ? 5000 : 15000);

    return () => clearInterval(interval);
  }, [agentStatus?.isRunning]);

  // --- Handlers ---

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      const res = await fetch('/api/email/test', { method: 'POST' });
      const data = await res.json();
      showMessage(data.success
        ? `Gmail SMTP Verified! Test email delivered to ${data.recipient || 'talhasadiq320@gmail.com'}`
        : `Gmail test failed: ${data.error}`
      );
    } catch (err: any) {
      showMessage(`Email test error: ${err.message}`);
    } finally {
      setTestingEmail(false);
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

  const handleAddToQueue = async (job: IJob) => {
    try {
      setAddingJobId(job.id);
      const res = await AgentApi.addToQueue(job.id);
      showMessage(res.message || `Added to queue`);
      await Promise.all([fetchJobs(true), fetchAgentStatus()]);
    } catch (err: any) {
      showMessage(`Failed to add: ${err.message}`);
    } finally {
      setAddingJobId(null);
    }
  };

  const handleAddAllToQueue = async () => {
    try {
      setAddingAll(true);
      const res = await AgentApi.addAllToQueue();
      showMessage(`Added ${res.added} jobs to queue (${res.skipped} skipped). Queue: ${res.queueLength} total.`);
      await Promise.all([fetchJobs(true), fetchAgentStatus()]);
    } catch (err: any) {
      showMessage(`Failed: ${err.message}`);
    } finally {
      setAddingAll(false);
    }
  };

  const handleRemoveFromQueue = async (jobId: string) => {
    try {
      await AgentApi.removeFromQueue(jobId);
      await Promise.all([fetchJobs(true), fetchAgentStatus()]);
    } catch (err: any) {
      showMessage(`Failed to remove: ${err.message}`);
    }
  };

  const handleStartAgent = async () => {
    try {
      const res = await AgentApi.startAgent();
      showMessage(res.message);
      // Immediately refresh everything
      await Promise.all([fetchJobs(true), fetchAgentStatus()]);
    } catch (err: any) {
      showMessage(`Failed to start agent: ${err.message}`);
    }
  };

  const handleStopAgent = async () => {
    try {
      const res = await AgentApi.stopAgent();
      showMessage(res.message || 'Agent stopping...');
      // Immediately update local state so UI responds instantly
      setAgentStatus((prev) => prev ? { ...prev, isRunning: false, currentJobId: null, currentJobTitle: null } : prev);
      // Then refresh from server
      await Promise.all([fetchJobs(true), fetchAgentStatus()]);
    } catch (err: any) {
      showMessage(`Failed to stop agent: ${err.message}`);
    }
  };

  // --- Filtering & Grouping ---

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = selectedSource === 'all' || job.source === selectedSource;
      const matchesType =
        selectedType === 'all' ||
        (selectedType === 'email' && Boolean(job.contact_email)) ||
        (selectedType === 'portal' && !job.contact_email);
      return matchesSearch && matchesSource && matchesType;
    });
  }, [jobs, searchQuery, selectedSource, selectedType]);

  const columns = useMemo(() => {
    const queueSet = new Set(agentStatus?.queue || []);
    const currentId = agentStatus?.currentJobId;
    const grouped: Record<QueueColumn, IJob[]> = { discovered: [], queue: [], applied: [] };

    for (const job of filteredJobs) {
      if (job.status === 'APPLIED') {
        grouped.applied.push(job);
      } else if (queueSet.has(job.id) || job.id === currentId || job.status === 'MATCHED') {
        grouped.queue.push(job);
      } else {
        grouped.discovered.push(job);
      }
    }
    return grouped;
  }, [filteredJobs, agentStatus]);

  const isAgentRunning = agentStatus?.isRunning ?? false;
  const queueCount = agentStatus?.queueLength ?? columns.queue.length;

  return (
    <div className="p-6 lg:p-8 max-w-full mx-auto space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Queue Board
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {filteredJobs.length} Jobs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Add jobs to the queue, start the agent, and watch them flow to Applied automatically.
          </p>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* ▶ Start / ⏹ Stop Agent Button */}
          {isAgentRunning ? (
            <button
              onClick={handleStopAgent}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-sm transition-all transform active:scale-95"
            >
              <Square className="h-3.5 w-3.5 fill-white" />
              <span>Stop Agent</span>
            </button>
          ) : (
            <button
              onClick={handleStartAgent}
              disabled={queueCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              <span>Start Agent{queueCount > 0 ? ` (${queueCount})` : ''}</span>
            </button>
          )}

          {/* Auto-Scraping */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-medium text-slate-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
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

          {/* Test Gmail */}
          <button
            onClick={handleTestEmail}
            disabled={testingEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Mail className={`h-3.5 w-3.5 text-brand-600 ${testingEmail ? 'animate-bounce' : ''}`} />
            <span>{testingEmail ? 'Sending...' : 'Test Gmail'}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={() => { fetchJobs(); fetchAgentStatus(); }}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Agent Running Status Banner */}
      {isAgentRunning && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-2xs font-medium animate-fadeIn flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 text-amber-600 animate-spin flex-shrink-0" />
            <span>
              <strong>Agent Running</strong>
              {agentStatus?.currentJobTitle
                ? ` — Processing: "${agentStatus.currentJobTitle}"`
                : ` — Waiting for next job...`
              }
              {queueCount ? ` (${queueCount} remaining)` : ''}
            </span>
          </div>
          <button onClick={handleStopAgent} className="text-xs text-red-600 font-bold hover:underline ml-3">Stop</button>
        </div>
      )}

      {/* Notification Banner */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs font-medium animate-fadeIn flex-shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="hover:underline text-emerald-700 font-semibold ml-2">Dismiss</button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0">
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
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-2xs font-medium"
          >
            <option value="all">All Methods ({jobs.length})</option>
            <option value="email">Direct Email ({jobs.filter(j => j.contact_email).length})</option>
            <option value="portal">Web Portal ({jobs.filter(j => !j.contact_email).length})</option>
          </select>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-2xs font-medium"
          >
            <option value="all">All Platforms</option>
            <option value="remotive">Remotive</option>
            <option value="remoteok">RemoteOK</option>
            <option value="arbeitnow">Arbeitnow</option>
            <option value="jobicy">Jobicy</option>
            <option value="serpapi">Google Jobs</option>
          </select>
        </div>
      </div>

      {/* === 3-Column Kanban Board === */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
          <span>Loading live positions...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0 items-start">

          {/* ========== COLUMN 1: DISCOVERED ========== */}
          <div className="kanban-col-discovered bg-white/70 border border-slate-200/80 rounded-2xl flex flex-col min-h-[500px] max-h-[calc(100vh-280px)] shadow-2xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-brand-500" />
                  Discovered
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Scraped from platforms</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Add All to Queue Button */}
                {columns.discovered.length > 0 && (
                  <button
                    onClick={handleAddAllToQueue}
                    disabled={addingAll}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-[11px] font-bold transition-all disabled:opacity-50"
                    title="Add all discovered jobs to the queue"
                  >
                    <PlusCircle className={`h-3 w-3 ${addingAll ? 'animate-spin' : ''}`} />
                    <span>{addingAll ? 'Adding...' : 'Add All'}</span>
                  </button>
                )}
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600">
                  {columns.discovered.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {columns.discovered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                  <Inbox className="h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">No new jobs yet. The auto-scraper will find new positions shortly.</p>
                </div>
              ) : (
                columns.discovered.map((job, idx) => {
                  const hasEmail = Boolean(job.contact_email);
                  const isAdding = addingJobId === job.id;
                  return (
                    <div
                      key={job.id}
                      style={{ animationDelay: `${idx * 30}ms` }}
                      className="animate-fadeIn p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all hover:shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">{job.title}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                              <Building className="h-3 w-3 text-slate-400" />{job.company}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin className="h-3 w-3" />{job.location}
                            </span>
                          </div>
                        </div>
                        <a href={job.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      {/* Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase ${getSourceBadgeStyle(job.source)}`}>{job.source}</span>
                        {hasEmail ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Mail className="h-2.5 w-2.5" /> Email
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Layers className="h-2.5 w-2.5" /> Portal
                          </span>
                        )}
                        {job.salary_min ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <DollarSign className="h-2.5 w-2.5" />{job.salary_min.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{job.description}</p>
                      {/* Add to Queue Button */}
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleAddToQueue(job)}
                          disabled={isAdding}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-2xs transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {isAdding ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Adding...</span></>
                          ) : (
                            <><Plus className="h-3.5 w-3.5" /><span>Add to Queue</span><ArrowRight className="h-3 w-3 ml-auto opacity-50" /></>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========== COLUMN 2: IN QUEUE ========== */}
          <div className="kanban-col-queue bg-white/70 border border-slate-200/80 rounded-2xl flex flex-col min-h-[500px] max-h-[calc(100vh-280px)] shadow-2xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Loader2 className={`h-4 w-4 text-amber-500 ${isAgentRunning ? 'animate-spin' : ''}`} />
                  In Queue
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{isAgentRunning ? 'Agent is processing...' : 'Waiting for agent start'}</p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 text-amber-700">
                {columns.queue.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {columns.queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                  <Clock className="h-8 w-8 text-amber-300" />
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">No jobs in queue. Click "Add to Queue" on discovered jobs.</p>
                </div>
              ) : (
                columns.queue.map((job, idx) => {
                  const isCurrentlyProcessing = agentStatus?.currentJobId === job.id;
                  const queuePosition = (agentStatus?.queue || []).indexOf(job.id);
                  const hasEmail = Boolean(job.contact_email);

                  return (
                    <div
                      key={job.id}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      className={`animate-slideInUp p-4 rounded-xl border bg-white transition-all space-y-3 ${
                        isCurrentlyProcessing
                          ? 'border-amber-400 ring-2 ring-amber-200/50 animate-pulseSubtle shadow-sm'
                          : 'border-amber-200/60 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isCurrentlyProcessing ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing
                              </span>
                            ) : queuePosition >= 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold border border-slate-200">
                                #{queuePosition + 1}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">{job.title}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                              <Building className="h-3 w-3 text-slate-400" />{job.company}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin className="h-3 w-3" />{job.location}
                            </span>
                          </div>
                        </div>
                        {/* Remove from queue */}
                        {!isCurrentlyProcessing && (
                          <button
                            onClick={() => handleRemoveFromQueue(job.id)}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                            title="Remove from queue"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase ${getSourceBadgeStyle(job.source)}`}>{job.source}</span>
                        {hasEmail ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Mail className="h-2.5 w-2.5" /> Email
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Layers className="h-2.5 w-2.5" /> Portal
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">{job.description}</p>
                      {/* Footer: show "Open Portal" for web jobs with resume ready */}
                      {!hasEmail && job.tailored_resume_pdf_url && (
                        <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Resume Ready
                          </span>
                          <a
                            href={job.application_url || job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-[10px] font-bold transition-all"
                          >
                            <ExternalLink className="h-2.5 w-2.5" /> Open Portal
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========== COLUMN 3: APPLIED ========== */}
          <div className="kanban-col-applied bg-white/70 border border-slate-200/80 rounded-2xl flex flex-col min-h-[500px] max-h-[calc(100vh-280px)] shadow-2xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Applied
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Successfully sent</p>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700">
                {columns.applied.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {columns.applied.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">No applications sent yet. Start the agent to begin applying.</p>
                </div>
              ) : (
                columns.applied.map((job, idx) => {
                  const hasEmail = Boolean(job.contact_email);
                  return (
                    <div
                      key={job.id}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      className="animate-slideInRight animate-glowGreen p-4 rounded-xl border border-emerald-200/80 bg-white transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-2">{job.title}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                              <Building className="h-3 w-3 text-slate-400" />{job.company}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin className="h-3 w-3" />{job.location}
                            </span>
                          </div>
                        </div>
                        <a href={job.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      {/* Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase ${getSourceBadgeStyle(job.source)}`}>{job.source}</span>
                        {hasEmail ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Mail className="h-2.5 w-2.5" /> Email
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Layers className="h-2.5 w-2.5" /> Portal
                          </span>
                        )}
                      </div>
                      {/* Applied Footer */}
                      <div className="pt-2 border-t border-emerald-100 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Applied
                        </span>
                        {(job.tailored_resume_pdf_url || appliedResumeUrls[job.id]) && (
                          <a
                            href={job.tailored_resume_pdf_url || appliedResumeUrls[job.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold transition-all"
                          >
                            <FileText className="h-3 w-3 text-indigo-600" /> Resume
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* Agent Activity Log */}
      {agentStatus && agentStatus.log.length > 0 && (
        <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 font-mono uppercase flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Agent Activity Log
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">{agentStatus.log.length} entries</span>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100">
            <table className="w-full text-[11px]">
              <tbody>
                {agentStatus.log.slice().reverse().map((entry, i) => (
                  <tr key={i} className={`border-b border-slate-50 last:border-0 ${i % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-3 py-2 w-5">
                      {entry.status === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </td>
                    <td className="py-2 font-semibold text-slate-800 max-w-[200px] truncate">
                      {entry.jobTitle}
                    </td>
                    <td className="py-2 px-3">
                      {entry.status === 'success' ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">Sent</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold text-[10px]">Failed</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-400 font-mono text-[10px] text-right pr-3 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
