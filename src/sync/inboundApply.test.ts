import { describe, expect, it } from 'vitest';
import { applyRemoteEntity } from './inboundApply';
import type {
  BindEntity,
  GroupEntity,
  MemberEntity,
} from '../types/group';

const group = (version: number): GroupEntity => ({
  id: 'g1',
  version,
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  name: 'n',
  currency_label: 'EUR',
  is_closed: false,
});

const member = (id: string, version: number): MemberEntity => ({
  id,
  group_id: 'g1',
  display_name: id,
  version,
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
});

const bind = (id: string, version: number): BindEntity => ({
  id,
  group_id: 'g1',
  device_user_id: 'd1',
  member_id: 'm1',
  version,
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
});

describe('applyRemoteEntity', () => {
  it('applies a newer group and leaves maps alone', () => {
    const state = {
      group: group(1),
      members: {},
      binds: {},
      expenses: {},
      activities: {},
    };
    const next = applyRemoteEntity(state, 'groups', group(2));
    expect(next).toEqual({
      group: group(2),
      members: {},
      binds: {},
      expenses: {},
      activities: {},
    });
  });

  it('no-ops when remote group version is not greater', () => {
    const state = {
      group: group(3),
      members: {},
      binds: {},
      expenses: {},
      activities: {},
    };
    expect(applyRemoteEntity(state, 'groups', group(3))).toBeNull();
    expect(applyRemoteEntity(state, 'groups', group(2))).toBeNull();
  });

  it('applies a newer member into the map', () => {
    const state = {
      group: group(1),
      members: { m1: member('m1', 1) },
      binds: {},
      expenses: {},
      activities: {},
    };
    const next = applyRemoteEntity(state, 'members', member('m1', 2));
    expect(next?.members.m1.version).toBe(2);
  });

  it('applies a new bind when local is missing', () => {
    const state = {
      group: group(1),
      members: {},
      binds: {},
      expenses: {},
      activities: {},
    };
    const next = applyRemoteEntity(state, 'binds', bind('b1', 1));
    expect(next?.binds.b1).toEqual(bind('b1', 1));
  });
});
