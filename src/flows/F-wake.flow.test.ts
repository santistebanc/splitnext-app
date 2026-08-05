import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-wake — Peer change arrives live.
 * Starts when: another device changed something while this one was subscribed.
 * Ends with: that one entity is refetched and applied, if it is newer.
 */
describe('F-wake — Peer change arrives live', () => {
  let app: App;
  let groupId: string;

  beforeEach(async () => {
    app = await makeApp();
    groupId = await app.createGroup();
    await app.startWakeSubscription(groupId);
    app.server.calls.length = 0;
  });

  it('fetches only the entity the wake names', async () => {
    app.server.peerWrite(groupId, 'members', {
      id: 'm-peer',
      group_id: groupId,
      version: 1,
      display_name: 'Bo',
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(app.server.calls).toEqual(['fetch-entity']);
    expect(app.state(groupId).members['m-peer']?.display_name).toBe('Bo');
  });

  it('carries no data in the wake itself — the fetch is what applies it', async () => {
    app.server.publishWake({
      group_id: groupId,
      entity_type: 'members',
      id: 'm-ghost',
      version: 9,
    });
    await new Promise((r) => setTimeout(r, 0));

    // the server has no such row, so nothing lands and the error is typed
    expect(app.state(groupId).members['m-ghost']).toBeUndefined();
    expect(app.state(groupId).error?.code).toBe('fetch_failed');
  });

  it('keeps the local copy when the wake is older', async () => {
    await app.bumpGroupName(groupId, 'Local');
    const stale = { ...app.server.groups.get(groupId)!, name: 'Stale', version: 1 };
    app.server.groups.set(groupId, stale);
    app.server.publishWake({
      group_id: groupId,
      entity_type: 'groups',
      id: groupId,
      version: 1,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(app.state(groupId).group.name).toBe('Local');
  });
});
