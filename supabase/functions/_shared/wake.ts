import { serviceClient } from './supabase.ts';

export type WakePayload = {
  group_id: string;
  entity_type: string;
  id: string;
  version: number;
};

/** Publish wake after a successful merge. Failures are logged; merge is not rolled back. */
export async function publishWake(payload: WakePayload): Promise<void> {
  try {
    const supabase = serviceClient();
    const channel = supabase.channel(`group:${payload.group_id}`);
    await channel.subscribe();
    const status = await channel.send({
      type: 'broadcast',
      event: 'wake',
      payload,
    });
    await supabase.removeChannel(channel);
    if (status !== 'ok') {
      console.error('wake publish non-ok', status, payload);
    }
  } catch (err) {
    console.error('wake publish failed', err, payload);
  }
}
