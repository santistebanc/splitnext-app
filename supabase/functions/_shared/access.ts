import { sha256Hex } from './crypto.ts';
import { serviceClient } from './supabase.ts';

export type AccessRow = {
  id: string;
  group_id: string;
  device_user_id: string;
  revoked_at: string | null;
};

export async function resolveAccessToken(
  accessToken: string,
  groupId: string,
  deviceUserId: string,
): Promise<AccessRow | null> {
  const hash = await sha256Hex(accessToken);
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('access_tokens')
    .select('id, group_id, device_user_id, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (data.group_id !== groupId) return null;
  if (data.device_user_id !== deviceUserId) return null;
  return data as AccessRow;
}
