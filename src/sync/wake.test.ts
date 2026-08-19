import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'undici';
import { createTestHarness } from 'wrangler';

import { mergeEntities } from '@/src/api/edge';
import type { MemberEntity } from '@/src/types/group';

const getAccessToken = vi.fn<(groupId: string) => Promise<string | null>>();
const getOrCreateDeviceUserId = vi.fn<() => Promise<string>>();

vi.mock('@/src/secrets/tokens', () => ({
  getAccessToken: (groupId: string) => getAccessToken(groupId),
}));

vi.mock('@/src/device/deviceUser', () => ({
  getOrCreateDeviceUserId: () => getOrCreateDeviceUserId(),
}));

import {
  getWakeSocketForTests,
  resetWakeStateForTests,
  startWakeSubscription,
  stopWakeSubscription,
} from '@/src/sync/wake';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const server = createTestHarness({
  root: ROOT,
  workers: [{ configPath: 'workers/wrangler.jsonc' }],
});

let origin = '';

beforeAll(async () => {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
  const { url } = await server.listen();
  if (url.hostname.endsWith('workers.dev')) {
    throw new Error('wake orchestrator tests must not talk to the deployed Worker');
  }
  await server.getWorker().applyD1Migrations('INDEX');
  origin = url.origin;
  process.env.EXPO_PUBLIC_API_URL = origin;
}, 60_000);

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  vi.useRealTimers();
  resetWakeStateForTests();
  getAccessToken.mockReset();
  getOrCreateDeviceUserId.mockReset();
});

afterEach(() => {
  resetWakeStateForTests();
  vi.useRealTimers();
});

function nowIso(): string {
  return new Date().toISOString();
}

async function seededGroup(name = 'Trip') {
  const groupId = crypto.randomUUID();
  const deviceUserId = crypto.randomUUID();
  const { createGroupRemote } = await import('@/src/api/edge');
  const created = await createGroupRemote({
    group_id: groupId,
    device_user_id: deviceUserId,
    name,
    currency_label: 'EUR',
    updated_at: nowIso(),
  });
  return { groupId, deviceUserId, created };
}

async function waitForOpen(groupId: string, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const socket = getWakeSocketForTests(groupId);
    if (socket && socket.readyState === 1) return socket;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('wake socket never opened');
}

describe('startWakeSubscription orchestrator', () => {
  it('does not open a socket without an access token', async () => {
    const { groupId } = await seededGroup();
    getAccessToken.mockResolvedValue(null);
    getOrCreateDeviceUserId.mockResolvedValue(crypto.randomUUID());

    const catchUp = vi.fn(async () => {});
    await startWakeSubscription(groupId, catchUp);

    expect(getWakeSocketForTests(groupId)).toBeUndefined();
    expect(catchUp).not.toHaveBeenCalled();
  });

  it('opens a wake socket on the local Worker', async () => {
    const { groupId, deviceUserId, created } = await seededGroup();
    getAccessToken.mockResolvedValue(created.access_token);
    getOrCreateDeviceUserId.mockResolvedValue(deviceUserId);

    await startWakeSubscription(groupId, async () => {});
    const socket = await waitForOpen(groupId);
    expect(socket.url).toContain(`/wake/${groupId}`);
    expect(socket.url).toContain('access_token=');
  });

  it('runs catchUp when a wake tip arrives', async () => {
    const group = await seededGroup();
    getAccessToken.mockResolvedValue(group.created.access_token);
    getOrCreateDeviceUserId.mockResolvedValue(group.deviceUserId);

    const catchUp = vi.fn(async () => {});
    await startWakeSubscription(group.groupId, catchUp);
    await waitForOpen(group.groupId);

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

    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && catchUp.mock.calls.length === 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(catchUp).toHaveBeenCalledTimes(1);
  });

  it('runs catchUp again after a drop and reconnect', async () => {
    const group = await seededGroup();
    getAccessToken.mockResolvedValue(group.created.access_token);
    getOrCreateDeviceUserId.mockResolvedValue(group.deviceUserId);

    const catchUp = vi.fn(async () => {});
    await startWakeSubscription(group.groupId, catchUp);
    const first = await waitForOpen(group.groupId);
    expect(catchUp).not.toHaveBeenCalled();

    (first as unknown as { onerror: ((event: Event) => void) | null }).onerror?.(
      new Event('error'),
    );
    await new Promise((r) => setTimeout(r, 1_200));
    await waitForOpen(group.groupId, 8_000);

    expect(catchUp).toHaveBeenCalledTimes(1);
  }, 15_000);

  it('stopWakeSubscription closes the socket and skips retry catch-up', async () => {
    vi.useFakeTimers();
    const group = await seededGroup();
    getAccessToken.mockResolvedValue(group.created.access_token);
    getOrCreateDeviceUserId.mockResolvedValue(group.deviceUserId);

    const catchUp = vi.fn(async () => {});
    await startWakeSubscription(group.groupId, catchUp);
    await vi.runOnlyPendingTimersAsync();
    const socket = await waitForOpen(group.groupId);

    stopWakeSubscription(group.groupId);
    expect(getWakeSocketForTests(group.groupId)).toBeUndefined();

    socket.close();
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.runOnlyPendingTimersAsync();
    expect(catchUp).not.toHaveBeenCalled();
  });
});
