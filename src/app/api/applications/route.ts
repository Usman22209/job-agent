import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { ApplicationStatus } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as ApplicationStatus | undefined;

  const applications = store.getApplications({ status });
  return NextResponse.json(applications);
}
