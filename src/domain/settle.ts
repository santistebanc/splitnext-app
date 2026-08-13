import type { Balance } from './balances';

export type Settlement = {
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  from_display_name: string;
  to_display_name: string;
};

/** Exact partition stays cheap; beyond this, pair poorest with richest. */
const EXACT_LIMIT = 16;

/**
 * The fewest transfers that zero every net we can settle.
 *
 * Drop members already at zero. Partition the rest into as many disjoint
 * subgroups whose nets sum to zero as exist — each extra subgroup saves a
 * transfer versus pairing the whole group (Settle Up, not Splitwise greedy).
 * Inside a subgroup, pair poorest with richest until both sides are gone.
 * Member-id order on every tie, so two devices agree.
 *
 * Nets that do not sum to zero (a legacy expense, a share pointing at a
 * member this device has not seen) leave an unmatched remainder: settle the
 * largest zero-sum portion and omit the rest. Never invent a person.
 */
export function suggestSettlements(balances: readonly Balance[]): Settlement[] {
  const nonzero = balances
    .filter((b) => b.net_cents !== 0)
    .sort((a, b) => a.member_id.localeCompare(b.member_id));
  if (nonzero.length < 2) return [];
  if (nonzero.length > EXACT_LIMIT) return pairPoorestRichest(nonzero);

  const n = nonzero.length;
  const size = 1 << n;
  const sum = new Int32Array(size);
  const nets = nonzero.map((b) => b.net_cents);
  for (let mask = 1; mask < size; mask += 1) {
    const bit = mask & -mask;
    const i = 31 - Math.clz32(bit);
    sum[mask] = sum[mask ^ bit] + nets[i];
  }

  const pieces = new Int8Array(size);
  for (let mask = 1; mask < size; mask += 1) {
    if (sum[mask] !== 0) continue;
    pieces[mask] = 1;
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      if (sum[sub] !== 0) continue;
      const rest = mask ^ sub;
      const split = pieces[sub] + pieces[rest];
      if (split > pieces[mask]) pieces[mask] = split;
    }
  }

  let best = 0;
  let bestPop = 0;
  let bestPieces = 0;
  for (let mask = 1; mask < size; mask += 1) {
    if (sum[mask] !== 0) continue;
    let pop = 0;
    for (let m = mask; m; m &= m - 1) pop += 1;
    if (
      pop > bestPop ||
      (pop === bestPop &&
        (pieces[mask] > bestPieces ||
          (pieces[mask] === bestPieces && mask < best)))
    ) {
      best = mask;
      bestPop = pop;
      bestPieces = pieces[mask];
    }
  }
  if (best === 0) return [];

  const out: Settlement[] = [];
  for (const component of splitComponents(best, sum, pieces)) {
    const people: Balance[] = [];
    for (let i = 0; i < n; i += 1) {
      if (component & (1 << i)) people.push({ ...nonzero[i] });
    }
    out.push(...pairPoorestRichest(people));
  }

  return out.sort(
    (a, b) =>
      a.from_member_id.localeCompare(b.from_member_id) ||
      a.to_member_id.localeCompare(b.to_member_id) ||
      a.amount_cents - b.amount_cents,
  );
}

function splitComponents(
  mask: number,
  sum: Int32Array,
  pieces: Int8Array,
): number[] {
  if (pieces[mask] <= 1) return [mask];
  for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
    if (sum[sub] !== 0) continue;
    const rest = mask ^ sub;
    if (pieces[sub] + pieces[rest] === pieces[mask]) {
      return [
        ...splitComponents(sub, sum, pieces),
        ...splitComponents(rest, sum, pieces),
      ];
    }
  }
  return [mask];
}

function pairPoorestRichest(people: Balance[]): Settlement[] {
  const open = people.map((p) => ({ ...p }));
  const out: Settlement[] = [];

  while (true) {
    const debtors = open
      .filter((p) => p.net_cents < 0)
      .sort(
        (a, b) =>
          a.net_cents - b.net_cents || a.member_id.localeCompare(b.member_id),
      );
    const creditors = open
      .filter((p) => p.net_cents > 0)
      .sort(
        (a, b) =>
          b.net_cents - a.net_cents || a.member_id.localeCompare(b.member_id),
      );
    if (debtors.length === 0 || creditors.length === 0) break;

    const from = debtors[0];
    const to = creditors[0];
    const amount = Math.min(-from.net_cents, to.net_cents);
    if (!Number.isInteger(amount) || amount <= 0) break;

    from.net_cents += amount;
    to.net_cents -= amount;
    out.push({
      from_member_id: from.member_id,
      to_member_id: to.member_id,
      amount_cents: amount,
      from_display_name: from.display_name,
      to_display_name: to.display_name,
    });
  }

  return out;
}
