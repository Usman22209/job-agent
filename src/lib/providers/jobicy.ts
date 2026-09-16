import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

export async function searchJobicyJobs(query: string = '', limit: number = 30, geo?: string): Promise<any[]> {
  try {
    let url = `https://jobicy.com/api/v2/remote-jobs?count=${limit}`;
    if (query) {
      const sanitizedTag = query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      url += `&tag=${encodeURIComponent(sanitizedTag)}`;
    } else {
      url += `&industry=engineering`;
    }
    if (geo && geo !== 'Worldwide' && geo !== 'Remote' && geo !== 'anywhere') {
      url += `&geo=${encodeURIComponent(geo.toLowerCase())}`;
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
      },
    });

    const jobs = response.data?.jobs || [];
    return jobs.map((item: any) => ({
      source: 'jobicy',
      source_id: String(item.id),
      title: item.jobTitle,
      company: item.companyName,
      location: item.jobGeo || 'Remote Worldwide',
      is_remote: true,
      description: cleanHtmlText(item.jobDescription),
      url: item.url,
      application_url: item.url,
      salary_min: item.annualSalaryMin ? Number(item.annualSalaryMin) : null,
      salary_max: item.annualSalaryMax ? Number(item.annualSalaryMax) : null,
      currency: item.salaryCurrency || 'USD',
      posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      tags: [],
      metadata: item,
    }));
  } catch (err: any) {
    console.warn(`Jobicy live scraper warning: ${err.message}`);
    return [];
  }
}
