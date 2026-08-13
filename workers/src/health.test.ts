import { describe, expect, it } from 'vitest';

import { healthPayload, isHealthRequest } from './health';

describe('isHealthRequest', () => {
  const url = (query: string) =>
    `https://splitnext.santistebanc94.workers.dev/merge${query}`;

  it('accepts a GET carrying health=1', () => {
    expect(isHealthRequest('GET', url('?health=1'))).toBe(true);
  });

  it('accepts health=1 alongside other params, in any position', () => {
    expect(isHealthRequest('GET', url('?foo=bar&health=1'))).toBe(true);
  });

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
