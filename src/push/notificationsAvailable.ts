/**
 * Remote push is unavailable in Expo Go on Android from SDK 53.
 * A development build is required. Never import `expo-notifications`
 * when this is false — the import itself throws.
 *
 * Gate on `appOwnership`, not `executionEnvironment`: `storeClient` is
 * Expo Go *and* expo-dev-client, and a development build still registers.
 */
export function notificationsAvailable(
  appOwnership: string | null | undefined,
): boolean {
  return appOwnership !== 'expo';
}
