import axios from 'axios';
import * as cheerio from 'cheerio';
import { cleanHtmlText } from '../normalizer';

const WWR_FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
];

/**
 * Scrapes top remote programming and engineering jobs across multiple We Work Remotely RSS feeds.
 * 100% free, public, high quality remote developer opportunities.
 */
export async function searchWeWorkRemotelyJobs(query: string = '', limit: number = 80): Promise<any[]> {
  try {
    const jobs: any[] = [];
    const seenLinks = new Set<string>();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

    const feedPromises = WWR_FEEDS.map((url) =>
      axios
        .get(url, {
          timeout: 12000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
        })
        .then((res) => res.data)
        .catch((err) => {
          console.warn(`[WWR Scraper] Feed warning for ${url}:`, err.message);
          return null;
        })
    );

    const feedResults = await Promise.allSettled(feedPromises);

    for (const result of feedResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;

      const $ = cheerio.load(result.value, { xmlMode: true });
      const items = $('item').toArray();

      for (const el of items) {
        const $item = $(el);
        const link = $item.find('link').text().trim();
        if (!link || seenLinks.has(link)) continue;
        seenLinks.add(link);

        const rawTitle = $item.find('title').text().trim();
        const pubDate = $item.find('pubDate').text().trim();
        const rawDescription = $item.find('description').text().trim();
        const cleanDescription = cleanHtmlText(rawDescription);

        // WWR titles are typically "Company Name: Job Title"
        let company = 'Remote Company';
        let title = rawTitle;
        if (rawTitle.includes(':')) {
          const parts = rawTitle.split(':');
          company = parts[0].trim();
          title = parts.slice(1).join(':').trim();
        }

        if (query) {
          const q = query.toLowerCase();
          const combined = `${title} ${company} ${cleanDescription}`.toLowerCase();
          if (!combined.includes(q)) continue;
        }

        // Check if description has direct email
        const emailMatch = cleanDescription.match(emailRegex);
        const contactEmail = emailMatch ? emailMatch[0].toLowerCase() : undefined;

        jobs.push({
          source: 'weworkremotely',
          source_id: link || String(Math.random()),
          title,
          company,
          location: 'Remote Worldwide',
          is_remote: true,
          description: cleanDescription,
          url: link,
          application_url: link,
          contact_email: contactEmail,
          application_type: contactEmail ? 'EMAIL' : 'WEB_FORM',
          salary_min: null,
          salary_max: null,
          currency: 'USD',
          posted_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          tags: ['weworkremotely', 'remote-programming'],
          metadata: { link, pubDate },
        });

        if (jobs.length >= limit) break;
      }

      if (jobs.length >= limit) break;
    }

    console.log(`[WWR Scraper] ✓ Fetched ${jobs.length} jobs across We Work Remotely feeds.`);
    return jobs;
  } catch (err: any) {
    console.warn(`WeWorkRemotely live scraper warning: ${err.message}`);
    return [];
  }
}
