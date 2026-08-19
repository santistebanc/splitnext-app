import * as Crypto from 'expo-crypto';
import { createGroupRemote } from '@/src/api/edge';
import { bindOnce } from '@/src/domain/bind';
import {
  activityForExpenseAdded,
  activityForExpenseDeleted,
  activityForExpenseEdited,
  activityForGroupRenamed,
  activityForMemberKicked,
  activityForMemberRenamed,
} from '@/src/domain/activity';
import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import { planUndo } from '@/src/domain/undo';
import { createGroupDraft, patchGroup, type CreateGroupDraftInput, type GroupPatch } from '@/src/domain/group';
import { buildExpenseAllocations, patchExpense, tombstoneExpense, type SplitAmongEntry } from '@/src/domain/expense';
import { patchMember, tombstoneMember } from '@/src/domain/member';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { registerPushTokenForGroup } from '@/src/push/registerPushToken';
import {
  addLobbyGroupId,
  listLobbyGroupIds,
  saveAccessToken,
  saveLastOpenedGroupId,
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
  ActivityEntity,
  BindEntity,
  ExpenseEntity,
  GroupEntity,
  MemberEntity,
  OutboundItem,
} from '@/src/types/group';

export { flushQueue } from '@/src/sync/outbound';
export { applyRemoteFetch } from '@/src/sync/inbound';
export { startWakeSubscription } from '@/src/sync/wake';

type GroupStoreHandle = ReturnType<typeof getGroupStore>;

async function queueActivityForActor(
  store$: GroupStoreHandle,
  build: (actorMemberId: string, at: string) => ActivityEntity | null,
  at: string,
): Promise<OutboundItem[]> {
  const binds = store$.binds.get() ?? {};
  const deviceUserId = await getOrCreateDeviceUserId();
  const actorMemberId = assumedMemberIdFromBinds(binds, deviceUserId);
  if (!actorMemberId) return [];
  const activity = build(actorMemberId, at);
  if (!activity) return [];
  store$.activities.set({
    ...(store$.activities.get() ?? {}),
    [activity.id]: activity,
  });
  return [
    {
      entity_type: 'activities',
      id: activity.id,
      version: activity.version,
      payload: activity,
    },
  ];
}

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
  const queueItems: OutboundItem[] = [
    {
      entity_type: 'groups',
      id: groupId,
      version: next.version,
      payload: next,
    },
  ];
  if (patch.name != null && patch.name !== current.name) {
    queueItems.push(
      ...(await queueActivityForActor(
        store$,
        (actorMemberId, at) =>
          activityForGroupRenamed({
            id: Crypto.randomUUID(),
            groupId,
            actorMemberId,
            at,
          }),
        next.updated_at,
      )),
    );
  }
  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
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
  const queueItems: OutboundItem[] = [
    {
      entity_type: 'members',
      id: memberId,
      version: next.version,
      payload: next,
    },
  ];
  queueItems.push(
    ...(await queueActivityForActor(
      store$,
      (actorMemberId, at) =>
        activityForMemberRenamed({
          id: Crypto.randomUUID(),
          groupId,
          actorMemberId,
          member: next,
          at,
        }),
      next.updated_at,
    )),
  );
  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
  await flushQueue(groupId);
}

/** What the form knows when someone records a cost. */
export type NewExpense = {
  payerMemberId: string;
  /** Integer cents. Rejected outright if it is not — money never rounds here. */
  amountCents: number;
  description: string;
  splitAmong?: SplitAmongEntry[];
  /** Who shares equally. Omitted means every live member. Ignored when splitAmong is set. */
  participantMemberIds?: string[];
};

function splitAmongForWrite(
  liveIds: string[],
  input: Pick<NewExpense, 'splitAmong' | 'participantMemberIds'>,
): SplitAmongEntry[] {
  if (input.splitAmong) return [...input.splitAmong];
  const selected = input.participantMemberIds ?? liveIds;
  return selected.map((memberId) => ({
    memberId,
    shareUnits: 1,
    fixedCents: null,
  }));
}

export async function addExpense(
  groupId: string,
  input: NewExpense,
): Promise<string> {
  const { payerMemberId, amountCents, description } = input;
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
  const splitAmong = splitAmongForWrite(liveIds, input);
  const allocations = buildExpenseAllocations(
    amountCents,
    liveIds,
    splitAmong,
  );
  if (!allocations) {
    store$.lastError.set(syncError('member_missing'));
    return '';
  }

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
  const queueItems: OutboundItem[] = [
    {
      entity_type: 'expenses',
      id: expense.id,
      version: expense.version,
      payload: expense,
    },
  ];

  queueItems.push(
    ...(await queueActivityForActor(
      store$,
      (actorMemberId, at) =>
        activityForExpenseAdded({
          id: Crypto.randomUUID(),
          groupId,
          actorMemberId,
          expense,
          at,
          snapshot: expense,
        }),
      expense.updated_at,
    )),
  );

  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
  await flushQueue(groupId);
  return expense.id;
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  input: NewExpense,
): Promise<void> {
  const { payerMemberId, amountCents, description } = input;
  if (!Number.isInteger(amountCents)) {
    throw new Error('amount must be integer cents');
  }
  if (amountCents <= 0) {
    throw new Error('amount must be greater than zero');
  }

  const store$ = getGroupStore(groupId);
  const current = (store$.expenses.get() ?? {})[expenseId];
  if (!current || current.deleted_at != null) return;

  const members = store$.members.get() ?? {};
  const liveIds = Object.values(members)
    .filter((m) => m.deleted_at == null)
    .map((m) => m.id);
  const next = patchExpense(
    current,
    liveIds,
    {
      payerMemberId,
      amountCents,
      description,
      splitAmong: splitAmongForWrite(liveIds, input),
    },
    new Date().toISOString(),
  );
  if (!next) return;

  store$.expenses.set({ ...(store$.expenses.get() ?? {}), [expenseId]: next });
  const queueItems: OutboundItem[] = [
    {
      entity_type: 'expenses',
      id: expenseId,
      version: next.version,
      payload: next,
    },
  ];
  queueItems.push(
    ...(await queueActivityForActor(
      store$,
      (actorMemberId, at) =>
        activityForExpenseEdited({
          id: Crypto.randomUUID(),
          groupId,
          actorMemberId,
          expense: next,
          at,
        }),
      next.updated_at,
    )),
  );
  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
  await flushQueue(groupId);
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const current = (store$.expenses.get() ?? {})[expenseId];
  if (!current || current.deleted_at != null) return;

  const next = tombstoneExpense(current, new Date().toISOString());
  if (!next) return;

  store$.expenses.set({ ...(store$.expenses.get() ?? {}), [expenseId]: next });
  const queueItems: OutboundItem[] = [
    {
      entity_type: 'expenses',
      id: expenseId,
      version: next.version,
      payload: next,
    },
  ];
  queueItems.push(
    ...(await queueActivityForActor(
      store$,
      (actorMemberId, at) =>
        activityForExpenseDeleted({
          id: Crypto.randomUUID(),
          groupId,
          actorMemberId,
          expense: current,
          at,
          snapshot: current,
        }),
      next.updated_at,
    )),
  );
  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
  await flushQueue(groupId);
}

export async function deleteMember(
  groupId: string,
  memberId: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const current = (store$.members.get() ?? {})[memberId];
  if (!current || current.deleted_at != null) return;

  const next = tombstoneMember(current, new Date().toISOString());
  if (!next) return;

  store$.members.set({ ...(store$.members.get() ?? {}), [memberId]: next });
  const queueItems: OutboundItem[] = [
    {
      entity_type: 'members',
      id: memberId,
      version: next.version,
      payload: next,
    },
  ];
  queueItems.push(
    ...(await queueActivityForActor(
      store$,
      (actorMemberId, at) =>
        activityForMemberKicked({
          id: Crypto.randomUUID(),
          groupId,
          actorMemberId,
          member: current,
          at,
          snapshot: current,
        }),
      next.updated_at,
    )),
  );
  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
  await flushQueue(groupId);
}

export async function undoActivity(
  groupId: string,
  activityId: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  const assumedMemberId = assumedMemberIdFromBinds(
    store$.binds.get() ?? {},
    deviceUserId,
  );
  const activity = (store$.activities.get() ?? {})[activityId];
  if (!activity) return;

  const plan = planUndo({
    activity,
    assumedMemberId,
    expense: (store$.expenses.get() ?? {})[activity.expense_id],
    member: (store$.members.get() ?? {})[activity.member_id],
    at: new Date().toISOString(),
  });
  if (!plan) return;

  const queueItems: OutboundItem[] = [];
  if (plan.expense) {
    store$.expenses.set({
      ...(store$.expenses.get() ?? {}),
      [plan.expense.id]: plan.expense,
    });
    queueItems.push({
      entity_type: 'expenses',
      id: plan.expense.id,
      version: plan.expense.version,
      payload: plan.expense,
    });
  }
  if (plan.member) {
    store$.members.set({
      ...(store$.members.get() ?? {}),
      [plan.member.id]: plan.member,
    });
    queueItems.push({
      entity_type: 'members',
      id: plan.member.id,
      version: plan.member.version,
      payload: plan.member,
    });
  }
  store$.activities.set({
    ...(store$.activities.get() ?? {}),
    [plan.activity.id]: plan.activity,
  });
  queueItems.push({
    entity_type: 'activities',
    id: plan.activity.id,
    version: plan.activity.version,
    payload: plan.activity,
  });
  store$.queue.set([...(store$.queue.get() ?? []), ...queueItems]);
  await flushQueue(groupId);
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
  await saveLastOpenedGroupId(groupId);
  void registerPushTokenForGroup(groupId);
  try {
    await startWakeSubscription(groupId, () => syncGroup(groupId));
  } catch {
    // Opening a group for browse must not crash if the wake socket is down.
  }
  await syncGroup(groupId);
}
