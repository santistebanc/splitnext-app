import * as Crypto from 'expo-crypto';
import {
  createGroupRemote,
  createInviteRemote,
  redeemInviteRemote,
} from '@/src/api/edge';
import { bindingIsOpen } from '@/src/domain/assumedMember';
import { normalizeInviteCode } from '@/src/domain/inviteCode';
import { splitEqually } from '@/src/domain/split';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  addLobbyGroupId,
  getAccessToken,
  listLobbyGroupIds,
  saveAccessToken,
} from '@/src/secrets/tokens';
import { getGroupStore, initLocalGroup } from '@/src/store/groupStore';
import { runExclusive } from '@/src/sync/exclusive';
import {
  applyRemoteFetch,
  pullRoster,
} from '@/src/sync/inbound';
import { flushQueue, flushQueueInner } from '@/src/sync/outbound';
import { syncError } from '@/src/sync/syncErrors';
import { startWakeSubscription } from '@/src/sync/wake';
import type {
  BindEntity,
  ExpenseEntity,
  GroupEntity,
  MemberEntity,
} from '@/src/types/group';

export { flushQueue } from '@/src/sync/outbound';
export { applyRemoteFetch } from '@/src/sync/inbound';
export { startWakeSubscription } from '@/src/sync/wake';

export async function createGroup(): Promise<string> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const groupId = Crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const local: GroupEntity = {
    id: groupId,
    version: 1,
    updated_at: updatedAt,
    deleted_at: null,
    name: '',
    currency_label: 'EUR',
    is_closed: false,
  };

  const store$ = getGroupStore(groupId);
  initLocalGroup(store$, local);
  store$.syncStatus.set('creating');

  try {
    const { access_token, group } = await createGroupRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      name: local.name,
      currency_label: local.currency_label,
      updated_at: local.updated_at,
    });
    await saveAccessToken(groupId, access_token);
    await addLobbyGroupId(groupId);
    store$.group.set(group);
    store$.syncStatus.set('on_server');
    store$.lastError.set(null);
    try {
      await startWakeSubscription(groupId);
    } catch (wakeErr) {
      store$.lastError.set(
        syncError(
          'wake_failed',
          wakeErr instanceof Error ? wakeErr.message : 'wake_failed',
        ),
      );
    }
    return groupId;
  } catch (err) {
    store$.syncStatus.set('error');
    store$.lastError.set(
      syncError(
        'create_failed',
        err instanceof Error ? err.message : 'create_failed',
      ),
    );
    throw err;
  }
}

export async function bumpGroupName(
  groupId: string,
  name: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const current = store$.group.get();
  const next: GroupEntity = {
    ...current,
    name,
    version: current.version + 1,
    updated_at: new Date().toISOString(),
  };
  store$.group.set(next);
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'groups',
      id: groupId,
      version: next.version,
      payload: next,
    },
  ]);
  await flushQueue(groupId);
}

export async function addMember(
  groupId: string,
  displayName: string,
): Promise<string> {
  const memberId = Crypto.randomUUID();
  const member: MemberEntity = {
    id: memberId,
    group_id: groupId,
    display_name: displayName.trim(),
    version: 1,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  const store$ = getGroupStore(groupId);
  store$.members.set({ ...(store$.members.get() ?? {}), [memberId]: member });
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'members',
      id: memberId,
      version: member.version,
      payload: member,
    },
  ]);
  await flushQueue(groupId);
  return memberId;
}

/** What the hub knows when someone records a cost. */
export type NewExpense = {
  payerMemberId: string;
  /** Integer cents. Rejected outright if it is not — money never rounds here. */
  amountCents: number;
  description: string;
};

export async function addExpense(
  groupId: string,
  { payerMemberId, amountCents, description }: NewExpense,
): Promise<string> {
  if (!Number.isInteger(amountCents)) {
    throw new Error('amount must be integer cents');
  }
  if (amountCents <= 0) {
    throw new Error('amount must be greater than zero');
  }

  const store$ = getGroupStore(groupId);
  const members = store$.members.get() ?? {};
  const payer = members[payerMemberId];
  if (!payer || payer.deleted_at != null) {
    store$.lastError.set(syncError('member_missing'));
    return '';
  }

  // Split across whoever is in the group right now, and freeze it into the
  // expense. A member added later joins the next expense, not this one.
  const participants = Object.values(members)
    .filter((m) => m.deleted_at == null)
    .map((m) => m.id);
  const allocations = splitEqually(amountCents, participants);

  const expense: ExpenseEntity = {
    id: Crypto.randomUUID(),
    group_id: groupId,
    payer_member_id: payerMemberId,
    amount_cents: amountCents,
    description: description.trim(),
    allocations,
    version: 1,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  store$.expenses.set({ ...(store$.expenses.get() ?? {}), [expense.id]: expense });
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'expenses',
      id: expense.id,
      version: expense.version,
      payload: expense,
    },
  ]);
  await flushQueue(groupId);
  return expense.id;
}

export async function bindMe(
  groupId: string,
  memberId: string,
): Promise<void> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const store$ = getGroupStore(groupId);
  const binds = store$.binds.get() ?? {};
  if (!bindingIsOpen(store$.expenses.get() ?? {})) {
    store$.lastError.set(syncError('binding_closed'));
    return;
  }

  const member = (store$.members.get() ?? {})[memberId];
  if (!member || member.deleted_at != null) {
    store$.lastError.set(syncError('member_missing'));
    return;
  }

  // One bind per device per group: changing your mind moves the existing bind
  // to the new member rather than leaving a second live one behind, which
  // would make "which member am I?" depend on iteration order.
  const existing = Object.values(binds).find(
    (b) => b.device_user_id === deviceUserId && b.deleted_at == null,
  );
  if (existing?.member_id === memberId) return;

  const bind: BindEntity = {
    id: existing?.id ?? Crypto.randomUUID(),
    group_id: groupId,
    device_user_id: deviceUserId,
    member_id: memberId,
    version: existing ? existing.version + 1 : 1,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  store$.binds.set({ ...binds, [bind.id]: bind });
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'binds',
      id: bind.id,
      version: bind.version,
      payload: bind,
    },
  ]);
  await flushQueue(groupId);
}

/** What the hub shows after minting an invite. */
export type Invite = {
  /** Plaintext, and only ever in memory — the server keeps a hash. */
  code: string;
  expiresAt: string;
};

/**
 * Mint a one-time code that binds whoever redeems it to this member.
 *
 * Nothing is written locally: an invite is not an entity of this group, it is
 * a capability the server issues. That is why it does not go through the queue
 * and why it needs the network — there is no offline version of "grant
 * somebody else access".
 */
export async function createInvite(
  groupId: string,
  memberId: string,
): Promise<Invite | null> {
  const store$ = getGroupStore(groupId);
  const accessToken = await getAccessToken(groupId);
  if (!accessToken) {
    store$.lastError.set(syncError('missing_token'));
    return null;
  }
  const deviceUserId = await getOrCreateDeviceUserId();

  try {
    const { code, expires_at } = await createInviteRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
      member_id: memberId,
    });
    store$.lastError.set(null);
    return { code, expiresAt: expires_at };
  } catch (err) {
    store$.lastError.set(
      syncError(
        'invite_failed',
        err instanceof Error ? err.message : 'invite_failed',
      ),
    );
    return null;
  }
}

/**
 * Join a group this device has never seen, using a code someone read to us.
 *
 * The mirror of `createGroup`: both start from a device holding nothing and
 * end with a token in the keychain, the group in the lobby and a live wake
 * subscription. The difference is that the bind already exists — the server
 * wrote it, because the code named the member — so this device arrives already
 * being someone, with no This-is-me to tap.
 *
 * Throws rather than recording a sync error: there is no group store to record
 * it in until this succeeds, so the caller (the lobby) owns the message.
 */
export async function redeemInvite(
  rawCode: string,
): Promise<{ groupId: string; memberId: string }> {
  const code = normalizeInviteCode(rawCode);
  const deviceUserId = await getOrCreateDeviceUserId();

  const { access_token, group, member_id } = await redeemInviteRemote({
    device_user_id: deviceUserId,
    code,
  });

  // Token before lobby: a group listed on a device that cannot authenticate
  // for it is a hub that opens and then fails every sync.
  await saveAccessToken(group.id, access_token);
  await addLobbyGroupId(group.id);

  const store$ = getGroupStore(group.id);
  store$.group.set(group);
  store$.syncStatus.set('on_server');
  store$.lastError.set(null);

  try {
    await startWakeSubscription(group.id);
  } catch {
    // Same as opening any group: live updates are a bonus, not a gate.
  }

  // Pull the roster now so the hub opens with members, expenses and the bind
  // the server just wrote, rather than empty for a beat.
  try {
    await syncGroup(group.id);
  } catch {
    // Already recorded on the store by the sync path; joining still worked.
  }

  return { groupId: group.id, memberId: member_id };
}

/** Flush outbound queue then pull remote group + roster. Serialized per group. */
export async function syncGroup(groupId: string): Promise<void> {
  return runExclusive(groupId, async () => {
    getGroupStore(groupId);
    await flushQueueInner(groupId);
    await applyRemoteFetch(groupId, 'groups', groupId);
    await pullRoster(groupId);
  });
}

/** Foreground / lobby-wide catch-up for every group this device knows. */
export async function syncAllLobbyGroups(): Promise<void> {
  const ids = await listLobbyGroupIds();
  await Promise.all(
    ids.map(async (id) => {
      try {
        await syncGroup(id);
      } catch {
        // Isolate failures so one group cannot block the others.
      }
    }),
  );
}

export async function openGroup(groupId: string): Promise<void> {
  getGroupStore(groupId);
  try {
    await startWakeSubscription(groupId);
  } catch {
    // Opening a group for browse must not crash if Realtime is unavailable.
  }
  await syncGroup(groupId);
}
