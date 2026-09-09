import { NextRequest, NextResponse } from 'next/server';
import { inspectJobApplicationUrl } from '@/lib/browser-inspector';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url;
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const task = await inspectJobApplicationUrl(url);
    return NextResponse.json(task);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
