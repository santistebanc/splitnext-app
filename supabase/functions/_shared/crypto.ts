export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Unambiguous when read aloud: no O/0, no I/1/L.
 * Must stay identical to `INVITE_CODE_ALPHABET` in `src/domain/inviteCode.ts` —
 * the client normalizes typed codes against its copy, and a character in one
 * alphabet but not the other is a code that can be minted but never entered.
 */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;

/**
 * A short code a person can carry from one screen to another.
 *
 * Rejection sampling rather than `% alphabet.length`: 256 is not a multiple of
 * 31, so the plain modulo would make the first few characters measurably more
 * likely and quietly shrink the keyspace.
 */
export function randomInviteCode(): string {
  const max = 256 - (256 % INVITE_ALPHABET.length);
  let out = '';
  while (out.length < INVITE_LENGTH) {
    const bytes = new Uint8Array(INVITE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= max) continue;
      out += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
      if (out.length === INVITE_LENGTH) break;
    }
  }
  return out;
}
