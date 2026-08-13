/**
 * The origin the web bundle talks to during capture-in-CI.
 *
 * Metro inlines EXPO_PUBLIC_API_URL at start. Pointing that at workers.dev
 * would make the CI job need a live Cloudflare account, which is the
 * constraint this slice exists to remove (D-070, D-072).
 */
export function isDeployedWorkerUrl(url) {
  try {
    return new URL(url).hostname.endsWith('workers.dev');
  } catch {
    return false;
  }
}

export function assertLocalOrigin(origin) {
  if (isDeployedWorkerUrl(origin)) {
    throw new Error('capture CI must not talk to the deployed Worker');
  }
  return origin.replace(/\/$/, '');
}

export function metroEnv(origin, env = process.env) {
  const apiUrl = assertLocalOrigin(origin);
  return {
    ...env,
    EXPO_PUBLIC_API_URL: apiUrl,
    BROWSER: 'none',
    CI: env.CI ?? '1',
  };
}

/** Any HTTP response means something already owns the port — including 500. */
export async function webPortOccupied(url, fetchImpl = fetch) {
  try {
    await fetchImpl(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}
