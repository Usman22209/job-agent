import type { Metadata } from "next";
import "./globals.css";
import { Bot } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";

export const metadata: Metadata = {
  title: "JobAgent AI Pro | Unified Autonomous Career Agent",
  description: "Job discovery, zero-hallucination resume tailoring, and multi-channel applications in a unified Next.js platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden antialiased selection:bg-brand-500 selection:text-white bg-slate-50 text-slate-900">
        {/* Modern Clean Sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  JobAgent <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 font-semibold">AI Pro</span>
                </h1>
                <p className="text-xs text-slate-500">Autonomous Career OS</p>
              </div>
            </div>

            {/* Local Agent Status Widget */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Auto-Scraper
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Live</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Continuously scrapes live platforms every 2 minutes.
              </p>
            </div>

            {/* Navigation */}
            <SidebarNav />
          </div>

          {/* Candidate Badge */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                US
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">Usman Shafiq</p>
                <p className="text-[11px] text-slate-500 truncate">Lead Mobile & AI Eng</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50/60">
          {children}
        </main>
      </body>
    </html>
  );
}
