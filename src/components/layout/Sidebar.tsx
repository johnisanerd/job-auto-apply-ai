'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Briefcase, Send, Settings, Bot, Target, MapPin, Building2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Resume', href: '/resume', icon: FileText },
  { name: 'Business Leads', href: '/business-leads', icon: Building2 },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'IT / Freelance Leads', href: '/jobs/freelance', icon: Target },
  { name: 'Ahmedabad Jobs', href: '/jobs/ahmedabad', icon: MapPin },
  { name: 'Applications', href: '/applications', icon: Send },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bot size={20} />
          </div>
          <span>Job Auto Apply AI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon size={18} className={cn(isActive ? 'text-blue-700' : 'text-gray-500')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Placeholder */}
      <div className="shrink-0 border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
            YS
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">Yashvi Shah</span>
            <span className="text-xs text-gray-500">yashvi@example.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
