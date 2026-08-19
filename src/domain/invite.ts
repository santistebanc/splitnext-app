/**
 * Whether an invite can still be redeemed.
 *
 * One-use and 7-day are the product shape: a redeemed row is spent, an
 * `expires_at` in the past is spent, and a tombstoned member cannot be bound
 * to. The clock is passed in so the rule does not read `Date.now()`.
 */
export type InviteView = {
  expires_at: string;
  redeemed_at: string | null;
  member_deleted_at: string | null;
};

export function inviteIsLive(invite: InviteView, now: Date): boolean {
  if (invite.redeemed_at != null) return false;
  if (invite.member_deleted_at != null) return false;
  return now.getTime() < Date.parse(invite.expires_at);
}

export type InviteStatus = 'active' | 'expired' | 'used';

/** Status of one invite row at `now`. */
export function inviteStatusForRow(invite: InviteView, now: Date): InviteStatus {
  if (invite.redeemed_at != null) return 'used';
  if (invite.member_deleted_at != null) return 'used';
  if (now.getTime() >= Date.parse(invite.expires_at)) return 'expired';
  return 'active';
}

export type InviteListStatus = InviteStatus | 'none';

/**
 * Status for the UI from server rows (newest `expires_at` first).
 * Any still-live row counts as active even if an older row was spent.
 */
export function inviteListStatus(
  invites: InviteView[],
  now: Date,
): InviteListStatus {
  if (invites.length === 0) return 'none';
  for (const row of invites) {
    if (inviteIsLive(row, now)) return 'active';
  }
  return inviteStatusForRow(invites[0], now);
}

/**
 * Pull the invite secret out of whatever the person pasted: a raw token, a
 * `/j/{token}` path, a `/join?token=` URL, or a full URL of either. Empty /
 * a join URL with no token is not a secret.
 */
export function parseInviteToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromUrl = tokenFromUrl(trimmed);
  if (fromUrl !== undefined) return fromUrl;

  return trimmed;
}

/**
 * Path (no origin) for a join link. The published site lives under
 * `/splitnext-app`; locally it does not. Copied links open the invite
 * landing (`/j/{token}`), not Expo `/app/j/…`. Callers prepend origin.
 */
export function joinPathForToken(token: string, pathname: string): string {
  const prefix = pathname.startsWith('/splitnext-app')
    ? '/splitnext-app'
    : '';
  return `${prefix}/j/${encodeURIComponent(token)}`;
}

/** `undefined` means "not a URL"; `null` means "a join URL with no token". */
function tokenFromUrl(input: string): string | null | undefined {
  const candidates = [input];
  if (input.startsWith('/')) candidates.push(`http://parse.local${input}`);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      const fromPath = tokenFromJoinPath(url.pathname);
      if (fromPath) return fromPath;
      const token = url.searchParams.get('token');
      if (token && token.length > 0) return token;
      return null;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

function tokenFromJoinPath(pathname: string): string | null {
  const match = pathname.match(/\/j\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
