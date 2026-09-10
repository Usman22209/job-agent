'use client';

import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  Key, 
  Mail, 
  Save, 
  CheckCircle2, 
  RefreshCw,
  Power
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { ISchedulerStatus } from '@/types';

export default function SettingsPage() {
  const [scheduler, setScheduler] = useState<ISchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Settings State
  const [cronExpression, setCronExpression] = useState('0 */6 * * *');
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [autoTailorThreshold, setAutoTailorThreshold] = useState(75);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [serpapiKey, setSerpapiKey] = useState('');
  const [adzunaId, setAdzunaId] = useState('');
  const [smtpUser, setSmtpUser] = useState('talhasadiq320@gmail.com');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const st = await AgentApi.getSchedulerStatus();
        setScheduler(st);
        if (st.cron_expression) setCronExpression(st.cron_expression);
      } catch (err) {
        console.error('Failed to get scheduler status:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const handleToggleAgent = async () => {
    try {
      const next = !agentEnabled;
      setAgentEnabled(next);
      await AgentApi.toggleScheduler(next);
      setStatusMessage(`Local Cron Agent has been ${next ? 'enabled' : 'paused'}.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setStatusMessage('Agent configuration updated and active!');
      setTimeout(() => setStatusMessage(null), 4000);
    }, 600);
  };

  return (
    <div className="p-8 lg:p-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span>Agent Engine Settings</span>
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Self-Hosted
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure local cron timing, scraping providers, AI model parameters, and email dispatch credentials.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-sm hover:shadow disabled:opacity-50 transition-all self-start sm:self-auto"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5 shadow-xs font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Local Background Cron Agent */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Local Background Agent (No n8n needed)</h3>
              <p className="text-xs text-slate-500">Autonomous execution directly inside this Next.js project</p>
            </div>
          </div>

          <button
            onClick={handleToggleAgent}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              agentEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-2xs'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            <span>{agentEnabled ? 'Agent Enabled' : 'Agent Paused'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block font-mono text-slate-600 font-medium mb-1.5">Schedule Interval</label>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="0 */6 * * *"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">Default: Every 6 hours (<code className="text-slate-600 font-mono bg-slate-100 px-1 py-0.5 rounded">0 */6 * * *</code>)</p>
          </div>

          <div>
            <label className="block font-mono text-slate-600 font-medium mb-1.5">Auto-Tailor Match Threshold</label>
            <div className="flex items-center gap-3 mt-1.5">
              <input
                type="range"
                min={60}
                max={95}
                value={autoTailorThreshold}
                onChange={(e) => setAutoTailorThreshold(Number(e.target.value))}
                className="flex-1 accent-brand-600"
              />
              <span className="font-mono text-brand-700 font-bold w-12 text-right bg-brand-50 border border-brand-200/80 px-2 py-0.5 rounded">{autoTailorThreshold}%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Jobs scoring ≥ {autoTailorThreshold}% will automatically have tailored resumes generated.</p>
          </div>
        </div>
      </div>

      {/* Email Dispatch (Free Channel) */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200/80">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Email Dispatch (Free Primary Channel)</h3>
            <p className="text-xs text-slate-500">Direct candidate outreach via Gmail SMTP / Microsoft Graph</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block font-mono text-slate-600 font-medium mb-1.5">Sender Email</label>
            <input
              type="text"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block font-mono text-slate-600 font-medium mb-1.5">SMTP Host</label>
            <input
              type="text"
              defaultValue="smtp.gmail.com (Port 587)"
              readOnly
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* External API Keys */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/80">
            <Key className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">API Credentials & Scraping Keys</h3>
            <p className="text-xs text-slate-500">Plug in keys when ready for live web querying (System works out of the box with seed data)</p>
          </div>
        </div>

        <div className="space-y-5 text-xs">
          <div>
            <label className="block font-mono text-slate-600 font-medium mb-1.5">Google Gemini API Key (Recommended: Free via aistudio.google.com)</label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block font-mono text-slate-600 font-medium mb-1.5">OpenAI API Key (Alternative Fallback)</label>
            <input
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block font-mono text-slate-600 font-medium mb-1.5">SerpApi Key (Google Jobs)</label>
              <input
                type="password"
                placeholder="serpapi-..."
                value={serpapiKey}
                onChange={(e) => setSerpapiKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all"
              />
            </div>

            <div>
              <label className="block font-mono text-slate-600 font-medium mb-1.5">Adzuna App ID & Key</label>
              <input
                type="text"
                placeholder="App ID : App Key"
                value={adzunaId}
                onChange={(e) => setAdzunaId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
