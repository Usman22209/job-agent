import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

export async function searchRemotiveJobs(query: string = '', limit: number = 40): Promise<any[]> {
  try {
    const url = query 
      ? `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${limit}`
      : `https://remotive.com/api/remote-jobs?category=software-dev&limit=${limit}`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
      },
    });

    const jobs = response.data?.jobs || [];
    return jobs.map((item: any) => {
      // Parse salary if available (e.g. "$120,000 - $150,000" or "$100k")
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      if (item.salary) {
        const matches = String(item.salary).match(/\$?([\d,]+)/g);
        if (matches && matches.length >= 2) {
          salaryMin = parseInt(matches[0].replace(/[^\d]/g, ''), 10);
          salaryMax = parseInt(matches[1].replace(/[^\d]/g, ''), 10);
        } else if (matches && matches.length === 1) {
          salaryMin = parseInt(matches[0].replace(/[^\d]/g, ''), 10);
        }
      }

      return {
        source: 'remotive',
        source_id: String(item.id),
        title: item.title,
        company: item.company_name,
        location: item.candidate_required_location || 'Remote Worldwide',
        is_remote: true,
        description: cleanHtmlText(item.description),
        url: item.url,
        application_url: item.url,
        salary_min: salaryMin,
        salary_max: salaryMax,
        currency: 'USD',
        posted_at: item.publication_date || new Date().toISOString(),
        tags: item.tags || [],
        metadata: item,
      };
    });
  } catch (err: any) {
    console.warn(`Remotive live scraper warning: ${err.message}`);
    return [];
  }
}
