import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { getAccessToken } from '@/src/secrets/tokens';
import {
  nextReconnectDelayMs,
  shouldCatchUpOnStatus,
  shouldReplaceSubscription,
} from '@/src/sync/wakePolicy';
import { wakeUrl } from '@/src/sync/wakeUrl';

export { wakeUrl };

const SUBSCRIBE_WAIT_MS = 8000;

const OPEN_STATE = 1;

const sockets = new Map<string, WebSocket>();
const reconnectByGroup = new Map<string, () => Promise<void>>();
const lastStatusByGroup = new Map<string, string>();
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const failedAttemptsByGroup = new Map<string, number>();

function hasLiveWakeSocket(groupId: string): boolean {
  const socket = sockets.get(groupId);
  return socket != null && socket.readyState === OPEN_STATE;
}

function clearReconnectTimer(groupId: string): void {
  const timer = reconnectTimers.get(groupId);
  if (timer != null) clearTimeout(timer);
  reconnectTimers.delete(groupId);
}

function scheduleReconnect(groupId: string): void {
  clearReconnectTimer(groupId);
  const attempts = failedAttemptsByGroup.get(groupId) ?? 0;
  failedAttemptsByGroup.set(groupId, attempts + 1);
  const timer = setTimeout(() => {
    reconnectTimers.delete(groupId);
    const catchUp = reconnectByGroup.get(groupId);
    if (!catchUp) return;
    void startWakeSubscription(groupId, catchUp).catch(() => {
      scheduleReconnect(groupId);
    });
  }, nextReconnectDelayMs(attempts));
  reconnectTimers.set(groupId, timer);
}

/** Drop only the socket that is still current — a replaced one's close is ignored. */
function dropCurrent(
  groupId: string,
  socket: WebSocket,
  status: 'ERROR' | 'CLOSED',
): void {
  if (sockets.get(groupId) !== socket) return;
  lastStatusByGroup.set(groupId, status);
  sockets.delete(groupId);
  scheduleReconnect(groupId);
}

export async function startWakeSubscription(
  groupId: string,
  onReconnect: () => Promise<void>,
): Promise<void> {
  reconnectByGroup.set(groupId, onReconnect);
  clearReconnectTimer(groupId);
  if (
    !shouldReplaceSubscription(
      hasLiveWakeSocket(groupId),
      lastStatusByGroup.get(groupId),
    )
  ) {
    return;
  }

  const stale = sockets.get(groupId);
  if (stale) {
    sockets.delete(groupId);
    stale.close();
  }

  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  await new Promise<void>((resolve) => {
    const socket = new WebSocket(wakeUrl(groupId, accessToken, deviceUserId));
    sockets.set(groupId, socket);
    const timer = setTimeout(() => {
      resolve();
      if (
        sockets.get(groupId) === socket &&
        lastStatusByGroup.get(groupId) !== 'OPEN'
      ) {
        dropCurrent(groupId, socket, 'ERROR');
        socket.close();
      }
    }, SUBSCRIBE_WAIT_MS);

    socket.onopen = () => {
      const prev = lastStatusByGroup.get(groupId) ?? null;
      lastStatusByGroup.set(groupId, 'OPEN');
      failedAttemptsByGroup.set(groupId, 0);
      clearTimeout(timer);
      resolve();
      if (!shouldCatchUpOnStatus(prev, 'OPEN')) return;
      const catchUp = reconnectByGroup.get(groupId);
      if (!catchUp) return;
      void Promise.resolve(catchUp()).catch(() => {
        // syncGroup records lastError; never let it kill the socket callback.
      });
    };

    socket.onmessage = (event) => {
      let parsed: {
        event?: string;
        payload?: {
          group_id?: string;
          entity_type?: string;
          id?: string;
          version?: number;
        };
      };
      try {
        parsed = JSON.parse(String(event.data)) as typeof parsed;
      } catch {
        return;
      }
      const payload = parsed.payload;
      if (parsed.event === 'wake' && payload?.group_id === groupId) {
        const catchUp = reconnectByGroup.get(groupId);
        if (!catchUp) return;
        void getAccessToken(groupId).then((token) => {
          if (!token) return;
          void Promise.resolve(catchUp()).catch(() => {
            // syncGroup records lastError; never let it kill the socket callback.
          });
        });
      }
    };

    socket.onerror = () => {
      dropCurrent(groupId, socket, 'ERROR');
    };

    socket.onclose = () => {
      dropCurrent(groupId, socket, 'CLOSED');
    };
  });
}

/** Clear module state between vitest cases. */
export function resetWakeStateForTests(): void {
  for (const timer of reconnectTimers.values()) clearTimeout(timer);
  reconnectTimers.clear();
  for (const socket of sockets.values()) {
    socket.onerror = null;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onopen = null;
    try {
      socket.close();
    } catch {
      // already closed
    }
  }
  sockets.clear();
  reconnectByGroup.clear();
  lastStatusByGroup.clear();
  failedAttemptsByGroup.clear();
}

/** Test seam: the live socket for a group, if any. */
export function getWakeSocketForTests(groupId: string): WebSocket | undefined {
  return sockets.get(groupId);
}

/** Stop listening and do not retry — used when this device leaves the group. */
export function stopWakeSubscription(groupId: string): void {
  clearReconnectTimer(groupId);
  reconnectByGroup.delete(groupId);
  failedAttemptsByGroup.delete(groupId);
  lastStatusByGroup.delete(groupId);
  const socket = sockets.get(groupId);
  sockets.delete(groupId);
  socket?.close();
}
