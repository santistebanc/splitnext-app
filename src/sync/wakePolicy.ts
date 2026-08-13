/** Whether a Realtime channel status change means this group missed wakes. */
const DROP_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

export function shouldCatchUpOnStatus(
  prev: string | null,
  next: string,
): boolean {
  return next === 'SUBSCRIBED' && prev !== null && DROP_STATUSES.has(prev);
}
