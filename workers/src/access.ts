import { inviteIsLive, type InviteView } from '../../src/domain/invite';

export type AccessRow = {
  group_id: string;
  device_user_id: string;
  revoked_at: string | null;
};

export function accessAllows(
  row: AccessRow | null,
  groupId: string,
  deviceUserId: string,
): boolean {
  if (!row) return false;
  if (row.revoked_at) return false;
  if (row.group_id !== groupId) return false;
  if (row.device_user_id !== deviceUserId) return false;
  return true;
}

export type InviteRow = InviteView & {
  group_id: string;
  member_id: string;
};

export function inviteRedeemBlock(
  invite: InviteRow | null,
  now: Date,
): 'invite_unknown' | 'invite_redeemed' | 'invite_expired' | 'member_missing' | null {
  if (!invite) return 'invite_unknown';
  if (invite.redeemed_at != null) return 'invite_redeemed';
  if (invite.member_deleted_at != null) return 'member_missing';
  if (now.getTime() >= Date.parse(invite.expires_at)) return 'invite_expired';
  return null;
}

export function inviteIsRedeemable(invite: InviteRow, now: Date): boolean {
  return inviteIsLive(invite, now);
}
