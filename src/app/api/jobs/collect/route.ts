import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query =
      body.query ||
      body.search ||
      req.nextUrl.searchParams.get('query') ||
      req.nextUrl.searchParams.get('search');
    const location =
      body.location || req.nextUrl.searchParams.get('location') || 'Remote';
    const autoQueue =
      body.autoQueue !== undefined
        ? Boolean(body.autoQueue)
        : req.nextUrl.searchParams.get('autoQueue') !== 'false';

    if (query) {
      const result = await store.scrapeLiveJobs(query, location);
      let queuedCount = 0;

      if (autoQueue) {
        // Automatically add newly scraped email jobs to queue
        for (const job of result.newJobs) {
          if (store['emailOnlyMode'] && !job.contact_email) continue;
          const addRes = store.addToQueue(job.id);
          if (addRes.success) queuedCount++;
        }

        // Also check if any existing unapplied email jobs in DB match this query and can be queued
        if (queuedCount === 0) {
          const q = query.toLowerCase();
          for (const job of store.getJobs()) {
            if (store['emailOnlyMode'] && !job.contact_email) continue;
            if (job.status !== 'APPLIED') {
              const fullText = `${job.title} ${job.company} ${job.description}`.toLowerCase();
              if (fullText.includes(q)) {
                const addRes = store.addToQueue(job.id);
                if (addRes.success) queuedCount++;
              }
            }
          }
        }
      }

      return NextResponse.json({
        message: `Live search finished: Found ${result.scrapedThisPass} positions across live providers (${result.newJobs.length} new, ${queuedCount} queued).`,
        newJobsCount: result.newJobs.length,
        queuedCount,
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
