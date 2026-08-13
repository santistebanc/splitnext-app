import { env } from '@/src/config/env';

/** Query-string token: RN `WebSocket` cannot set headers. */
export function wakeUrl(
  groupId: string,
  accessToken: string,
  deviceUserId: string,
): string {
  const base = env.apiUrl.replace(/^http/i, 'ws');
  const url = new URL(`${base}/wake/${encodeURIComponent(groupId)}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('device_user_id', deviceUserId);
  return url.toString();
}
