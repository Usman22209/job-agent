import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

/**
 * Scrapes direct startup & YC tech jobs from Hacker News "Ask HN: Who is hiring?" monthly threads.
 * Algolia provides a 100% free, unauthenticated, reliable REST API for Hacker News.
 * This is the #1 source for direct founder/CTO/recruiter email addresses.
 * 
 * Deep pagination across multiple active monthly threads (current month + past 2 months)
 * with multi-page comment retrieval to ensure hundreds of high-yield opportunities.
 */
export async function searchHackerNewsJobs(query: string = '', limit: number = 150): Promise<any[]> {
  try {
    // 1. Find the top 3 recent "Ask HN: Who is hiring?" stories (current month + last 2 months)
    const storyRes = await axios.get(
      'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=Who+is+hiring',
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
        },
      }
    );

    const stories = (storyRes.data?.hits || [])
      .filter(
        (s: any) =>
          s.title &&
          s.title.toLowerCase().includes('who is hiring') &&
          !s.title.toLowerCase().includes('who wants to be hired')
      )
      .slice(0, 3);

    if (stories.length === 0) {
      console.warn('[HackerNews Scraper] No recent "Who is hiring" stories found.');
      return [];
    }

    console.log(
      `[HackerNews Scraper] 📰 Scanning ${stories.length} monthly "Who is hiring" threads: ${stories.map((s: any) => s.title).join(', ')}...`
    );

    const jobs: any[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const seenEmails = new Set<string>();

    for (const story of stories) {
      const storyId = story.objectID;

      // Paginate through pages 0, 1, 2, 3 of each monthly story
      for (let page = 0; page < 4; page++) {
        try {
          const commentsRes = await axios.get(
            `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=100&page=${page}`,
            {
              timeout: 10000,
              headers: {
                'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
              },
            }
          );

          const comments = commentsRes.data?.hits || [];
          if (comments.length === 0) break;

          for (const comment of comments) {
            const rawText = comment.comment_text || '';
            if (!rawText || rawText.length < 50) continue;

            const cleanText = cleanHtmlText(rawText);

            // Extract email address
            const emailMatch = cleanText.match(emailRegex);
            if (!emailMatch) continue; // In email-only mode, only keep postings with direct hiring emails!

            const contactEmail = emailMatch[0].toLowerCase();
            // Filter out common false positives
            if (
              contactEmail.includes('example.com') ||
              contactEmail.includes('github.com') ||
              contactEmail.includes('ycombinator.com') ||
              contactEmail.includes('sentry.io') ||
              contactEmail.includes('w3.org') ||
              contactEmail.endsWith('.png') ||
              contactEmail.endsWith('.jpg')
            ) {
              continue;
            }

            if (seenEmails.has(contactEmail)) continue;
            seenEmails.add(contactEmail);

            // Extract Company and Title from first line
            // Standard HN format: "Company Name | Job Title | Location | Remote | ..."
            const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean);
            const firstLine = lines[0] || '';
            const parts = firstLine.split('|').map((p) => p.trim());

            let company = 'Tech Startup';
            let title = 'Software Engineer';
            let location = 'Remote';

            if (parts.length >= 2) {
              company = parts[0];
              title = parts[1];
              if (parts.length >= 3) {
                location = parts.slice(2).join(' | ');
              }
            } else if (parts.length === 1 && firstLine.length < 80) {
              title = firstLine;
            }

            // Filter by query if provided
            if (query) {
              const q = query.toLowerCase();
              const fullContent = `${title} ${company} ${cleanText}`.toLowerCase();
              if (!fullContent.includes(q)) continue;
            }

            jobs.push({
              source: 'hackernews',
              source_id: String(comment.objectID),
              title,
              company,
              location: location.toLowerCase().includes('remote') ? location : `${location} (Remote)`,
              is_remote: true,
              description: cleanText,
              url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
              application_url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
              contact_email: contactEmail,
              application_type: 'EMAIL',
              salary_min: null,
              salary_max: null,
              currency: 'USD',
              posted_at: comment.created_at || new Date().toISOString(),
              tags: ['hackernews', 'startup', 'direct-founder'],
              metadata: {
                hn_story_id: storyId,
                hn_comment_id: comment.objectID,
                author: comment.author,
              },
            });

            if (jobs.length >= limit) break;
          }
        } catch (pageErr: any) {
          console.warn(`[HackerNews Scraper] Warning on story ${storyId} page ${page}:`, pageErr.message);
          break;
        }

        if (jobs.length >= limit) break;
      }

      if (jobs.length >= limit) break;
    }

    console.log(`[HackerNews Scraper] ✓ Successfully found ${jobs.length} direct-email startup opportunities across Hacker News!`);
    return jobs;
  } catch (err: any) {
    console.warn(`HackerNews live scraper warning: ${err.message}`);
    return [];
  }
}
