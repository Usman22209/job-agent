import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

const POPULAR_GREENHOUSE_BOARDS = [
  'gitlab',
  'cloudflare',
  'stripe',
  'figma',
  'github',
  'canonical',
  'automattic',
  'datadog',
  'discord',
  'dropbox',
  'elastic',
  'mongodb',
  'hashicorp',
];

export async function searchGreenhouseJobs(
  query: string = '',
  limit: number = 30
): Promise<any[]> {
  try {
    const qLower = query.toLowerCase().trim();
    // Select top 6 boards per pass for fast parallel fetching
    const selectedBoards = POPULAR_GREENHOUSE_BOARDS.slice(0, 6);

    const promises = selectedBoards.map(async (board) => {
      try {
        const response = await axios.get(
          `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`,
          {
            timeout: 5000,
            headers: {
              'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
            },
          }
        );
        return { board, jobs: response.data?.jobs || [] };
      } catch {
        return { board, jobs: [] };
      }
    });

    const results = await Promise.allSettled(promises);
    const candidateJobs: { board: string; raw: any }[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value?.jobs)) {
        for (const raw of res.value.jobs) {
          const title = raw.title || '';
          const location = raw.location?.name || 'Remote';

          const matches =
            !qLower ||
            title.toLowerCase().includes(qLower) ||
            location.toLowerCase().includes(qLower);

          if (matches) {
            candidateJobs.push({ board: res.value.board, raw });
            if (candidateJobs.length >= limit) break;
          }
        }
      }
      if (candidateJobs.length >= limit) break;
    }

    // For matched jobs, fetch full descriptions in parallel (up to 8 jobs)
    const jobsToEnrich = candidateJobs.slice(0, Math.min(candidateJobs.length, 8));
    const enrichedPromises = jobsToEnrich.map(async ({ board, raw }) => {
      try {
        const detailRes = await axios.get(
          `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${raw.id}`,
          {
            timeout: 3000,
            headers: {
              'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
            },
          }
        );
        return detailRes.data?.content || '';
      } catch {
        return '';
      }
    });

    const enrichedContents = await Promise.allSettled(enrichedPromises);

    return candidateJobs.map(({ board, raw }, idx) => {
      const title = raw.title || 'Software Engineer';
      const location = raw.location?.name || 'Remote';
      const company = raw.company_name || board.charAt(0).toUpperCase() + board.slice(1);
      const isRemote =
        location.toLowerCase().includes('remote') ||
        title.toLowerCase().includes('remote');

      const content =
        (enrichedContents[idx]?.status === 'fulfilled'
          ? (enrichedContents[idx] as PromiseFulfilledResult<string>).value
          : '') || `${title} position at ${company}. Location: ${location}. Apply directly via Greenhouse ATS.`;

      return {
        source: 'greenhouse',
        source_id: String(raw.id || raw.internal_job_id),
        title,
        company,
        location,
        is_remote: Boolean(isRemote),
        description: cleanHtmlText(content),
        url: raw.absolute_url,
        application_url: raw.absolute_url,
        salary_min: null,
        salary_max: null,
        currency: 'USD',
        posted_at: raw.updated_at || new Date().toISOString(),
        tags: ['ATS Direct', board],
        metadata: raw,
      };
    });
  } catch (err: any) {
    console.warn(`Greenhouse ATS search warning: ${err.message}`);
    return [];
  }
}
