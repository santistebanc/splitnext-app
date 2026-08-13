import type { Settlement } from './settle';

export type ExpenseSearchParams = {
  payer?: string | string[];
  amount?: string | string[];
  participants?: string | string[];
  what?: string | string[];
};

export type ExpensePrefill = {
  payerId: string;
  amountCents: number;
  participantIds: string[];
  what: string;
};

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Turn the new-expense query string into form values, or `null` if the
 * required pieces are missing or not money. Does not look up members.
 */
export function expensePrefillFromSearchParams(
  params: ExpenseSearchParams,
): ExpensePrefill | null {
  const payerId = one(params.payer).trim();
  const amountRaw = one(params.amount).trim();
  const what = one(params.what);
  const participantIds = [
    ...new Set(
      one(params.participants)
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ];

  if (!payerId || participantIds.length === 0) return null;
  if (!/^\d+$/.test(amountRaw)) return null;
  const amountCents = Number(amountRaw);
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;

  return { payerId, amountCents, participantIds, what };
}

/** Path the hub opens for a settle-up row. Amount is integer cents. */
export function settlementHref(groupId: string, s: Settlement): string {
  const q = new URLSearchParams({
    payer: s.from_member_id,
    amount: String(s.amount_cents),
    participants: s.to_member_id,
    what: 'Settlement',
  });
  return `/group/${groupId}/expense/new?${q.toString()}`;
}
