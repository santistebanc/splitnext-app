import type { Allocation } from '@/src/types/group';

export type MixedMember = {
  id: string;
  shareUnits: number;
  fixedCents?: number | null;
};

type Rational = { num: bigint; den: bigint };

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function normalize({ num, den }: Rational): Rational {
  if (den === 0n) return { num: 0n, den: 1n };
  if (den < 0n) return normalize({ num: -num, den: -den });
  const g = gcdBig(num, den);
  return g === 0n ? { num: 0n, den: 1n } : { num: num / g, den: den / g };
}

function shareRational(
  amountCents: number,
  shareUnits: number,
  totalWeight: number,
): Rational {
  if (totalWeight <= 0) return { num: 0n, den: 1n };
  return normalize({
    num: BigInt(Math.trunc(amountCents) * shareUnits),
    den: BigInt(totalWeight),
  });
}

function fractionalRemainder(n: bigint, d: bigint): bigint {
  const r = n % d;
  const abs = r < 0n ? -r : r;
  return (abs * 1_000_000n) / d;
}

/** Round share rationals so displayed cents sum to the remainder pool. */
function roundSharesToAmountCents(
  shares: Map<string, Rational>,
  amountCents: number,
): Map<string, number> {
  const target = BigInt(Math.trunc(amountCents));
  const entries = [...shares.entries()].map(([memberId, rational]) => {
    const { num, den } = rational;
    return {
      memberId,
      truncated: num / den,
      remainder: fractionalRemainder(num, den),
    };
  });

  let delta = target - entries.reduce((s, entry) => s + entry.truncated, 0n);
  entries.sort((a, b) => {
    const byRemainder =
      b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0;
    if (byRemainder !== 0) return byRemainder;
    return a.memberId.localeCompare(b.memberId);
  });

  const rounded = new Map<string, number>();
  for (const entry of entries) {
    let cents = entry.truncated;
    if (delta > 0n) {
      cents += 1n;
      delta -= 1n;
    } else if (delta < 0n) {
      cents -= 1n;
      delta += 1n;
    }
    rounded.set(entry.memberId, Number(cents));
  }
  return rounded;
}

function storedFields(member: MixedMember): {
  share_units: number;
  fixed_cents: number | null;
} {
  const fixed =
    member.fixedCents != null && member.fixedCents > 0
      ? member.fixedCents
      : null;
  return {
    share_units: fixed != null ? 1 : member.shareUnits,
    fixed_cents: fixed,
  };
}

/**
 * Allocate total cents: fixed amounts come off the pool first, then the
 * remainder is split by share units. Leftover cents go by largest remainder,
 * then member id — two devices with the same intent agree exactly.
 */
export function allocateMixed(
  totalCents: number,
  members: readonly MixedMember[],
): Allocation[] {
  const fixed = members.filter((m) => m.fixedCents != null && m.fixedCents > 0);
  const sharesOnly = members.filter(
    (m) => (m.fixedCents == null || m.fixedCents <= 0) && m.shareUnits > 0,
  );

  const totalFixed = fixed.reduce((s, m) => s + m.fixedCents!, 0);
  const remainingPool = Math.max(0, totalCents - totalFixed);

  const centsById = new Map<string, number>();
  for (const m of fixed) centsById.set(m.id, m.fixedCents!);

  if (sharesOnly.length > 0 && remainingPool > 0) {
    const totalWeight = sharesOnly.reduce((s, m) => s + m.shareUnits, 0);
    const shareMap = new Map<string, Rational>();
    for (const m of sharesOnly) {
      shareMap.set(
        m.id,
        shareRational(remainingPool, m.shareUnits, totalWeight),
      );
    }
    for (const [id, cents] of roundSharesToAmountCents(
      shareMap,
      remainingPool,
    )) {
      centsById.set(id, cents);
    }
  } else if (sharesOnly.length > 0) {
    for (const m of sharesOnly) centsById.set(m.id, 0);
  }

  return [...centsById.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([member_id, amount_cents]) => {
      const member = members.find((m) => m.id === member_id)!;
      return { member_id, amount_cents, ...storedFields(member) };
    });
}
