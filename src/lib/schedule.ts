/**
 * Plain date helpers for the "Publish at" picker. No React here, so they can
 * be tested on their own.
 */

/** "2026-11-05T09:00" in the person's local time, as `datetime-local` wants. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** The next whole hour that is at least 30 minutes away: a sensible start. */
export function suggestedTime(now: Date = new Date()): string {
  const next = new Date(now.getTime() + 30 * 60_000);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return toLocalInput(next);
}

/**
 * Check what the person picked. Returns a sentence to show, or null when it is
 * fine. The value is read as the person's local time.
 */
export function pickProblem(value: string, now: number = Date.now()): string | null {
  const when = new Date(value);
  if (value === '' || Number.isNaN(when.getTime())) {
    return 'Choose a date and time.';
  }
  if (when.getTime() <= now) {
    return 'Choose a time in the future.';
  }
  return null;
}
