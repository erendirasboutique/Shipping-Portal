import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';

export const dynamic = 'force-dynamic';
// Photos from a phone can be a few MB. The default body limit is fine for
// route handlers reading formData, but be explicit about the runtime —
// the edge runtime can't do what the storage client needs.
export const runtime = 'nodejs';

const BUCKET = 'live-items';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

/**
 * Drag-and-drop photo upload for catalog items.
 *
 * Goes through the server with the service role key rather than uploading
 * from the browser, so no storage credentials ever reach the client and
 * there are no insert policies to get wrong.
 *
 * Returns { url } — a public URL you can drop straight into an item's
 * photo field.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file was included.' }, { status: 400 });
    }

    const blob = file as File;

    if (blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'That image is over 10MB. Try a smaller one.' },
        { status: 413 }
      );
    }

    const type = blob.type || 'image/jpeg';
    if (!ALLOWED.includes(type.toLowerCase())) {
      return NextResponse.json({ error: 'That needs to be an image file.' }, { status: 415 });
    }

    // Filename from the original is a liability: spaces, emoji, accents,
    // and collisions when two staff both upload "IMG_0001.jpg". Generate
    // one instead and keep only the extension.
    const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const saleId = form.get('saleId');
    const folder = typeof saleId === 'string' && saleId ? saleId : 'misc';
    const name = `${folder}/${crypto.randomUUID()}.${ext}`;

    const bytes = new Uint8Array(await blob.arrayBuffer());

    const db = liveDb();
    const upload = await db.storage.from(BUCKET).upload(name, bytes, {
      contentType: type,
      upsert: false,
      cacheControl: '31536000', // a year — the name is unique, so it can't go stale
    });

    if (upload.error) {
      const msg = upload.error.message ?? 'Upload failed';
      if (/bucket not found/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              'The live-items storage bucket does not exist. Run 20260716000300_photo_storage.sql in Supabase.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { data } = db.storage.from(BUCKET).getPublicUrl(name);

    return NextResponse.json({ url: data.publicUrl, path: name }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Upload failed' }, { status: 500 });
  }
}
