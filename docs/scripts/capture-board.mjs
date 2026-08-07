/**
 * Still-shoot the board itself.
 *
 * `capture-flows.mjs` records the app; this records the page that describes
 * it. A slice that changes the board changes a surface, and the board is all
 * prose otherwise — a table has never caught a layout that broke.
 *
 * Usage:
 *   node docs/scripts/capture-board.mjs --slice 0009
 *   node docs/scripts/capture-board.mjs --slice 0009 --url http://127.0.0.1:8777
 *
 * Needs the board already serving:
 *   python3 docs/scripts/serve-slicer-board.py
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'state', 'shots');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const slice = flag('slice', '');
const base = flag('url', 'http://127.0.0.1:8777');
if (!slice) {
  console.error('need --slice NNNN — the stills are named for it');
  process.exit(1);
}

// Wider than the ~900px an app still uses: the board is a desktop document
// with a fixed rail, and a tree row carries a fold, a name, a path, an area
// and two counts. Below 1200 those wrap — correct behaviour, but a still that
// freezes it mid-wrap documents the narrow case as if it were the layout.
const VIEWPORT = { width: 1200, height: 1000, deviceScaleFactor: 2 };

// The environment's Chromium may be a different build than the pinned
// @playwright/test, so prefer the one that is actually installed.
const executablePath = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const errors = [];

/**
 * One still, in its own context.
 *
 * The board remembers the view you left it in, so re-using a page would make
 * each still depend on the one shot before it — and a capture whose result
 * changes with the order it ran in is not evidence.
 */
async function shoot(name, prepare) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.on('console', (m) => {
    // The dev server serves the board and nothing else, so the browser's own
    // favicon probe 404s on every load. It is not the page's error.
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) {
      errors.push(m.text());
    }
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${base}/slicer.html#symbols`);
  await page.waitForSelector('.view-btn');
  await prepare(page);
  // `:visible`, not a bare selector: the view that is switched off is still in
  // the DOM, and its first row is what a plain match would settle on.
  await page.locator('#symbols .row:visible').first().waitFor();
  await page.waitForTimeout(200);
  const file = join(SHOTS, `${slice}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  ${file}`);
  await context.close();
}

await mkdir(SHOTS, { recursive: true });

await shoot('symbols-tree', async (page) => {
  await page.click('.view-btn[data-view="tree"]');
});

// Opened one level, because a still of the resting state is ten rows and says
// nothing about what is behind them.
await shoot('symbols-tree-open', async (page) => {
  await page.click('.view-btn[data-view="tree"]');
  await page.click('#tree-L-hub .fold');
});

await shoot('symbols-tree-search', async (page) => {
  await page.click('.view-btn[data-view="tree"]');
  await page.fill('#q', 'roster');
});

await shoot('symbols-flat', async (page) => {
  await page.click('.view-btn[data-view="flat"]');
});

await browser.close();

if (errors.length) {
  // A capture that records a broken page without saying so is worse than no
  // capture: it looks like evidence.
  console.error('console was not clean:');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('console clean');
