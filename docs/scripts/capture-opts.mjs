/**
 * Capture CLI: which flows, which origin, and whether this run writes clips.
 *
 * `--assert-only` is the CI path — drive every recorded flow, keep the
 * existing asserts, skip Playwright's video. A human `npm run capture` still
 * records.
 */
export function parseCaptureArgv(argv) {
  const flagValue = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  return {
    base: flagValue('--url') ?? 'http://127.0.0.1:8081',
    slice: flagValue('--slice'),
    only: argv.filter((a) => a.startsWith('F-')),
    assertOnly: argv.includes('--assert-only'),
  };
}

export function contextOptions({ assertOnly, viewport, videoDir, storageState }) {
  const opts = {
    viewport,
    deviceScaleFactor: 2,
    storageState,
  };
  if (!assertOnly) {
    opts.recordVideo = { dir: videoDir, size: viewport };
  }
  return opts;
}
