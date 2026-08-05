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
  it('removes accepted ids and keeps the rest', () => {
    const queue = [
      { id: 'a', version: 2 },
      { id: 'b', version: 3 },
    ];
    const next = queueAfterMergeResults(queue, [
      { id: 'a', status: 'accepted' },
      { id: 'b', status: 'rejected' },
    ]);
    expect(next).toEqual([{ id: 'b', version: 3 }]);
  });
});
