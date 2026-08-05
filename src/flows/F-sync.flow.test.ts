import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-sync — Sync one group.
 * Starts when: any full refresh of one group.
 * Ends with: everything pending is on the server, and the group plus its roster
 * match the server.
 */
describe('F-sync — Sync one group', () => {
  let app: App;
  let groupId: string;

  beforeEach(async () => {
    app = await makeApp();
    groupId = await app.createGroup();
    app.server.calls.length = 0;
  });

  it('pushes everything pending, then pulls the group and its roster back', async () => {
    await app.bumpGroupName(groupId, 'Trip');
    app.server.calls.length = 0;

    await app.syncGroup(groupId);

    // step 2 flush, step 3 group fetch, step 4 roster — in that order
    expect(app.server.calls).toEqual(['fetch-entity', 'list-roster']);
    expect(app.state(groupId).queue).toEqual([]);
    expect(app.server.groups.get(groupId)?.name).toBe('Trip');
  });

  it('sends nothing when the queue is empty', async () => {
    await app.syncGroup(groupId);

    expect(app.server.calls).not.toContain('merge');
  });

  it('keeps the item pending and records a typed failure when the push fails', async () => {
    // every mutation flushes as it happens, so the failure lands there
    app.server.failNext = 'merge_failed';
    await app.addMember(groupId, 'Ana');

    expect(app.state(groupId).queue).toHaveLength(1);
    expect(app.state(groupId).error?.code).toBe('merge_failed');
  });

  it('clears that error and drains the queue on the next successful sync', async () => {
    app.server.failNext = 'merge_failed';
    await app.addMember(groupId, 'Ana');
    expect(app.state(groupId).error).not.toBeNull();

    await app.syncGroup(groupId);

    expect(app.state(groupId).error).toBeNull();
    expect(app.state(groupId).queue).toEqual([]);
    expect(app.server.members.size).toBe(1);
  });

  it('ignores a remote copy that is not newer than the local one', async () => {
    await app.bumpGroupName(groupId, 'Local wins');
    await app.syncGroup(groupId);
    // the server's row goes stale behind the device's next edit
    await app.bumpGroupName(groupId, 'Newer still');

    await app.syncGroup(groupId);

    expect(app.state(groupId).group.name).toBe('Newer still');
  });
});
