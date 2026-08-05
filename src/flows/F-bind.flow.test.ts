import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-bind — This is me.
 * Starts when: on the hub, the person taps This is me on a member row.
 * Ends with: that member is this device's own person; the hub shows You (Name)
 * and the button disappears.
 */
describe('F-bind — This is me', () => {
  let app: App;
  let groupId: string;
  let memberId: string;

  beforeEach(async () => {
    app = await makeApp();
    groupId = await app.createGroup();
    memberId = await app.addMember(groupId, 'Ana');
    app.server.calls.length = 0;
  });

  it('binds this device to the member and pushes the bind', async () => {
    await app.bindMe(groupId, memberId);

    const deviceUserId = await app.getOrCreateDeviceUserId();
    expect(
      app.assumedMemberIdFromBinds(app.state(groupId).binds, deviceUserId),
    ).toBe(memberId);
    expect(app.server.binds.size).toBe(1);
  });

  it('hides the button once this device has a bind', async () => {
    const deviceUserId = await app.getOrCreateDeviceUserId();
    expect(app.deviceHasActiveBind(app.state(groupId).binds, deviceUserId)).toBe(
      false,
    );

    await app.bindMe(groupId, memberId);

    expect(app.deviceHasActiveBind(app.state(groupId).binds, deviceUserId)).toBe(
      true,
    );
  });

  it('refuses a second bind on the same device', async () => {
    await app.bindMe(groupId, memberId);
    const other = await app.addMember(groupId, 'Bo');
    app.server.calls.length = 0;

    await app.bindMe(groupId, other);

    expect(app.state(groupId).error?.code).toBe('already_bound');
    expect(app.server.binds.size).toBe(1);
  });

  it('refuses to bind a member that is not there', async () => {
    await app.bindMe(groupId, 'nobody');

    expect(app.state(groupId).error?.code).toBe('member_missing');
    expect(app.server.binds.size).toBe(0);
  });
});
