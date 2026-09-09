import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

export async function searchJobicyJobs(query: string = '', limit: number = 30): Promise<any[]> {
  try {
    const url = query
      ? `https://jobicy.com/api/v2/remote-jobs?count=${limit}&tag=${encodeURIComponent(query)}`
      : `https://jobicy.com/api/v2/remote-jobs?count=${limit}&industry=engineering`;

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
