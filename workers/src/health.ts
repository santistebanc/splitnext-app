// Which commit is actually serving this request?
//
// Deploying by hand made that unanswerable, and unanswerable meant wrong.
// Every route answers `GET ...?health=1` with the sha it was deployed from.
// CI asserts every name in FUNCTIONS reports that sha.

export type HealthPayload = {
  ok: true;
  fn: string;
  revision: string;
};

/**
 * True for the deploy probe, and only for it. Real work happens on POST
 * (and the wake socket on GET+Upgrade), so the probe is scoped to GET
 * without an Upgrade: it can never shadow a merge.
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
 * separate answers, because a worker that is up but cannot name its own
 * commit is up and untrustworthy. The verifier fails it: 'unknown' never
 * equals the merge sha.
 */
export function healthPayload(
  fn: string,
  deploySha: string | undefined,
): HealthPayload {
  return { ok: true, fn, revision: deploySha || 'unknown' };
}
