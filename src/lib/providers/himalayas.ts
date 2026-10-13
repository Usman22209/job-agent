import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

export async function searchHimalayasJobs(
  query: string = '',
  limit: number = 30
): Promise<any[]> {
  try {
    const qParam = query ? `&q=${encodeURIComponent(query)}` : '';
    const url = `https://himalayas.app/jobs/api/search?limit=20${qParam}`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
      },
    });

    const jobs = response.data?.jobs || [];
    return jobs.slice(0, limit).map((item: any) => {
      const locationRestrictions = Array.isArray(item.locationRestrictions)
        ? item.locationRestrictions.slice(0, 3).join(', ')
        : '';
      const location = locationRestrictions
        ? `Remote (${locationRestrictions})`
        : 'Remote Worldwide';

      return {
        source: 'himalayas',
        source_id: item.guid || item.applicationLink || String(item.pubDate || Math.random()),
        title: item.title,
        company: item.companyName || 'Tech Startup',
        location,
        is_remote: true,
        description: cleanHtmlText(item.description || ''),
        url: item.applicationLink || item.guid,
        application_url: item.applicationLink || item.guid,
        salary_min: item.minSalary ? Number(item.minSalary) : null,
        salary_max: item.maxSalary ? Number(item.maxSalary) : null,
        currency: item.currency || 'USD',
        posted_at: item.pubDate
          ? new Date(item.pubDate * 1000).toISOString()
          : new Date().toISOString(),
        tags: Array.isArray(item.categories) ? item.categories : [],
        metadata: item,
      };
    });
  } catch (err: any) {
    console.warn(`Himalayas live search warning: ${err.message}`);
    return [];
  }
}
