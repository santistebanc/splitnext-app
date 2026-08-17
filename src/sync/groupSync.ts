import * as Crypto from 'expo-crypto';
import { createGroupRemote } from '@/src/api/edge';
import { bindOnce } from '@/src/domain/bind';
import { createGroupDraft, patchGroup, type CreateGroupDraftInput, type GroupPatch } from '@/src/domain/group';
import { patchMember } from '@/src/domain/member';
import { participantsForSplit, splitEqually } from '@/src/domain/split';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  addLobbyGroupId,
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

export async function createGroup(
  input: CreateGroupDraftInput,
): Promise<string> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const groupId = Crypto.randomUUID();
  const memberId = Crypto.randomUUID();
  const bindId = Crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const draft = createGroupDraft(
    input,
    { groupId, memberId, bindId, deviceUserId },
    updatedAt,
  );
  if (!draft) {
    throw new Error('create_invalid');
  }

  const store$ = getGroupStore(groupId);
  initLocalGroup(store$, draft.group);
  store$.members.set({ [draft.member.id]: draft.member });
  store$.binds.set({ [draft.bind.id]: draft.bind });
  store$.syncStatus.set('creating');

  try {
    const { access_token, group } = await createGroupRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      name: draft.group.name,
      currency_label: draft.group.currency_label,
      updated_at: draft.group.updated_at,
    });
    await saveAccessToken(groupId, access_token);
    await addLobbyGroupId(groupId);
    store$.group.set(group);
    store$.queue.set([
      {
        entity_type: 'members',
        id: draft.member.id,
        version: draft.member.version,
        payload: draft.member,
      },
      {
        entity_type: 'binds',
        id: draft.bind.id,
        version: draft.bind.version,
        payload: draft.bind,
      },
    ]);
    store$.syncStatus.set('on_server');
    store$.lastError.set(null);
    await flushQueue(groupId);
    // Create must not wait on the live socket — a hung WebSocket
    // constructor would leave the lobby spinner running forever.
    // Wake failure is recorded, not thrown (slice 0004).
    void startWakeSubscription(groupId, () => syncGroup(groupId)).catch(
      (wakeErr) => {
        store$.lastError.set(
          syncError(
            'wake_failed',
            wakeErr instanceof Error ? wakeErr.message : 'wake_failed',
          ),
        );
      },
    );
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

export async function updateGroup(
  groupId: string,
  patch: GroupPatch,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const current = store$.group.get();
  const next = patchGroup(current, patch, new Date().toISOString());
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

export async function updateMember(
  groupId: string,
  memberId: string,
  displayName: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const current = (store$.members.get() ?? {})[memberId];
  if (!current || current.deleted_at != null) return;
  const next = patchMember(current, displayName, new Date().toISOString());
  if (!next) return;
  store$.members.set({ ...(store$.members.get() ?? {}), [memberId]: next });
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'members',
      id: memberId,
      version: next.version,
      payload: next,
    },
  ]);
  await flushQueue(groupId);
}

/** What the form knows when someone records a cost. */
export type NewExpense = {
  payerMemberId: string;
  /** Integer cents. Rejected outright if it is not — money never rounds here. */
  amountCents: number;
  description: string;
  /** Who shares. Omitted means every live member, which is the form's default. */
  participantMemberIds?: string[];
};

export async function addExpense(
  groupId: string,
  { payerMemberId, amountCents, description, participantMemberIds }: NewExpense,
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

  const liveIds = Object.values(members)
    .filter((m) => m.deleted_at == null)
    .map((m) => m.id);
  const selected = participantMemberIds ?? liveIds;
  const split = participantsForSplit(liveIds, selected);
  if (!split.ok) {
    store$.lastError.set(syncError('member_missing'));
    return '';
  }
  const allocations = splitEqually(amountCents, split.memberIds);

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
  const decision = bindOnce(binds, deviceUserId, memberId);
  if (decision === 'locked') {
    store$.lastError.set(syncError('binding_locked'));
    return;
  }
  if (decision === 'noop') return;

  const member = (store$.members.get() ?? {})[memberId];
  if (!member || member.deleted_at != null) {
    store$.lastError.set(syncError('member_missing'));
    return;
  }

  const bind: BindEntity = {
    id: Crypto.randomUUID(),
    group_id: groupId,
    device_user_id: deviceUserId,
    member_id: memberId,
    version: 1,
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
    await startWakeSubscription(groupId, () => syncGroup(groupId));
  } catch {
    // Opening a group for browse must not crash if the wake socket is down.
  }
  await syncGroup(groupId);
}
