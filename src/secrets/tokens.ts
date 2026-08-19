import { deleteSecret, getSecret, setSecret } from './secureStorage';

/** Secret keys allow only [A-Za-z0-9._-]. UUIDs use hyphens; no colons. */
function tokenKey(groupId: string): string {
  return `access_token.${groupId}`;
}

export async function saveAccessToken(
  groupId: string,
  token: string,
): Promise<void> {
  await setSecret(tokenKey(groupId), token);
}

export async function getAccessToken(groupId: string): Promise<string | null> {
  return getSecret(tokenKey(groupId));
}

const LOBBY_KEY = 'lobby_group_ids';
const LAST_OPENED_KEY = 'last_opened_group_id';

export async function getLastOpenedGroupId(): Promise<string | null> {
  const raw = await getSecret(LAST_OPENED_KEY);
  return raw && raw.length > 0 ? raw : null;
}

export async function saveLastOpenedGroupId(groupId: string): Promise<void> {
  if (!groupId) return;
  await setSecret(LAST_OPENED_KEY, groupId);
}

export async function clearLastOpenedGroupId(): Promise<void> {
  await deleteSecret(LAST_OPENED_KEY);
}

export async function listLobbyGroupIds(): Promise<string[]> {
  const raw = await getSecret(LOBBY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function addLobbyGroupId(groupId: string): Promise<void> {
  const ids = await listLobbyGroupIds();
  if (ids.includes(groupId)) return;
  await setSecret(LOBBY_KEY, JSON.stringify([groupId, ...ids]));
}

export async function removeLobbyGroupId(groupId: string): Promise<void> {
  const ids = await listLobbyGroupIds();
  await setSecret(LOBBY_KEY, JSON.stringify(ids.filter((id) => id !== groupId)));
  const last = await getLastOpenedGroupId();
  if (last === groupId) await clearLastOpenedGroupId();
}

export async function deleteAccessToken(groupId: string): Promise<void> {
  await deleteSecret(tokenKey(groupId));
}

function inviteTokenKey(groupId: string, memberId: string): string {
  return `invite_token.${groupId}.${memberId}`;
}

export async function saveInviteToken(
  groupId: string,
  memberId: string,
  token: string,
): Promise<void> {
  await setSecret(inviteTokenKey(groupId, memberId), token);
}

export async function getInviteToken(
  groupId: string,
  memberId: string,
): Promise<string | null> {
  return getSecret(inviteTokenKey(groupId, memberId));
}

export async function deleteInviteToken(
  groupId: string,
  memberId: string,
): Promise<void> {
  await deleteSecret(inviteTokenKey(groupId, memberId));
}
