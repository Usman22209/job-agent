import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

export async function searchArbeitnowJobs(query: string = '', limit: number = 40): Promise<any[]> {
  try {
    const response = await axios.get('https://www.arbeitnow.com/api/job-board-api', {
      timeout: 10000,
      headers: {
        'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
      },
    });

    const rawList = response.data?.data || [];

    let filtered = rawList;
    if (query) {
      const q = query.toLowerCase();
      filtered = rawList.filter((item: any) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const tagsMatch = Array.isArray(item.tags) && item.tags.some((t: string) => t.toLowerCase().includes(q));
        const companyMatch = item.company_name?.toLowerCase().includes(q);
        const descMatch = item.description?.toLowerCase().includes(q);
        return titleMatch || tagsMatch || companyMatch || descMatch;
      });
    }

    return filtered.slice(0, limit).map((item: any) => ({
      source: 'arbeitnow',
      source_id: item.slug || String(item.created_at || Math.random()),
      title: item.title,
      company: item.company_name,
      location: item.location || (item.remote ? 'Remote' : 'Worldwide'),
      is_remote: Boolean(item.remote),
      description: cleanHtmlText(item.description),
      url: item.url,
      application_url: item.url,
      salary_min: null,
      salary_max: null,
      currency: 'USD',
      posted_at: item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString(),
      tags: item.tags || [],
      metadata: item,
    }));
  } catch (err: any) {
    console.warn(`Arbeitnow live scraper warning: ${err.message}`);
    return [];
  }
}
