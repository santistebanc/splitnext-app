import type { MemberEntity } from '@/src/types/group';

/** Lobby row title: the group name, or (empty) when it has not been named. */
export function lobbyGroupTitle(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? '(empty)' : trimmed;
}

/**
 * One-line member list for a lobby row, live members only, in member-id
 * order. Null when there is nobody to name — the row then shows the title
 * alone. Fitting on screen is the UI's job (one line, ellipsize).
 */
export function lobbyMemberSummary(
  members: Record<string, MemberEntity>,
): string | null {
  const names = Object.values(members)
    .filter((m) => m.deleted_at == null)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => {
      const n = m.display_name.trim();
      return n === '' ? '(unnamed)' : n;
    });
  return names.length === 0 ? null : names.join(', ');
}
