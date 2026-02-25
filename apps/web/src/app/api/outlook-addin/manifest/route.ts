import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/outlook-addin/manifest
 * Serves the Outlook add-in manifest.xml with the correct app URL substituted in.
 */
export async function GET() {
  try {
    const manifestPath = join(process.cwd(), '..', '..', 'apps', 'outlook-addin', 'manifest.xml');
    let manifest = readFileSync(manifestPath, 'utf-8');

    // Replace localhost:3000 with the actual app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    manifest = manifest.replaceAll('https://localhost:3000', appUrl);
    manifest = manifest.replaceAll('http://localhost:3000', appUrl);

    return new NextResponse(manifest, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="lb-bot-manifest.xml"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
  }
}
