import axios from 'axios';

export async function searchAdzunaJobs(query: string, country: string = 'us'): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey || appId === 'your-adzuna-id') {
    return [];
  }

  try {
    const response = await axios.get(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`, {
      params: {
        app_id: appId,
        app_key: appKey,
        what: query,
        results_per_page: 10,
        content_type: 'application/json',
      },
      timeout: 12000,
    });

    const results = response.data?.results || [];
    return results.map((item: any) => ({
      source: 'adzuna',
      source_id: String(item.id),
      title: item.title,
      company: item.company?.display_name || 'Unknown Company',
      location: item.location?.display_name || 'Remote',
      description: item.description,
      salary_min: item.salary_min,
      salary_max: item.salary_max,
      url: item.redirect_url,
      application_url: item.redirect_url,
      posted_at: item.created,
      metadata: item,
    }));
  } catch (err: any) {
    console.warn(`Adzuna API search warning: ${err.message}`);
    return [];
  }
}
