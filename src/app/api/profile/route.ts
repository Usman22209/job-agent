import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET() {
  const profile = store.getProfile();
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  try {
    const updates = await req.json();
    const updated = store.updateProfile(updates);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}

