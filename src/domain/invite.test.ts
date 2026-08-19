import { describe, expect, it } from 'vitest';
import { inviteIsLive, joinPathForToken, parseInviteToken } from './invite';

const NOW = new Date('2026-08-13T00:00:00.000Z');

function invite(
  partial: Partial<{
    expires_at: string;
    redeemed_at: string | null;
    member_deleted_at: string | null;
  }> = {},
) {
  return {
    expires_at: '2026-08-20T00:00:00.000Z',
    redeemed_at: null,
    member_deleted_at: null,
    ...partial,
  };
}

describe('inviteIsLive', () => {
  it('is live when unredeemed, unexpired, and the member is still there', () => {
    expect(inviteIsLive(invite(), NOW)).toBe(true);
  });

  it('is dead once redeemed, even if the expiry is still in the future', () => {
    expect(
      inviteIsLive(invite({ redeemed_at: '2026-08-13T01:00:00.000Z' }), NOW),
    ).toBe(false);
  });

  it('is dead at the expiry instant, not a millisecond after', () => {
    expect(
      inviteIsLive(invite({ expires_at: NOW.toISOString() }), NOW),
    ).toBe(false);
  });

  it('is dead after expiry', () => {
    expect(
      inviteIsLive(invite({ expires_at: '2026-08-12T23:59:59.000Z' }), NOW),
    ).toBe(false);
  });

  it('is dead when the named member has been tombstoned', () => {
    expect(
      inviteIsLive(
        invite({ member_deleted_at: '2026-08-12T00:00:00.000Z' }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe('parseInviteToken', () => {
  it('returns a raw token unchanged', () => {
    expect(parseInviteToken('abc-DEF_123')).toBe('abc-DEF_123');
  });

  it('pulls token out of a /join URL', () => {
    expect(
      parseInviteToken('http://127.0.0.1:8081/join?token=abc-DEF_123'),
    ).toBe('abc-DEF_123');
  });

  it('pulls token out of a /j/ path', () => {
    expect(parseInviteToken('http://127.0.0.1:8081/j/xK3mP9qL2nQ')).toBe(
      'xK3mP9qL2nQ',
    );
  });

  it('pulls token out of a pasted /j/ path with no origin', () => {
    expect(parseInviteToken('/j/xK3mP9qL2nQ')).toBe('xK3mP9qL2nQ');
  });

  it('pulls token out of a Pages /j/ URL', () => {
    expect(
      parseInviteToken(
        'https://santistebanc.github.io/splitnext-app/app/j/xK3mP9qL2nQ',
      ),
    ).toBe('xK3mP9qL2nQ');
  });

  it('pulls token out of a Pages invite-landing /j/ URL', () => {
    expect(
      parseInviteToken(
        'https://santistebanc.github.io/splitnext-app/j/xK3mP9qL2nQ',
      ),
    ).toBe('xK3mP9qL2nQ');
  });

  it('pulls token out of a pasted path with no origin', () => {
    expect(parseInviteToken('/join?token=abc-DEF_123')).toBe('abc-DEF_123');
  });

  it('decodes a percent-encoded token in the query', () => {
    expect(parseInviteToken('/join?token=ab%2Bcd')).toBe('ab+cd');
  });

  it('trims surrounding whitespace', () => {
    expect(parseInviteToken('  abc-DEF_123  \n')).toBe('abc-DEF_123');
  });

  it('returns null for empty input', () => {
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken('   ')).toBeNull();
  });

  it('returns null for a join URL with no token', () => {
    expect(parseInviteToken('http://127.0.0.1:8081/join')).toBeNull();
  });
});

describe('joinPathForToken', () => {
  it('is /j/{token} on a local path', () => {
    expect(joinPathForToken('abc', '/group/g1')).toBe('/j/abc');
  });

  it('keeps the Pages site prefix so a copied link opens the invite landing', () => {
    expect(joinPathForToken('abc', '/splitnext-app/app/group/g1')).toBe(
      '/splitnext-app/j/abc',
    );
  });
});
