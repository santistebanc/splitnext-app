export type PushTokenRow = {
  device_user_id: string;
  expo_push_token: string;
};

export type PushBindRow = {
  device_user_id: string;
  member_id: string;
  deleted_at: string | null;
};

/** Device ids that should receive a push for this activity (exclude actor side). */
export function pushRecipientTokens(
  tokens: PushTokenRow[],
  binds: PushBindRow[],
  actorDeviceUserId: string,
  actorMemberId: string,
): string[] {
  const excludedDevices = new Set<string>([actorDeviceUserId]);
  for (const bind of binds) {
    if (bind.deleted_at != null) continue;
    if (bind.member_id === actorMemberId) {
      excludedDevices.add(bind.device_user_id);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of tokens) {
    if (excludedDevices.has(row.device_user_id)) continue;
    if (seen.has(row.expo_push_token)) continue;
    seen.add(row.expo_push_token);
    out.push(row.expo_push_token);
  }
  return out;
}
