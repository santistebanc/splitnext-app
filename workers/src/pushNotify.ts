import type { ActivityEntity } from '../../src/types/group';
import type { MergeItem } from './entities';
import type { Env } from './index';
import {
  deletePushToken,
  listPushTokensForGroup,
  type IndexDb,
} from './indexDb';
import { sendExpoPush } from './expoPush';
import { activityPushMessage } from './pushMessage';
import { pushRecipientTokens } from './pushRecipients';

export async function notifyActivityPush(
  env: Env,
  groupId: string,
  item: MergeItem,
  actorDeviceUserId: string,
): Promise<void> {
  if (item.entity_type !== 'activities') return;
  const payload = item.payload as ActivityEntity;
  if (!payload.actor_member_id) return;

  const stub = env.GROUP.get(env.GROUP.idFromName(groupId));
  const roster = await stub.listRoster(groupId);
  const group = await stub.getGroup(groupId);
  const currency = group?.currency_label ?? 'EUR';

  const members = Object.fromEntries(roster.members.map((m) => [m.id, m]));
  const expenses = Object.fromEntries(roster.expenses.map((e) => [e.id, e]));

  const message = activityPushMessage(
    {
      ...payload,
      id: item.id,
      group_id: groupId,
      version: item.version,
    } as ActivityEntity,
    members,
    expenses,
    currency,
  );
  if (!message) return;

  const tokens = await listPushTokensForGroup(env.INDEX as unknown as IndexDb, groupId);
  const binds = roster.binds.map((b) => ({
    device_user_id: String(b.device_user_id ?? ''),
    member_id: String(b.member_id ?? ''),
    deleted_at: (b.deleted_at as string | null) ?? null,
  }));
  const expoTokens = pushRecipientTokens(
    tokens,
    binds,
    actorDeviceUserId,
    payload.actor_member_id,
  );
  if (expoTokens.length === 0) return;

  await sendExpoPush(
    env.EXPO_ACCESS_TOKEN,
    expoTokens.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: { groupId },
    })),
  );
}

export async function revokePushForDevice(
  db: IndexDb,
  groupId: string,
  deviceUserId: string,
): Promise<void> {
  await deletePushToken(db, groupId, deviceUserId);
}
