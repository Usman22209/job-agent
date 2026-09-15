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
      case 'requeueApplied': {
        const res = store.moveAppliedToQueue();
        return NextResponse.json(res);
      }
      case 'reload': {
        store.reloadFromDisk();
        return NextResponse.json({ success: true, message: 'Store reloaded from disk' });
      }
      case 'toggleAutonomous': {
        const res = store.toggleAutonomousMode(Boolean(body.enabled));
        return NextResponse.json({ success: true, autonomous: res });
      }
      case 'setAutonomousConfig': {
        const res = store.setAutonomousConfig({
          dailyLimit: body.dailyLimit ? Number(body.dailyLimit) : undefined,
          cooldownMinutes: body.cooldownMinutes ? Number(body.cooldownMinutes) : undefined,
        });
        return NextResponse.json({ success: true, autonomous: res });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
