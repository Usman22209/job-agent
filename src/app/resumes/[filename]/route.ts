import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const rawFilename = params.filename;
    const filename = decodeURIComponent(rawFilename);

    // 1. Try public/resumes/
    let filePath = path.resolve(process.cwd(), 'public/resumes', filename);
    if (!fs.existsSync(filePath)) {
      // 2. Try storage/resumes/
      filePath = path.resolve(process.cwd(), 'storage/resumes', filename);
    }
    if (!fs.existsSync(filePath)) {
      // 3. Try public/uploads/
      filePath = path.resolve(process.cwd(), 'public/uploads', filename);
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File ${filename} not found` }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
