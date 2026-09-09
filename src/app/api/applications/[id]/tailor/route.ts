import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const application = await store.tailorApplication(params.id);
    return NextResponse.json(application);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
