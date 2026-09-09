import axios from 'axios';
import { cleanHtmlText } from '../normalizer';

export async function searchRemoteOkJobs(query: string = '', limit: number = 40): Promise<any[]> {
  try {
    const response = await axios.get('https://remoteok.com/api', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    // RemoteOK returns an array where first item is legal/notice object
    const rawJobs = Array.isArray(response.data) ? response.data.slice(1) : [];

    let filtered = rawJobs;
    if (query) {
      const q = query.toLowerCase();
      filtered = rawJobs.filter((item: any) => {
        const titleMatch = item.position?.toLowerCase().includes(q);
        const tagsMatch = Array.isArray(item.tags) && item.tags.some((t: string) => t.toLowerCase().includes(q));
        const descMatch = item.description?.toLowerCase().includes(q);
        return titleMatch || tagsMatch || descMatch;
      });
    }

    return filtered.slice(0, limit).map((item: any) => ({
      source: 'remoteok',
      source_id: String(item.id || item.slug || Math.random()),
      title: item.position || 'Remote Developer',
      company: item.company || 'Tech Company',
      location: item.location || 'Remote Worldwide',
      is_remote: true,
      description: cleanHtmlText(item.description),
      url: item.url || (item.slug ? `https://remoteok.com/remote-jobs/${item.slug}` : 'https://remoteok.com'),
      application_url: item.apply_url || item.url || (item.slug ? `https://remoteok.com/remote-jobs/${item.slug}` : 'https://remoteok.com'),
      salary_min: item.salary_min ? Number(item.salary_min) : null,
      salary_max: item.salary_max ? Number(item.salary_max) : null,
      currency: 'USD',
      posted_at: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      tags: item.tags || [],
      metadata: item,
    }));
  } catch (err: any) {
    console.warn(`RemoteOK live scraper warning: ${err.message}`);
    return [];
  }
}
