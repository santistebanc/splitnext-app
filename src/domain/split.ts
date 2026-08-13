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

export type SplitParticipantsResult =
  | { ok: true; memberIds: string[] }
  | { ok: false; reason: 'empty' | 'member_missing' };

/**
 * Who shares this expense. Selected ids must all be live and at least one;
 * a missing member is refused rather than dropped, so two devices cannot
 * silently split a different set.
 */
export function participantsForSplit(
  liveMemberIds: readonly string[],
  selectedIds: readonly string[],
): SplitParticipantsResult {
  const live = new Set(liveMemberIds);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!live.has(id)) {
      return { ok: false, reason: 'member_missing' };
    }
    unique.push(id);
  }
  if (unique.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  unique.sort();
  return { ok: true, memberIds: unique };
}
