/** Serializes async work per group id (flush vs sync cannot race). */
const groupWork = new Map<string, Promise<void>>();

export function runExclusive(
  groupId: string,
  work: () => Promise<void>,
): Promise<void> {
  const prev = groupWork.get(groupId) ?? Promise.resolve();
  const next = prev.then(work, work);
  groupWork.set(
    groupId,
    next.finally(() => {
      if (groupWork.get(groupId) === next) groupWork.delete(groupId);
    }),
  );
  return next;
}
