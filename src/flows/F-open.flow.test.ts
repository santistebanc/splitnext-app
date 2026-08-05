import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-open — Open group.
 * Starts when: the person taps a group in the lobby, or the hub mounts.
 * Ends with: the screen shows the latest group and roster, anything pending has
 * been pushed, and live updates are running.
 */
describe('F-open — Open group', () => {
  let app: App;
  let groupId: string;

  beforeEach(async () => {
    app = await makeApp();
    groupId = await app.createGroup();
    app.server.calls.length = 0;
  });

  it('subscribes for wakes, then runs a full sync', async () => {
    await app.openGroup(groupId);

    expect(app.server.calls).toEqual(['fetch-entity', 'list-roster']);
  });

  it('catches the roster up on open', async () => {
    app.server.peerWrite(groupId, 'members', {
      id: 'm-remote',
      group_id: groupId,
      version: 1,
      display_name: 'Ana',
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });

    await app.openGroup(groupId);

    expect(Object.keys(app.state(groupId).members)).toEqual(['m-remote']);
  });

  it('opens for browsing even when Realtime refuses', async () => {
    const server = app.server;
    server.mintRealtimeAuth = (() => {
      throw new Error('rt_down');
    }) as typeof server.mintRealtimeAuth;

    await expect(app.openGroup(groupId)).resolves.toBeUndefined();
    expect(app.server.calls).toContain('list-roster');
  });
});
