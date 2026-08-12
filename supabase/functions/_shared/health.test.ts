import { describe, expect, it } from 'vitest';

import { healthPayload, isHealthRequest } from './health.ts';

describe('isHealthRequest', () => {
  const url = (query: string) =>
    `https://ycpkguwfxlhpovnsuujr.supabase.co/functions/v1/merge${query}`;

  it('accepts a GET carrying health=1', () => {
    expect(isHealthRequest('GET', url('?health=1'))).toBe(true);
  });

  it('accepts health=1 alongside other params, in any position', () => {
    expect(isHealthRequest('GET', url('?foo=bar&health=1'))).toBe(true);
  });

  // The probe has to stay off the real path: every function's work happens on
  // POST, so a health check that could ride a POST would be one typo away from
  // shadowing a merge.
  it('rejects every other method, health param or not', () => {
    for (const method of ['POST', 'OPTIONS', 'PUT', 'DELETE']) {
      expect(isHealthRequest(method, url('?health=1'))).toBe(false);
    }
  });

  it('rejects a GET without the param, and health set to anything else', () => {
    expect(isHealthRequest('GET', url(''))).toBe(false);
    expect(isHealthRequest('GET', url('?health=0'))).toBe(false);
    expect(isHealthRequest('GET', url('?health='))).toBe(false);
    expect(isHealthRequest('GET', url('?health=true'))).toBe(false);
  });

  it('treats a lowercase method name as the same method', () => {
    expect(isHealthRequest('get', url('?health=1'))).toBe(true);
  });

  // Deno hands us a real request URL, but the verifier is not the only caller
  // this will ever have; an unparseable string is a no, not a crash.
  it('says no rather than throwing on a url it cannot parse', () => {
    expect(isHealthRequest('GET', 'not a url')).toBe(false);
  });
});

describe('healthPayload', () => {
  it('reports the function name and the sha it was deployed from', () => {
    expect(healthPayload('merge', 'a1b2c3d')).toEqual({
      ok: true,
      fn: 'merge',
      revision: 'a1b2c3d',
    });
  });

  // Liveness and provenance are separate answers. A function that is up but
  // cannot say what it is running is still up — and the verifier fails it,
  // because 'unknown' never equals the merge sha.
  it('is still ok, with an unknown revision, when DEPLOY_SHA is unset', () => {
    expect(healthPayload('merge', undefined)).toEqual({
      ok: true,
      fn: 'merge',
      revision: 'unknown',
    });
    expect(healthPayload('merge', '')).toEqual({
      ok: true,
      fn: 'merge',
      revision: 'unknown',
    });
  });
});
