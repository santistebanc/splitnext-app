import { revokePushTokenRemote } from '@/src/api/edge';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { getAccessToken } from '@/src/secrets/tokens';

export async function revokePushTokenForGroup(groupId: string): Promise<void> {
  const accessToken = await getAccessToken(groupId);
  if (!accessToken) return;
  const deviceUserId = await getOrCreateDeviceUserId();
  try {
    await revokePushTokenRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
    });
  } catch {
    // Leave still proceeds if revoke fails.
  }
}
