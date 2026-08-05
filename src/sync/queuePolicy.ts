/** Whether flush should call merge (empty queue is a no-op). */
export function shouldAttemptFlush(queueLength: number): boolean {
  return queueLength > 0;
}

type QueueItem = { id: string };
type MergeResult = { id: string; status: string };

/** Drop items the server accepted; keep rejected/error for retry. */
export function queueAfterMergeResults<T extends QueueItem>(
  queue: T[],
  results: MergeResult[],
): T[] {
  const accepted = new Set(
    results.filter((r) => r.status === 'accepted').map((r) => r.id),
  );
  return queue.filter((item) => !accepted.has(item.id));
}
