import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { ApplicationStatus } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const status = body.status as ApplicationStatus;
    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const application = store.updateApplicationStatus(params.id, status);
    return NextResponse.json(application);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
