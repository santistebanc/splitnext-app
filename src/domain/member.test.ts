import { describe, expect, it } from 'vitest';
import type { MemberEntity } from '@/src/types/group';
import { patchMember, tombstoneMember } from './member';

const live: MemberEntity = {
  id: 'm1',
  group_id: 'g1',
  display_name: 'Ana',
  version: 3,
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

describe('patchMember', () => {
  it('renames at the next version and keeps the other fields', () => {
    expect(patchMember(live, 'Ann', '2026-08-17T12:00:00.000Z')).toEqual({
      id: 'm1',
      group_id: 'g1',
      display_name: 'Ann',
      version: 4,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: null,
    });
  });

  it('returns null for a whitespace name', () => {
    expect(patchMember(live, '   ', '2026-08-17T12:00:00.000Z')).toBeNull();
  });

  it('returns null when the trimmed name is unchanged', () => {
    expect(patchMember(live, '  Ana  ', '2026-08-17T12:00:00.000Z')).toBeNull();
    expect(
      patchMember(
        { ...live, display_name: '  Ana  ' },
        'Ana',
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
  });
});

describe('tombstoneMember', () => {
  it('soft-deletes a live member at the next version', () => {
    expect(tombstoneMember(live, '2026-08-17T12:00:00.000Z')).toEqual({
      ...live,
      version: 4,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: '2026-08-17T12:00:00.000Z',
    });
  });

  it('returns null when the member is already tombstoned', () => {
    const gone = { ...live, deleted_at: '2026-08-02T00:00:00.000Z' };
    expect(tombstoneMember(gone, '2026-08-17T12:00:00.000Z')).toBeNull();
  });
});
