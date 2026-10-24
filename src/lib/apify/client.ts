import { ApifyClient } from 'apify-client';

const apifyToken = process.env.APIFY_API_TOKEN;

export const apifyClient = apifyToken ? new ApifyClient({ token: apifyToken }) : null;

// Actor IDs from environment
export const ACTORS = {
  linkedin: process.env.APIFY_ACTOR_LINKEDIN || 'curious_coder/linkedin-jobs-scraper',
  upwork: process.env.APIFY_ACTOR_UPWORK || 'upwork-scraper/upwork-jobs',
  naukri: process.env.APIFY_ACTOR_NAUKRI || 'naukri-scraper/naukri-jobs',
  indeed: process.env.APIFY_ACTOR_INDEED || 'johnvc/indeed-jobs-api',
  freelancer: process.env.APIFY_ACTOR_FREELANCER || 'freelancer-scraper/freelancer-jobs',
  wellfound: process.env.APIFY_ACTOR_WELLFOUND || 'johnvc/wellfound-jobs-api',
  remoteOk: process.env.APIFY_ACTOR_REMOTEOK || 'remoteok-scraper/remoteok-jobs',
  web: process.env.APIFY_ACTOR_WEB || 'apify/google-search-scraper',
};

export type ApifySource = keyof typeof ACTORS;

export interface ApifySearchParams {
  keywords?: string;
  location?: string;
  limit?: number;
}

// Indeed searches one country site per run (US unless "country" is set), so a
// country at the end of the location picks the site: "Remote, India" -> IN + "Remote"
const INDEED_COUNTRIES: Record<string, string> = {
  india: 'IN',
  usa: 'US',
  'united states': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  canada: 'CA',
  australia: 'AU',
  singapore: 'SG',
  germany: 'DE',
  ireland: 'IE',
};

function indeedLocation(location: string): { location: string; country?: string } {
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  const country = INDEED_COUNTRIES[(parts[parts.length - 1] || '').toLowerCase()];
  return country ? { location: parts.slice(0, -1).join(', '), country } : { location: parts.join(', ') };
}

export async function runApifyActor(source: ApifySource, params: ApifySearchParams) {
  if (!apifyClient) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }

  const actorId = ACTORS[source];
  if (!actorId) {
    throw new Error(`No actor configured for source: ${source}`);
  }

  // --- MOCK MODE FOR LINKEDIN (Reads from saved dataset to save credits) ---
  if (source === 'linkedin') {
    console.log('Mock Mode: Pulling from existing dataset Zcp504ZyefC0ddmNB to save credits...');
    try {
      const { items } = await apifyClient.dataset('Zcp504ZyefC0ddmNB').listItems({
        limit: params.limit || 50,
      });
      return items;
    } catch (e) {
      console.error('Error fetching from saved dataset', e);
      throw e;
    }
  }
  // --------------------------------------------------------------------------

  // Map our generic search params to actor-specific inputs
  let input: any = {};
  
  if (source === 'upwork') {
    input = {
      query: params.keywords || '',
      location: params.location || '',
      limit: params.limit || 10,
    };
  } else if (source === 'web') {
    // Official apify/google-search-scraper requires "queries"
    input = {
      queries: `${params.keywords || ''} ${params.location || ''} jobs`.trim(),
      maxPagesPerQuery: 1,
      resultsPerPage: params.limit || 10,
    };
  } else if (source === 'indeed') {
    const { location, country } = indeedLocation(params.location || '');
    input = {
      mode: 'search',
      keywords: params.keywords ? [params.keywords] : [],
      maxResultsPerInput: params.limit || 10,
      descriptionFormat: 'text',
    };
    if (location) input.location = location;
    if (country) input.country = country;
  } else if (source === 'wellfound') {
    // Wellfound has no free-text search: the keyword doubles as the role search,
    // and locations are slugs such as "india" or "san-francisco"
    const places = (params.location || '').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
    const locations = places.filter((p) => p !== 'remote').map((p) => p.replace(/[^a-z0-9]+/g, '-'));
    input = {
      remoteOnly: places.includes('remote'),
      maxItems: params.limit || 10,
    };
    if (locations.length) input.locations = locations;
    if (params.keywords) input.keyword = params.keywords;
  } else {
    // Generic fallback for others
    input = {
      query: `${params.keywords || ''} ${params.location || ''}`.trim(),
      maxResults: params.limit || 10,
    };
  }

  try {
    const run = await apifyClient.actor(actorId).call(input);
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    return items;
  } catch (error) {
    console.error(`Error running Apify actor for ${source}:`, error);
    throw error;
  }
}
