import { describe, expect, it } from 'vitest';
import { accessAllows, accessIdentifies, inviteRedeemBlock } from './access';

describe('accessAllows', () => {
  const row = {
    group_id: 'g1',
    device_user_id: 'd1',
    revoked_at: null as string | null,
  };

  it('lets through an unrevoked token for this group and device', () => {
    expect(accessAllows(row, 'g1', 'd1')).toBe(true);
  });

  it('rejects a missing row, a revoke, a wrong group, and a wrong device', () => {
    expect(accessAllows(null, 'g1', 'd1')).toBe(false);
    expect(accessAllows({ ...row, revoked_at: '2026-01-01T00:00:00.000Z' }, 'g1', 'd1')).toBe(
      false,
    );
    expect(accessAllows(row, 'g-other', 'd1')).toBe(false);
    expect(accessAllows(row, 'g1', 'd-other')).toBe(false);
  });

  it('still identifies a revoked token as this group and device', () => {
    expect(
      accessIdentifies({ ...row, revoked_at: '2026-01-01T00:00:00.000Z' }, 'g1', 'd1'),
    ).toBe(true);
    expect(accessIdentifies(row, 'g-other', 'd1')).toBe(false);
  });
});

describe('inviteRedeemBlock', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');
  const live = {
    group_id: 'g1',
    member_id: 'm1',
    expires_at: '2026-06-08T00:00:00.000Z',
    redeemed_at: null as string | null,
    member_deleted_at: null as string | null,
  };

  it('lets a live invite through', () => {
    expect(inviteRedeemBlock(live, now)).toBeNull();
  });

  it('names unknown, redeemed, expired, and a tombstoned member', () => {
    expect(inviteRedeemBlock(null, now)).toBe('invite_unknown');
    expect(inviteRedeemBlock({ ...live, redeemed_at: now.toISOString() }, now)).toBe(
      'invite_redeemed',
    );
    expect(inviteRedeemBlock({ ...live, expires_at: '2026-05-01T00:00:00.000Z' }, now)).toBe(
      'invite_expired',
    );
    expect(
      inviteRedeemBlock({ ...live, member_deleted_at: now.toISOString() }, now),
    ).toBe('member_missing');
  });
});
