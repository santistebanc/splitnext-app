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
 *   node docs/scripts/capture-flows.mjs --assert-only       # drive, write no clip
 *
 * Needs the web target already serving (`npm run web`).
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const run = promisify(execFile);

import { VIEWPORT, balanceRowOf, balancesOf, makeDriver, owesForOf, paidForOf, settleOf, settleRowOf } from './capture-driver.mjs';
import { contextOptions, parseCaptureArgv } from './capture-opts.mjs';
import { installPointerOverlay } from './capture-overlay.mjs';
import { isDeployedWorkerUrl } from './local-origin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'state', 'shots');
const FLOW_SHOTS = join(SHOTS, 'flows');

const { base: BASE, slice: SLICE, only, assertOnly: ASSERT_ONLY } = parseCaptureArgv(
  process.argv.slice(2),
);

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
async function playwrightFfmpegBins() {
  const root = join(homedir(), '.cache', 'ms-playwright');
  const out = [];
  let names;
  try {
    names = await readdir(root);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.startsWith('ffmpeg-')) continue;
    let bins;
    try {
      bins = await readdir(join(root, name));
    } catch {
      continue;
    }
    for (const bin of bins) {
      if (bin.startsWith('ffmpeg')) out.push(join(root, name, bin));
    }
  }
  return out;
}

async function findFfmpeg() {
  if (ffmpegPath !== undefined) return ffmpegPath;
  ffmpegPath = null;
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg', ...(await playwrightFfmpegBins())].filter(
    Boolean,
  );
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
    async run(d, page) {
      await d.tap('Create group');
      await d.type('Group name', 'Trip');
      await d.type('Your name', 'Ana');
      await d.press(page.getByTestId('create-submit'));
      await d.beat(2600);
      if (/\/settings/.test(page.url())) {
        problems.push('[F-create] landed on Settings');
      }
      if (!/\/group\//.test(page.url())) {
        problems.push('[F-create] did not land on the hub');
      }
      const body = await page.innerText('body');
      if (!/\bYou\b/.test(body)) {
        problems.push('[F-create] hub did not mark You');
      }
      if ((await page.getByTestId('add-member').count()) === 0) {
        problems.push('[F-create] hub did not offer Add member');
      }
      if (/0\.00/.test(body)) {
        problems.push('[F-create] hub showed 0.00');
      }
    },
  },
  {
    id: 'F-open',
    from: 'spent',
    at: '/',
    async run(d, page) {
      await d.tap('Trip');
      await d.beat(2600);
    },
  },
  {
    id: 'F-add-member',
    from: 'group',
    async run(d, page) {
      await d.press(page.getByTestId('add-member'));
      await d.beat(400);
      await d.type('Member name', 'Bo');
      await page.getByPlaceholder('Member name').press('Enter');
      await d.beat(1600);
    },
  },
  {
    id: 'F-rename',
    from: 'group',
    async run(d, page) {
      await d.tap('You');
      await d.beat(800);
      await d.press(page.getByTestId('member-edit'));
      await d.beat(400);
      const field = page.getByTestId('member-name');
      await field.fill('');
      await field.pressSequentially('Ann', { delay: 45 });
      await d.beat(400);
      await field.press('Enter');
      await d.beat(400);
      if ((await page.getByTestId('member-name').count()) > 0) {
        await field.blur();
      }
      await d.beat(1600);
      const renamed = await page.getByTestId('member-name-label').innerText();
      if (renamed.trim() !== 'Ann') {
        problems.push(
          `[F-rename] member screen did not show the new name (got ${JSON.stringify(renamed)})`,
        );
      }
      await page.goBack({ waitUntil: 'networkidle', timeout: 120000 });
      await d.beat(1200);
      const body = await page.innerText('body');
      if (!/\bYou\b/.test(body)) {
        problems.push('[F-rename] hub did not still mark You');
      }
    },
  },
  {
    id: 'F-kick-member',
    from: 'spent',
    async run(d, page) {
      await d.tap('Bo');
      await d.beat(800);
      await d.press(page.getByTestId('member-remove'));
      await d.beat(400);
      await d.press(page.getByTestId('member-remove-confirm-ok'));
      await d.beat(2000);
      const body = await page.innerText('body');
      if (/\bBo\b/.test(body)) {
        problems.push('[F-kick-member] hub still shows Bo');
      }
      if (!/\bCy\b/.test(body)) {
        problems.push('[F-kick-member] hub lost Cy');
      }
    },
  },
  {
    id: 'F-add-expense',
    from: 'bound',
    async run(d) {
      await d.tapNewExpense();
      await d.typeAmount('10.00');
      await d.type('What for', 'Taxi');
      await d.tap('Add expense');
      await d.beat(2400);
    },
  },
  {
    id: 'F-edit-expense',
    from: 'spent',
    async run(d, page) {
      await d.tap('View all expenses');
      await d.beat(800);
      await d.press(page.getByTestId('expense-row').first());
      await d.beat(800);
      const field = page.getByTestId('expense-amount');
      await field.fill('');
      await field.pressSequentially('12.00', { delay: 45 });
      await d.beat(400);
      await d.tap('Save');
      await d.beat(2000);
      const list = await page.innerText('body');
      if (!/12\.00/.test(list)) {
        problems.push(
          `[F-edit-expense] all-expenses list did not show the new amount (got ${JSON.stringify(list.slice(0, 400))})`,
        );
      }
      await page.goBack({ waitUntil: 'networkidle', timeout: 120000 });
      await d.beat(1600);
      const hub = await page.innerText('body');
      if (!/8\.00/.test(hub) && !/\+8\.00/.test(hub)) {
        problems.push(
          `[F-edit-expense] hub nets did not refold after the edit (got ${JSON.stringify(hub.slice(0, 400))})`,
        );
      }
    },
  },
  {
    id: 'F-delete-expense',
    from: 'spent',
    async run(d, page) {
      await d.tap('View all expenses');
      await d.beat(800);
      const before = await page.getByTestId('expense-row').count();
      if (before === 0) {
        problems.push('[F-delete-expense] no expenses to delete');
        return;
      }
      await d.press(page.getByTestId('expense-row').first());
      await d.beat(800);
      await d.press(page.getByTestId('expense-delete'));
      await d.beat(400);
      await d.press(page.getByTestId('expense-delete-confirm-ok'));
      await d.beat(2000);
      const after = await page.getByTestId('expense-row').count();
      if (after >= before) {
        problems.push(
          `[F-delete-expense] expense still listed (${before} → ${after})`,
        );
      }
      await page.goBack({ waitUntil: 'networkidle', timeout: 120000 });
      await d.beat(1600);
      const hub = await page.innerText('body');
      if (/Taxi/.test(hub)) {
        problems.push('[F-delete-expense] hub still mentions deleted expense');
      }
    },
  },
  {
    id: 'F-mixed-split',
    from: 'bound',
    async run(d, page) {
      await d.tapNewExpense();
      await d.typeAmount('9.00');
      await d.beat(400);
      await d.press(page.getByLabel('Increase share').first());
      await d.beat(400);
      await d.tap('Add expense');
      await d.beat(2400);
      const hub = await page.innerText('body');
      if (!/4\.50/.test(hub) && !/\+4\.50/.test(hub)) {
        problems.push(
          `[F-mixed-split] hub nets did not show a 2× share (got ${JSON.stringify(hub.slice(0, 400))})`,
        );
      }
    },
  },
  {
    id: 'F-balances',
    from: 'spent',
    async run(d, page) {
      // The second expense is what makes the balances interesting: uneven
      // cents, and a payer who is up while everyone else is down.
      await d.tapNewExpense();
      await d.typeAmount('4.50');
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
    id: 'F-settle',
    from: 'spent',
    async run(d, page) {
      await d.press(balanceRowOf(page));
      await d.beat(1600);

      const owes = await owesForOf(page).innerText();
      if (!/Taxi/.test(owes)) {
        problems.push(`[F-settle] no owe-for Taxi line (got ${JSON.stringify(owes)})`);
      }
      if (await paidForOf(page).count()) {
        problems.push('[F-settle] debtor should have no paid-for section');
      }

      const before = settleOf(await page.innerText('body'));
      if (!before) problems.push('[F-settle] no settle buttons');
      await page.goto(page.url(), { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForTimeout(4000);
      const after = settleOf(await page.innerText('body'));
      if (!after) problems.push('[F-settle] no settle buttons after reload');
      if (before !== after) {
        problems.push(
          `[F-settle] settle buttons changed across a reload:\n  before: ${before}\n  after:  ${after}`,
        );
      }

      await d.press(settleRowOf(page));
      await d.beat(1200);
      const what = await page.getByPlaceholder('What for').inputValue();
      if (what !== 'Settlement') {
        problems.push(`[F-settle] tap did not prefill Settlement (got ${JSON.stringify(what)})`);
      }
      await d.beat(1500);
    },
  },
  {
    id: 'F-settle-record',
    from: 'spent',
    async run(d, page) {
      const hubUrl = page.url();
      await d.press(balanceRowOf(page));
      await d.beat(800);
      const before = settleOf(await page.innerText('body'));
      if (!before) problems.push('[F-settle-record] no settle buttons');

      await d.press(settleRowOf(page));
      await d.beat(800);
      const what = await page.getByPlaceholder('What for').inputValue();
      if (what !== 'Settlement') {
        problems.push(
          `[F-settle-record] tap did not prefill Settlement (got ${JSON.stringify(what)})`,
        );
      }
      await d.tap('Add expense');
      await d.beat(2400);
      const paidAfter = await paidForOf(page).innerText();
      if (!/Settlement/.test(paidAfter)) {
        problems.push('[F-settle-record] Settlement did not land in paid-for');
      }

      await page.goto(hubUrl, { waitUntil: 'networkidle', timeout: 120000 });
      await d.beat(800);
      await d.tap('View all expenses');
      await d.beat(1200);
      const listed = await page.innerText('body');
      if (!/Settlement/.test(listed)) {
        problems.push('[F-settle-record] no Settlement expense listed');
      }
      if (!/split 1 way/.test(listed)) {
        problems.push('[F-settle-record] settlement was not split 1 way');
      }
      await page.goto(hubUrl, { waitUntil: 'networkidle', timeout: 120000 });
      await d.press(balanceRowOf(page));
      await d.beat(800);
      const after = settleOf(await page.innerText('body'));
      if (before && after === before) {
        problems.push('[F-settle-record] settle buttons did not change after save');
      }
    },
  },
  {
    id: 'F-leave',
    from: 'spent',
    async run(d, page) {
      await d.tapSettings();
      await d.beat(800);
      await d.press(page.getByTestId('leave'));
      await d.beat(800);
      await d.press(page.getByTestId('leave-confirm-ok'));
      await d.beat(2800);
      const body = await page.innerText('body');
      if (!/Create group/.test(body)) {
        problems.push('[F-leave] did not land on the lobby');
      }
      if (/\bTrip\b/.test(body)) {
        problems.push('[F-leave] group still listed on the lobby');
      }
    },
  },
  {
    id: 'F-bump',
    from: 'bound',
    async run(d, page) {
      await d.tapSettings();
      const field = page.getByPlaceholder('Group name');
      await d.press(field);
      await field.fill('');
      await field.pressSequentially('Cabin', { delay: 45 });
      await d.beat(400);
      await d.tap('Done');
      await d.beat(2400);
      if (/\/settings/.test(page.url())) {
        problems.push('[F-bump] still on Settings after Done');
      }
    },
  },
];

/** Stated, not silently skipped — an absent clip should say why. */
const UNRECORDED = {
  'F-sync': 'no surface of its own; it runs inside F-open and F-foreground',
  'F-foreground': 'needs the app backgrounded and returned to, which a headless page cannot do',
  'F-wake': 'needs a second device changing the group while this one watches',
  'F-invite':
    'needs a second device to redeem; mint is demoed by hand, not a one-context clip',
  'F-join':
    'needs a second browser profile to redeem while the first stays on the hub',
  'F-bind': 'no surface of its own; bind is a step of F-create and F-join',
  'F-wake-reconnect':
    'needs the wake socket to drop while the hub stays open; the client retries, but a clip cannot force the drop',
};

// ── Setup ──────────────────────────────────────────────────────────────────
// An unrecorded run through the app, stopping at the state the flow starts
// from. `storageState` carries the origin's localStorage, which is where both
// the store and the capability tokens live on web.
//
// Every flow gets its **own group**, seeded from scratch. Sharing one would
// couple the clips to the order they were recorded in. Seeding costs ~10s
// per flow and buys independence. Create already names the group and binds
// this device; later stages add friends, then an expense.
const STAGES = ['empty', 'group', 'roster', 'bound', 'spent'];

async function seedCreate(page) {
  await page.getByText('Create group', { exact: true }).first().click();
  await page.getByPlaceholder('Group name').waitFor({ timeout: 120000 });
  await page.getByPlaceholder('Group name').fill('Trip');
  await page.getByPlaceholder('Your name').fill('Ana');
  await page.getByTestId('create-submit').click();
  await page.waitForTimeout(3000);
}

async function seed(browser, stage) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const upTo = STAGES.indexOf(stage);

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);

  let hubUrl = BASE;
  if (upTo >= STAGES.indexOf('group')) {
    await seedCreate(page);
    hubUrl = page.url();
  }
  if (upTo >= STAGES.indexOf('roster')) {
    for (const name of ['Bo', 'Cy']) {
      await page.getByTestId('add-member').click();
      await page.getByPlaceholder('Member name').waitFor({ timeout: 120000 });
      await page.getByPlaceholder('Member name').fill(name);
      await page.getByPlaceholder('Member name').press('Enter');
      await page.waitForTimeout(1500);
    }
  }
  if (upTo >= STAGES.indexOf('spent')) {
    await page.getByRole('button', { name: 'Add expense' }).click();
    await page.waitForTimeout(1200);
    await page.getByTestId('expense-amount').fill('10.00');
    await page.getByPlaceholder('What for').fill('Taxi');
    await page.getByText('Add expense', { exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2500);
  }

  const storageState = await context.storageState();
  await context.close();
  return { storageState, hubUrl };
}

// ── Record ─────────────────────────────────────────────────────────────────
async function record(browser, flow, storageState, hubUrl) {
  const dir = join(FLOW_SHOTS, `.tmp-${flow.id}`);
  if (!ASSERT_ONLY) {
    await rm(dir, { recursive: true, force: true });
  }

  // Recording begins with the context, so this is frame zero of the clip.
  const startedAt = Date.now();
  const context = await browser.newContext(
    contextOptions({
      assertOnly: ASSERT_ONLY,
      viewport: VIEWPORT,
      videoDir: dir,
      storageState,
    }),
  );
  await context.addInitScript(installPointerOverlay);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${flow.id}] ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${flow.id}] ${e.message}`));
  if (ASSERT_ONLY) {
    page.on('request', (req) => {
      if (isDeployedWorkerUrl(req.url())) {
        problems.push(`[${flow.id}] request to deployed Worker: ${req.url()}`);
      }
    });
  }

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
  if (ASSERT_ONLY) {
    console.log('assert', flow.id);
    return;
  }
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
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, `${number}-hub.png`) });
  console.log('still', `${number}-hub.png`);
  if (number === '0030') {
    await page.getByRole('button', { name: 'Add expense' }).click();
    await page.waitForTimeout(1200);
    await page.getByTestId('expense-amount').fill('9.00');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `${number}-split.png`) });
    console.log('still', `${number}-split.png`);
    await context.close();
    return;
  }
  if (number === '0029') {
    await page.getByRole('button', { name: 'View all expenses' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `${number}-expenses.png`) });
    console.log('still', `${number}-expenses.png`);
    await page.getByTestId('expense-row').first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `${number}-edit.png`) });
    console.log('still', `${number}-edit.png`);
    await context.close();
    return;
  }
  if (number === '0028') {
    await page.getByText('You', { exact: true }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `${number}-member.png`) });
    console.log('still', `${number}-member.png`);
    await context.close();
    return;
  }
  if (number === '0027') {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `${number}-settings.png`) });
    console.log('still', `${number}-settings.png`);
    await context.close();
    return;
  }
  if (number === '0026') {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(SHOTS, `${number}-settings.png`) });
    console.log('still', `${number}-settings.png`);
    await context.close();
    return;
  }
  if (number === '0025') {
    await page.getByText('You', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(SHOTS, `${number}-you.png`) });
    console.log('still', `${number}-you.png`);
    await page.getByTestId('leave').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(SHOTS, `${number}-leave-confirm.png`) });
    console.log('still', `${number}-leave-confirm.png`);
    await context.close();
    return;
  }
  await balanceRowOf(page).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, `${number}-member.png`) });
  console.log('still', `${number}-member.png`);
  await settleRowOf(page).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, `${number}-settle-prefill.png`) });
  console.log('still', `${number}-settle-prefill.png`);
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

if (SLICE && !ASSERT_ONLY) {
  const stage = SLICE === '0028' || SLICE === '0027' ? 'group' : 'spent';
  const { storageState, hubUrl } = await seed(browser, stage);
  await stills(browser, storageState, hubUrl, SLICE);
}

await browser.close();

for (const [id, why] of Object.entries(UNRECORDED)) {
  console.log(`skipped ${id} — ${why}`);
}
console.log(problems.length ? problems.join('\n') : 'console clean');
process.exit(problems.length ? 1 : 0);
