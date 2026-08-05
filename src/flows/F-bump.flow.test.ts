import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp, makePeer } from './harness/app';

/**
 * F-bump — Bump group name.
 * Starts when: on the hub, the person renames the group.
 * Ends with: the new name shows at once here and reaches the other devices
 * without them asking.
 */
describe('F-bump — Bump group name', () => {
  let app: App;
  let groupId: string;

  beforeEach(async () => {
    app = await makeApp();
    groupId = await app.createGroup();
    app.server.calls.length = 0;
  });

  it('shows the new name before the network answers', async () => {
    app.server.failNext = 'merge_failed';

    await app.bumpGroupName(groupId, 'Trip');

    expect(app.state(groupId).group.name).toBe('Trip');
    expect(app.server.groups.get(groupId)?.name).toBe('');
  });

  it('sends it as the next version', async () => {
    await app.bumpGroupName(groupId, 'Trip');

    expect(app.server.groups.get(groupId)).toMatchObject({
      name: 'Trip',
      version: 2,
    });
  });

  it('reaches a subscribed peer without the peer asking', async () => {
    const peer = await makePeer(app.server);
    // the peer holds the same capability token and is listening
    await peer.saveAccessToken(groupId, `tok_${groupId}`);
    await peer.startWakeSubscription(groupId);
    app.server.calls.length = 0;

    await app.bumpGroupName(groupId, 'Trip');
    await new Promise((r) => setTimeout(r, 0));

    expect(peer.state(groupId).group.name).toBe('Trip');
  });
});
