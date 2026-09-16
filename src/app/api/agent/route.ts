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
        const res = store.addAllToQueue(body.emailOnly);
        return NextResponse.json(res);
      }
      case 'purgePortalJobs': {
        const res = store.purgePortalJobsFromQueue();
        return NextResponse.json({ success: true, ...res });
      }
      case 'setEmailOnly': {
        const res = store.setEmailOnlyMode(Boolean(body.enabled));
        return NextResponse.json({ success: true, emailOnly: res });
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
          emailOnly: typeof body.emailOnly === 'boolean' ? body.emailOnly : undefined,
        });
        return NextResponse.json({ success: true, autonomous: res });
      }
      case 'purgeNonEmailJobs': {
        const res = store.purgeNonEmailJobs();
        return NextResponse.json({ success: true, ...res });
      }
      case 'sweepMarkets': {
        // Kick off immediate multi-market & field sweep
        const res = await store.sweepAndReplenishQueue();
        return NextResponse.json({ success: true, ...res });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
