/** Whether a wake-socket status change means this group missed wakes. */
const DROP_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

export function shouldCatchUpOnStatus(
  prev: string | null,
  next: string,
): boolean {
  return next === 'SUBSCRIBED' && prev !== null && DROP_STATUSES.has(prev);
}

/**
 * Whether `startWakeSubscription` should (re)connect.
 * A live `SUBSCRIBED` socket is reused. A missing socket is started.
 * A dropped one is replaced so a joiner whose first subscribe died on the
 * way to the hub can listen when the hub opens.
 */
export function shouldReplaceSubscription(
  hasSocket: boolean,
  status: string | null | undefined,
): boolean {
  if (!hasSocket) return true;
  if (status == null) return false;
  return DROP_STATUSES.has(status);
}

