import { describe, expect, it } from 'vitest';
import {
  shouldAcceptVersion,
  sortByFlushOrder,
  type EntityType,
} from './version';

describe('shouldAcceptVersion', () => {
  it('accepts only when incoming is strictly greater', () => {
    expect(shouldAcceptVersion(2, 1)).toBe(true);
    expect(shouldAcceptVersion(1, 1)).toBe(false);
    expect(shouldAcceptVersion(1, 2)).toBe(false);
  });
});

describe('sortByFlushOrder', () => {
  it('orders groups → members → binds → expenses → activities', () => {
    const items = (
      [
        'activities',
        'expenses',
        'binds',
        'members',
        'groups',
      ] as EntityType[]
    ).map((entity_type) => ({ entity_type, id: entity_type }));

    expect(sortByFlushOrder(items).map((i) => i.entity_type)).toEqual([
      'groups',
      'members',
      'binds',
      'expenses',
      'activities',
    ]);
  });
});
