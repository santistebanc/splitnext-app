import { describe, expect, it } from 'vitest';
import type { GroupEntity } from '@/src/types/group';
import { patchGroup, settingsDoneEnabled, createGroupDraft } from '@/src/domain/group';

const live: GroupEntity = {
  id: 'g1',
  version: 3,
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
  name: 'Trip',
  currency_label: 'EUR',
  is_closed: false,
};

describe('patchGroup', () => {
  it('renames at the next version and keeps the other fields', () => {
    expect(
      patchGroup(live, { name: 'Cabin' }, '2026-08-14T12:00:00.000Z'),
    ).toEqual({
      id: 'g1',
      version: 4,
      updated_at: '2026-08-14T12:00:00.000Z',
      deleted_at: null,
      name: 'Cabin',
      currency_label: 'EUR',
      is_closed: false,
    });
  });

  it('relabels currency at the next version and keeps the name', () => {
    expect(
      patchGroup(live, { currency_label: 'USD' }, '2026-08-14T12:00:00.000Z'),
    ).toEqual({
      id: 'g1',
      version: 4,
      updated_at: '2026-08-14T12:00:00.000Z',
      deleted_at: null,
      name: 'Trip',
      currency_label: 'USD',
      is_closed: false,
    });
  });

  it('keeps the current currency when the new label is empty', () => {
    expect(
      patchGroup(live, { currency_label: '' }, '2026-08-14T12:00:00.000Z')
        .currency_label,
    ).toBe('EUR');
  });

  it('patches name and currency together at one version', () => {
    expect(
      patchGroup(
        live,
        { name: 'Cabin', currency_label: 'USD' },
        '2026-08-14T12:00:00.000Z',
      ),
    ).toEqual({
      id: 'g1',
      version: 4,
      updated_at: '2026-08-14T12:00:00.000Z',
      deleted_at: null,
      name: 'Cabin',
      currency_label: 'USD',
      is_closed: false,
    });
  });
});

describe('settingsDoneEnabled', () => {
  it('is disabled until the group has a name and this device has a member', () => {
    expect(settingsDoneEnabled('', 'm1')).toBe(false);
    expect(settingsDoneEnabled('   ', 'm1')).toBe(false);
    expect(settingsDoneEnabled('Trip', null)).toBe(false);
  });

  it('is enabled when the name is non-empty and this device has a member', () => {
    expect(settingsDoneEnabled('Trip', 'm1')).toBe(true);
  });
});

describe('createGroupDraft', () => {
  const ids = {
    groupId: 'g1',
    memberId: 'm1',
    bindId: 'b1',
    deviceUserId: 'd1',
  };
  const at = '2026-08-17T00:00:00.000Z';

  it('builds a named group, the creator member, and this device bound', () => {
    expect(
      createGroupDraft(
        { name: 'Trip', currency_label: 'USD', creator_name: 'Ana' },
        ids,
        at,
      ),
    ).toEqual({
      group: {
        id: 'g1',
        version: 1,
        updated_at: at,
        deleted_at: null,
        name: 'Trip',
        currency_label: 'USD',
        is_closed: false,
      },
      member: {
        id: 'm1',
        group_id: 'g1',
        display_name: 'Ana',
        version: 1,
        updated_at: at,
        deleted_at: null,
      },
      bind: {
        id: 'b1',
        group_id: 'g1',
        device_user_id: 'd1',
        member_id: 'm1',
        version: 1,
        updated_at: at,
        deleted_at: null,
      },
    });
  });

  it('refuses a whitespace group name or creator name', () => {
    expect(
      createGroupDraft(
        { name: '  ', currency_label: 'EUR', creator_name: 'Ana' },
        ids,
        at,
      ),
    ).toBeNull();
    expect(
      createGroupDraft(
        { name: 'Trip', currency_label: 'EUR', creator_name: '   ' },
        ids,
        at,
      ),
    ).toBeNull();
  });

  it('keeps EUR when currency is empty', () => {
    expect(
      createGroupDraft(
        { name: 'Trip', currency_label: '', creator_name: 'Ana' },
        ids,
        at,
      )?.group.currency_label,
    ).toBe('EUR');
  });
});
