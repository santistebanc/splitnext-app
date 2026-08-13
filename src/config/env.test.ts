import { afterEach, describe, expect, it } from 'vitest';

import { env } from './env';

describe('env.apiUrl', () => {
  const previous = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = previous;
    }
  });

  it('throws on read when the URL is unset', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(() => env.apiUrl).toThrow(/Missing EXPO_PUBLIC_API_URL/);
  });

  it('strips a trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8787/';
    expect(env.apiUrl).toBe('http://127.0.0.1:8787');
  });
});
