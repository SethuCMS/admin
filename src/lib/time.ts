/**
 * Relative-time formatting for activity lists.
 */

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// Largest unit first; the first unit that fits wins. Seconds are skipped on
// purpose.
const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "2 minutes ago", "yesterday". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  // Negative for past times, which gives "ago" wording.
  const elapsed = new Date(iso).getTime() - now;
  for (const [unit, size] of STEPS) {
    if (Math.abs(elapsed) >= size) {
      return formatter.format(Math.round(elapsed / size), unit);
    }
  }
  return 'just now';
}
