import { describe, expect, it } from 'vitest';
import {
  INVITE_CODE_LENGTH,
  formatInviteCode,
  isWellFormedInviteCode,
  normalizeInviteCode,
} from './inviteCode';

describe('normalizeInviteCode', () => {
  it('leaves an already-canonical code alone', () => {
    expect(normalizeInviteCode('ABCD2345')).toBe('ABCD2345');
  });

  it('uppercases, so a code typed in lower case still works', () => {
    expect(normalizeInviteCode('abcd2345')).toBe('ABCD2345');
  });

  it('strips the display hyphen', () => {
    expect(normalizeInviteCode('ABCD-2345')).toBe('ABCD2345');
  });

  it('strips surrounding whitespace', () => {
    expect(normalizeInviteCode('  ABCD2345  ')).toBe('ABCD2345');
  });

  it('strips whitespace inside, which is how a pasted code arrives', () => {
    expect(normalizeInviteCode('ABCD 2345')).toBe('ABCD2345');
  });

  it('every way of typing the same code normalizes identically', () => {
    const forms = [
      'ABCD2345',
      'abcd2345',
      'ABCD-2345',
      'abcd-2345',
      ' abcd 2345 ',
      'a b c d 2 3 4 5',
    ];
    const normalized = new Set(forms.map(normalizeInviteCode));
    expect([...normalized]).toEqual(['ABCD2345']);
  });

  it('drops separators the alphabet never contains rather than passing them on', () => {
    expect(normalizeInviteCode('ABCD.2345')).toBe('ABCD2345');
    expect(normalizeInviteCode('ABCD_2345')).toBe('ABCD2345');
  });

  it('is empty for an empty input', () => {
    expect(normalizeInviteCode('')).toBe('');
    expect(normalizeInviteCode('   ')).toBe('');
  });
});

describe('isWellFormedInviteCode', () => {
  it('accepts a full-length code in the alphabet', () => {
    expect(isWellFormedInviteCode('ABCD2345')).toBe(true);
  });

  it('accepts what a person typed, normalizing first', () => {
    expect(isWellFormedInviteCode(' abcd-2345 ')).toBe(true);
  });

  it('rejects a short code, so the join button stays disabled mid-typing', () => {
    expect(isWellFormedInviteCode('ABCD234')).toBe(false);
  });

  it('rejects a long code', () => {
    expect(isWellFormedInviteCode('ABCD23456')).toBe(false);
  });

  it('rejects the ambiguous characters the alphabet excludes', () => {
    // O/0 and I/1/L are the pairs a person reading a code aloud confuses.
    for (const bad of ['ABCD234O', 'ABCD2340', 'ABCD234I', 'ABCD2341', 'ABCD234L']) {
      expect(isWellFormedInviteCode(bad)).toBe(false);
    }
  });

  it('rejects an empty code', () => {
    expect(isWellFormedInviteCode('')).toBe(false);
  });
});

describe('formatInviteCode', () => {
  it('hyphenates in the middle, which is how it is shown to read aloud', () => {
    expect(formatInviteCode('ABCD2345')).toBe('ABCD-2345');
  });

  it('formats what it is given after normalizing, so it is idempotent', () => {
    expect(formatInviteCode(formatInviteCode('ABCD2345'))).toBe('ABCD-2345');
  });

  it('leaves a code that is not full length unformatted rather than inventing a shape', () => {
    expect(formatInviteCode('ABC')).toBe('ABC');
  });

  it('splits exactly in half', () => {
    expect(formatInviteCode('ABCD2345')).toHaveLength(INVITE_CODE_LENGTH + 1);
  });
});
