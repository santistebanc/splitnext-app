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

/**
 * Pull the invite secret out of whatever the person pasted: a raw token, a
 * `/join?token=` path, or a full URL. Empty / a join URL with no token is
 * not a secret.
 */
export function parseInviteToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromUrl = tokenFromUrl(trimmed);
  if (fromUrl !== undefined) return fromUrl;

  return trimmed;
}

/**
 * Path (no origin) for a join link. The published app lives under
 * `/splitnext-app/app`; locally it does not. Callers prepend origin.
 */
export function joinPathForToken(token: string, pathname: string): string {
  const prefix = pathname.startsWith('/splitnext-app/app')
    ? '/splitnext-app/app'
    : '';
  return `${prefix}/join?token=${encodeURIComponent(token)}`;
}

/** `undefined` means "not a URL"; `null` means "a join URL with no token". */
function tokenFromUrl(input: string): string | null | undefined {
  const candidates = [input];
  if (input.startsWith('/')) candidates.push(`http://parse.local${input}`);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      const token = url.searchParams.get('token');
      return token && token.length > 0 ? token : null;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}
