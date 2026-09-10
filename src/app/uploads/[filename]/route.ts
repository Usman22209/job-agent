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

    const filePath = path.resolve(process.cwd(), 'public/uploads', filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File ${filename} not found` }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const contentType = filename.endsWith('.pdf')
      ? 'application/pdf'
      : filename.endsWith('.txt')
      ? 'text/plain; charset=utf-8'
      : 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
