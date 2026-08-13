import { env } from '@/src/config/env';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import type { EntityType } from '@/src/domain/version';
import { getAccessToken } from '@/src/secrets/tokens';
import { applyRemoteFetch } from '@/src/sync/inbound';
import {
  shouldCatchUpOnStatus,
  shouldReplaceSubscription,
} from '@/src/sync/wakePolicy';

const SUBSCRIBE_WAIT_MS = 8000;

const sockets = new Map<string, WebSocket>();
const reconnectByGroup = new Map<string, () => Promise<void>>();
const lastStatusByGroup = new Map<string, string>();

function wakeUrl(groupId: string, accessToken: string, deviceUserId: string): string {
  const base = env.apiUrl.replace(/^http/i, 'ws');
  const url = new URL(`${base}/wake/${encodeURIComponent(groupId)}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('device_user_id', deviceUserId);
  return url.toString();
}

export async function startWakeSubscription(
  groupId: string,
  onReconnect: () => Promise<void>,
): Promise<void> {
  reconnectByGroup.set(groupId, onReconnect);
  if (
    !shouldReplaceSubscription(
      sockets.has(groupId),
      lastStatusByGroup.get(groupId),
    )
  ) {
    return;
  }

  const stale = sockets.get(groupId);
  if (stale) {
    sockets.delete(groupId);
    lastStatusByGroup.delete(groupId);
    stale.close();
  }

  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, SUBSCRIBE_WAIT_MS);
    const socket = new WebSocket(wakeUrl(groupId, accessToken, deviceUserId));
    sockets.set(groupId, socket);

    socket.onopen = () => {
      const prev = lastStatusByGroup.get(groupId) ?? null;
      lastStatusByGroup.set(groupId, 'SUBSCRIBED');
      clearTimeout(timer);
      resolve();
      if (!shouldCatchUpOnStatus(prev, 'SUBSCRIBED')) return;
      const catchUp = reconnectByGroup.get(groupId);
      if (!catchUp) return;
      void Promise.resolve(catchUp()).catch(() => {
        // syncGroup records lastError; never let it kill the socket callback.
      });
    };

    socket.onmessage = (event) => {
      let parsed: {
        event?: string;
        payload?: {
          group_id?: string;
          entity_type?: string;
          id?: string;
          version?: number;
        };
      };
      try {
        parsed = JSON.parse(String(event.data)) as typeof parsed;
      } catch {
        return;
      }
      const payload = parsed.payload;
      if (
        parsed.event === 'wake' &&
        payload?.group_id === groupId &&
        payload.entity_type &&
        payload.id
      ) {
        void applyRemoteFetch(
          groupId,
          payload.entity_type as EntityType,
          payload.id,
        );
      }
    };

    socket.onerror = () => {
      lastStatusByGroup.set(groupId, 'CHANNEL_ERROR');
    };

    socket.onclose = () => {
      lastStatusByGroup.set(groupId, 'CLOSED');
    };
  });
}
