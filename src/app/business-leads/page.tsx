'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Target, 
  Search, 
  Play, 
  Download, 
  RefreshCw, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Trash2, 
  Send, 
  Filter, 
  ChevronRight,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { BusinessLead } from '@/types';
import { useAppStore } from '@/lib/store';

export default function BusinessLeadsPage() {
  const { signature, resume, websites } = useAppStore();
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Scraper controls
  const [selectedRole, setSelectedRole] = useState('Full Stack Developer');
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [locationInput, setLocationInput] = useState('Ahmedabad');
  const [minScoreThreshold, setMinScoreThreshold] = useState(4);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'buyers' | 'providers' | 'emails_only'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium'>('all');

  // Email outreach state
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailNotification, setEmailNotification] = useState<string | null>(null);

  // Default target roles from resume
  const targetRoles = [
    'Full Stack Developer',
    'Php Developer',
    'Laravel developer',
    'Angular Developer',
    'Mern Stack Developer',
    'Freelancer',
    'Web Developer'
  ];

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/business-leads');
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
      }
    } catch (err: any) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const runScraper = async () => {
    setScraping(true);
    const activeRole = customRoleInput.trim() || selectedRole;
    setStatusMsg(`Searching & crawling for "${activeRole}" in ${locationInput}...`);
    
    try {
      const res = await fetch('/api/business-leads/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: [activeRole],
          location: locationInput,
          minScore: minScoreThreshold,
          maxPerQuery: 5,
          autoSave: true
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`Scan complete! Found ${data.found || 0} valid leads (Score ≥ ${minScoreThreshold}).`);
        fetchLeads();
      } else {
        setStatusMsg(`Scan error: ${data.error || 'Failed to complete scrape'}`);
      }
    } catch (err: any) {
      setStatusMsg(`Scraper error: ${err.message}`);
    } finally {
      setScraping(false);
      setTimeout(() => setStatusMsg(''), 6000);
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const res = await fetch(`/api/business-leads?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };

  const sendOutreachEmail = async (lead: BusinessLead) => {
    if (!lead.email || lead.email === 'N/A') {
      alert('This lead does not have a public email address.');
      return;
    }

    const primaryEmail = lead.email.split(',')[0].trim();
    setSendingEmailId(lead.id);

    try {
      // 1. Generate Cover Letter via existing API
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDetails: {
            title: lead.searchQuery || 'Software Development Services',
            company: lead.companyName,
            requirements: `IT & Web Engineering collaboration for ${lead.companyName}. Located in ${lead.address || 'Ahmedabad'}.`
          },
          signature,
          resumeBase64: resume?.base64Data,
          websites,
          jobType: 'freelance'
        })
      });

      if (!genRes.ok) throw new Error('Failed to generate customized email message');
      const genData = await genRes.json();

      // 2. Dispatch via SMTP
      const sendRes = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: primaryEmail,
          subject: genData.subject,
          body: genData.body,
          resumeBase64: resume?.base64Data,
          resumeName: resume?.name
        })
      });

      if (!sendRes.ok) throw new Error('SMTP Dispatch failed');

      // 3. Update Status
      await fetch('/api/business-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lead,
          status: 'email_sent',
          emailStatus: 'SENT'
        })
      });

      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'email_sent', emailStatus: 'SENT' } : l));
      setEmailNotification(`Email successfully sent to ${lead.companyName} (${primaryEmail})!`);
      setTimeout(() => setEmailNotification(null), 5000);

    } catch (err: any) {
      alert(`Error sending outreach: ${err.message}`);
    } finally {
      setSendingEmailId(null);
    }
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;
    
    const headers = [
      'Company Name', 'Website URL', 'Email', 'Mobile Number', 
      'Address', 'Search Query', 'Intent', 'Lead Type', 'Lead Score', 
      'Status', 'Scraped Date'
    ];

    const rows = leads.map(l => [
      `"${l.companyName.replace(/"/g, '""')}"`,
      `"${l.websiteUrl}"`,
      `"${l.email}"`,
      `"${l.mobileNumber}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${(l.searchQuery || '').replace(/"/g, '""')}"`,
      `"${l.intent}"`,
      `"${l.leadType}"`,
      l.leadScore,
      `"${l.status}"`,
      `"${l.scrapedDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `business_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Leads Calculation
  const filteredLeads = leads.filter(l => {
    // Tab filter
    if (activeTab === 'buyers' && l.leadType !== 'Potential Buyer') return false;
    if (activeTab === 'providers' && l.leadType !== 'IT Service Provider') return false;
    if (activeTab === 'emails_only' && (!l.email || l.email === 'N/A')) return false;

    // Search query filter
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchName = l.companyName.toLowerCase().includes(q);
      const matchEmail = l.email.toLowerCase().includes(q);
      const matchPhone = l.mobileNumber.toLowerCase().includes(q);
      const matchAddress = (l.address || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchAddress) return false;
    }

    // Score filter
    if (scoreFilter === 'high' && l.leadScore < 6) return false;
    if (scoreFilter === 'medium' && (l.leadScore < 3 || l.leadScore >= 6)) return false;

    return true;
  });

  // Analytics counters
  const totalBuyers = leads.filter(l => l.leadType === 'Potential Buyer').length;
  const totalProviders = leads.filter(l => l.leadType === 'IT Service Provider').length;
  const totalWithEmails = leads.filter(l => l.email && l.email !== 'N/A').length;
  const totalWithPhones = leads.filter(l => l.mobileNumber && l.mobileNumber !== 'N/A').length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Business Lead Collector
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            High-Accuracy IT & Software Business Lead Discovery. Distinguishes Potential Buyers from Service Providers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            disabled={leads.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {emailNotification && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{emailNotification}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{leads.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Saved Leads</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700">{totalBuyers}</div>
            <div className="text-xs text-emerald-600 font-medium">🎯 Potential Buyers</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-700">{totalWithEmails}</div>
            <div className="text-xs text-indigo-600 font-medium">Public Emails Found</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">{totalWithPhones}</div>
            <div className="text-xs text-amber-600 font-medium">Indian Phone / Landlines</div>
          </div>
        </div>
      </div>

      {/* Live Scraper Launcher Panel */}
      <div className="bg-gradient-to-br from-white to-blue-50/40 p-6 rounded-2xl border border-blue-200/70 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Run High-Accuracy Live Scraper</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
            100% Vercel & Node.js Native
          </span>
        </div>

        {/* Roles Pill Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Target Role (From Resume / Preferences)
          </label>
          <div className="flex flex-wrap gap-2">
            {targetRoles.map(role => (
              <button
                key={role}
                onClick={() => {
                  setSelectedRole(role);
                  setCustomRoleInput('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  selectedRole === role && !customRoleInput
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Scraper Inputs & Action Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          <div className="md:col-span-5">
            <label className="block text-xs text-slate-500 mb-1">Custom Role / Service Keyword (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Next.js Developer, Mobile App Agency..."
              value={customRoleInput}
              onChange={e => setCustomRoleInput(e.target.value)}
              className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs text-slate-500 mb-1">Target Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Location (e.g. Ahmedabad)"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              onClick={runScraper}
              disabled={scraping}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-600/20 transition-all"
            >
              {scraping ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Scanning Web...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Start Scraper</span>
                </>
              )}
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium">
            {statusMsg}
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('buyers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'buyers' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🎯 Potential Buyers ({totalBuyers})
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'providers' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🏢 IT Service Providers ({totalProviders})
          </button>
          <button
            onClick={() => setActiveTab('emails_only')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'emails_only' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ✉ Verified Email ({totalWithEmails})
          </button>
        </div>

        {/* Search & Score filter */}
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-60">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={scoreFilter}
            onChange={(e: any) => setScoreFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="all">All Scores</option>
            <option value="high">High Score (6+)</option>
            <option value="medium">Medium Score (3-5)</option>
          </select>
        </div>
      </div>

      {/* Leads List / Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading business leads...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center">
          <Building2 className="h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-800">No leads found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Try adjusting your search criteria, click "Start Scraper" above, or clear your active filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => {
            const hasEmail = lead.email && lead.email !== 'N/A';
            const hasPhone = lead.mobileNumber && lead.mobileNumber !== 'N/A';
            const cleanPhone = lead.mobileNumber ? lead.mobileNumber.replace(/[^0-9]/g, '') : '';
            const isEmailSent = lead.status === 'email_sent';

            return (
              <div 
                key={lead.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 line-clamp-1">
                        {lead.companyName}
                      </h3>
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5 line-clamp-1"
                      >
                        <span>{lead.domain || lead.websiteUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>

                    {/* Score Badge */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        lead.leadScore >= 6 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : lead.leadScore >= 3 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        Score: {lead.leadScore}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Intent: {lead.intent}
                      </span>
                    </div>
                  </div>

                  {/* Lead Type Badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      lead.leadType === 'Potential Buyer'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : lead.leadType === 'IT Service Provider'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      {lead.leadType === 'Potential Buyer' ? '🎯 Potential Buyer (Client)' : '🏢 IT Service Provider'}
                    </span>
                  </div>

                  {/* Contact Info Block */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">
                        {hasEmail ? lead.email : <span className="text-slate-400 italic">No email detected</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">
                        {hasPhone ? lead.mobileNumber : <span className="text-slate-400 italic">No phone detected</span>}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-[11px] text-slate-600">
                        {lead.address || 'Ahmedabad, Gujarat, India'}
                      </span>
                    </div>
                  </div>

                  {/* Query info */}
                  <div className="text-[10px] text-slate-400">
                    Query: <span className="text-slate-600 font-medium">{lead.searchQuery}</span>
                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Send Outreach Email Button */}
                    <button
                      onClick={() => sendOutreachEmail(lead)}
                      disabled={!hasEmail || sendingEmailId === lead.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        isEmailSent
                          ? 'bg-emerald-600 text-white'
                          : hasEmail
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {sendingEmailId === lead.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>{isEmailSent ? 'Sent' : 'Outreach'}</span>
                    </button>

                    {/* WhatsApp Chat Button */}
                    {hasPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteLead(lead.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Lead"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
