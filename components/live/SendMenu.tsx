'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/live/i18n';

type Mode = 'share' | 'clipboard';

/**
 * Sending a basket to a customer.
 *
 * What's actually possible, and what isn't:
 *
 * No web page can put a photo into Messenger's compose box. That's a
 * browser security boundary — a page can't reach into another app. Any
 * tool claiming otherwise is either a browser extension or a Page-based
 * Send API, and neither applies to a personal-profile live sale.
 *
 * So there are two honest paths:
 *
 *   Phone — navigator.share() with the text AND the photo as a file.
 *   That's the real native share sheet: tap Messenger, and it opens with
 *   both already attached. One tap from sent. This is the good path, and
 *   it's why running Thursday night from a phone is worth it.
 *
 *   Desktop — no share sheet. Copy the text, copy the image to the
 *   clipboard, open the thread, paste. Two paste operations, but nothing
 *   to retype and no math to redo.
 */
export default function SendMenu({
  text,
  photoUrl,
  disabled,
}: {
  text: string;
  photoUrl: string | null;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>('clipboard');
  const [state, setState] = useState<'idle' | 'working' | 'sent' | 'copied' | 'error'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  // Feature-detect rather than sniff the user agent. Desktop Safari has
  // navigator.share but can't take files; canShare({files}) is the only
  // answer that's actually true.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    if (!photoUrl) {
      setMode('share');
      return;
    }
    try {
      const probe = new File([new Blob([''])], 'probe.jpg', { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [probe] })) setMode('share');
    } catch {
      setMode('clipboard');
    }
  }, [photoUrl]);

  async function fetchPhoto(): Promise<File | null> {
    if (!photoUrl) return null;
    try {
      const res = await fetch(photoUrl);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      return new File([blob], `basket.${ext}`, { type: blob.type });
    } catch {
      return null;
    }
  }

  async function send() {
    setProblem(null);
    setState('working');

    try {
      if (mode === 'share') {
        const file = await fetchPhoto();
        const payload: any = { text };
        if (file && navigator.canShare?.({ files: [file] })) payload.files = [file];

        await navigator.share(payload);
        setState('sent');
        setTimeout(() => setState('idle'), 2000);
        return;
      }

      // Desktop: text first — that's the part they can't retype.
      await navigator.clipboard.writeText(text);

      const file = await fetchPhoto();
      if (file && typeof ClipboardItem !== 'undefined') {
        try {
          // Only PNG is reliably accepted by the clipboard across browsers.
          const png = await toPng(file);
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
          setState('copied');
          setProblem(t.copiedBoth);
        } catch {
          setState('copied');
          setProblem(t.copiedTextOnly);
        }
      } else {
        setState('copied');
      }

      setTimeout(() => setState('idle'), 2600);
    } catch (err: any) {
      // The user dismissing the share sheet isn't a failure.
      if (err?.name === 'AbortError') {
        setState('idle');
        return;
      }
      setState('error');
      setProblem(t.sendFailed);
    }
  }

  return (
    <div className="send">
      <button className="live__btn live__btn--send" onClick={send} disabled={disabled}>
        {state === 'working'
          ? t.sending
          : state === 'sent'
            ? t.sent
            : state === 'copied'
              ? t.copied
              : mode === 'share'
                ? t.sendToMessenger
                : t.copyForMessenger}
      </button>

      {mode === 'clipboard' && state === 'copied' && (
        <a
          className="live__btn live__btn--ghost send__open"
          href="https://www.messenger.com/"
          target="_blank"
          rel="noreferrer"
        >
          {t.openMessenger}
        </a>
      )}

      {problem && <p className="send__note">{problem}</p>}
      {mode === 'clipboard' && state === 'idle' && <p className="send__hint">{t.desktopHint}</p>}
    </div>
  );
}

/** Clipboard image writes only reliably accept PNG. Repaint through a canvas. */
async function toPng(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png')
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
