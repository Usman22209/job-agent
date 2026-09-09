import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { parseResumeAndExtractProfile } from '@/lib/resume-parser';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('resume') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No resume file uploaded' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await parseResumeAndExtractProfile({
        fileBuffer: buffer,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
      });

      const updated = store.updateProfile(extracted);
      return NextResponse.json({
        success: true,
        message: `Master resume "${file.name}" uploaded and parsed with Gemini AI!`,
        profile: updated,
      });
    }

    // JSON fallback for text paste or base64
    const body = await req.json().catch(() => ({}));
    if (body.text) {
      const buffer = Buffer.from(body.text, 'utf8');
      const extracted = await parseResumeAndExtractProfile({
        fileBuffer: buffer,
        fileName: body.fileName || 'resume.txt',
        mimeType: 'text/plain',
        textContent: body.text,
      });

      const updated = store.updateProfile(extracted);
      return NextResponse.json({
        success: true,
        message: 'Resume text parsed and Master Profile updated with Gemini AI!',
        profile: updated,
      });
    }

    return NextResponse.json({ error: 'Invalid upload format. Please upload a file or provide text.' }, { status: 400 });
  } catch (err: any) {
    console.error('Resume upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
