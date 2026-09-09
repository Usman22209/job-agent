'use client';

import React, { useEffect, useState } from 'react';
import { 
  Send, 
  Building, 
  Mail, 
  Globe, 
  Download, 
  ShieldAlert,
  X
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { IApplication, ApplicationStatus } from '@/types';

const STAGES: { id: ApplicationStatus; label: string; badge: string }[] = [
  { id: 'MATCHED', label: 'Matched Opportunities', badge: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { id: 'READY', label: 'Tailored & Ready', badge: 'text-purple-700 bg-purple-50 border-purple-200' },
  { id: 'APPLIED', label: 'Applied', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { id: 'INTERVIEW', label: 'Interviews Scheduled', badge: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'OFFER', label: 'Offers Received', badge: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<IApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<IApplication | null>(null);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover_letter' | 'email' | 'form_review'>('resume');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [inspectingForm, setInspectingForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      const data = await AgentApi.getApplications();
      setApplications(data);
      if (selectedApp) {
        const refreshed = data.find((a) => a.id === selectedApp.id);
        if (refreshed) setSelectedApp(refreshed);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleSendEmail = async (appId: string) => {
    try {
      setSendingEmail(true);
      const res = await AgentApi.sendEmailApplication(appId);
      setStatusMessage(`Email application sent to ${res.recipient}! (Mode: ${res.mode})`);
      await fetchApplications();
    } catch (err: any) {
      setStatusMessage(`Email send error: ${err.message}`);
    } finally {
      setSendingEmail(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleInspectForm = async (targetUrl: string) => {
    try {
      setInspectingForm(true);
      const task = await AgentApi.inspectForm(targetUrl);
      setStatusMessage(`Form inspected: Found ${task.form_fields?.length || 0} fields. ${task.flagged_questions?.length || 0} sensitive questions flagged for human review.`);
      await fetchApplications();
      setActiveTab('form_review');
    } catch (err: any) {
      setStatusMessage(`Inspection error: ${err.message}`);
    } finally {
      setInspectingForm(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleUpdateStatus = async (appId: string, newStatus: ApplicationStatus) => {
    try {
      await AgentApi.updateApplicationStatus(appId, newStatus);
      await fetchApplications();
      setStatusMessage(`Application moved to ${newStatus}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="p-8 lg:p-10 max-w-full mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span>Autonomous Application Pipeline</span>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              {applications.length} Active Candidates
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track opportunities from AI match to tailored resume generation, direct email outreach, and interview milestones.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-900 text-xs flex items-center justify-between shadow-xs font-medium">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="hover:underline text-brand-700 font-semibold">Close</button>
        </div>
      )}

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
        {STAGES.map((stage) => {
          const stageApps = applications.filter((app) => app.status === stage.id);

          return (
            <div key={stage.id} className="bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4 space-y-3 min-h-[600px] flex flex-col">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className={`text-[11px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${stage.badge}`}>
                  {stage.label}
                </span>
                <span className="text-xs font-mono font-semibold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 shadow-2xs">
                  {stageApps.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {stageApps.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    No opportunities in this stage
                  </div>
                ) : (
                  stageApps.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className={`p-4 rounded-xl border bg-white cursor-pointer transition-all hover:scale-[1.01] space-y-2.5 shadow-xs hover:shadow-sm ${
                        selectedApp?.id === app.id
                          ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                          : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 hover:text-brand-600 transition-colors">
                          {app.job?.title}
                        </h4>
                        {app.match && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200/80 font-bold flex-shrink-0">
                            {app.match.score}%
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                        <Building className="h-3 w-3 text-slate-400" />
                        <span>{app.job?.company}</span>
                      </p>

                      <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 border-t border-slate-100">
                        <span className="flex items-center gap-1 font-mono">
                          {app.application_channel === 'EMAIL' ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <Mail className="h-3 w-3 text-emerald-600" /> Email
                            </span>
                          ) : (
                            <span className="text-indigo-700 font-medium flex items-center gap-1">
                              <Globe className="h-3 w-3 text-indigo-600" /> Web ATS
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400">
                          {new Date(app.updated_at || app.created_at || '').toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-in Detail Drawer */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col p-6 lg:p-8 space-y-6 overflow-y-auto shadow-2xl text-slate-900">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200 font-semibold">
                    {selectedApp.status}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">ID: {selectedApp.id?.slice(0, 8)}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1.5">
                  {selectedApp.job?.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedApp.job?.company} • {selectedApp.job?.location}
                </p>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Action Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Application Dispatch Channel</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedApp.job?.contact_email ? `Target Email: ${selectedApp.job.contact_email}` : `Target URL: ${selectedApp.job?.application_url || selectedApp.job?.url}`}
                  </p>
                </div>

                {selectedApp.job?.contact_email ? (
                  <button
                    onClick={() => handleSendEmail(selectedApp.id)}
                    disabled={sendingEmail || selectedApp.status === 'APPLIED'}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition-all"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{sendingEmail ? 'Sending...' : selectedApp.status === 'APPLIED' ? 'Email Sent' : 'Send Email Application'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleInspectForm(selectedApp.job?.application_url || selectedApp.job?.url || '')}
                    disabled={inspectingForm}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition-all"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>{inspectingForm ? 'Inspecting...' : 'Inspect Web Form'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                <span className="text-[11px] text-slate-500 uppercase font-mono font-medium">Move stage:</span>
                {(['READY', 'APPLIED', 'INTERVIEW', 'OFFER'] as ApplicationStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedApp.id, st)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      selectedApp.status === st
                        ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200">
              {[
                { id: 'resume', label: 'Tailored Resume' },
                { id: 'cover_letter', label: 'Cover Letter' },
                { id: 'email', label: 'Email Outreach' },
                { id: 'form_review', label: 'Form Inspector' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Resume */}
            {activeTab === 'resume' && (
              <div className="space-y-4">
                {selectedApp.tailored_resume_pdf_url && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-50 border border-brand-200 text-xs">
                    <span className="text-brand-800 font-semibold">ATS-Compliant PDF Resume Generated</span>
                    <a
                      href={selectedApp.tailored_resume_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </a>
                  </div>
                )}

                {selectedApp.tailored_resume_json ? (
                  <div className="space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-700 uppercase font-mono text-[11px] mb-1.5">Tailored Professional Summary</h4>
                      <p className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed font-sans">
                        {selectedApp.tailored_resume_json.summary}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-700 uppercase font-mono text-[11px] mb-1.5">Prioritized Skills for Job</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedApp.tailored_resume_json.ordered_skills.map((s, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-700 uppercase font-mono text-[11px] mb-1.5">Tailored Experience Bullets</h4>
                      <div className="space-y-3">
                        {selectedApp.tailored_resume_json.experience.map((exp, i) => (
                          <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                            <p className="font-bold text-slate-900">{exp.position} — {exp.company}</p>
                            <ul className="list-disc list-inside space-y-1.5 text-slate-600 leading-relaxed">
                              {exp.bullet_points.map((b, bi) => (
                                <li key={bi}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-xs text-slate-400">
                    Resume tailoring not yet executed for this opportunity.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Cover Letter */}
            {activeTab === 'cover_letter' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 font-mono uppercase">Personalized Cover Letter</h4>
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans shadow-2xs">
                  {selectedApp.cover_letter || 'Cover letter not generated.'}
                </div>
              </div>
            )}

            {/* Tab 3: Email Outreach */}
            {activeTab === 'email' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-600 mb-1">Recipient</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedApp.job?.contact_email || 'No direct email detected (Check website form)'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-600 mb-1">Subject</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedApp.email_subject || `Application for ${selectedApp.job?.title} — Usman Shafiq`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-600 mb-1">Message Body</label>
                  <textarea
                    rows={8}
                    readOnly
                    value={selectedApp.email_body || ''}
                    className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed font-sans"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Form Review */}
            {activeTab === 'form_review' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <span>Human-in-the-Loop Safeguard</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Browser automation will never auto-submit sensitive questions (work sponsorship, clearance, salary demands) without your explicit approval.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs font-mono uppercase">Detected Compliance Questions</h4>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <p className="font-semibold text-slate-800">Will you now or in the future require visa sponsorship?</p>
                    <p className="text-[11px] text-slate-500">Proposed QA answer: <strong className="text-brand-700 font-semibold">Will require visa sponsorship / open to B2B remote contract</strong></p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <p className="font-semibold text-slate-800">Are you legally authorized to work in this position?</p>
                    <p className="text-[11px] text-slate-500">Proposed QA answer: <strong className="text-brand-700 font-semibold">Yes, authorized for international remote contract work</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
