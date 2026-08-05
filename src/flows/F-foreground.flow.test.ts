import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-foreground — App foreground.
 * Starts when: the app launches, or the person switches back to it.
 * Ends with: every group this device knows has caught up.
 *
 * Step 1 is the AppState listener inside `useLobbyForegroundSync`; mounting it
 * needs a renderer, so the demo gate covers that wiring. What is testable — and
 * what actually breaks — is step 2: every known group syncs, and one bad group
 * cannot take the others down.
 */
describe('F-foreground — App foreground', () => {
  let app: App;
  let a: string;
  let b: string;

  beforeEach(async () => {
    app = await makeApp();
    a = await app.createGroup();
    b = await app.createGroup();
    app.server.calls.length = 0;
  });

  it('syncs every group in the lobby', async () => {
    expect(await app.listLobbyGroupIds()).toHaveLength(2);

    await app.syncAllLobbyGroups();

    expect(app.server.calls.filter((c) => c === 'list-roster')).toHaveLength(2);
  });

  it('isolates a failing group so the others still catch up', async () => {
    app.server.peerWrite(a, 'members', {
      id: 'm-a',
      group_id: a,
      version: 1,
      display_name: 'Ana',
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    // b's token goes missing: its sync will fail, a's must not
    const brokenToken = `tok_${b}`;
    app.server.tokens.delete(brokenToken);
    app.server.calls.length = 0;

    await app.syncAllLobbyGroups();

    expect(app.state(a).members['m-a']?.display_name).toBe('Ana');
    // the group fetch fails first, then the roster — the last failure is what sticks
    expect(app.state(b).error?.code).toBe('roster_failed');
  });
});
