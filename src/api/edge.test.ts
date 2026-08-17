import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'undici';
import { createTestHarness } from 'wrangler';

import {
  createGroupRemote,
  fetchEntity,
  joinGroupRemote,
  listRoster,
  mergeEntities,
  mintInviteRemote,
  leaveGroupRemote,
} from '@/src/api/edge';
import { wakeUrl } from '@/src/sync/wakeUrl';
import type { MemberEntity } from '@/src/types/group';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function functionsFromDeployList(): string[] {
  const src = readFileSync(join(ROOT, 'docs/scripts/verify_deploy.py'), 'utf8');
  const block = src.match(/FUNCTIONS\s*=\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error('FUNCTIONS list missing from verify_deploy.py');
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const ROUTES = functionsFromDeployList();

const server = createTestHarness({
  root: ROOT,
  workers: [{ configPath: 'workers/wrangler.jsonc' }],
});

let origin = '';

beforeAll(async () => {
  const { url } = await server.listen();
  if (url.hostname.endsWith('workers.dev')) {
    throw new Error('contract tests must not talk to the deployed Worker');
  }
  await server.getWorker().applyD1Migrations('INDEX');
  origin = url.origin;
  process.env.EXPO_PUBLIC_API_URL = origin;
}, 60_000);

afterAll(async () => {
  await server.close();
});

function nowIso(): string {
  return new Date().toISOString();
}

async function seededGroup(name = 'Trip') {
  const groupId = crypto.randomUUID();
  const deviceUserId = crypto.randomUUID();
  const created = await createGroupRemote({
    group_id: groupId,
    device_user_id: deviceUserId,
    name,
    currency_label: 'EUR',
    updated_at: nowIso(),
  });
  return { groupId, deviceUserId, created };
}

async function seededMember(
  group: Awaited<ReturnType<typeof seededGroup>>,
  displayName = 'Ada',
): Promise<MemberEntity> {
  const member: MemberEntity = {
    id: crypto.randomUUID(),
    group_id: group.groupId,
    display_name: displayName,
    version: 1,
    updated_at: nowIso(),
    deleted_at: null,
  };
  await mergeEntities({
    group_id: group.groupId,
    device_user_id: group.deviceUserId,
    access_token: group.created.access_token,
    items: [
      { entity_type: 'members', id: member.id, version: 1, payload: member },
    ],
  });
  return member;
}

describe('local Worker HTTP contract', () => {
  it('answers health on every FUNCTIONS route', async () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    for (const fn of ROUTES) {
      const res = await fetch(`${origin}/${fn}?health=1`);
      expect(res.status, fn).toBe(200);
      expect(await res.json()).toEqual({ ok: true, fn, revision: 'unknown' });
    }
  });

  it('create-group returns an access token and a v1 group', async () => {
    const { groupId, created } = await seededGroup('Contract');
    expect(created.access_token.length).toBeGreaterThan(0);
    expect(created.group).toMatchObject({
      id: groupId,
      version: 1,
      name: 'Contract',
      currency_label: 'EUR',
      is_closed: false,
      deleted_at: null,
    });
  });

  it('create-group throws when ids are missing', async () => {
    await expect(
      createGroupRemote({
        group_id: '',
        device_user_id: '',
        name: 'Nope',
        currency_label: 'EUR',
        updated_at: nowIso(),
      }),
    ).rejects.toThrow(/invalid_body/);
  });

  it('merges a member, fetches it back, and lists it on the roster', async () => {
    const group = await seededGroup();
    const member: MemberEntity = {
      id: crypto.randomUUID(),
      group_id: group.groupId,
      display_name: 'Ada',
      version: 1,
      updated_at: nowIso(),
      deleted_at: null,
    };
    const merged = await mergeEntities({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
      items: [
        {
          entity_type: 'members',
          id: member.id,
          version: 1,
          payload: member,
        },
      ],
    });
    expect(merged.results).toEqual([
      {
        id: member.id,
        entity_type: 'members',
        version: 1,
        status: 'accepted',
      },
    ]);

    const fetched = await fetchEntity({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
      entity_type: 'members',
      id: member.id,
    });
    expect(fetched.entity).toMatchObject({
      id: member.id,
      display_name: 'Ada',
      version: 1,
    });

    const roster = await listRoster({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
    });
    expect(roster.members.map((m) => m.id)).toContain(member.id);
    expect(Array.isArray(roster.expenses)).toBe(true);
  });

  it('rejects a stale member version', async () => {
    const group = await seededGroup();
    const member = await seededMember(group);
    const again = await mergeEntities({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
      items: [
        {
          entity_type: 'members',
          id: member.id,
          version: 1,
          payload: member,
        },
      ],
    });
    expect(again.results[0]?.status).not.toBe('accepted');
    expect(again.results[0]).toMatchObject({
      id: member.id,
      status: 'rejected',
      reason: 'version_not_greater',
    });
    const fetched = await fetchEntity({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
      entity_type: 'members',
      id: member.id,
    });
    expect(fetched.entity).toMatchObject({
      id: member.id,
      display_name: 'Ada',
      version: 1,
    });
    const roster = await listRoster({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
    });
    expect(roster.members.map((m) => m.id)).toContain(member.id);
  });

  it('mints an invite and joins as a second device', async () => {
    const group = await seededGroup();
    const member = await seededMember(group);
    const minted = await mintInviteRemote({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
      member_id: member.id,
    });
    expect(minted.token).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(minted.member_id).toBe(member.id);

    const joiner = crypto.randomUUID();
    const joined = await joinGroupRemote({
      token: minted.token,
      device_user_id: joiner,
    });
    expect(joined.access_token.length).toBeGreaterThan(0);
    expect(joined.access_token).not.toBe(group.created.access_token);
    expect(joined.group.id).toBe(group.groupId);
    expect(joined.bind).toMatchObject({
      group_id: group.groupId,
      device_user_id: joiner,
      member_id: member.id,
      version: 1,
      deleted_at: null,
    });
  });
});

describe('local Worker leave-group contract', () => {
  it('revokes the token so a later fetch is rejected', async () => {
    const group = await seededGroup();
    const left = await leaveGroupRemote({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
    });
    expect(left).toEqual({ ok: true });

    await expect(
      fetchEntity({
        group_id: group.groupId,
        device_user_id: group.deviceUserId,
        access_token: group.created.access_token,
        entity_type: 'groups',
        id: group.groupId,
      }),
    ).rejects.toThrow(/unauthorized/);
  });

  it('is idempotent: a second leave is still ok', async () => {
    const group = await seededGroup();
    await leaveGroupRemote({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
    });
    await expect(
      leaveGroupRemote({
        group_id: group.groupId,
        device_user_id: group.deviceUserId,
        access_token: group.created.access_token,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('rejects a missing token', async () => {
    const group = await seededGroup();
    await expect(
      leaveGroupRemote({
        group_id: group.groupId,
        device_user_id: group.deviceUserId,
        access_token: '',
      }),
    ).rejects.toThrow(/unauthorized/);
  });
});

function openWake(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener(
      'error',
      () => reject(new Error('wake socket failed to open')),
      { once: true },
    );
  });
}

function nextJson(socket: WebSocket, ms = 5_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no wake message')), ms);
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer);
        resolve(JSON.parse(String(event.data)));
      },
      { once: true },
    );
  });
}

describe('local Worker wake contract', () => {
  it('does not list /wake/ on FUNCTIONS', () => {
    expect(ROUTES).not.toContain('wake');
  });

  it('does not upgrade /wake/ without a token', async () => {
    const { groupId, deviceUserId } = await seededGroup();
    await expect(openWake(wakeUrl(groupId, '', deviceUserId))).rejects.toThrow(
      /wake socket failed/,
    );
  });

  it('does not upgrade /wake/ with a wrong token', async () => {
    const { groupId, deviceUserId } = await seededGroup();
    await expect(openWake(wakeUrl(groupId, 'nope', deviceUserId))).rejects.toThrow(
      /wake socket failed/,
    );
  });

  it('does not upgrade /wake/ without a device id', async () => {
    const { groupId, created } = await seededGroup();
    const url = new URL(wakeUrl(groupId, created.access_token, 'x'));
    url.searchParams.delete('device_user_id');
    await expect(openWake(url.toString())).rejects.toThrow(/wake socket failed/);
  });

  it('does not upgrade /wake/ with a wrong device id', async () => {
    const { groupId, created } = await seededGroup();
    await expect(
      openWake(wakeUrl(groupId, created.access_token, 'nope')),
    ).rejects.toThrow(/wake socket failed/);
  });

  it('sends a wake tip after an accepted merge, with no entity body', async () => {
    const group = await seededGroup();
    const socket = await openWake(
      wakeUrl(
        group.groupId,
        group.created.access_token,
        group.deviceUserId,
      ),
    );
    const incoming = nextJson(socket);
    const member: MemberEntity = {
      id: crypto.randomUUID(),
      group_id: group.groupId,
      display_name: 'Ada',
      version: 1,
      updated_at: nowIso(),
      deleted_at: null,
    };
    const merged = await mergeEntities({
      group_id: group.groupId,
      device_user_id: group.deviceUserId,
      access_token: group.created.access_token,
      items: [
        { entity_type: 'members', id: member.id, version: 1, payload: member },
      ],
    });
    expect(merged.results[0]?.status).toBe('accepted');
    expect(await incoming).toEqual({
      event: 'wake',
      payload: {
        group_id: group.groupId,
        entity_type: 'members',
        id: member.id,
        version: 1,
      },
    });
    socket.close();
  });
});
