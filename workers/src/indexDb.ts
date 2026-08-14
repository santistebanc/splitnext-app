import { accessAllows, type AccessRow } from './access';
import { sha256Hex } from './crypto';

export type IndexDb = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<{ success: boolean; meta: { changes: number } }>;
    };
  };
};

export async function lookupAccess(
  db: IndexDb,
  accessToken: string,
): Promise<AccessRow | null> {
  const hash = await sha256Hex(accessToken);
  const row = await db
    .prepare(
      'SELECT group_id, device_user_id, revoked_at FROM access_tokens WHERE token_hash = ?',
    )
    .bind(hash)
    .first<AccessRow>();
  return row ?? null;
}

export async function resolveAccessToken(
  db: IndexDb,
  accessToken: string,
  groupId: string,
  deviceUserId: string,
): Promise<AccessRow | null> {
  const row = await lookupAccess(db, accessToken);
  if (!accessAllows(row, groupId, deviceUserId)) return null;
  return row;
}

export type InviteLookup = {
  token_hash: string;
  group_id: string;
  member_id: string;
  expires_at: string;
  redeemed_at: string | null;
};

export async function lookupInvite(
  db: IndexDb,
  token: string,
): Promise<InviteLookup | null> {
  const hash = await sha256Hex(token);
  const row = await db
    .prepare(
      'SELECT token_hash, group_id, member_id, expires_at, redeemed_at FROM invites WHERE token_hash = ?',
    )
    .bind(hash)
    .first<InviteLookup>();
  return row ?? null;
}

export async function insertAccessToken(
  db: IndexDb,
  accessToken: string,
  groupId: string,
  deviceUserId: string,
): Promise<void> {
  const hash = await sha256Hex(accessToken);
  await db
    .prepare(
      'INSERT INTO access_tokens (token_hash, group_id, device_user_id, revoked_at) VALUES (?, ?, ?, NULL)',
    )
    .bind(hash, groupId, deviceUserId)
    .run();
}

export async function hasLiveTokenForDevice(
  db: IndexDb,
  groupId: string,
  deviceUserId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      'SELECT token_hash FROM access_tokens WHERE group_id = ? AND device_user_id = ? AND revoked_at IS NULL',
    )
    .bind(groupId, deviceUserId)
    .first();
  return row != null;
}

export async function revokeAccessToken(
  db: IndexDb,
  accessToken: string,
  revokedAt: string,
): Promise<void> {
  const hash = await sha256Hex(accessToken);
  await db
    .prepare(
      'UPDATE access_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
    )
    .bind(revokedAt, hash)
    .run();
}

export async function insertInvite(
  db: IndexDb,
  token: string,
  groupId: string,
  memberId: string,
  expiresAt: string,
): Promise<void> {
  const hash = await sha256Hex(token);
  await db
    .prepare(
      'INSERT INTO invites (token_hash, group_id, member_id, expires_at, redeemed_at) VALUES (?, ?, ?, ?, NULL)',
    )
    .bind(hash, groupId, memberId, expiresAt)
    .run();
}

export async function claimInvite(
  db: IndexDb,
  tokenHash: string,
  redeemedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      'UPDATE invites SET redeemed_at = ? WHERE token_hash = ? AND redeemed_at IS NULL',
    )
    .bind(redeemedAt, tokenHash)
    .run();
  return result.meta.changes === 1;
}
