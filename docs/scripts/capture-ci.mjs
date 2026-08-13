/**
 * Boot a local Worker + `npm run web`, then drive capture --assert-only.
 *
 * CI's `capture` job runs this. It must not talk to workers.dev (D-072).
 * Needs Playwright's Chromium already installed (`npx playwright install`).
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestHarness } from 'wrangler';

import { assertLocalOrigin, metroEnv, webPortOccupied } from './local-origin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = 'http://127.0.0.1:8081';

async function waitUntilOk(url, timeoutMs, abort) {
  const deadline = Date.now() + timeoutMs;
  let last = 'not reached';
  while (Date.now() < deadline) {
    if (abort?.()) throw new Error(`${url} never came up (${last})`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
      last = `status ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${url} (${last})`);
}

function spawnInherit(command, args, env) {
  return spawn(command, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    detached: true,
  });
}

function stop(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // already gone
    }
  }
}

const server = createTestHarness({
  root: ROOT,
  workers: [{ configPath: 'workers/wrangler.jsonc' }],
});

let expo;
let expoDead = false;
let closed = false;

async function shutdown() {
  if (closed) return;
  closed = true;
  stop(expo);
  await server.close();
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(1));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(1));
});
try {
  if (await webPortOccupied(WEB)) {
    throw new Error(
      `${WEB} is already serving; capture:ci must start Metro so it inlines the local Worker URL`,
    );
  }

  const { url } = await server.listen();
  const origin = assertLocalOrigin(url.origin);
  await server.getWorker().applyD1Migrations('INDEX');
  const health = await fetch(`${origin}/create-group?health=1`);
  if (!health.ok) {
    throw new Error(`local Worker health ${health.status}`);
  }
  console.log('worker', origin);

  expo = spawnInherit('npm', ['run', 'web'], metroEnv(origin));
  expo.on('exit', () => {
    expoDead = true;
  });
  await waitUntilOk(WEB, 180_000, () => expoDead);
  console.log('web', WEB);

  const code = await new Promise((resolve, reject) => {
    const capture = spawn(
      'node',
      ['docs/scripts/capture-flows.mjs', '--assert-only', '--url', WEB],
      { cwd: ROOT, env: process.env, stdio: 'inherit' },
    );
    capture.on('error', reject);
    capture.on('exit', (c, signal) => {
      resolve(c ?? (signal ? 1 : 0));
    });
  });
  process.exitCode = code;
} finally {
  await shutdown();
}
