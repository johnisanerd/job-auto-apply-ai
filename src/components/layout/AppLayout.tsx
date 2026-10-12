'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Briefcase, 
  Target, 
  MapPin, 
  Send, 
  Settings, 
  Bot, 
  Menu, 
  Bell, 
  Plus, 
  Search, 
  FileText, 
  Globe,
  Building2
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/lib/store';

const sidebarSections = [
  {
    title: 'Dashboard',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Jobs',
    items: [
      { name: 'All Jobs', href: '/jobs', icon: Briefcase },
    ]
  },
  {
    title: 'Job Discovery',
    items: [
      { name: 'Business Leads Scraper', href: '/business-leads', icon: Building2 },
      { name: 'Manual Auto-Scout', href: '/auto-scout', icon: Globe },
      { name: 'Auto-Pilot (Cron Jobs)', href: '/auto-scout/dashboard', icon: Target },
      { name: 'Contract & Flexible Jobs', href: '/jobs/flexible', icon: Briefcase },
      { name: 'Job Search', href: '/jobs/search', icon: Search },
      { name: 'IT / Freelance Leads', href: '/jobs/freelance', icon: Target },
      { name: 'Ahmedabad Jobs', href: '/jobs/ahmedabad', icon: MapPin },
    ]
  },
  {
    title: 'Tools',
    items: [
      { name: 'Import Jobs', href: '/jobs/import', icon: Plus },
      { name: 'Resume', href: '/resume', icon: FileText },
    ]
  },
  {
    title: 'Settings',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ]
  }
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { signature } = useAppStore();

  const initials = signature?.fullName 
    ? signature.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
    : 'YS';

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-sm">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-gray-900" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Bot size={20} />
          </div>
          <span>Auto-Apply AI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 px-4 py-6 overflow-y-auto custom-scrollbar">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}`));
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon size={18} className={cn(isActive ? 'text-blue-700' : 'text-gray-400')} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="shrink-0 border-t border-gray-100 p-4 bg-gray-50/50">
        <Link href="/settings" className="flex items-center gap-3 hover:bg-gray-100 p-2 rounded-lg transition-colors cursor-pointer" onClick={onClose}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 font-semibold text-blue-700 border border-blue-200 shadow-sm">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {signature?.fullName || 'User Profile'}
            </span>
            <span className="text-xs text-gray-500 truncate">
              {signature?.phone || 'Configure Settings'}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { signature } = useAppStore();
  const initials = signature?.fullName 
    ? signature.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
    : 'YS';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:hidden shadow-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </button>
        <span className="font-bold text-lg tracking-tight text-gray-900">Auto-Apply AI</span>
      </div>
      
      <div className="flex items-center gap-3">
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 text-sm shadow-sm border border-blue-200">
          {initials}
        </div>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden font-sans">
      {/* Mobile Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop and Mobile */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full h-full relative">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
