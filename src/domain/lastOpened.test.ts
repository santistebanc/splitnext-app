import { describe, expect, it } from 'vitest';
import { lastOpenedHubId } from './lastOpened';

describe('lastOpenedHubId', () => {
  it('returns the id when it is still on the lobby', () => {
    expect(lastOpenedHubId('g1', ['g1', 'g2'])).toBe('g1');
  });

  it('returns null when there is no last opened id', () => {
    expect(lastOpenedHubId(null, ['g1'])).toBeNull();
    expect(lastOpenedHubId(undefined, ['g1'])).toBeNull();
    expect(lastOpenedHubId('', ['g1'])).toBeNull();
  });

  it('returns null when the last id is no longer on the lobby', () => {
    expect(lastOpenedHubId('g-gone', ['g1'])).toBeNull();
  });
});
