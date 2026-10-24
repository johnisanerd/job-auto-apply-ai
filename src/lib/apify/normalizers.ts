import { Lead } from '@/types/lead';
import { ApifySource } from './client';
import { v4 as uuidv4 } from 'uuid';

// The Indeed and Wellfound actors tag rows with result_type, and a free-tier run
// can end with a notice row; only real job rows become leads
function isJobRow(item: { result_type?: string; free_tier_notice?: boolean }): boolean {
  return !item.free_tier_notice && (!item.result_type || item.result_type === 'job');
}

export function normalizeApifyResults(source: ApifySource, items: any[]): Lead[] {
  const normalized = items.map((item) => {
    try {
      if (source === 'linkedin') {
        return {
          id: item.id || uuidv4(),
          source: 'LinkedIn',
          leadType: 'job' as const,
          title: item.title || item.jobTitle || 'Unknown Position',
          company: item.company || item.companyName,
          description: item.description || item.text || '',
          location: item.location || item.jobLocation,
          url: item.url || item.jobUrl || '',
          postedAt: item.postedAt || item.datePosted,
          skills: [], // LinkedIn usually doesn't have an easy array without extraction
        } as Lead;
      } else if (source === 'upwork') {
        return {
          id: item.id || uuidv4(),
          source: 'Upwork',
          leadType: 'freelance' as const,
          title: item.title || 'Unknown Project',
          description: item.snippet || item.description || '',
          location: item.clientLocation || item.location,
          url: item.url || item.jobUrl || '',
          budget: item.budget ? `$${item.budget}` : undefined,
          postedAt: item.postedOn || item.createdOn,
          skills: item.skills ? (Array.isArray(item.skills) ? item.skills : item.skills.split(',')) : [],
        } as Lead;
      } else if (source === 'naukri') {
        return {
          id: item.id || uuidv4(),
          source: 'Naukri',
          leadType: 'job' as const,
          title: item.title || 'Unknown Position',
          company: item.companyName || item.company,
          description: item.description || '',
          location: item.locations || item.location,
          url: item.url || '',
          postedAt: item.date || item.postedAt,
          skills: item.skills || [],
        } as Lead;
      } else if (source === 'indeed') {
        if (!isJobRow(item)) return null;
        return {
          id: item.jobId || uuidv4(),
          source: 'Indeed',
          leadType: 'job' as const,
          title: item.jobTitle || 'Unknown Position',
          company: item.companyName,
          description: item.descriptionText || item.descriptionMarkdown || '',
          location: item.location,
          url: item.jobUrl || '',
          budget: item.salaryText,
          postedAt: item.datePosted,
          skills: [],
        } as Lead;
      } else if (source === 'wellfound') {
        if (!isJobRow(item)) return null;
        return {
          id: item.id || uuidv4(),
          source: 'Wellfound',
          leadType: 'job' as const,
          title: item.title || 'Unknown Position',
          company: item.company?.name,
          description: item.description || '',
          location: item.locationNames?.join(', ') || (item.remote ? 'Remote' : undefined),
          url: item.url || '',
          budget: item.compensationRaw,
          postedAt: item.postedAt,
          skills: [],
        } as Lead;
      } else {
        // Generic fallback
        return {
          id: item.id || uuidv4(),
          source: source.charAt(0).toUpperCase() + source.slice(1),
          leadType: (['upwork', 'freelancer', 'fiverr'].includes(source) ? 'freelance' : 'job') as 'job' | 'freelance',
          title: item.title || item.name || 'Unknown',
          company: item.company || item.client,
          description: item.description || item.snippet || item.text || '',
          location: item.location,
          url: item.url || item.link || '',
          budget: item.budget,
        } as Lead;
      }
    } catch (error) {
      console.warn(`Failed to normalize item from ${source}:`, item);
      return null;
    }
  });

  return normalized.filter((lead): lead is Lead => lead !== null && !!lead.url && !!lead.title);
}

export function deduplicateLeads(leads: Lead[]): Lead[] {
  const seenUrls = new Set<string>();
  const seenTitleCompany = new Set<string>();
  const result: Lead[] = [];

  for (const lead of leads) {
    if (seenUrls.has(lead.url)) continue;
    
    // Normalize Title+Company key (remove spaces, lowercase)
    const titleCompanyKey = `${lead.title || ''}-${lead.company || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (titleCompanyKey.length > 5 && seenTitleCompany.has(titleCompanyKey)) continue;

    seenUrls.add(lead.url);
    if (titleCompanyKey.length > 5) {
      seenTitleCompany.add(titleCompanyKey);
    }
    result.push(lead);
  }

  return result;
}
