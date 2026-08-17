import { allocateMixed } from '@/src/domain/allocateMixed';

export type SplitEditorState = {
  shares: Record<string, number>;
  fixedCents: Record<string, number | null>;
};

export type SplitAmongEntry = {
  memberId: string;
  shareUnits: number;
  fixedCents: number | null;
};

export type SplitEditorDerived = {
  activeMemberIds: string[];
  shareMemberIds: string[];
  allocCentsByMember: Record<string, number>;
  hasUnequalShares: boolean;
  canSave: boolean;
  splitAmong: SplitAmongEntry[];
  isFixed: (memberId: string) => boolean;
  isActive: (memberId: string) => boolean;
  showIncreaseControl: (memberId: string) => boolean;
  amountIsPressable: (memberId: string) => boolean;
};

function parseAmountToCents(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Amount is required');
  let normalized = trimmed.replace(',', '.');
  if (normalized.startsWith('.')) normalized = `0${normalized}`;
  if (normalized.endsWith('.')) normalized = `${normalized}0`;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Invalid amount');
  }
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  return cents;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function ensureShareMember(
  lastTouchedId: string,
  shares: Record<string, number>,
  fixedCents: Record<string, number | null>,
): SplitEditorState {
  const hasShareMember = Object.entries(shares).some(
    ([id, v]) => v > 0 && fixedCents[id] == null,
  );
  if (!hasShareMember) {
    return {
      shares: { ...shares, [lastTouchedId]: 1 },
      fixedCents: Object.fromEntries(
        Object.entries(fixedCents).filter(([k]) => k !== lastTouchedId),
      ),
    };
  }
  return { shares, fixedCents };
}

function normalizeShares(
  shares: Record<string, number>,
): Record<string, number> {
  const active = Object.values(shares).filter((v) => v > 0);
  if (active.length === 0) return shares;
  const g = active.reduce(gcd);
  if (g <= 1) return shares;
  return Object.fromEntries(
    Object.entries(shares).map(([k, v]) => [k, v > 0 ? v / g : 0]),
  );
}

function normalizeNonFixedShares(
  shares: Record<string, number>,
  fixedCents: Record<string, number | null>,
): Record<string, number> {
  const nonFixed = Object.fromEntries(
    Object.entries(shares).filter(([id]) => fixedCents[id] == null),
  );
  return { ...shares, ...normalizeShares(nonFixed) };
}

function applySplitTransition(
  lastTouchedId: string,
  shares: Record<string, number>,
  fixedCents: Record<string, number | null>,
): SplitEditorState {
  return ensureShareMember(lastTouchedId, shares, fixedCents);
}

function isMemberFixed(
  fixedCents: Record<string, number | null>,
  id: string,
): boolean {
  return fixedCents[id] != null;
}

function shareMembers(
  memberIds: readonly string[],
  state: SplitEditorState,
): string[] {
  return memberIds.filter(
    (id) => (state.shares[id] ?? 0) > 0 && !isMemberFixed(state.fixedCents, id),
  );
}

function activeMembers(
  memberIds: readonly string[],
  state: SplitEditorState,
): string[] {
  return memberIds.filter(
    (id) => (state.shares[id] ?? 0) > 0 || isMemberFixed(state.fixedCents, id),
  );
}

function convertFixedToShares(
  memberIds: readonly string[],
  amountCents: number,
  state: SplitEditorState,
  memberId: string,
  roundFn: (x: number) => number,
): SplitEditorState {
  const fixed = state.fixedCents[memberId];
  if (fixed == null) return state;

  const otherFixed = Object.entries(state.fixedCents)
    .filter(([id, v]) => id !== memberId && v != null)
    .reduce((s, [, v]) => s + v!, 0);
  const nonFixedShares = memberIds
    .filter(
      (id) =>
        id !== memberId &&
        !isMemberFixed(state.fixedCents, id) &&
        (state.shares[id] ?? 0) > 0,
    )
    .reduce((s, id) => s + (state.shares[id] ?? 0), 0);
  const denom = amountCents - otherFixed - fixed;
  const equiv =
    nonFixedShares > 0 && denom > 0 ? (fixed * nonFixedShares) / denom : 1;
  const rawFixed = Object.fromEntries(
    Object.entries(state.fixedCents).filter(([k]) => k !== memberId),
  );
  return applySplitTransition(
    memberId,
    normalizeNonFixedShares(
      { ...state.shares, [memberId]: Math.max(0, roundFn(equiv)) },
      rawFixed,
    ),
    rawFixed,
  );
}

export function equalSplitState(
  memberIds: readonly string[],
): SplitEditorState {
  return {
    shares: Object.fromEntries(memberIds.map((id) => [id, 1])),
    fixedCents: {},
  };
}

export function splitForMemberState(
  memberIds: readonly string[],
  splitForId: string,
): SplitEditorState {
  return {
    shares: Object.fromEntries(
      memberIds.map((id) => [id, id === splitForId ? 1 : 0]),
    ),
    fixedCents: {},
  };
}

export function splitStateFromAllocations(
  allocations: readonly {
    member_id: string;
    amount_cents?: number;
    share_units?: number | null;
    fixed_cents?: number | null;
  }[],
  memberIds: readonly string[],
): SplitEditorState {
  if (allocations.length === 0) return equalSplitState(memberIds);
  const shares: Record<string, number> = {};
  const fixedCents: Record<string, number | null> = {};
  for (const row of allocations) {
    shares[row.member_id] = row.share_units ?? 1;
    if (row.fixed_cents != null && row.fixed_cents > 0) {
      fixedCents[row.member_id] = row.fixed_cents;
    }
  }
  return { shares, fixedCents };
}

export function increaseMemberSplit(
  memberIds: readonly string[],
  amountCents: number,
  state: SplitEditorState,
  memberId: string,
): SplitEditorState {
  if (isMemberFixed(state.fixedCents, memberId)) {
    return convertFixedToShares(
      memberIds,
      amountCents,
      state,
      memberId,
      Math.ceil,
    );
  }
  return applySplitTransition(
    memberId,
    normalizeNonFixedShares(
      { ...state.shares, [memberId]: (state.shares[memberId] ?? 0) + 1 },
      state.fixedCents,
    ),
    state.fixedCents,
  );
}

export function decreaseMemberSplit(
  memberIds: readonly string[],
  _amountCents: number,
  state: SplitEditorState,
  memberId: string,
): SplitEditorState {
  if (isMemberFixed(state.fixedCents, memberId)) {
    const rawFixed = Object.fromEntries(
      Object.entries(state.fixedCents).filter(([k]) => k !== memberId),
    );
    return applySplitTransition(
      memberId,
      { ...state.shares, [memberId]: 0 },
      rawFixed,
    );
  }
  return applySplitTransition(
    memberId,
    normalizeNonFixedShares(
      {
        ...state.shares,
        [memberId]: Math.max(0, (state.shares[memberId] ?? 0) - 1),
      },
      state.fixedCents,
    ),
    state.fixedCents,
  );
}

export function commitMemberFixedAmount(
  memberIds: readonly string[],
  amountCents: number,
  state: SplitEditorState,
  memberId: string,
  rawAmount: string,
): SplitEditorState {
  const raw = rawAmount.trim();
  const shares = shareMembers(memberIds, state);

  if (raw === '' || raw === '0' || raw === '0.00') {
    const rawFixed = Object.fromEntries(
      Object.entries(state.fixedCents).filter(([id]) => id !== memberId),
    );
    return applySplitTransition(
      memberId,
      normalizeNonFixedShares({ ...state.shares, [memberId]: 1 }, rawFixed),
      rawFixed,
    );
  }

  const otherFixed = Object.entries(state.fixedCents)
    .filter(([id, v]) => id !== memberId && v != null)
    .reduce((s, [, v]) => s + v!, 0);
  const maxCents = amountCents - otherFixed;
  const minCents =
    shares.filter((id) => id !== memberId).length === 0 ? maxCents : 0;

  let cents = 0;
  try {
    cents = parseAmountToCents(raw);
  } catch {
    cents = 0;
  }
  cents = Math.max(minCents, Math.min(maxCents, cents));

  if (cents === 0) {
    const rawFixed = Object.fromEntries(
      Object.entries(state.fixedCents).filter(([id]) => id !== memberId),
    );
    return applySplitTransition(
      memberId,
      normalizeNonFixedShares({ ...state.shares, [memberId]: 1 }, rawFixed),
      rawFixed,
    );
  }

  if (cents === maxCents) {
    const rawFixed: Record<string, number | null> = {
      ...Object.fromEntries(
        Object.entries(state.fixedCents).filter(
          ([id]) => state.fixedCents[id] != null && id !== memberId,
        ),
      ),
      [memberId]: cents,
    };
    return applySplitTransition(
      memberId,
      Object.fromEntries(Object.keys(state.shares).map((id) => [id, 0])),
      rawFixed,
    );
  }

  const rawFixed = { ...state.fixedCents, [memberId]: cents };
  return applySplitTransition(
    memberId,
    normalizeNonFixedShares({ ...state.shares, [memberId]: 0 }, rawFixed),
    rawFixed,
  );
}

export function deriveSplitEditor(
  memberIds: readonly string[],
  amountCents: number,
  state: SplitEditorState,
): SplitEditorDerived {
  const activeIds = activeMembers(memberIds, state);
  const shareIds = shareMembers(memberIds, state);

  const mixedResult =
    amountCents > 0 && activeIds.length > 0
      ? allocateMixed(
          amountCents,
          activeIds.map((id) => ({
            id,
            shareUnits: state.shares[id] ?? 0,
            fixedCents: state.fixedCents[id] ?? null,
          })),
        )
      : [];
  const allocCentsByMember: Record<string, number> = {};
  for (const row of mixedResult) {
    allocCentsByMember[row.member_id] = row.amount_cents;
  }

  const nonFixedIds = activeIds.filter(
    (id) => !isMemberFixed(state.fixedCents, id),
  );
  const totalNonFixedWeight = nonFixedIds.reduce(
    (s, id) => s + (state.shares[id] ?? 0),
    0,
  );
  const hasUnequalShares =
    totalNonFixedWeight !== nonFixedIds.length ||
    activeIds.some((id) => isMemberFixed(state.fixedCents, id));

  return {
    activeMemberIds: activeIds,
    shareMemberIds: shareIds,
    allocCentsByMember,
    hasUnequalShares,
    canSave: amountCents > 0 && activeIds.length > 0,
    splitAmong: activeIds.map((id) => ({
      memberId: id,
      shareUnits: state.shares[id] ?? 0,
      fixedCents: state.fixedCents[id] ?? null,
    })),
    isFixed: (id) => isMemberFixed(state.fixedCents, id),
    isActive: (id) =>
      (state.shares[id] ?? 0) > 0 || isMemberFixed(state.fixedCents, id),
    showIncreaseControl: (id) =>
      amountCents > 0 &&
      (isMemberFixed(state.fixedCents, id) || shareIds.length > 1),
    amountIsPressable: (id) =>
      isMemberFixed(state.fixedCents, id) || shareIds.length > 1,
  };
}
