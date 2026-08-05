import { beforeEach, describe, expect, it } from 'vitest';
import { type App, makeApp } from './harness/app';

/**
 * F-add-member — Add member.
 * Starts when: on the hub, the person types a name and taps Add member.
 * Ends with: the person appears in the list immediately and reaches the server
 * on the next push.
 */
describe('F-add-member — Add member', () => {
  let app: App;
  let groupId: string;

  beforeEach(async () => {
    app = await makeApp();
    groupId = await app.createGroup();
    app.server.calls.length = 0;
  });

  it('shows the member before any network call', async () => {
    app.server.failNext = 'merge_failed';

    const memberId = await app.addMember(groupId, 'Ana');

    expect(app.state(groupId).members[memberId]?.display_name).toBe('Ana');
    expect(app.server.members.size).toBe(0);
  });

  it('pushes the member at version 1', async () => {
    const memberId = await app.addMember(groupId, 'Ana');

    expect(app.server.members.get(memberId)).toMatchObject({
      display_name: 'Ana',
      version: 1,
      group_id: groupId,
    });
    expect(app.state(groupId).queue).toEqual([]);
  });

  it('trims the typed name', async () => {
    const memberId = await app.addMember(groupId, '  Ana  ');

    expect(app.state(groupId).members[memberId]?.display_name).toBe('Ana');
  });
});
