'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/lib/live/i18n';

/**
 * Drag a photo in, click to browse, or paste from the clipboard.
 *
 * Paste matters more than it sounds: if you're photographing the rack on
 * your phone and airdropping to the desktop, paste is the shortest path
 * from camera to catalog.
 */
export default function PhotoDrop({
  value,
  saleId,
  onChange,
}: {
  value: string | null;
  saleId?: string;
  onChange: (url: string | null) => void;
}) {
  const { t } = useLocale();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError(t.photoWrongType);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t.photoTooBig);
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      if (saleId) body.append('saleId', saleId);

      const res = await fetch('/api/live/upload', { method: 'POST', body });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t.uploadFailed);
        return;
      }
      onChange(json.url);
    } catch {
      setError(t.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  // Paste anywhere while the zone is focused or hovered.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const zone = zoneRef.current;
      if (!zone) return;
      if (!zone.contains(document.activeElement) && !zone.matches(':hover')) return;

      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/')
      );
      if (!item) return;

      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        upload(file);
      }
    }

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  if (value) {
    return (
      <div className="pd">
        <img className="pd__preview" src={value} alt="" />
        <div className="pd__actions">
          <button
            type="button"
            className="live__undo"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? t.uploading : t.replacePhoto}
          </button>
          <button type="button" className="live__undo" onClick={() => onChange(null)}>
            {t.removePhoto}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        {error && <p className="pd__error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pd">
      <div
        ref={zoneRef}
        className={`pd__zone${dragging ? ' pd__zone--over' : ''}${busy ? ' pd__zone--busy' : ''}`}
        tabIndex={0}
        role="button"
        aria-label={t.dropPhoto}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
      >
        {busy ? (
          <span className="pd__label">{t.uploading}</span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="pd__icon" aria-hidden="true">
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="pd__label">{t.dropPhoto}</span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = '';
        }}
      />

      {error && <p className="pd__error">{error}</p>}
    </div>
  );
}
