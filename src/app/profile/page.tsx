'use client';

import React, { useEffect, useState, useRef } from 'react';
import { 
  UserCheck, 
  Code, 
  HelpCircle, 
  Save, 
  CheckCircle2, 
  RefreshCw,
  Upload,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Briefcase,
  GraduationCap,
  FolderGit2
} from 'lucide-react';
import { AgentApi } from '@/lib/api-client';
import { IMasterProfile, ISkill, IExperience, IProject, IEducation } from '@/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<IMasterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await AgentApi.getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setStatusMessage('Analyzing resume and extracting profile with Gemini AI...');

      const formData = new FormData();
      formData.append('resume', file);

      const res = await AgentApi.uploadResume(formData);
      if (res.profile) {
        setProfile(res.profile);
        setStatusMessage(`Successfully extracted profile from "${file.name}" with Gemini AI! You can review and edit below.`);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setStatusMessage(`Upload / extraction failed: ${err.message}`);
    } finally {
      setUploading(false);
      setTimeout(() => setStatusMessage(null), 8000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      await AgentApi.updateProfile(profile);
      setStatusMessage('Master Profile updated successfully!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Skill Handlers
  const handleAddSkill = () => {
    if (!profile || !newSkillName.trim()) return;
    const exists = profile.skills.some((s) => s.name.toLowerCase() === newSkillName.trim().toLowerCase());
    if (exists) return;

    setProfile({
      ...profile,
      skills: [...profile.skills, { name: newSkillName.trim(), level: 'Expert' }],
    });
    setNewSkillName('');
  };

  const handleRemoveSkill = (index: number) => {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: profile.skills.filter((_, i) => i !== index),
    });
  };

  // Experience Handlers
  const handleAddExperience = () => {
    if (!profile) return;
    const newExp: IExperience = {
      company: 'New Company',
      position: 'Role Title',
      start_date: '2023',
      end_date: 'Present',
      current: true,
      description: '',
      bullet_points: ['Key responsibility or impact statement'],
    };
    setProfile({ ...profile, experience: [newExp, ...profile.experience] });
  };

  const handleRemoveExperience = (index: number) => {
    if (!profile) return;
    setProfile({
      ...profile,
      experience: profile.experience.filter((_, i) => i !== index),
    });
  };

  if (loading || !profile) {
    return (
      <div className="p-8 text-center text-slate-500 py-32 flex flex-col items-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
        <span>Loading Master Candidate Profile...</span>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Master Candidate Profile
            </h1>
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Zero Hallucination Ground Truth
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Upload your resume or edit your profile below. All AI-tailored applications are strictly grounded in this data.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-xs hover:shadow disabled:opacity-50 transition-all self-start sm:self-auto cursor-pointer"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs font-medium animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="hover:underline text-emerald-700 font-semibold ml-2">Dismiss</button>
        </div>
      )}

      {/* Upload Master Resume Dropzone Card */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`glass-panel rounded-2xl p-7 text-center transition-all border-2 border-dashed ${
          dragActive 
            ? 'border-brand-500 bg-brand-50/50' 
            : 'border-slate-300 hover:border-brand-400 bg-white'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto border border-brand-200/80 shadow-2xs">
            {uploading ? (
              <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
            ) : (
              <Upload className="h-6 w-6 text-brand-600" />
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
              <span>Upload Master Resume</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 font-semibold">
                <Sparkles className="h-2.5 w-2.5" />
                Gemini AI Parser
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Drag & drop your PDF, Word, or TXT resume here, or click to browse.
            </p>
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {uploading ? 'Extracting with Gemini AI...' : 'Select Resume File'}
          </button>

          {profile.master_resume_url && (
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-600 font-medium">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span>Active Resume: <strong>{profile.master_resume_filename || 'Uploaded Resume'}</strong></span>
              <a
                href={profile.master_resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline flex items-center gap-0.5 font-bold"
              >
                <span>View</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Section 1: Basic Information */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-5 bg-white border border-slate-200">
        <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-brand-600" />
          <span>Contact Info & Professional Headline</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium text-xs mb-1.5">Full Name</label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium text-xs mb-1.5">Primary Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium text-xs mb-1.5">Phone Number</label>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium text-xs mb-1.5">Location</label>
            <input
              type="text"
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all text-xs font-medium"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-600 font-medium text-xs mb-1.5">Professional Headline</label>
            <input
              type="text"
              value={profile.headline}
              onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs transition-all text-xs font-medium"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-600 font-medium text-xs mb-1.5">Executive Summary</label>
            <textarea
              rows={3}
              value={profile.summary}
              onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
              className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 shadow-xs leading-relaxed font-sans text-xs transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Technical Skills */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-5 bg-white border border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <Code className="h-4 w-4 text-emerald-600" />
            <span>Skills Inventory ({profile.skills.length})</span>
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add skill..."
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={handleAddSkill}
              className="p-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-2xs"
              title="Add Skill"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {profile.skills.map((skill, i) => (
            <div 
              key={i} 
              className="pl-3 pr-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-2 text-xs hover:bg-slate-100/80 transition-colors shadow-2xs"
            >
              <span className="font-semibold text-slate-800">{skill.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 font-medium">
                {skill.level || 'Expert'}
              </span>
              <button
                onClick={() => handleRemoveSkill(i)}
                className="text-slate-400 hover:text-rose-500 ml-1"
                title="Remove skill"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Work Experience */}
      <div className="glass-panel rounded-2xl p-6 lg:p-7 space-y-5 bg-white border border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            <span>Work Experience ({profile.experience?.length || 0})</span>
          </h3>
          <button
            onClick={handleAddExperience}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Role</span>
          </button>
        </div>

        <div className="space-y-4">
          {(profile.experience || []).map((exp, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                  <input
                    type="text"
                    value={exp.company}
                    placeholder="Company"
                    onChange={(e) => {
                      const list = [...profile.experience];
                      list[idx].company = e.target.value;
                      setProfile({ ...profile, experience: list });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900"
                  />
                  <input
                    type="text"
                    value={exp.position}
                    placeholder="Job Title"
                    onChange={(e) => {
                      const list = [...profile.experience];
                      list[idx].position = e.target.value;
                      setProfile({ ...profile, experience: list });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-brand-700"
                  />
                  <input
                    type="text"
                    value={`${exp.start_date} - ${exp.end_date}`}
                    placeholder="Start - End Date"
                    onChange={(e) => {
                      const list = [...profile.experience];
                      const parts = e.target.value.split('-');
                      list[idx].start_date = parts[0]?.trim() || '';
                      list[idx].end_date = parts[1]?.trim() || '';
                      setProfile({ ...profile, experience: list });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600"
                  />
                </div>

                <button
                  onClick={() => handleRemoveExperience(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  title="Remove Experience"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Bullet Points */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">Key Achievements / Bullets:</label>
                {(exp.bullet_points || []).map((bullet, bIdx) => (
                  <input
                    key={bIdx}
                    type="text"
                    value={bullet}
                    onChange={(e) => {
                      const list = [...profile.experience];
                      list[idx].bullet_points[bIdx] = e.target.value;
                      setProfile({ ...profile, experience: list });
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-sans"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Projects & Education Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Projects */}
        <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-indigo-600" />
            <span>Featured Projects ({profile.projects?.length || 0})</span>
          </h3>

          <div className="space-y-3">
            {(profile.projects || []).map((proj, pIdx) => (
              <div key={pIdx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <input
                  type="text"
                  value={proj.title}
                  placeholder="Project Name"
                  onChange={(e) => {
                    const list = [...profile.projects];
                    list[pIdx].title = e.target.value;
                    setProfile({ ...profile, projects: list });
                  }}
                  className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900"
                />
                <textarea
                  rows={2}
                  value={proj.description}
                  placeholder="Description"
                  onChange={(e) => {
                    const list = [...profile.projects];
                    list[pIdx].description = e.target.value;
                    setProfile({ ...profile, projects: list });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Education */}
        <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-teal-600" />
            <span>Education</span>
          </h3>

          <div className="space-y-3">
            {(profile.education || []).map((edu, eIdx) => (
              <div key={eIdx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <input
                  type="text"
                  value={edu.degree}
                  placeholder="Degree"
                  onChange={(e) => {
                    const list = [...profile.education];
                    list[eIdx].degree = e.target.value;
                    setProfile({ ...profile, education: list });
                  }}
                  className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={edu.institution}
                    placeholder="Institution"
                    onChange={(e) => {
                      const list = [...profile.education];
                      list[eIdx].institution = e.target.value;
                      setProfile({ ...profile, education: list });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700"
                  />
                  <input
                    type="text"
                    value={edu.graduation_year}
                    placeholder="Year"
                    onChange={(e) => {
                      const list = [...profile.education];
                      list[eIdx].graduation_year = e.target.value;
                      setProfile({ ...profile, education: list });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
