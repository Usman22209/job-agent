import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await store.sendEmailForApplication(params.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
