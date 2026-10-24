// Offline test for the Indeed and Wellfound Apify sources: the actor call is mocked.
// Run: npx tsx --test src/lib/apify/client.test.ts
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type * as ClientModule from './client';
import type * as NormalizersModule from './normalizers';

// Rows shaped like each actor's dataset output (made-up jobs)
const INDEED_ROWS = [
  {
    result_type: 'job',
    jobId: 'a1b2c3d4e5f60718',
    jobTitle: 'React Developer',
    companyName: 'Northwind Labs',
    location: 'Remote',
    jobUrl: 'https://in.indeed.com/viewjob?jk=a1b2c3d4e5f60718',
    applyUrl: 'https://careers.example.com/apply/1187',
    datePosted: '2026-10-20T00:00:00.000Z',
    jobType: 'Full-time',
    salaryText: '₹6,00,000 - ₹9,00,000 a year',
    salaryMin: 600000,
    salaryMax: 900000,
    descriptionText: 'Build dashboards in React and TypeScript.',
    searchKeyword: 'React Developer',
  },
  {
    result_type: 'job',
    jobId: '0f1e2d3c4b5a6978',
    jobTitle: 'Frontend Engineer',
    companyName: 'Bright Line Software',
    location: 'Remote',
    jobUrl: 'https://in.indeed.com/viewjob?jk=0f1e2d3c4b5a6978',
    datePosted: '2026-10-18T00:00:00.000Z',
    descriptionText: 'Own the design system and component library.',
    searchKeyword: 'React Developer',
  },
  {
    result_type: 'error',
    sourceInput: 'React Developer',
    error_message: 'No jobs found for this keyword and location.',
  },
  {
    free_tier_notice: true,
    notice: 'free_tier_limit_reached',
    message: 'Free monthly usage limit reached for this actor. This run returned 2 result(s) before stopping.',
    allowance_resets_on: '2026-11-01',
    how_to_continue: 'Notice text from the actor, not a job.',
  },
];

const WELLFOUND_ROWS = [
  {
    result_type: 'job',
    id: '4353862',
    title: 'Product Manager',
    url: 'https://wellfound.com/jobs/4353862-product-manager',
    description: '### About the role\nOwn the roadmap for our payments product.',
    compensationRaw: '$130k - $200k * 0.15% - 0.25%',
    salaryMin: 130000,
    salaryMax: 200000,
    salaryCurrency: 'USD',
    equityMin: 0.15,
    equityMax: 0.25,
    jobType: 'full-time',
    remote: true,
    remoteKind: 'ONSITE_OR_REMOTE',
    locationNames: ['Bangalore', 'Mumbai'],
    postedAt: '2026-10-19T09:30:00+00:00',
    company: {
      name: 'Acme Payments',
      slug: 'acme-payments',
      size: 'SIZE_11_50',
      tagline: 'Payments for small shops',
      stage: 'early_stage',
      ycFunded: false,
      topInvestors: true,
      activelyHiring: true,
    },
  },
  {
    result_type: 'job',
    id: '4360001',
    title: 'Senior Product Manager',
    url: 'https://wellfound.com/jobs/4360001-senior-product-manager',
    description: 'Lead discovery for the merchant app.',
    remote: true,
    remoteKind: 'REMOTE_ONLY',
    locationNames: [],
    postedAt: '2026-10-21T12:00:00+00:00',
    company: { name: 'Globex Remote', slug: 'globex-remote' },
  },
  {
    result_type: 'error',
    error_type: 'NoSuchSearchPage',
    error_message: 'Wellfound does not serve this role or location page.',
  },
];

let client: typeof ClientModule;
let normalizers: typeof NormalizersModule;
const calls: { actorId: string; input: Record<string, unknown> }[] = [];

before(async () => {
  process.env.APIFY_API_TOKEN = 'test-token';
  delete process.env.APIFY_ACTOR_INDEED;
  delete process.env.APIFY_ACTOR_WELLFOUND;
  client = await import('./client');
  normalizers = await import('./normalizers');

  const datasets: Record<string, unknown[]> = {
    'johnvc/indeed-jobs-api': INDEED_ROWS,
    'johnvc/wellfound-jobs-api': WELLFOUND_ROWS,
  };
  const apify = client.apifyClient!;
  apify.actor = ((actorId: string) => ({
    call: async (input: Record<string, unknown>) => {
      calls.push({ actorId, input });
      return { defaultDatasetId: actorId };
    },
  })) as unknown as typeof apify.actor;
  apify.dataset = ((datasetId: string) => ({
    listItems: async () => ({ items: datasets[datasetId] || [] }),
  })) as unknown as typeof apify.dataset;
});

beforeEach(() => {
  calls.length = 0;
});

test('Indeed and Wellfound default to actors that exist', () => {
  assert.equal(client.ACTORS.indeed, 'johnvc/indeed-jobs-api');
  assert.equal(client.ACTORS.wellfound, 'johnvc/wellfound-jobs-api');
});

test('Indeed input uses mode/keywords/location/maxResultsPerInput, with the country taken from the location', async () => {
  await client.runApifyActor('indeed', { keywords: 'React Developer', location: 'Remote, India', limit: 10 });
  await client.runApifyActor('indeed', { keywords: 'React Developer', location: 'Ahmedabad', limit: 5 });
  await client.runApifyActor('indeed', { keywords: 'React Developer', location: 'India' });

  assert.deepEqual(calls.map((c) => c.actorId), Array(3).fill('johnvc/indeed-jobs-api'));
  assert.deepEqual(calls[0].input, {
    mode: 'search',
    keywords: ['React Developer'],
    maxResultsPerInput: 10,
    descriptionFormat: 'text',
    location: 'Remote',
    country: 'IN',
  });
  assert.deepEqual(calls[1].input, {
    mode: 'search',
    keywords: ['React Developer'],
    maxResultsPerInput: 5,
    descriptionFormat: 'text',
    location: 'Ahmedabad',
  });
  assert.deepEqual(calls[2].input, {
    mode: 'search',
    keywords: ['React Developer'],
    maxResultsPerInput: 10,
    descriptionFormat: 'text',
    country: 'IN',
  });
});

test('Indeed rows map onto leads, and error and free-tier notice rows are dropped', async () => {
  const items = await client.runApifyActor('indeed', { keywords: 'React Developer', location: 'Remote, India', limit: 10 });
  const leads = normalizers.normalizeApifyResults('indeed', items);

  assert.equal(leads.length, 2);
  assert.deepEqual(leads[0], {
    id: 'a1b2c3d4e5f60718',
    source: 'Indeed',
    leadType: 'job',
    title: 'React Developer',
    company: 'Northwind Labs',
    description: 'Build dashboards in React and TypeScript.',
    location: 'Remote',
    url: 'https://in.indeed.com/viewjob?jk=a1b2c3d4e5f60718',
    budget: '₹6,00,000 - ₹9,00,000 a year',
    postedAt: '2026-10-20T00:00:00.000Z',
    skills: [],
  });
  assert.equal(leads[1].budget, undefined);
  assert.ok(leads.every((l) => !l.title.includes('Unknown') && l.url.startsWith('https://')));
});

test('Wellfound input sends the keyword, location slugs and remoteOnly', async () => {
  await client.runApifyActor('wellfound', { keywords: 'Product Manager', location: 'Remote, India', limit: 10 });
  await client.runApifyActor('wellfound', { keywords: 'Product Manager', location: 'San Francisco' });
  await client.runApifyActor('wellfound', { location: 'Remote' });

  assert.deepEqual(calls.map((c) => c.actorId), Array(3).fill('johnvc/wellfound-jobs-api'));
  assert.deepEqual(calls[0].input, {
    remoteOnly: true,
    maxItems: 10,
    locations: ['india'],
    keyword: 'Product Manager',
  });
  assert.deepEqual(calls[1].input, {
    remoteOnly: false,
    maxItems: 10,
    locations: ['san-francisco'],
    keyword: 'Product Manager',
  });
  assert.deepEqual(calls[2].input, { remoteOnly: true, maxItems: 10 });
});

test('Wellfound rows map onto leads with the company name as text, and error rows are dropped', async () => {
  const items = await client.runApifyActor('wellfound', { keywords: 'Product Manager', location: 'India', limit: 10 });
  const leads = normalizers.normalizeApifyResults('wellfound', items);

  assert.equal(leads.length, 2);
  assert.deepEqual(leads[0], {
    id: '4353862',
    source: 'Wellfound',
    leadType: 'job',
    title: 'Product Manager',
    company: 'Acme Payments',
    description: '### About the role\nOwn the roadmap for our payments product.',
    location: 'Bangalore, Mumbai',
    url: 'https://wellfound.com/jobs/4353862-product-manager',
    budget: '$130k - $200k * 0.15% - 0.25%',
    postedAt: '2026-10-19T09:30:00+00:00',
    skills: [],
  });
  assert.equal(leads[1].company, 'Globex Remote');
  assert.equal(leads[1].location, 'Remote');
  assert.ok(leads.every((l) => typeof l.company === 'string'));
});

test('Indeed and Wellfound leads go through the existing dedupe unchanged', async () => {
  const indeed = normalizers.normalizeApifyResults('indeed', INDEED_ROWS);
  const wellfound = normalizers.normalizeApifyResults('wellfound', WELLFOUND_ROWS);
  const unique = normalizers.deduplicateLeads([...indeed, ...indeed, ...wellfound]);
  assert.deepEqual(unique.map((l) => l.source), ['Indeed', 'Indeed', 'Wellfound', 'Wellfound']);
});
