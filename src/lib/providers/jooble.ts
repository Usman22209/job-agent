import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

/**
 * Parses salary strings like "$87.72k - $131.58k", "$90,000 - $120,000", or "$110k"
 */
function parseSalaryRange(salaryStr?: string): { min: number | null; max: number | null } {
  if (!salaryStr) return { min: null, max: null };
  const parts = salaryStr.split('-').map((s) => s.trim());

  const parseVal = (val: string): number | null => {
    if (!val) return null;
    const isK = val.toLowerCase().includes('k');
    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return null;
    return Math.round(isK ? num * 1000 : num);
  };

  if (parts.length >= 2) {
    return { min: parseVal(parts[0]), max: parseVal(parts[1]) };
  } else if (parts.length === 1) {
    return { min: parseVal(parts[0]), max: null };
  }
  return { min: null, max: null };
}

export async function searchJoobleJobs(
  query: string = '',
  location: string = 'Remote',
  limit: number = 30
): Promise<any[]> {
  const apiKey = process.env.JOOBLE_API_KEY || '02f72de9-dbbb-48c0-919c-f172e63d917d';
  if (!apiKey) {
    return [];
  }

  try {
    const payload = {
      keywords: query || 'developer',
      location: location || 'Remote',
      page: 1,
    };

    const response = await axios.post(`https://jooble.org/api/${apiKey}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
      },
      timeout: 12000,
    });

    const jobs = response.data?.jobs || [];
    return jobs.slice(0, limit).map((item: any) => {
      const { min: salaryMin, max: salaryMax } = parseSalaryRange(item.salary);
      const isRemote =
        (item.location && item.location.toLowerCase().includes('remote')) ||
        (item.title && item.title.toLowerCase().includes('remote')) ||
        location.toLowerCase().includes('remote');

      return {
        source: 'jooble',
        source_id: String(item.id || Math.random()),
        title: item.title,
        company: item.company || 'Confidential Employer',
        location: item.location || location || 'Remote',
        is_remote: Boolean(isRemote),
        description: cleanHtmlText(item.snippet || ''),
        url: item.link,
        application_url: item.link,
        salary_min: salaryMin,
        salary_max: salaryMax,
        currency: 'USD',
        posted_at: item.updated ? new Date(item.updated).toISOString() : new Date().toISOString(),
        tags: item.type ? [item.type] : [],
        metadata: item,
      };
    });
  } catch (err: any) {
    console.warn(`Jooble live search warning: ${err.message}`);
    return [];
  }
}
