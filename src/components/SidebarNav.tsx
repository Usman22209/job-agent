'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, 
  GitPullRequest, 
  Layers, 
  UserCheck, 
  Settings,
  SendHorizontal 
} from 'lucide-react';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Overview & Analytics',
    icon: Activity,
  },
  {
    href: '/custom-apply',
    label: 'On-Demand Apply',
    icon: SendHorizontal,
    badge: 'Custom',
  },
  {
    href: '/jobs',
    label: 'Queue Board',
    icon: GitPullRequest,
  },
  {
    href: '/applications',
    label: 'Application Pipeline',
    icon: Layers,
  },
  {
    href: '/profile',
    label: 'Master Resume & QA',
    icon: UserCheck,
  },
  {
    href: '/settings',
    label: 'Agent Settings',
    icon: Settings,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === '/' 
          ? pathname === '/' 
          : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
              isActive
                ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200/60 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Icon
              className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
