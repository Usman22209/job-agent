import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET() {
  const status = store.getQueueStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    switch (action) {
      case 'start': {
        const res = store.startAgent();
        return NextResponse.json(res);
      }
      case 'stop': {
        const res = store.stopAgent();
        return NextResponse.json(res);
      }
      case 'add': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
        }
        const res = store.addToQueue(body.jobId);
        return NextResponse.json(res);
      }
      case 'addAll': {
        const res = store.addAllToQueue();
        return NextResponse.json(res);
      }
      case 'remove': {
        if (!body.jobId) {
          return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
        }
        const res = store.removeFromQueue(body.jobId);
        return NextResponse.json(res);
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
