import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = body.query || body.search;
    const location = body.location || 'Remote';

    if (query) {
      const result = await store.scrapeLiveJobs(query, location);
      return NextResponse.json({
        message: `Live scrape finished: Found ${result.scrapedThisPass} positions across live providers (${result.newJobs.length} new).`,
        newJobsCount: result.newJobs.length,
        scrapedThisPass: result.scrapedThisPass,
        totalJobs: result.total,
        sourceCounts: result.sourceCounts,
      });
    }

    const queries = body.queries || ['React Native', 'React', 'Next.js', 'AI Engineer'];
    const result = await store.runDiscovery(queries, location);
    return NextResponse.json({
      message: `Discovered ${result.newJobs.length} new positions across live platforms.`,
      newJobsCount: result.newJobs.length,
      totalJobs: result.total,
      sourceCounts: result.sourceCounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
