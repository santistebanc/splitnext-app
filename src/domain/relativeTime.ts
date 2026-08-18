const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Relative time label for an ISO timestamp, e.g. "just now", "5m ago". */
export function relativeTimeLabel(iso: string, now: Date): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const diffMs = now.getTime() - at;
  if (diffMs < 45_000) return 'just now';
  if (diffMs < MINUTE_MS) return '1m ago';
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  if (diffMs < 7 * DAY_MS) return `${Math.floor(diffMs / DAY_MS)}d ago`;
  return new Date(at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
