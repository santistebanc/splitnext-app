/**
 * Web has no keychain. `expo-secure-store` is Android/iOS/tvOS only, so the web
 * build falls back to `localStorage`, which is readable by any script on the
 * origin and by anyone at the machine.
 *
 * That is acceptable for what this app keeps — a device id and per-group
 * capability tokens, each scoped to one group and revocable server-side — and
 * for what the web target is for: development, testing and screenshots. Do not
 * put a credential with wider blast radius behind this interface without
 * splitting the two platforms apart first.
 */
const memory = new Map<string, string>();

function store(): Storage | null {
  // SSR / static export prerender runs this module with no window.
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // localStorage throws rather than returning null when cookies are blocked.
    return null;
  }
}

export async function getSecret(key: string): Promise<string | null> {
  const s = store();
  return s ? s.getItem(key) : (memory.get(key) ?? null);
}

export async function setSecret(key: string, value: string): Promise<void> {
  const s = store();
  if (s) s.setItem(key, value);
  else memory.set(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  const s = store();
  if (s) s.removeItem(key);
  else memory.delete(key);
}
