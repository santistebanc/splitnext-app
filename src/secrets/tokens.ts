import * as SecureStore from 'expo-secure-store';

/** SecureStore allows only [A-Za-z0-9._-]. UUIDs use hyphens; no colons. */
function tokenKey(groupId: string): string {
  return `access_token.${groupId}`;
}

export async function saveAccessToken(
  groupId: string,
  token: string,
): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(groupId), token);
}

export async function getAccessToken(groupId: string): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey(groupId));
}

const LOBBY_KEY = 'lobby_group_ids';

export async function listLobbyGroupIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(LOBBY_KEY);
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
  await SecureStore.setItemAsync(LOBBY_KEY, JSON.stringify([groupId, ...ids]));
}
