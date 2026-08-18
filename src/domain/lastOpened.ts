/** Pick a hub to open on launch when the id is still on the lobby. */
export function lastOpenedHubId(
  lastOpenedId: string | null | undefined,
  lobbyIds: readonly string[],
): string | null {
  if (!lastOpenedId) return null;
  return lobbyIds.includes(lastOpenedId) ? lastOpenedId : null;
}
