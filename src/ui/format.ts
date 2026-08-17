import { currencySymbol } from '@/src/domain/currency';

/** Integer cents as decimal text. Remainder is `% 100`, not a float. */
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

export function formatMoney(
  cents: number,
  currency: string,
  signed = false,
): string {
  const sign = !signed || cents === 0 ? '' : cents > 0 ? '+' : '−';
  return `${sign}${formatCents(cents)} ${currencySymbol(currency)}`;
}

export function memberLabel(displayName: string, isYou: boolean): string {
  if (isYou) return 'You';
  return displayName === '' ? '(unnamed)' : displayName;
}
