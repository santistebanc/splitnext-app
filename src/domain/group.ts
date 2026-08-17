import type { BindEntity, GroupEntity, MemberEntity } from '@/src/types/group';

export type GroupPatch = {
  name?: string;
  currency_label?: string;
};

/**
 * Next version of a group with name and/or currency changed. Omitted fields
 * stay. An empty currency label keeps the current one so Done cannot blank it.
 */
export function patchGroup(
  group: GroupEntity,
  patch: GroupPatch,
  updatedAt: string,
): GroupEntity {
  return {
    ...group,
    name: patch.name !== undefined ? patch.name : group.name,
    currency_label:
      patch.currency_label !== undefined && patch.currency_label !== ''
        ? patch.currency_label
        : group.currency_label,
    version: group.version + 1,
    updated_at: updatedAt,
  };
}

/** Done on Settings is only offerable once the group is named and this device is someone. */
export function settingsDoneEnabled(
  name: string,
  assumedMemberId: string | null,
): boolean {
  return name.trim() !== '' && assumedMemberId != null;
}

export type CreateGroupDraftInput = {
  name: string;
  currency_label: string;
  creator_name: string;
};

export type CreateGroupIds = {
  groupId: string;
  memberId: string;
  bindId: string;
  deviceUserId: string;
};

/**
 * Local v1 group + creator member + this device's bind, or null when the
 * group name or creator name is empty. An empty currency label becomes EUR.
 */
export function createGroupDraft(
  input: CreateGroupDraftInput,
  ids: CreateGroupIds,
  updatedAt: string,
): { group: GroupEntity; member: MemberEntity; bind: BindEntity } | null {
  const name = input.name.trim();
  const creatorName = input.creator_name.trim();
  if (name === '' || creatorName === '') return null;
  const currency =
    input.currency_label.trim() === '' ? 'EUR' : input.currency_label.trim();
  return {
    group: {
      id: ids.groupId,
      version: 1,
      updated_at: updatedAt,
      deleted_at: null,
      name,
      currency_label: currency,
      is_closed: false,
    },
    member: {
      id: ids.memberId,
      group_id: ids.groupId,
      display_name: creatorName,
      version: 1,
      updated_at: updatedAt,
      deleted_at: null,
    },
    bind: {
      id: ids.bindId,
      group_id: ids.groupId,
      device_user_id: ids.deviceUserId,
      member_id: ids.memberId,
      version: 1,
      updated_at: updatedAt,
      deleted_at: null,
    },
  };
}
