'use client';

import { useState } from 'react';

/**
 * The boutique mark.
 *
 * Falls back to a wordmark in La Luxes Serif if the image can't load,
 * because a missing logo shouldn't leave a broken-image icon in the
 * header of a screen you're using in front of a live audience. Set
 * NEXT_PUBLIC_BRAND_LOGO_URL to point at your file — otherwise it tries
 * /logo.png, which is where it usually is.
 */
export default function Logo() {
  const [failed, setFailed] = useState(false);
  const src = process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? '/logo.png';

  if (failed) {
    return <span className="logo logo--word">Erendira&rsquo;s</span>;
  }

  return (
    <img
      className="logo"
      src={src}
      alt="Erendira's Boutique"
      onError={() => setFailed(true)}
    />
  );
}
