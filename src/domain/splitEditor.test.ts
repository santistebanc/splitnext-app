import { describe, expect, it } from 'vitest';
import {
  commitMemberFixedAmount,
  decreaseMemberSplit,
  deriveSplitEditor,
  equalSplitState,
  increaseMemberSplit,
  splitForMemberState,
  splitStateFromAllocations,
  type SplitEditorState,
} from './splitEditor';

const MEMBERS = ['a', 'b', 'c'] as const;

describe('equalSplitState', () => {
  it('gives every member one share', () => {
    const state = equalSplitState(MEMBERS);
    expect(state.shares).toEqual({ a: 1, b: 1, c: 1 });
    expect(state.fixedCents).toEqual({});
  });
});

describe('splitForMemberState', () => {
  it('activates only the chosen member', () => {
    const state = splitForMemberState(MEMBERS, 'b');
    expect(state.shares).toEqual({ a: 0, b: 1, c: 0 });
  });
});

describe('splitStateFromAllocations', () => {
  it('falls back to equal split when empty', () => {
    expect(splitStateFromAllocations([], MEMBERS)).toEqual(
      equalSplitState(MEMBERS),
    );
  });

  it('loads shares and fixed amounts from rows', () => {
    const state = splitStateFromAllocations(
      [
        { member_id: 'a', share_units: 2, fixed_cents: null },
        { member_id: 'b', share_units: 0, fixed_cents: 400 },
      ],
      MEMBERS,
    );
    expect(state.shares.a).toBe(2);
    expect(state.shares.b).toBe(0);
    expect(state.fixedCents.b).toBe(400);
  });

  it('treats cents-only rows as one share each', () => {
    const state = splitStateFromAllocations(
      [
        { member_id: 'a', amount_cents: 500 },
        { member_id: 'b', amount_cents: 500 },
      ],
      MEMBERS,
    );
    expect(state.shares).toEqual({ a: 1, b: 1 });
    expect(state.fixedCents.a).toBeUndefined();
  });
});

describe('increaseMemberSplit / decreaseMemberSplit', () => {
  it('adds a member to the split', () => {
    let state = splitForMemberState(MEMBERS, 'a');
    state = increaseMemberSplit(MEMBERS, 1000, state, 'b');
    const derived = deriveSplitEditor(MEMBERS, 1000, state);
    expect(derived.activeMemberIds.sort()).toEqual(['a', 'b']);
  });

  it('removes a member from the split', () => {
    let state = equalSplitState(MEMBERS);
    state = decreaseMemberSplit(MEMBERS, 900, state, 'c');
    const derived = deriveSplitEditor(MEMBERS, 900, state);
    expect(derived.activeMemberIds.sort()).toEqual(['a', 'b']);
  });

  it('keeps the last share member on one share', () => {
    let state = equalSplitState(['a']);
    state = decreaseMemberSplit(['a'], 500, state, 'a');
    expect(state.shares.a).toBe(1);
  });
});

describe('commitMemberFixedAmount', () => {
  it('clears fixed amount when input is empty', () => {
    let state: SplitEditorState = {
      shares: { a: 0, b: 1, c: 1 },
      fixedCents: { a: 300 },
    };
    state = commitMemberFixedAmount(MEMBERS, 1000, state, 'a', '');
    expect(state.fixedCents.a).toBeUndefined();
    expect(state.shares.a).toBe(1);
  });

  it('sets a partial fixed amount and zeroes share units', () => {
    let state = equalSplitState(MEMBERS);
    state = commitMemberFixedAmount(MEMBERS, 1000, state, 'a', '3.00');
    expect(state.fixedCents.a).toBe(300);
    expect(state.shares.a).toBe(0);
    const derived = deriveSplitEditor(MEMBERS, 1000, state);
    expect(derived.allocCentsByMember.a).toBe(300);
    expect(
      (derived.allocCentsByMember.b ?? 0) + (derived.allocCentsByMember.c ?? 0),
    ).toBe(700);
  });

  it('converts a full-amount fixed input into a single share member', () => {
    let state = equalSplitState(MEMBERS);
    state = commitMemberFixedAmount(MEMBERS, 1000, state, 'a', '10.00');
    expect(state.fixedCents.a).toBeUndefined();
    expect(state.shares.a).toBe(1);
    expect(state.shares.b).toBe(0);
    expect(state.shares.c).toBe(0);
    const derived = deriveSplitEditor(MEMBERS, 1000, state);
    expect(derived.allocCentsByMember.a).toBe(1000);
    expect(derived.activeMemberIds).toEqual(['a']);
  });
});

describe('deriveSplitEditor', () => {
  it('reports equal split when all shares are 1', () => {
    const state = equalSplitState(MEMBERS);
    const derived = deriveSplitEditor(MEMBERS, 900, state);
    expect(derived.hasUnequalShares).toBe(false);
    expect(derived.canSave).toBe(true);
    expect(
      Object.values(derived.allocCentsByMember).reduce((s, v) => s + v, 0),
    ).toBe(900);
  });

  it('cannot save without amount or active members', () => {
    const state = splitForMemberState(MEMBERS, 'a');
    expect(deriveSplitEditor(MEMBERS, 0, state).canSave).toBe(false);

    const empty: SplitEditorState = {
      shares: { a: 0, b: 0, c: 0 },
      fixedCents: {},
    };
    expect(deriveSplitEditor(MEMBERS, 500, empty).canSave).toBe(false);
  });
});
