import { describe, expect, it } from 'vitest';
import {
  expenseIsPending,
  queueAfterMergeResults,
  shouldAttemptFlush,
} from './queuePolicy';

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

describe('expenseIsPending', () => {
  it('is true when that expense id is queued', () => {
    expect(
      expenseIsPending(
        [{ entity_type: 'expenses', id: 'e1', version: 1 }],
        'e1',
      ),
    ).toBe(true);
  });

  it('is true when two versions of the same expense are queued', () => {
    expect(
      expenseIsPending(
        [
          { entity_type: 'expenses', id: 'e1', version: 1 },
          { entity_type: 'expenses', id: 'e1', version: 2 },
        ],
        'e1',
      ),
    ).toBe(true);
  });

  it('is false when the queue is empty or holds a different entity', () => {
    expect(expenseIsPending([], 'e1')).toBe(false);
    expect(
      expenseIsPending(
        [{ entity_type: 'members', id: 'e1', version: 1 }],
        'e1',
      ),
    ).toBe(false);
    expect(
      expenseIsPending(
        [{ entity_type: 'expenses', id: 'e2', version: 1 }],
        'e1',
      ),
    ).toBe(false);
  });
});
