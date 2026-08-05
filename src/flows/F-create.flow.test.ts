import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-create — Create group.
 * Starts when: on the lobby screen, the person taps Create group.
 * Ends with: the group exists on the server, this device holds its access
 * token, and the hub opens.
 */
describe('F-create — Create group', () => {
  let app: App;

  beforeEach(async () => {
    app = await makeApp();
  });

  it('leaves nothing half-registered when the server refuses', async () => {
    app.server.failNext = 'create_failed';

    await expect(app.createGroup()).rejects.toThrow();

    expect(app.server.groups.size).toBe(0);
    expect(await app.listLobbyGroupIds()).toEqual([]);
  });

  it('registers the group, stores its token, and lists it in the lobby', async () => {
    const groupId = await app.createGroup();

    expect(app.server.groups.get(groupId)).toBeTruthy();
    expect(await app.getAccessToken(groupId)).toBe(`tok_${groupId}`);
    expect(await app.listLobbyGroupIds()).toEqual([groupId]);
    expect(app.state(groupId).status).toBe('on_server');
  });

  it('subscribes for wakes as the last step', async () => {
    const groupId = await app.createGroup();

    expect(app.server.calls).toEqual(['create-group', 'rt-jwt']);
    expect(app.state(groupId).error).toBeNull();
  });

  it('still yields a usable group when Realtime is unavailable', async () => {
    let call = 0;
    const server = app.server;
    const realMint = server.mintRealtimeAuth.bind(server);
    server.mintRealtimeAuth = ((i: Parameters<typeof realMint>[0]) => {
      if (++call === 1) throw new Error('rt_down');
      return realMint(i);
    }) as typeof realMint;

    const groupId = await app.createGroup();

    expect(app.server.groups.get(groupId)).toBeTruthy();
    expect(app.state(groupId).error?.code).toBe('wake_failed');
  });
});
