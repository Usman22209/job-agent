'use client';

import React, { useState, useEffect } from 'react';
import { 
  SendHorizontal, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Download, 
  Mail, 
  Building, 
  MapPin, 
  Clock, 
  ArrowRight, 
  RefreshCw, 
  FileCheck, 
  Loader2, 
  ShieldCheck, 
  Eye, 
  Edit3, 
  ExternalLink,
  Copy,
  Zap,
  Check
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { IApplication } from '@/types';

export default function CustomApplyPage() {
  // Form State
  const [recipientEmail, setRecipientEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('Remote');
  const [description, setDescription] = useState('');

  // Execution State
  const [loadingMode, setLoadingMode] = useState<'idle' | 'autoSend' | 'preview' | 'extracting' | 'dispatchingExisting'>('idle');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Result State
  const [currentApp, setCurrentApp] = useState<IApplication | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'email' | 'cover_letter' | 'resume_preview'>('email');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Recent on-demand history
  const [recentApplications, setRecentApplications] = useState<IApplication[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load recent applications
  const fetchRecent = async () => {
    try {
      setLoadingHistory(true);
      const apps = await AgentApi.getCustomApplications();
      setRecentApplications(apps);
    } catch (err) {
      console.warn('Failed to load recent applications:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Auto-detect details from pasted JD
  const handleAutoExtract = async () => {
    if (!description.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste a job description first to auto-extract details.' });
      return;
    }

    try {
      setLoadingMode('extracting');
      setStatusMessage(null);
      const data = await AgentApi.extractJobDetails(description);
      if (data.title && !jobTitle) setJobTitle(data.title);
      if (data.company && !company) setCompany(data.company);
      if (data.email && !recipientEmail) setRecipientEmail(data.email);
      if (data.location && location === 'Remote') setLocation(data.location);

      setStatusMessage({
        type: 'success',
        text: `Extracted: ${data.title || 'Role'} ${data.company ? 'at ' + data.company : ''}${data.email ? ' (' + data.email + ')' : ''}`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Auto-extraction failed: ${err.message}` });
    } finally {
      setLoadingMode('idle');
    }
  };

  // Submit on-demand custom apply
  const handleSubmit = async (autoSend: boolean) => {
    if (!description.trim()) {
      setStatusMessage({ type: 'error', text: 'Job description is required.' });
      return;
    }
    if (!recipientEmail.trim() || !recipientEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'A valid recipient email address is required.' });
      return;
    }

    try {
      setLoadingMode(autoSend ? 'autoSend' : 'preview');
      setStatusMessage(null);
      setActiveStep(1); // Parsing requirements

      // Simulate nice stepper transitions for user feedback
      const stepTimer1 = setTimeout(() => setActiveStep(2), 700);
      const stepTimer2 = setTimeout(() => setActiveStep(3), 1600);

      const res = await AgentApi.customApply({
        title: jobTitle.trim(),
        company: company.trim(),
        description: description.trim(),
        recipientEmail: recipientEmail.trim(),
        location: location.trim(),
        autoSend,
        customSubject: emailSubject || undefined,
        customBody: emailBody || undefined,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setActiveStep(autoSend ? 4 : 3);

      setCurrentApp(res.application);
      setPdfUrl(res.pdfUrl || res.application.tailored_resume_pdf_url || null);
      setEmailSubject(res.emailDraft?.subject || res.application.email_subject || '');
      setEmailBody(res.emailDraft?.body || res.application.email_body || '');
      setCoverLetter(res.coverLetter || res.application.cover_letter || '');

      if (autoSend) {
        setStatusMessage({
          type: 'success',
          text: `Application email dispatched successfully to ${recipientEmail}! PDF resume attached.`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `ATS Resume & personalized draft generated! Review below before sending.`,
        });
      }

      await fetchRecent();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Custom application failed.',
      });
    } finally {
      setLoadingMode('idle');
    }
  };

  // Dispatch an existing tailored draft
  const handleDispatchExisting = async () => {
    if (!currentApp) return;

    try {
      setLoadingMode('dispatchingExisting');
      setStatusMessage(null);

      // Re-send with current subject and body
      const res = await AgentApi.customApply({
        title: currentApp.job?.title || jobTitle,
        company: currentApp.job?.company || company,
        description: currentApp.job?.description || description,
        recipientEmail: currentApp.job?.contact_email || recipientEmail,
        location: currentApp.job?.location || location,
        autoSend: true,
        customSubject: emailSubject,
        customBody: emailBody,
      });

      setCurrentApp(res.application);
      setStatusMessage({
        type: 'success',
        text: `Email dispatched successfully to ${recipientEmail}!`,
      });
      await fetchRecent();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to dispatch email.',
      });
    } finally {
      setLoadingMode('idle');
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                On-Demand Custom Apply
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Isolated Flow
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste any job description & recipient email to tailor an ATS PDF resume and dispatch directly via SMTP.
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600 font-medium">SMTP Live:</span>
            <span className="font-mono text-slate-900 font-semibold">talhasadiq320@gmail.com</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <span className="text-slate-600 font-medium">Profile:</span>
            <span className="text-slate-900 font-semibold">Talha Sadiq</span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 shadow-xs transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200'
              : 'bg-rose-50/90 text-rose-900 border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          )}
          <p className="text-sm font-medium flex-1">{statusMessage.text}</p>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Input Form vs. Output / Review Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" />
                Target Opportunity Details
              </h2>
              <button
                type="button"
                onClick={handleAutoExtract}
                disabled={loadingMode !== 'idle' || !description.trim()}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100/80 px-3 py-1.5 rounded-xl border border-brand-200/60 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingMode === 'extracting' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Auto-Detect from JD</span>
              </button>
            </div>

            {/* Recipient Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Recipient Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="e.g., jobs@acme.com or hiring.manager@techcorp.io"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-slate-50/50 hover:bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Direct email where the tailored resume PDF & application pitch will be sent.
              </p>
            </div>

            {/* Job Title & Company Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Job Title
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g., Senior React Native Developer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-slate-50/50 hover:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Company Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g., Acme Technologies"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-slate-50/50 hover:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Job Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Job Description / Posting Requirements <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {description.length} chars
                </span>
              </div>
              <textarea
                rows={9}
                placeholder="Paste the raw job description, requirements, responsibilities, or hiring email thread here..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-slate-50/30 hover:bg-white resize-y"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loadingMode !== 'idle'}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {loadingMode === 'autoSend' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing & Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span>⚡ Tailor & Send Immediately</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loadingMode !== 'idle'}
                className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-sm border border-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingMode === 'preview' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating Draft...</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 text-slate-500" />
                    <span>Preview & Review Draft</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Stepper or Review & Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Real-time Stepper when working */}
          {loadingMode !== 'idle' && loadingMode !== 'extracting' && (
            <div className="bg-white rounded-3xl border border-brand-200 p-6 md:p-8 shadow-sm space-y-6 animate-pulse">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-brand-600 animate-spin" />
                Autonomous Engine in Progress
              </h3>

              <div className="space-y-4">
                {[
                  { step: 1, label: 'Extracting key requirements & core keywords' },
                  { step: 2, label: 'Zero-hallucination ATS resume tailoring' },
                  { step: 3, label: 'Compiling executive PDF resume' },
                  { step: 4, label: 'Dispatching email with PDF attachment' },
                ].map((item) => {
                  const isDone = activeStep > item.step;
                  const isCurrent = activeStep === item.step;
                  return (
                    <div key={item.step} className="flex items-center gap-3">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : isCurrent
                            ? 'bg-brand-600 text-white animate-bounce'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : item.step}
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isCurrent
                            ? 'text-slate-900 font-bold'
                            : isDone
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results / Review Panel */}
          {currentApp ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      currentApp.status === 'APPLIED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    }`}
                  >
                    {currentApp.status === 'APPLIED' ? '✓ Dispatched & Applied' : 'Draft Ready for Review'}
                  </span>

                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-white bg-white/15 hover:bg-white/25 px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 border border-white/20"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </a>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-white truncate">
                    {currentApp.job?.title || jobTitle || 'Application'}
                  </h3>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <Building className="h-3 w-3" />
                    <span>{currentApp.job?.company || company || 'Hiring Team'}</span>
                    <span>•</span>
                    <Mail className="h-3 w-3" />
                    <span>{currentApp.job?.contact_email || recipientEmail}</span>
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/70 text-xs font-semibold px-4 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('email')}
                  className={`pb-2.5 px-3 border-b-2 transition-all ${
                    activeTab === 'email'
                      ? 'border-brand-600 text-brand-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Email Pitch
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cover_letter')}
                  className={`pb-2.5 px-3 border-b-2 transition-all ${
                    activeTab === 'cover_letter'
                      ? 'border-brand-600 text-brand-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cover Letter
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resume_preview')}
                  className={`pb-2.5 px-3 border-b-2 transition-all ${
                    activeTab === 'resume_preview'
                      ? 'border-brand-600 text-brand-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tailored Resume
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-5 flex-1 space-y-4">
                {activeTab === 'email' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Subject</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(emailSubject, 'subject')}
                          className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                        >
                          {copiedField === 'subject' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedField === 'subject' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Body</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(emailBody, 'body')}
                          className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                        >
                          {copiedField === 'body' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedField === 'body' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={10}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-slate-50"
                      />
                    </div>

                    {currentApp.status !== 'APPLIED' && (
                      <button
                        type="button"
                        onClick={handleDispatchExisting}
                        disabled={loadingMode !== 'idle'}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        {loadingMode === 'dispatchingExisting' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SendHorizontal className="h-4 w-4" />
                        )}
                        <span>🚀 Dispatch Application Email Now</span>
                      </button>
                    )}

                    {currentApp.status === 'APPLIED' && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Delivered via Nodemailer SMTP</span>
                        </div>
                        {currentApp.email_sent_at && (
                          <p className="text-[11px] text-emerald-700">
                            Sent at {new Date(currentApp.email_sent_at).toLocaleString()}
                          </p>
                        )}
                        {currentApp.email_message_id && (
                          <p className="text-[10px] font-mono text-emerald-600 truncate">
                            ID: {currentApp.email_message_id}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'cover_letter' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        AI-Generated Cover Letter
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(coverLetter, 'coverLetter')}
                        className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                      >
                        {copiedField === 'coverLetter' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedField === 'coverLetter' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                      {coverLetter || 'No cover letter generated.'}
                    </div>
                  </div>
                )}

                {activeTab === 'resume_preview' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Targeted ATS Resume Summary
                      </span>
                      {pdfUrl && (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-brand-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View Full PDF</span>
                        </a>
                      )}
                    </div>
                    {currentApp.tailored_resume_json ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3 max-h-[380px] overflow-y-auto">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {currentApp.tailored_resume_json.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {currentApp.tailored_resume_json.headline || 'Lead Mobile & AI Developer'}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                          <p className="font-bold text-slate-800 text-[11px] mb-1">Tailored ATS Summary:</p>
                          <p className="text-slate-600 text-xs leading-relaxed">
                            {currentApp.tailored_resume_json.summary}
                          </p>
                        </div>

                        {currentApp.tailored_resume_json.ordered_skills && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-bold text-slate-800 text-[11px] mb-1.5">Prioritized Skills:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {currentApp.tailored_resume_json.ordered_skills.slice(0, 10).map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px] font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No JSON resume data available.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Idle Placeholder */
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-sm space-y-6 text-center">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-600">
                <SendHorizontal className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Direct On-Demand Dispatch</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Enter a target job description and recipient email to generate a tailored ATS resume and email pitch.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Completely Isolated</p>
                    <p className="text-[11px] text-slate-500">Won&apos;t be queued or touched by the background autonomous loop.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Dynamic ATS Optimization</p>
                    <p className="text-[11px] text-slate-500">Zero-hallucination tailoring based on Talha Sadiq&apos;s master profile.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Direct SMTP Delivery</p>
                    <p className="text-[11px] text-slate-500">PDF attached automatically with a BCC confirmation copy to your inbox.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent On-Demand Dispatches Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-600" />
              Recent On-Demand Applications
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              History of manually tailored applications dispatched from this workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRecent}
            disabled={loadingHistory}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {recentApplications.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <FileText className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No on-demand applications sent yet</p>
            <p className="text-xs text-slate-400">Fill in the form above to craft and dispatch your first custom application.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/60 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">Role & Company</th>
                  <th className="pb-3">Recipient Email</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Sent / Created</th>
                  <th className="pb-3 pr-2 text-right">PDF Resume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="font-bold text-slate-900">
                        {app.job?.title || 'Software Engineer'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {app.job?.company || 'Hiring Team'}
                      </div>
                    </td>
                    <td className="py-3.5 font-mono text-slate-700">
                      {app.job?.contact_email || '—'}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          app.status === 'APPLIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {app.status === 'APPLIED' ? '✓ Applied' : app.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-500">
                      {app.email_sent_at
                        ? new Date(app.email_sent_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : app.created_at
                        ? new Date(app.created_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      {app.tailored_resume_pdf_url ? (
                        <a
                          href={app.tailored_resume_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100/80 px-2.5 py-1 rounded-lg border border-brand-200/60 transition-all"
                        >
                          <Download className="h-3 w-3" />
                          <span>PDF</span>
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
