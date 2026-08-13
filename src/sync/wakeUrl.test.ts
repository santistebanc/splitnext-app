import { afterEach, describe, expect, it } from 'vitest';

import { wakeUrl } from './wakeUrl';

describe('wakeUrl', () => {
  const previous = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = previous;
    }
  });

  it('puts token and device id on the query string and encodes the group id', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://example.test';
    expect(wakeUrl('g 1', 'tok', 'dev')).toBe(
      'wss://example.test/wake/g%201?access_token=tok&device_user_id=dev',
    );
  });
});
