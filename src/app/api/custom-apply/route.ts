import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      company,
      description,
      recipientEmail,
      location = 'Remote',
      autoSend = false,
      customSubject,
      customBody,
    } = body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'Job description is required.' },
        { status: 400 }
      );
    }

    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.trim()) {
      return NextResponse.json(
        { error: 'Recipient email address is required.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = recipientEmail.trim();
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Please provide a valid recipient email address.' },
        { status: 400 }
      );
    }

    // Heuristics for title/company if not explicitly provided
    let finalTitle = (title || '').trim();
    let finalCompany = (company || '').trim();

    if (!finalTitle) {
      // Try to extract from first 3 lines of description
      const lines = description.split('\n').map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines.slice(0, 3)) {
        if (line.length > 4 && line.length < 70 && !line.includes('@')) {
          finalTitle = line.replace(/^(Job Title|Position|Role|Title):?\s*/i, '');
          break;
        }
      }
      if (!finalTitle) finalTitle = 'Software Engineer';
    }

    if (!finalCompany) {
      finalCompany = 'Hiring Team';
    }

    const result = await store.createCustomApplication({
      title: finalTitle,
      company: finalCompany,
      description: description.trim(),
      recipientEmail: cleanEmail,
      location,
      autoSend: Boolean(autoSend),
      customSubject,
      customBody,
    });

    return NextResponse.json({
      success: true,
      application: result.application,
      emailResult: result.emailResult,
      coverLetter: result.coverLetter,
      emailDraft: result.emailDraft,
      pdfUrl: result.pdfUrl,
    });
  } catch (err: any) {
    console.error('[API custom-apply] Error processing custom application:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process custom application.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const allApps = store.getApplications();
    const manualApps = allApps.filter((a) => a.job?.source === 'manual');
    return NextResponse.json(manualApps);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch manual applications' },
      { status: 500 }
    );
  }
}
