/** Whether a wake-socket status change means this group missed wakes. */
const OPEN = 'OPEN';
const DROP_STATUSES = new Set(['ERROR', 'CLOSED']);

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

export function shouldCatchUpOnStatus(
  prev: string | null,
  next: string,
): boolean {
  return next === OPEN && prev !== null && DROP_STATUSES.has(prev);
}

/**
 * Whether `startWakeSubscription` should (re)connect.
 * A live `OPEN` socket is reused. A missing socket is started.
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

/** Delay before the next wake-socket retry. `failedAttempts` is 0 on the first retry. */
export function nextReconnectDelayMs(failedAttempts: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** failedAttempts, MAX_RETRY_MS);
}
