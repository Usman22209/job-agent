import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET() {
  const status = store.getSchedulerStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'toggle') {
      const res = store.toggleScheduler(Boolean(body.enabled));
      return NextResponse.json(res);
    }

    if (body.action === 'setInterval') {
      const minutes = Number(body.minutes) || 2;
      const res = store.setSchedulerInterval(minutes);
      return NextResponse.json(res);
    }

    // Default: run now
    const res = await store.executeLocalAgentPipeline();
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
