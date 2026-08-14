import * as SecureStore from 'expo-secure-store';

/**
 * The device's one secret store. Native uses the OS keychain; the web build
 * swaps in `secureStorage.web.ts`, which cannot offer the same guarantee —
 * see the note there before putting anything new behind this interface.
 *
 * Keys allow only [A-Za-z0-9._-]: that is SecureStore's rule, and keeping it
 * on both platforms means a key that works on web works on a phone.
 */
export async function getSecret(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
