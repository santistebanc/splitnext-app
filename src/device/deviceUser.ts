import * as Crypto from 'expo-crypto';

import { getSecret, setSecret } from '../secrets/secureStorage';

const KEY = 'device_user_id';

export async function getOrCreateDeviceUserId(): Promise<string> {
  const existing = await getSecret(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await setSecret(KEY, id);
  return id;
}
