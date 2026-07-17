'use client';

/**
 * Who's clicking.
 *
 * Deliberately not tied to your Google OAuth session: during a live the
 * machine is shared, and the person entering claims often isn't whoever
 * signed in that morning. A name typed once per browser is closer to the
 * truth than an auth token, and it's the answer you actually want on
 * Thursday when a total looks wrong.
 *
 * If you'd rather this came from the signed-in staff user, tell me how
 * your auth exposes the session and I'll swap it.
 */
const KEY = 'eb-live-operator';

export function getOperator(): string {
  try {
    return window.localStorage.getItem(KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setOperator(name: string) {
  try {
    window.localStorage.setItem(KEY, name.trim());
  } catch {
    // private mode — the name just won't persist past this session
  }
}

/** Adds `by` to any mutating request body. */
export function withOperator<T extends Record<string, unknown>>(body: T): T & { by: string } {
  return { ...body, by: getOperator() };
}
