// Which commit is actually serving this request?
//
// Deploying by hand made that unanswerable, and unanswerable meant wrong: the
// remote ran a stale `fetch-entity` for three slices while every archive said
// it had shipped. A stale function answers 200 to everything a liveness check
// could ask, so liveness is not the question — provenance is.
//
// Every function answers `GET ...?health=1` with the sha it was deployed from.
// CI asserts every name in FUNCTIONS reports the merge sha
// (docs/scripts/verify_deploy.py), so
// a deploy that silently did nothing goes red instead of green.
//
// Deno-free on purpose: `DEPLOY_SHA` is read by the caller and passed in, which
// is what lets these two rules be tested from vitest.

export type HealthPayload = {
  ok: true;
  fn: string;
  revision: string;
};

/**
 * True for the deploy probe, and only for it. Every function does its real
 * work on POST, so the probe is scoped to GET: it can never shadow a merge.
 */
export function isHealthRequest(method: string, url: string): boolean {
  if (method.toUpperCase() !== 'GET') return false;
  try {
    return new URL(url).searchParams.get('health') === '1';
  } catch {
    return false;
  }
}

/**
 * What the probe answers. `ok` is liveness and `revision` is provenance —
 * separate answers, because a function that is up but cannot name its own
 * commit is up and untrustworthy. The verifier fails it: 'unknown' never
 * equals the merge sha.
 */
export function healthPayload(
  fn: string,
  deploySha: string | undefined,
): HealthPayload {
  return { ok: true, fn, revision: deploySha || 'unknown' };
}
