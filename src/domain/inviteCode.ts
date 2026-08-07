/**
 * The shape of an invite code, and the one place a typed one is made canonical.
 *
 * An invite code is read off one screen and typed into another — often aloud,
 * often across a room. That journey, not cryptography, is what shapes it: the
 * alphabet leaves out the characters people confuse when reading (`O`/`0`,
 * `I`/`1`/`L`), and everything a person might add on the way in — the display
 * hyphen, stray spaces, lower case — is stripped back off here rather than
 * being allowed to reach the server as a different code.
 *
 * Kept as its own module because both ends need it: the client normalizes
 * before sending, and the alphabet has to match what the server mints.
 */

/** Unambiguous when read aloud: no O/0, no I/1/L. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const INVITE_CODE_LENGTH = 8;

/**
 * What the user typed → what the server is asked about.
 *
 * Strips every character outside the alphabet rather than only the hyphen we
 * happen to print: a code arrives pasted, spoken, or re-typed, and the ways it
 * picks up punctuation are not worth enumerating.
 */
export function normalizeInviteCode(raw: string): string {
  const upper = raw.toUpperCase();
  let out = '';
  for (const ch of upper) {
    if (INVITE_CODE_ALPHABET.includes(ch)) out += ch;
  }
  return out;
}

/**
 * Whether this is worth sending at all — full length, all in the alphabet.
 *
 * Lets the join button stay disabled while someone is still typing, so a
 * half-entered code never becomes a failed round trip.
 */
export function isWellFormedInviteCode(raw: string): boolean {
  return normalizeInviteCode(raw).length === INVITE_CODE_LENGTH;
}

/** `ABCD2345` → `ABCD-2345`, which is how it is shown and read out. */
export function formatInviteCode(raw: string): string {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_CODE_LENGTH) return code;
  const half = INVITE_CODE_LENGTH / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}
