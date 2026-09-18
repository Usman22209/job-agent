import axios from 'axios';
import { cleanHtmlText, cleanJobTitle, cleanCompany } from '../normalizer';

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
            // Postings frequently include company URLs in parts[1], e.g. "Enrollment123 | https://e123insurtech.com | Staff Platform Engineer | REMOTE"
            const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean);
            const firstLine = lines[0] || '';
            const parts = firstLine.split('|').map((p) => p.trim()).filter(Boolean);

            let rawCompany = 'Tech Startup';
            let rawTitle = 'Software Engineer';
            let location = 'Remote';
            let companyUrl = '';

            const isUrl = (str: string) =>
              /^https?:\/\//i.test(str) ||
              /^www\./i.test(str) ||
              /^[a-z0-9-]+\.(com|io|ai|co|org|net|tech|dev|app)/i.test(str);

            const isLocationOrMeta = (str: string) =>
              /^(remote|onsite|on-site|hybrid|relocation|visa|full-?time|part-?time|contract|intern(ship)?|\$|€|£)/i.test(str) ||
              /\b(remote|onsite|hybrid|us only|worldwide|anywhere|nyc|san francisco|sf|london|berlin|europe|new york)\b/i.test(str);

            const isJobTitle = (str: string) =>
              /\b(engineer|developer|architect|lead|cto|designer|manager|fullstack|full-stack|backend|back-end|frontend|front-end|devops|sre|data|ml|ai|mobile|ios|android|product|qa|analyst|specialist|intern|vp|director|head of)\b/i.test(str);

            if (parts.length >= 1) {
              rawCompany = parts[0];

              const remainingParts = parts.slice(1);
              const nonUrlParts: string[] = [];
              const locationParts: string[] = [];

              for (const part of remainingParts) {
                if (isUrl(part)) {
                  if (!companyUrl) companyUrl = part.startsWith('http') ? part : `https://${part}`;
                } else if (isLocationOrMeta(part)) {
                  locationParts.push(part);
                } else {
                  nonUrlParts.push(part);
                }
              }

              // 1. Try to find a clear job title from non-URL parts
              const titleMatch = nonUrlParts.find((p) => isJobTitle(p));
              if (titleMatch) {
                rawTitle = titleMatch;
              } else if (nonUrlParts.length > 0) {
                rawTitle = nonUrlParts[0];
              } else {
                // If all non-company parts were meta/location or URL, check if any meta part contains role keywords
                const metaTitle = locationParts.find((p) => isJobTitle(p));
                if (metaTitle) {
                  rawTitle = metaTitle;
                } else {
                  // Fallback: search early lines of description for "hiring a ..." / "looking for a ..."
                  const roleRegex = /(?:looking for|hiring|seeking)\s+(?:an?\s+)?([A-Za-z0-9\s\/\-+]+?(?:Engineer|Developer|Architect|Designer|Manager|Lead|CTO))/i;
                  const descMatch = cleanText.match(roleRegex);
                  if (descMatch && descMatch[1] && descMatch[1].length < 60) {
                    rawTitle = descMatch[1].trim();
                  } else {
                    rawTitle = 'Software Engineer';
                  }
                }
              }

              if (locationParts.length > 0) {
                location = locationParts.join(' | ');
              }
            } else if (firstLine.length < 80 && !isUrl(firstLine)) {
              rawTitle = firstLine;
            }

            const company = cleanCompany(rawCompany);
            const title = cleanJobTitle(rawTitle, company);

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
