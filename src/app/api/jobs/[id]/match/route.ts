import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const match = await store.matchJob(params.id);
    return NextResponse.json(match);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
