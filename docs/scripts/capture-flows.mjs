/**
 * Record one clip per flow in FLOWS.md, plus the slice's stills.
 *
 * The board's flow entries are prose: trigger, steps, outcome. Prose cannot
 * show that the steps happen in an order that works, so each flow that a
 * browser can drive gets a short looping clip beside it. They are evidence of
 * the *current system*, not of a slice — re-record a flow when its behaviour
 * changes, and the file is overwritten in place.
 *
 * Every clip starts at the state its flow starts from. Recording the setup
 * would bury the flow in preamble, so setup runs once in a context that is
 * not being recorded, and each flow's recording context is seeded with a
 * `storageState` snapshot taken at the right moment.
 *
 * Usage:
 *   node docs/scripts/capture-flows.mjs                     # every flow
 *   node docs/scripts/capture-flows.mjs F-add-expense       # one flow
 *   node docs/scripts/capture-flows.mjs --slice 0007        # + slice stills
 *   node docs/scripts/capture-flows.mjs --url http://…      # non-default port
 *
 * Needs the web target already serving (`npm run web`).
 */
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { glob, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

import { installPointerOverlay } from './capture-overlay.mjs';
import { VIEWPORT, balancesOf, makeDriver } from './capture-driver.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'state', 'shots');
const FLOW_SHOTS = join(SHOTS, 'flows');

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
// `npm run web` serves on 8081; override with --url when it is elsewhere.
const BASE = flagValue('--url') ?? 'http://127.0.0.1:8081';
const SLICE = flagValue('--slice');
const only = argv.filter((a) => a.startsWith('F-'));

const problems = [];

/**
 * Trim the dev-server load off the front of a clip.
 *
 * Recording starts when the browser context does, so every clip opens on a
 * blank page while the bundle loads — two seconds of nothing at the head of a
 * short loop. That blankness is Metro warming up, not the app, so showing it
 * misrepresents the flow.
 *
 * Best-effort: uses whatever `ffmpeg` is around (Playwright ships one for its
 * own recording), and leaves the clip untouched if there is none. A missing
 * trim costs two dull seconds; making it a hard dependency would cost the
 * whole capture.
 */
let ffmpegPath;
async function findFfmpeg() {
  if (ffmpegPath !== undefined) return ffmpegPath;
  ffmpegPath = null;
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean);
  for await (const p of glob(
    join(homedir(), '.cache', 'ms-playwright', 'ffmpeg-*', 'ffmpeg-*'),
  )) {
    candidates.push(p);
  }
  for (const candidate of candidates) {
    try {
      await run(candidate, ['-version']);
      ffmpegPath = candidate;
      break;
    } catch {
      // Try the next one; absence is the expected case, not an error.
    }
  }
  return ffmpegPath;
}

async function trimHead(file, seconds) {
  if (seconds <= 0.2) return;
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return;
  const trimmed = `${file}.trimmed.webm`;
  try {
    // Re-encoded, not stream-copied: these recordings carry almost no
    // keyframes, so `-c copy` snaps the cut back to frame zero and silently
    // trims nothing. A few seconds of VP8 on an 8-second clip is cheap.
    await run(ffmpeg, ['-loglevel', 'error', '-ss', String(seconds), '-i', file,
      '-c:v', 'libvpx', '-b:v', '300k', '-cpu-used', '4', trimmed, '-y']);
    await rename(trimmed, file);
  } catch {
    await rm(trimmed, { force: true });
  }
}

// ── Flows ──────────────────────────────────────────────────────────────────
// `from` names the snapshot the flow starts at — the state its FLOWS.md
// trigger assumes. Flows needing two devices or a backgrounded app are absent
// on purpose; see UNRECORDED below.
const FLOWS = [
  {
    id: 'F-create',
    from: 'empty',
    at: '/',
    async run(d) {
      await d.tap('Create group');
      await d.beat(2600);
    },
  },
  {
    id: 'F-open',
    from: 'spent',
    at: '/',
    async run(d, page) {
      await d.press(page.locator('text=/^[0-9a-f]{8}-/').first());
      await d.beat(2600);
    },
  },
  {
    id: 'F-add-member',
    from: 'group',
    async run(d) {
      await d.type('Member name', 'Ana');
      await d.tap('Add member');
      await d.beat(1600);
    },
  },
  {
    id: 'F-bind',
    from: 'roster',
    async run(d) {
      await d.tap('This is me');
      await d.beat(1800);
    },
  },
  {
    id: 'F-add-expense',
    from: 'bound',
    async run(d) {
      await d.type(/^Amount/, '10.00');
      await d.type('What for', 'Taxi');
      await d.tap('Add expense');
      await d.beat(2400);
    },
  },
  {
    id: 'F-balances',
    from: 'spent',
    async run(d, page) {
      // The second expense is what makes the balances interesting: uneven
      // cents, and a payer who is up while everyone else is down.
      await d.type(/^Amount/, '4.50');
      await d.type('What for', 'Coffee');
      await d.tap('Add expense');
      await d.beat(2600);

      const before = balancesOf(await page.innerText('body'));
      await page.goto(page.url(), { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForTimeout(4000);
      const after = balancesOf(await page.innerText('body'));
      if (!after) problems.push('[F-balances] no balances after reload');
      if (before !== after) {
        problems.push(
          `[F-balances] balances changed across a reload:\n  before: ${before}\n  after:  ${after}`,
        );
      }
      await d.beat(1500);
    },
  },
  {
    id: 'F-bump',
    from: 'bound',
    async run(d) {
      await d.tap('Bump name (merge + wake)');
      await d.beat(2400);
    },
  },
];

/** Stated, not silently skipped — an absent clip should say why. */
const UNRECORDED = {
  'F-sync': 'no surface of its own; it runs inside F-open and F-foreground',
  'F-foreground': 'needs the app backgrounded and returned to, which a headless page cannot do',
  'F-wake': 'needs a second device changing the group while this one watches',
  'F-invite':
    'needs mint-invite on the server, which this slice adds and D-052 only deploys on merge',
  'F-join':
    'needs join-group on the server plus a second device; both the function and a live two-context capture wait on this slice merging (D-052)',
  'F-wake-reconnect':
    'needs the Realtime socket to drop and return while the hub stays open, and a second device to have written in between',
};

// ── Setup ──────────────────────────────────────────────────────────────────
// An unrecorded run through the app, stopping at the state the flow starts
// from. `storageState` carries the origin's localStorage, which is where both
// the store and the capability tokens live on web.
//
// Every flow gets its **own group**, seeded from scratch. Sharing one would
// couple the clips to the order they were recorded in: the group's first
// expense closes the binding for good, so a shared group would mean F-bind
// had to run before F-add-expense or quietly record a screen with no button
// on it. Seeding costs ~10s per flow and buys independence.
const STAGES = ['empty', 'group', 'roster', 'bound', 'spent'];

async function seed(browser, stage) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const upTo = STAGES.indexOf(stage);

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);

  let hubUrl = BASE;
  if (upTo >= STAGES.indexOf('group')) {
    await page.getByText('Create group', { exact: true }).first().click();
    await page.waitForTimeout(3000);
    hubUrl = page.url();
  }
  if (upTo >= STAGES.indexOf('roster')) {
    for (const name of ['Ana', 'Bo', 'Cy']) {
      await page.getByPlaceholder('Member name').fill(name);
      await page.getByText('Add member', { exact: true }).first().click();
      await page.waitForTimeout(1500);
    }
  }
  if (upTo >= STAGES.indexOf('bound')) {
    await page.getByText('This is me', { exact: true }).first().click();
    await page.waitForTimeout(1800);
  }
  if (upTo >= STAGES.indexOf('spent')) {
    await page.getByPlaceholder(/^Amount/).fill('10.00');
    await page.getByPlaceholder('What for').fill('Taxi');
    await page.getByText('Add expense', { exact: true }).first().click();
    await page.waitForTimeout(2500);
  }

  const storageState = await context.storageState();
  await context.close();
  return { storageState, hubUrl };
}

// ── Record ─────────────────────────────────────────────────────────────────
async function record(browser, flow, storageState, hubUrl) {
  const dir = join(FLOW_SHOTS, `.tmp-${flow.id}`);
  await rm(dir, { recursive: true, force: true });

  // Recording begins with the context, so this is frame zero of the clip.
  const startedAt = Date.now();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    storageState,
    recordVideo: { dir, size: VIEWPORT },
  });
  await context.addInitScript(installPointerOverlay);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${flow.id}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${flow.id}] ${e.message}`));

  const target = flow.at === '/' ? BASE : hubUrl;
  await page.goto(target, { waitUntil: 'networkidle', timeout: 120000 });
  const d = makeDriver(page);
  await d.enter();
  // Everything before this was the page loading; keep a beat of the settled
  // screen so the clip opens on the state the flow starts from.
  const loadedFor = (Date.now() - startedAt) / 1000 - 0.5;
  await d.beat(1100);

  await flow.run(d, page);

  await context.close();
  const [recorded] = await readdir(dir);
  const out = join(FLOW_SHOTS, `${flow.id}.webm`);
  await rename(join(dir, recorded), out);
  await rm(dir, { recursive: true, force: true });
  await trimHead(out, loadedFor);
  console.log('clip', `flows/${flow.id}.webm`);
}

/** Stills for the slice in flight: a surface standing still, not a path. */
async function stills(browser, storageState, hubUrl, number) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    storageState,
  });
  const page = await context.newPage();
  await page.goto(hubUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(SHOTS, `${number}-balances.png`) });
  console.log('still', `${number}-balances.png`);
  await context.close();
}

// ── Run ────────────────────────────────────────────────────────────────────
await mkdir(FLOW_SHOTS, { recursive: true });
const browser = await chromium.launch();

for (const flow of FLOWS) {
  if (only.length && !only.includes(flow.id)) continue;
  const { storageState, hubUrl } = await seed(browser, flow.from);
  await record(browser, flow, storageState, hubUrl);
}

if (SLICE) {
  const { storageState, hubUrl } = await seed(browser, 'spent');
  await stills(browser, storageState, hubUrl, SLICE);
}

await browser.close();

for (const [id, why] of Object.entries(UNRECORDED)) {
  console.log(`skipped ${id} — ${why}`);
}
console.log(problems.length ? problems.join('\n') : 'console clean');
process.exit(problems.length ? 1 : 0);
