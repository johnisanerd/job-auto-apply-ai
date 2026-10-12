import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { BusinessLead } from '@/types';

// ==============================================================================
// 1. CONFIGURATION & CONSTANTS
// ==============================================================================

const EXCLUDED_DOMAINS = new Set([
  // Social Platforms
  'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com',
  'twitter.com', 'x.com', 'tiktok.com', 'reddit.com', 'pinterest.com',
  // Search Engines
  'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com',
  // Dictionaries & Educational Reference
  'dictionary.com', 'cambridge.org', 'collinsdictionary.com',
  'thesaurus.com', 'merriam-webster.com', 'usdictionary.com',
  'askdifference.com', 'britannica.com', 'wikipedia.org', 'w3schools.com',
  'geeksforgeeks.org', 'tutorialspoint.com', 'thefreedictionary.com',
  'vocabulary.com', 'perfectyourenglish.com', 'prepedu.com',
  // Streaming & Media / Entertainment
  'hotstar.com', 'netflix.com', 'justwatch.com', 'imdb.com', 'primevideo.com',
  // Directories & Job Boards
  'justdial.com', 'indiamart.com', 'indianyellowpages.com', 'yellowpages.com',
  'indeed.com', 'glassdoor.com', 'upwork.com', 'fiverr.com', 'freelancer.com',
  'toptal.com', 'naukri.com', 'shine.com', 'monster.com', 'clutch.co',
  'goodfirms.co', 'techbehemoths.com', 'f6s.com', 'techreviewer.co',
  'itprofiles.com', 'beststartup.in', 'peoplemanagingpeople.com',
  'recruitment.com', 'ambitionbox.com',
  // Tech giants & AI
  'microsoft.com', 'apple.com', 'amazon.com', 'openai.com', 'chatgpt.com',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'softonic.com'
]);

const INTENT_KEYWORDS = {
  high: [
    'looking for software development company',
    'need software development company',
    'looking for web development company',
    'need web development company',
    'looking for it company',
    'need it company',
    'looking to hire',
    'need a developer',
    'need software development',
    'need web development',
    'need mobile app',
    'request for proposal',
    'rfp',
    'tender',
    'seeking development partner',
    'seeking software vendor',
    'wanted software developer'
  ],
  medium: [
    'looking for',
    'need',
    'required',
    'hire',
    'hiring',
    'wanted',
    'seeking',
    'project requirement',
    'get a quote',
    'request a quote',
    'budget estimate',
    'post a project'
  ]
};

const SERVICE_PROVIDER_KEYWORDS = [
  'we provide software development',
  'we offer web development',
  'we are a software development company',
  'we are an it company',
  'our it services',
  'our software services',
  'our web development services',
  'our mobile app development services',
  'custom software development services',
  'hire our developers',
  'hire dedicated developers from us',
  'our technology stack',
  'our portfolio',
  'our case studies',
  'software development agency'
];

const TARGET_SUBPAGE_KEYWORDS = ['contact', 'contact-us', 'contactus', 'about', 'about-us', 'company'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ==============================================================================
// 2. HELPER FUNCTIONS
// ==============================================================================

function getDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return '';
  }
}

function filterSearchResult(urlStr: string, title: string): { isAccepted: boolean; reason: string } {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isAccepted: false, reason: 'Invalid URL scheme' };
    }

    const domain = getDomain(urlStr);
    if (!domain) return { isAccepted: false, reason: 'Malformed domain' };

    for (const excluded of EXCLUDED_DOMAINS) {
      if (domain === excluded || domain.endsWith('.' + excluded)) {
        return { isAccepted: false, reason: `Excluded domain (${excluded})` };
      }
    }

    const lowerUrl = urlStr.toLowerCase();
    const lowerTitle = title.toLowerCase();

    const dictWords = ['dictionary', 'thesaurus', 'grammar', 'definition', 'synonyms', 'pronunciation'];
    if (dictWords.some(w => lowerUrl.includes(w) || lowerTitle.includes(w))) {
      return { isAccepted: false, reason: 'Dictionary / reference content' };
    }

    const mediaWords = ['streaming', 'movie', 'tv-show', 'trailer', 'episodes', 'watch online'];
    if (mediaWords.some(w => lowerUrl.includes(w) || lowerTitle.includes(w))) {
      return { isAccepted: false, reason: 'Entertainment / streaming media' };
    }

    return { isAccepted: true, reason: 'Accepted' };
  } catch (e: any) {
    return { isAccepted: false, reason: `Validation error: ${e.message}` };
  }
}

async function fetchPageWithTimeout(urlStr: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(urlStr, {
      headers: HEADERS,
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    return await res.text();
  } catch {
    return null;
  }
}

function cleanCompanyNameText(text: string): string {
  const patternsToRemove = [
    /\s*\|\s*Home.*/i,
    /\s*\|\s*Services.*/i,
    /\s*\|\s*Contact Us.*/i,
    /\s*-\s*Official Website.*/i,
    /\s*\|\s*Website Designing.*/i,
    /\s*\|\s*Software Development.*/i,
    /\s*Private Limited/i,
    /\s*Pvt\.?\s*Ltd\.?/i
  ];
  let cleaned = text.trim();
  for (const pat of patternsToRemove) {
    cleaned = cleaned.replace(pat, '').trim();
  }
  return cleaned || text.trim();
}

function extractCompanyName($: cheerio.CheerioAPI, urlStr: string): string {
  // 1. OpenGraph site_name
  const ogSite = $('meta[property="og:site_name"]').attr('content');
  if (ogSite && ogSite.trim().length >= 2 && ogSite.trim().length <= 50) {
    return cleanCompanyNameText(ogSite);
  }

  // 2. Application name
  const appName = $('meta[name="application-name"]').attr('content');
  if (appName && appName.trim().length >= 2 && appName.trim().length <= 50) {
    return cleanCompanyNameText(appName);
  }

  // 3. JSON-LD schema Organization
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text() || '{}');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if ((item['@type'] === 'Organization' || item['@type'] === 'Corporation' || item['@type'] === 'LocalBusiness') && item.name) {
          return cleanCompanyNameText(String(item.name));
        }
      }
    } catch {}
  });

  // 4. Clean <title> tag
  const rawTitle = $('title').text().trim();
  if (rawTitle) {
    const parts = rawTitle.split(/[\s\|\-\—\:\•\»\–]+/);
    if (parts.length > 0) {
      let candidate = parts[0].trim();
      if (['home', 'welcome', 'about us', 'contact us', 'official website'].includes(candidate.toLowerCase()) && parts.length > 1) {
        candidate = parts[1].trim();
      }
      if (candidate.length >= 2 && candidate.length <= 45) {
        return cleanCompanyNameText(candidate);
      }
    }
  }

  // 5. Fallback: domain
  const domain = getDomain(urlStr);
  const baseName = domain.split('.')[0];
  return baseName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractCleanEmails(html: string, $: cheerio.CheerioAPI): string[] {
  const emails = new Set<string>();

  // Mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (email && email.includes('@')) {
      emails.add(email);
    }
  });

  // Regex
  const regex = /\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g;
  const matches = html.match(regex) || [];
  matches.forEach(m => emails.add(m.trim().toLowerCase()));

  const ignoredKeywords = [
    'example.com', 'domain.com', 'test.com', 'sentry.io', 'wixpress.com',
    'wix.com', 'googleapis.com', 'polyfill', 'webpack', 'schema.org',
    'ingest.sentry', 'cloudflare', 'noreply', 'no-reply'
  ];
  const invalidExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js'];

  const cleaned: string[] = [];
  for (const e of emails) {
    if (invalidExts.some(ext => e.endsWith(ext))) continue;
    if (ignoredKeywords.some(ign => e.includes(ign))) continue;
    if (e.length < 6 || e.length > 60) continue;
    cleaned.push(e);
  }

  const priorityPrefixes = ['info@', 'contact@', 'hello@', 'sales@', 'business@', 'support@'];
  cleaned.sort((a, b) => {
    const aPri = priorityPrefixes.some(p => a.startsWith(p)) ? 0 : 1;
    const bPri = priorityPrefixes.some(p => b.startsWith(p)) ? 0 : 1;
    return aPri - bPri;
  });

  return Array.from(new Set(cleaned)).slice(0, 3);
}

function validateAndNormalizeIndianPhone(phoneStr: string): string | null {
  const cleaned = phoneStr.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 12) return null;
  if (new Set(digits).size <= 3) return null; // repetative digits like 9999999999

  // Mobile
  if (digits.length === 10 && '6789'.includes(digits[0])) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (digits.length === 12 && digits.startsWith('91') && '6789'.includes(digits[2])) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  } else if (digits.length === 11 && digits.startsWith('0') && '6789'.includes(digits[1])) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }

  // Landline (Ahmedabad 079)
  if (digits.startsWith('079') && (digits.length === 10 || digits.length === 11)) {
    return `079-${digits.slice(3)}`;
  } else if (digits.length === 10 && digits.startsWith('79')) {
    return `079-${digits.slice(2)}`;
  }

  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('19') && !digits.startsWith('20')) {
    return `+91 ${digits.slice(-10)}`;
  }

  return null;
}

function extractCleanIndianPhones(html: string, $: cheerio.CheerioAPI): string[] {
  const phones = new Set<string>();

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const phoneVal = href.replace(/^tel:/i, '').split('?')[0].trim();
    const norm = validateAndNormalizeIndianPhone(phoneVal);
    if (norm) phones.add(norm);
  });

  const patterns = [
    /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g,
    /(?:0[1-9]\d{1,3}[\s-]?)?[2-9]\d{6,7}/g
  ];

  for (const pat of patterns) {
    const matches = html.match(pat) || [];
    for (const m of matches) {
      const norm = validateAndNormalizeIndianPhone(m);
      if (norm) phones.add(norm);
    }
  }

  return Array.from(phones).slice(0, 2);
}

function cleanAddressString(txt: string): string {
  if (!txt) return 'N/A';
  let cleaned = txt.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/[^\x00-\x7F]/g, '');
  cleaned = cleaned.replace(/\b(PostalAddress|@type|streetAddress|addressLocality|addressRegion|postalCode|addressCountry)\b/gi, '');
  cleaned = cleaned.replace(/["{}[\]:]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/,\s*,+/g, ',');
  cleaned = cleaned.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
  return cleaned.length >= 5 ? cleaned : 'N/A';
}

function extractAddress($: cheerio.CheerioAPI, html: string): string {
  // 1. JSON-LD PostalAddress
  let jsonAddress = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text() || '{}');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.address) {
          if (typeof item.address === 'object') {
            const parts = [
              item.address.streetAddress,
              item.address.addressLocality,
              item.address.addressRegion,
              item.address.postalCode,
              item.address.addressCountry
            ].filter(Boolean);
            if (parts.length > 0) {
              jsonAddress = cleanAddressString(parts.join(', '));
              return false;
            }
          } else if (typeof item.address === 'string' && item.address.length > 8) {
            jsonAddress = cleanAddressString(item.address);
            return false;
          }
        }
      }
    } catch {}
  });
  if (jsonAddress && jsonAddress !== 'N/A') return jsonAddress;

  // 2. <address> tag
  const addrTag = $('address').first().text();
  if (addrTag && addrTag.length > 10 && addrTag.length < 300) {
    const res = cleanAddressString(addrTag);
    if (res !== 'N/A') return res;
  }

  // 3. Regex snippet with Ahmedabad/Gujarat
  const match = html.match(/([^.\n\r<>{}\"]{0,60}(?:Ahmedabad|Gujarat|S\.?G\.?\s*Highway|Prahladnagar|Bodakdev|Navrangpura)[^.\n\r<>{}\"]{0,100}\b\d{6}\b[^.\n\r<>{}\"]{0,30})/i);
  if (match) {
    const snippet = cheerio.load(match[1]).text().trim();
    const res = cleanAddressString(snippet);
    if (res.length > 10) return res;
  }

  return 'N/A';
}

function analyzeIntentAndType(text: string, title: string): { intent: 'High' | 'Medium' | 'Low'; leadType: 'Potential Buyer' | 'IT Service Provider' | 'Unknown' | 'Blog/Article'; signals: any } {
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();

  const signals = {
    strong_buying_intent: false,
    hiring_phrase: false,
    tech_requirement: false,
    business_website_detected: true,
    is_service_provider: false
  };

  const providerMatches = SERVICE_PROVIDER_KEYWORDS.filter(kw => lowerText.includes(kw) || lowerTitle.includes(kw)).length;
  if (providerMatches >= 2) {
    signals.is_service_provider = true;
  }

  const highIntentMatches = INTENT_KEYWORDS.high.filter(kw => lowerText.includes(kw) || lowerTitle.includes(kw)).length;
  const mediumIntentMatches = INTENT_KEYWORDS.medium.filter(kw => lowerText.includes(kw)).length;

  let intent: 'High' | 'Medium' | 'Low' = 'Low';
  if (highIntentMatches >= 1) {
    signals.strong_buying_intent = true;
    signals.hiring_phrase = true;
    intent = 'High';
  } else if (mediumIntentMatches >= 2) {
    signals.hiring_phrase = true;
    intent = 'Medium';
  }

  let leadType: 'Potential Buyer' | 'IT Service Provider' | 'Unknown' | 'Blog/Article' = 'Unknown';
  if (signals.is_service_provider) {
    leadType = 'IT Service Provider';
  } else if (signals.strong_buying_intent || intent === 'Medium') {
    leadType = 'Potential Buyer';
  } else if (['about us', 'our services', 'company', 'solutions'].some(w => lowerText.includes(w))) {
    leadType = 'Unknown';
  } else {
    leadType = 'Blog/Article';
  }

  return { intent, leadType, signals };
}

function calculateLeadScore(signals: any, hasEmail: boolean, hasPhone: boolean, leadType: string): number {
  let score = 0;
  if (signals.strong_buying_intent) score += 3;
  if (signals.hiring_phrase) score += 2;
  if (signals.tech_requirement || signals.strong_buying_intent) score += 2;
  if (signals.business_website_detected) score += 1;
  if (hasEmail) score += 1;
  if (hasPhone) score += 1;

  if (leadType === 'IT Service Provider') score -= 5;
  else if (['Directory', 'Job Board', 'Blog/Article'].includes(leadType)) score -= 5;

  return score;
}

// ==============================================================================
// 3. SEARCH RUNNER VIA BING & YAHOO (FREE, FAST, SERVERLESS-SAFE)
// ==============================================================================

async function searchPublicEngine(query: string, maxResults = 10): Promise<{ url: string; title: string; query: string }[]> {
  const results: { url: string; title: string; query: string }[] = [];
  const seenUrls = new Set<string>();

  // 1. Bing Search
  try {
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults * 2}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(bingUrl, {
      headers: HEADERS,
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      $('li.b_algo').each((_, el) => {
        if (results.length >= maxResults) return;

        const aTag = $(el).find('h2 a');
        let actualUrl = aTag.attr('href') || '';
        const title = aTag.text().trim();

        if (actualUrl.includes('/ck/a?!') && actualUrl.includes('&u=')) {
          try {
            const match = actualUrl.match(/[?&]u=([^&]+)/);
            if (match && match[1].startsWith('a1')) {
              let b64 = match[1].substring(2);
              b64 += '='.repeat((4 - (b64.length % 4)) % 4);
              actualUrl = Buffer.from(b64, 'base64').toString('utf-8');
            }
          } catch {}
        }

        const { isAccepted } = filterSearchResult(actualUrl, title);
        if (isAccepted && !seenUrls.has(actualUrl)) {
          seenUrls.add(actualUrl);
          results.push({ url: actualUrl, title, query });
        }
      });
    }
  } catch (err: any) {
    console.warn(`[Search] Bing query note: ${err.message}`);
  }

  // 2. Yahoo Search Fallback if Bing gave few results
  if (results.length < maxResults) {
    try {
      const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&n=${maxResults}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(yahooUrl, {
        headers: HEADERS,
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        $('div.compTitle a').each((_, el) => {
          if (results.length >= maxResults) return;

          const rawHref = $(el).attr('href') || '';
          const match = rawHref.match(/\/RU=([^\/]+)\//);
          if (match) {
            try {
              const actualUrl = decodeURIComponent(match[1]);
              const title = $(el).text().trim();
              const { isAccepted } = filterSearchResult(actualUrl, title);
              if (isAccepted && !seenUrls.has(actualUrl)) {
                seenUrls.add(actualUrl);
                results.push({ url: actualUrl, title, query });
              }
            } catch {}
          }
        });
      }
    } catch (err: any) {
      console.warn(`[Search] Yahoo fallback query note: ${err.message}`);
    }
  }

  return results;
}

// ==============================================================================
// 4. MAIN API HANDLER
// ==============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { 
      roles = [], 
      location = 'Ahmedabad', 
      minScore = 4, 
      maxPerQuery = 5,
      autoSave = true 
    } = body;

    // Load auto-scout preferences if no roles specified
    if (!roles || roles.length === 0) {
      const prefsPath = path.join(process.cwd(), 'data', 'auto_scout_prefs.json');
      if (fs.existsSync(prefsPath)) {
        try {
          const prefsData = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
          if (prefsData.autoScoutPreferences?.targetRoles?.length > 0) {
            roles = prefsData.autoScoutPreferences.targetRoles;
          }
          if (prefsData.autoScoutPreferences?.location && !body.location) {
            location = prefsData.autoScoutPreferences.location;
          }
        } catch {}
      }
    }

    if (!roles || roles.length === 0) {
      roles = [
        'Full Stack Developer',
        'Web Development Company',
        'Custom Software Solutions',
        'IT Services Company'
      ];
    }

    const acceptedLeads: BusinessLead[] = [];
    const rejectedLeads: any[] = [];
    const seenDomains = new Set<string>();

    for (const role of roles.slice(0, 4)) { // Process up to 4 roles per run to stay well within limits
      const queries = [
        `looking for ${role} ${location}`.trim(),
        `${role} company ${location}`.trim()
      ];

      for (const query of queries) {
        const searchResults = await searchPublicEngine(query, maxPerQuery);

        for (const item of searchResults) {
          const domain = getDomain(item.url);
          if (seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          const html = await fetchPageWithTimeout(item.url);
          if (!html) {
            rejectedLeads.push({ url: item.url, reason: 'Unreachable / Timeout' });
            continue;
          }

          const $ = cheerio.load(html);
          let pageText = $('body').text().replace(/\s+/g, ' ').trim();
          const companyName = extractCompanyName($, item.url);

          let emails = new Set(extractCleanEmails(html, $));
          let phones = new Set(extractCleanIndianPhones(html, $));
          let address = extractAddress($, html);

          // Subpage crawler: if email or phone is missing, inspect contact/about subpage
          if (emails.size === 0 || phones.size === 0 || address === 'N/A') {
            const subpages: string[] = [];
            $('a[href]').each((_, el) => {
              const href = $(el).attr('href') || '';
              const lower = href.toLowerCase();
              if (TARGET_SUBPAGE_KEYWORDS.some(k => lower.includes(k))) {
                try {
                  const resolved = new URL(href, item.url).toString();
                  if (getDomain(resolved) === domain && !subpages.includes(resolved)) {
                    subpages.push(resolved);
                  }
                } catch {}
              }
            });

            for (const subUrl of subpages.slice(0, 2)) {
              const subHtml = await fetchPageWithTimeout(subUrl, 5000);
              if (subHtml) {
                const sub$ = cheerio.load(subHtml);
                pageText += ' ' + sub$('body').text().replace(/\s+/g, ' ').trim();
                extractCleanEmails(subHtml, sub$).forEach(e => emails.add(e));
                extractCleanIndianPhones(subHtml, sub$).forEach(p => phones.add(p));
                if (address === 'N/A') {
                  const subAddr = extractAddress(sub$, subHtml);
                  if (subAddr !== 'N/A') address = subAddr;
                }
                if (emails.size > 0 && phones.size > 0 && address !== 'N/A') break;
              }
            }
          }

          if (address === 'N/A' && location && pageText.toLowerCase().includes(location.toLowerCase())) {
            address = `${location}, Gujarat, India`;
          }

          const { intent, leadType, signals } = analyzeIntentAndType(pageText, companyName);
          const hasEmail = emails.size > 0;
          const hasPhone = phones.size > 0;
          const score = calculateLeadScore(signals, hasEmail, hasPhone, leadType);

          const leadRecord: BusinessLead = {
            id: `biz-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            companyName,
            websiteUrl: item.url,
            email: emails.size > 0 ? Array.from(emails).join(', ') : 'N/A',
            mobileNumber: phones.size > 0 ? Array.from(phones).join(', ') : 'N/A',
            address,
            searchQuery: query,
            intent,
            leadType,
            leadScore: score,
            scrapedDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
            postedDate: 'N/A',
            status: emails.size > 0 ? 'new' : 'no_email',
            domain
          };

          if (score >= minScore) {
            acceptedLeads.push(leadRecord);
          } else {
            rejectedLeads.push({
              companyName,
              url: item.url,
              score,
              leadType,
              reason: `Score ${score} below threshold ${minScore}`
            });
          }
        }
      }
    }

    // Auto-save accepted leads to DB if requested
    if (autoSave && acceptedLeads.length > 0) {
      try {
        const dataDir = path.join(process.cwd(), 'data');
        const dbPath = path.join(dataDir, 'business_leads.json');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        
        let existing: BusinessLead[] = [];
        if (fs.existsSync(dbPath)) {
          existing = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        }

        for (const lead of acceptedLeads) {
          const idx = existing.findIndex(e => e.websiteUrl === lead.websiteUrl || e.domain === lead.domain);
          if (idx !== -1) {
            existing[idx] = { ...existing[idx], ...lead };
          } else {
            existing.unshift(lead);
          }
        }

        fs.writeFileSync(dbPath, JSON.stringify(existing, null, 2));
      } catch (saveErr) {
        console.warn('Auto-save leads error:', saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      found: acceptedLeads.length,
      rejected: rejectedLeads.length,
      leads: acceptedLeads
    });

  } catch (error: any) {
    console.error('Lead scraper API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
