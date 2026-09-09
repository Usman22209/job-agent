import axios from 'axios';

export async function searchGoogleJobs(query: string, location: string = 'Remote'): Promise<any[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey || apiKey === 'your-serpapi-key') {
    return [];
  }

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_jobs',
        q: `${query} ${location}`,
        api_key: apiKey,
      },
      timeout: 12000,
    });

    const jobs = response.data?.jobs_results || [];
    return jobs.map((item: any) => ({
      source: 'serpapi',
      source_id: item.job_id || item.link,
      title: item.title,
      company: item.company_name,
      location: item.location,
      description: item.description,
      url: item.share_link || item.link,
      application_url: item.apply_options?.[0]?.link || item.share_link,
      posted_at: item.detected_extensions?.posted_at,
      metadata: item,
    }));
  } catch (err: any) {
    console.warn(`SerpApi search warning: ${err.message}`);
    return [];
  }
}
