import { describe, expect, it } from 'vitest';
import { queueAfterMergeResults, shouldAttemptFlush } from './queuePolicy';

describe('shouldAttemptFlush', () => {
  it('skips merge when the queue is empty', () => {
    expect(shouldAttemptFlush(0)).toBe(false);
  });

  it('attempts merge when the queue has items', () => {
    expect(shouldAttemptFlush(1)).toBe(true);
  });
});

describe('queueAfterMergeResults', () => {
  it('drops only the accepted entity_type+id+version', () => {
    const queue = [
      { entity_type: 'groups' as const, id: 'g1', version: 2 },
      { entity_type: 'groups' as const, id: 'g1', version: 3 },
      { entity_type: 'members' as const, id: 'm1', version: 1 },
    ];
    const next = queueAfterMergeResults(queue, [
      {
        entity_type: 'groups',
        id: 'g1',
        version: 2,
        status: 'accepted',
      },
      {
        entity_type: 'members',
        id: 'm1',
        version: 1,
        status: 'rejected',
      },
    ]);
    expect(next).toEqual([
      { entity_type: 'groups', id: 'g1', version: 3 },
      { entity_type: 'members', id: 'm1', version: 1 },
    ]);
  });

  it('does not drop a same id at a different version', () => {
    const queue = [{ entity_type: 'groups' as const, id: 'g1', version: 5 }];
    const next = queueAfterMergeResults(queue, [
      {
        entity_type: 'groups',
        id: 'g1',
        version: 4,
        status: 'accepted',
      },
    ]);
    expect(next).toEqual(queue);
  });
});
