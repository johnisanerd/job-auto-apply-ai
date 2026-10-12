import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { BusinessLead } from '@/types';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'business_leads.json');
const autoScoutPath = path.join(dataDir, 'auto_scout_leads.json');

function initDB() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]));
  }
}

function getLeads(): BusinessLead[] {
  initDB();
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading business leads DB:', error);
    return [];
  }
}

function saveLeads(leads: BusinessLead[]) {
  initDB();
  fs.writeFileSync(dbPath, JSON.stringify(leads, null, 2));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get('type');
    const minScore = searchParams.get('minScore');
    const location = searchParams.get('location');

    let leads = getLeads();

    if (filterType && filterType !== 'all') {
      leads = leads.filter(l => l.leadType === filterType);
    }

    if (minScore) {
      const scoreNum = parseInt(minScore, 10);
      if (!isNaN(scoreNum)) {
        leads = leads.filter(l => l.leadScore >= scoreNum);
      }
    }

    if (location) {
      const locLower = location.toLowerCase();
      leads = leads.filter(l => (l.address || '').toLowerCase().includes(locLower));
    }

    return NextResponse.json({ leads, total: leads.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const incomingLeads: BusinessLead[] = Array.isArray(payload) ? payload : [payload];
    const existingLeads = getLeads();

    for (const incoming of incomingLeads) {
      if (!incoming.id && !incoming.websiteUrl) continue;

      const existingIndex = existingLeads.findIndex(l => 
        (incoming.id && l.id === incoming.id) ||
        (incoming.websiteUrl && l.websiteUrl === incoming.websiteUrl) ||
        (incoming.domain && l.domain === incoming.domain)
      );

      if (existingIndex !== -1) {
        existingLeads[existingIndex] = {
          ...existingLeads[existingIndex],
          ...incoming
        };
      } else {
        existingLeads.unshift({
          ...incoming,
          id: incoming.id || `biz-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          scrapedDate: incoming.scrapedDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
          status: incoming.status || 'new'
        });
      }

      // Also sync to auto_scout_leads.json so the main Auto-Scout dashboard can see them
      try {
        if (fs.existsSync(autoScoutPath)) {
          const autoData = JSON.parse(fs.readFileSync(autoScoutPath, 'utf8') || '[]');
          const autoIdx = autoData.findIndex((a: any) => a.jobUrl === incoming.websiteUrl || a.id === incoming.id);
          const autoItem = {
            id: incoming.id || `biz-${Date.now()}`,
            source: 'Business Lead Scraper',
            jobTitle: incoming.leadType === 'Potential Buyer' ? `Client Project (${incoming.searchQuery})` : `${incoming.companyName} Services`,
            company: incoming.companyName,
            location: incoming.address || 'Ahmedabad, Gujarat',
            jobUrl: incoming.websiteUrl,
            fullDescription: `Intent: ${incoming.intent} | Score: ${incoming.leadScore} | Type: ${incoming.leadType}\nAddress: ${incoming.address}\nSearch: ${incoming.searchQuery}`,
            recipientEmail: incoming.email !== 'N/A' ? incoming.email.split(',')[0].trim() : undefined,
            phone: incoming.mobileNumber !== 'N/A' ? incoming.mobileNumber.split(',')[0].trim() : undefined,
            companyWebsite: incoming.websiteUrl,
            status: incoming.status === 'email_sent' ? 'applied' : (incoming.email && incoming.email !== 'N/A' ? 'new' : 'no_email'),
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now()
          };

          if (autoIdx !== -1) {
            autoData[autoIdx] = { ...autoData[autoIdx], ...autoItem };
          } else {
            autoData.unshift(autoItem);
          }
          fs.writeFileSync(autoScoutPath, JSON.stringify(autoData, null, 2));
        }
      } catch (syncErr) {
        console.warn('Sync to auto_scout_leads warning:', syncErr);
      }
    }

    saveLeads(existingLeads);
    return NextResponse.json({ success: true, count: existingLeads.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    let leads = getLeads();
    leads = leads.filter(l => l.id !== id);
    saveLeads(leads);

    return NextResponse.json({ success: true, remaining: leads.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
