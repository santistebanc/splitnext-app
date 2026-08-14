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
}

export async function deleteAccessToken(groupId: string): Promise<void> {
  await deleteSecret(tokenKey(groupId));
}
