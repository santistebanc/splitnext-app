/**
 * ISO tender codes the picker offers. Symbols and English names come from
 * `Intl` so they match the device, not a hand-maintained glyph table.
 * Metals / testing / no-currency codes are omitted.
 */
const CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
  'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
  'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
  'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC',
  'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD',
  'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST',
  'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG', 'ZWL',
] as const;

const PINNED = [
  'EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK',
  'DKK', 'PLN', 'INR', 'CNY', 'KRW', 'BRL', 'MXN', 'SGD', 'HKD', 'THB',
] as const;

export type Currency = {
  code: string;
  symbol: string;
  name: string;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Narrow symbol for a stored ISO code; unknown or blank stays as typed. */
export function currencySymbol(code: string): string {
  const upper = normalizeCode(code);
  if (!/^[A-Z]{3}$/.test(upper)) {
    const trimmed = code.trim();
    return trimmed === '' ? code : trimmed;
  }
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: upper,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    return parts.find((p) => p.type === 'currency')?.value ?? upper;
  } catch {
    return upper;
  }
}

export function currencyName(code: string): string {
  const upper = normalizeCode(code);
  if (!/^[A-Z]{3}$/.test(upper)) {
    const trimmed = code.trim();
    return trimmed === '' ? code : trimmed;
  }
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(upper) ?? upper;
  } catch {
    return upper;
  }
}

function asCurrency(code: string): Currency {
  return {
    code,
    symbol: currencySymbol(code),
    name: currencyName(code),
  };
}

let catalog: Currency[] | null = null;

/** Every tender currency, common ones first, then the rest by English name. */
export function allCurrencies(): Currency[] {
  if (catalog) return catalog;
  const pin = new Set<string>(PINNED);
  const rest = CODES.filter((c) => !pin.has(c))
    .map(asCurrency)
    .sort((a, b) => a.name.localeCompare(b.name));
  catalog = [...PINNED.map(asCurrency), ...rest];
  return catalog;
}
