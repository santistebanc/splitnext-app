import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { mintRealtimeAuth } from '@/src/api/edge';
import { env } from '@/src/config/env';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import type { EntityType } from '@/src/domain/version';
import { getAccessToken } from '@/src/secrets/tokens';
import { applyRemoteFetch } from '@/src/sync/inbound';

const channels = new Map<string, RealtimeChannel>();

function supabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function startWakeSubscription(groupId: string): Promise<void> {
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
    .subscribe();

  channels.set(groupId, channel);
}
