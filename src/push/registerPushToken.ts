import { registerPushTokenRemote } from '@/src/api/edge';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { getAccessToken } from '@/src/secrets/tokens';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export async function registerPushTokenForGroup(groupId: string): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let granted = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    granted = status;
  }
  if (granted !== 'granted') return;

  const expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
  const accessToken = await getAccessToken(groupId);
  if (!accessToken) return;

  const deviceUserId = await getOrCreateDeviceUserId();
  await registerPushTokenRemote({
    group_id: groupId,
    device_user_id: deviceUserId,
    access_token: accessToken,
    expo_push_token: expoPushToken,
  });
}
