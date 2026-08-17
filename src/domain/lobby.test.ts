import { describe, expect, it } from 'vitest';
import type { MemberEntity } from '@/src/types/group';
import { lobbyGroupTitle, lobbyMemberSummary } from '@/src/domain/lobby';

function member(
  partial: Partial<MemberEntity> & Pick<MemberEntity, 'id' | 'display_name'>,
): MemberEntity {
  return {
    group_id: 'g1',
    version: 1,
    updated_at: '2026-08-17T00:00:00.000Z',
    deleted_at: null,
    ...partial,
  };
}

describe('lobbyGroupTitle', () => {
  it('uses the trimmed group name', () => {
    expect(lobbyGroupTitle('Trip')).toBe('Trip');
    expect(lobbyGroupTitle('  Cabin  ')).toBe('Cabin');
  });

  it('falls back when the name is empty', () => {
    expect(lobbyGroupTitle('')).toBe('(empty)');
    expect(lobbyGroupTitle('   ')).toBe('(empty)');
  });
});

describe('lobbyMemberSummary', () => {
  it('joins live member names in member-id order', () => {
    const members = {
      m2: member({ id: 'm2', display_name: 'Bo' }),
      m1: member({ id: 'm1', display_name: 'Ana' }),
    };
    expect(lobbyMemberSummary(members)).toBe('Ana, Bo');
  });

  it('skips tombstoned members', () => {
    const members = {
      m1: member({ id: 'm1', display_name: 'Ana' }),
      m2: member({
        id: 'm2',
        display_name: 'Bo',
        deleted_at: '2026-08-17T00:00:00.000Z',
      }),
    };
    expect(lobbyMemberSummary(members)).toBe('Ana');
  });

  it('labels a blank display name', () => {
    const members = {
      m1: member({ id: 'm1', display_name: '  ' }),
    };
    expect(lobbyMemberSummary(members)).toBe('(unnamed)');
  });

  it('is null when nobody is live', () => {
    expect(lobbyMemberSummary({})).toBeNull();
    expect(
      lobbyMemberSummary({
        m1: member({
          id: 'm1',
          display_name: 'Ana',
          deleted_at: '2026-08-17T00:00:00.000Z',
        }),
      }),
    ).toBeNull();
  });
});
