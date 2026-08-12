import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { mintRealtimeAuth } from '@/src/api/edge';
import { env } from '@/src/config/env';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import type { EntityType } from '@/src/domain/version';
import { getAccessToken } from '@/src/secrets/tokens';
import { applyRemoteFetch } from '@/src/sync/inbound';
import { shouldCatchUpOnStatus } from '@/src/sync/wakePolicy';

const channels = new Map<string, RealtimeChannel>();
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
  if (channels.has(groupId)) return;

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
      if (!shouldCatchUpOnStatus(prev, status)) return;
      const catchUp = reconnectByGroup.get(groupId);
      if (!catchUp) return;
      void Promise.resolve(catchUp()).catch(() => {
        // syncGroup records lastError; never let it kill the channel callback.
      });
    });

  channels.set(groupId, channel);
}
