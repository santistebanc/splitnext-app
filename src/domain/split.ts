import type { Allocation } from '@/src/types/group';

/**
 * Split an amount equally, to the cent.
 *
 * Cents do not divide evenly, so someone has to carry the remainder. Largest
 * remainder ("Hamilton") gives everyone the floor share and hands the leftover
 * cents out one at a time — with equal shares every remainder is identical, so
 * the tie-break is the member id, sorted. That is the whole point: two devices
 * holding the same roster in different insertion orders must produce the same
 * split byte for byte, or the entity-level merge would flap between two equally
 * valid answers.
 */
export function splitEqually(
  amountCents: number,
  memberIds: readonly string[],
): Allocation[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('amount must be a positive whole number of cents');
  }

  const ids = [...new Set(memberIds)].sort();
  if (ids.length === 0) return [];

  const base = Math.floor(amountCents / ids.length);
  const remainder = amountCents - base * ids.length;

  return ids.map((member_id, index) => ({
    member_id,
    amount_cents: base + (index < remainder ? 1 : 0),
  }));
}
