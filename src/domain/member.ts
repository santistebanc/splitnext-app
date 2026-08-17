import type { MemberEntity } from '@/src/types/group';

/**
 * Next version of a member with a new display name, or null when there is
 * nothing to write: whitespace, or the same name after trim.
 */
export function patchMember(
  member: MemberEntity,
  displayName: string,
  updatedAt: string,
): MemberEntity | null {
  const name = displayName.trim();
  if (name === '' || name === member.display_name.trim()) return null;
  return {
    ...member,
    display_name: name,
    version: member.version + 1,
    updated_at: updatedAt,
  };
}

/**
 * Soft-delete a live member at the next version. Already-tombstoned → null.
 */
export function tombstoneMember(
  member: MemberEntity,
  deletedAt: string,
): MemberEntity | null {
  if (member.deleted_at != null) return null;
  return {
    ...member,
    version: member.version + 1,
    updated_at: deletedAt,
    deleted_at: deletedAt,
  };
}
