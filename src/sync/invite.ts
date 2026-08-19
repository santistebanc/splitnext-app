import { joinGroupRemote, listMemberInvitesRemote, mintInviteRemote } from '@/src/api/edge';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  inviteIsLive,
  inviteListStatus,
  parseInviteToken,
  type InviteView,
} from '@/src/domain/invite';
import {
  addLobbyGroupId,
  deleteInviteToken,
  getAccessToken,
  getInviteToken,
  saveAccessToken,
  saveInviteToken,
} from '@/src/secrets/tokens';
import { getGroupStore, initLocalGroup } from '@/src/store/groupStore';
import { commitRemoteEntity } from '@/src/sync/inbound';
import { syncError } from '@/src/sync/syncErrors';

/** Mint a one-use invite for this member. Returns the plaintext secret. */
export async function mintInvite(
  groupId: string,
  memberId: string,
): Promise<string> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const accessToken = await getAccessToken(groupId);
  const store$ = getGroupStore(groupId);
  if (!accessToken) {
    store$.lastError.set(syncError('missing_token'));
    return '';
  }

  try {
    const { token } = await mintInviteRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
      member_id: memberId,
    });
    await saveInviteToken(groupId, memberId, token);
    store$.lastError.set(null);
    return token;
  } catch (err) {
    store$.lastError.set(
      syncError(
        'invite_failed',
        err instanceof Error ? err.message : 'invite_failed',
      ),
    );
    return '';
  }
}

export type MemberInviteSnapshot = {
  status: ReturnType<typeof inviteListStatus>;
  cachedToken: string | null;
};

/** Load invite metadata and reconcile any cached plaintext token. */
export async function loadMemberInvites(
  groupId: string,
  memberId: string,
): Promise<MemberInviteSnapshot> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const accessToken = await getAccessToken(groupId);
  const store$ = getGroupStore(groupId);
  if (!accessToken) {
    store$.lastError.set(syncError('missing_token'));
    return { status: 'none', cachedToken: null };
  }

  try {
    const { invites, member_deleted_at } = await listMemberInvitesRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
      member_id: memberId,
    });
    const rows: InviteView[] = invites.map((row) => ({
      ...row,
      member_deleted_at,
    }));
    const status = inviteListStatus(rows, new Date());
    let cachedToken = await getInviteToken(groupId, memberId);
    if (status !== 'active') {
      if (cachedToken) await deleteInviteToken(groupId, memberId);
      cachedToken = null;
    }
    store$.lastError.set(null);
    return { status, cachedToken };
  } catch (err) {
    store$.lastError.set(
      syncError(
        'invite_failed',
        err instanceof Error ? err.message : 'invite_list_failed',
      ),
    );
    return { status: 'none', cachedToken: null };
  }
}

/**
 * Redeem an invite (raw token, `/j/{token}` URL, or `/join?token=`). Returns the group id.
 * Throws `invite_invalid` or the server error string on failure.
 */
export async function joinGroup(input: string): Promise<string> {
  const token = parseInviteToken(input);
  if (!token) {
    throw new Error('invite_invalid');
  }

  const deviceUserId = await getOrCreateDeviceUserId();
  const { access_token, group, bind } = await joinGroupRemote({
    token,
    device_user_id: deviceUserId,
  });

  const store$ = getGroupStore(group.id);
  initLocalGroup(store$, group);
  await saveAccessToken(group.id, access_token);
  await addLobbyGroupId(group.id);
  commitRemoteEntity(group.id, 'binds', bind);
  store$.syncStatus.set('on_server');
  store$.lastError.set(null);
  // Do not subscribe here. Join is a spinner that unmounts as soon as we
  // navigate; a socket started on that screen is what left joiners deaf.
  // The hub's openGroup starts the live channel on a screen that stays up.
  return group.id;
}
