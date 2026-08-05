/** Whether flush should call merge (empty queue is a no-op). */
export function shouldAttemptFlush(queueLength: number): boolean {
  return queueLength > 0;
}

type QueueItem = { entity_type: string; id: string; version: number };
type MergeResult = {
  entity_type: string;
  id: string;
  version: number;
  status: string;
};

function itemKey(item: {
  entity_type: string;
  id: string;
  version: number;
}): string {
  return `${item.entity_type}:${item.id}:${item.version}`;
}

/** Drop items the server accepted at the exact entity_type+id+version. */
export function queueAfterMergeResults<T extends QueueItem>(
  queue: T[],
  results: MergeResult[],
): T[] {
  const accepted = new Set(
    results
      .filter((r) => r.status === 'accepted')
      .map((r) => itemKey(r)),
  );
  return queue.filter((item) => !accepted.has(itemKey(item)));
}
