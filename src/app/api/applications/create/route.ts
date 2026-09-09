import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = body;
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const application = await store.createApplication(jobId);
    return NextResponse.json(application);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
