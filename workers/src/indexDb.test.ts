import { describe, expect, it } from 'vitest';
import { claimInvite, type IndexDb } from './indexDb';

function dbWithChanges(changes: number): IndexDb {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return null;
            },
            async run() {
              return { success: true, meta: { changes } };
            },
          };
        },
      };
    },
  };
}

describe('claimInvite', () => {
  it('is one-use: a live invite reports claimed, a second pass does not', async () => {
    expect(await claimInvite(dbWithChanges(1), 'hash', '2026-06-01T00:00:00.000Z')).toBe(
      true,
    );
    expect(await claimInvite(dbWithChanges(0), 'hash', '2026-06-01T00:00:00.000Z')).toBe(
      false,
    );
  });
});
