import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { JobStatus } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as JobStatus | undefined;
  const search = searchParams.get('search') || undefined;
  const source = searchParams.get('source') || undefined;

  const jobs = store.getJobs({ status, search, source });
  return NextResponse.json(jobs);
}
