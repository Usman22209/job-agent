import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

/**
 * Scrapes direct startup & YC tech jobs from Hacker News "Ask HN: Who is hiring?" monthly threads.
 * Algolia provides a 100% free, unauthenticated, reliable REST API for Hacker News.
 * This is the #1 source for direct founder/CTO/recruiter email addresses.
 */
export async function searchHackerNewsJobs(query: string = '', limit: number = 80): Promise<any[]> {
  try {
    // 1. Find the latest "Ask HN: Who is hiring?" story
    const storyRes = await axios.get(
      'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=Who+is+hiring',
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
        },
      }
    );

    const stories = storyRes.data?.hits || [];
    // Select the latest story that matches "Who is hiring" (exclude "Who wants to be hired")
    const hiringStory = stories.find(
      (s: any) =>
        s.title &&
        s.title.toLowerCase().includes('who is hiring') &&
        !s.title.toLowerCase().includes('who wants to be hired')
    );

    if (!hiringStory) {
      console.warn('[HackerNews Scraper] No recent "Who is hiring" story found.');
      return [];
    }

    const storyId = hiringStory.objectID;
    console.log(`[HackerNews Scraper] 📰 Fetching "${hiringStory.title}" (Story ID: ${storyId})...`);

    // 2. Fetch comments from this story (each top-level comment is a job posting)
    const commentsRes = await axios.get(
      `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=${Math.min(limit * 2, 200)}`,
      {
        timeout: 12000,
        headers: {
          'User-Agent': 'JobAgent-Autonomous-Career-OS/1.0',
        },
      }
    );

    const comments = commentsRes.data?.hits || [];
    const jobs: any[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

    for (const comment of comments) {
      const rawText = comment.comment_text || '';
      if (!rawText || rawText.length < 50) continue;

      const cleanText = cleanHtmlText(rawText);

      // Extract email address
      const emailMatch = cleanText.match(emailRegex);
      if (!emailMatch) continue; // In email-only mode, we only want posts with direct emails!

      const contactEmail = emailMatch[0].toLowerCase();
      // Ignore common false positives
      if (
        contactEmail.includes('example.com') ||
        contactEmail.includes('github.com') ||
        contactEmail.includes('ycombinator.com')
      ) {
        continue;
      }

      // Extract Company and Title from first line
      // Standard format in HN: "Company Name | Job Title | Location | Remote | ..."
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

    console.log(`[HackerNews Scraper] ✓ Found ${jobs.length} direct-email startup opportunities on Hacker News!`);
    return jobs;
  } catch (err: any) {
    console.warn(`HackerNews live scraper warning: ${err.message}`);
    return [];
  }
}
