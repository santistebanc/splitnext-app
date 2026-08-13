import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { mintRealtimeAuth } from '@/src/api/edge';
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

const channels = new Map<string, RealtimeChannel>();
const clients = new Map<string, SupabaseClient>();
const reconnectByGroup = new Map<string, () => Promise<void>>();
const lastStatusByGroup = new Map<string, string>();

function supabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function startWakeSubscription(
  groupId: string,
  onReconnect: () => Promise<void>,
): Promise<void> {
  reconnectByGroup.set(groupId, onReconnect);
  if (
    !shouldReplaceSubscription(
      channels.has(groupId),
      lastStatusByGroup.get(groupId),
    )
  ) {
    return;
  }

  const stale = channels.get(groupId);
  const staleClient = clients.get(groupId);
  if (stale && staleClient) {
    channels.delete(groupId);
    clients.delete(groupId);
    lastStatusByGroup.delete(groupId);
    await staleClient.removeChannel(stale);
  }

  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  const auth = await mintRealtimeAuth({
    group_id: groupId,
    device_user_id: deviceUserId,
    access_token: accessToken,
  });

  const client = supabaseClient();
  if (auth.jwt) {
    client.realtime.setAuth(auth.jwt);
  }
  clients.set(groupId, client);

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, SUBSCRIBE_WAIT_MS);
    const channel = client
      .channel(auth.channel)
      .on('broadcast', { event: 'wake' }, (msg) => {
        const payload = msg.payload as {
          group_id?: string;
          entity_type?: string;
          id?: string;
          version?: number;
        };
        if (
          payload.group_id === groupId &&
          payload.entity_type &&
          payload.id
        ) {
          void applyRemoteFetch(
            groupId,
            payload.entity_type as EntityType,
            payload.id,
          );
        }
      })
      .subscribe((status) => {
        const prev = lastStatusByGroup.get(groupId) ?? null;
        lastStatusByGroup.set(groupId, status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        }
        if (!shouldCatchUpOnStatus(prev, status)) return;
        const catchUp = reconnectByGroup.get(groupId);
        if (!catchUp) return;
        void Promise.resolve(catchUp()).catch(() => {
          // syncGroup records lastError; never let it kill the channel callback.
        });
      });
    channels.set(groupId, channel);
  });
}
