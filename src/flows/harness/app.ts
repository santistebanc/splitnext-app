import { vi } from 'vitest';
import type { SyncError } from '@/src/types/syncError';
import { setServer } from './current';
import { FakeServer } from './server';

export type App = Awaited<ReturnType<typeof makeApp>>;

/**
 * One device, wired to one fake server. Modules are reset per app so the store
 * cache and the wake-subscription map start empty — two apps means two devices.
 */
export async function makeApp(server = new FakeServer()) {
  setServer(server);
  vi.resetModules();

  const groupSync = await import('@/src/sync/groupSync');
  const inbound = await import('@/src/sync/inbound');
  const outbound = await import('@/src/sync/outbound');
  const store = await import('@/src/store/groupStore');
  const tokens = await import('@/src/secrets/tokens');
  const assumed = await import('@/src/domain/assumedMember');
  const device = await import('@/src/device/deviceUser');

  return {
    server,
    ...groupSync,
    ...inbound,
    ...outbound,
    getGroupStore: store.getGroupStore,
    ...tokens,
    ...assumed,
    getOrCreateDeviceUserId: device.getOrCreateDeviceUserId,
    /** Read the group's state the way the hub screen would. */
    state(groupId: string) {
      const s = store.getGroupStore(groupId);
      return {
        group: s.group.get(),
        members: s.members.get() ?? {},
        binds: s.binds.get() ?? {},
        queue: s.queue.get() ?? [],
        status: s.syncStatus.get(),
        // Legend widens the persisted union; the app only ever stores SyncError
        error: s.lastError.get() as SyncError | null,
      };
    },
  };
}

/** A second device against the same server — the peer in wake flows. */
export async function makePeer(server: FakeServer) {
  return makeApp(server);
}
