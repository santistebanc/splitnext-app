/** Whether this app session already auto-opened the last group from the lobby. */
let autoOpenedThisSession = false;

export function shouldAutoOpenLastGroup(): boolean {
  return !autoOpenedThisSession;
}

export function markAutoOpenedLastGroup(): void {
  autoOpenedThisSession = true;
}

/** Test hook — reset session gate between vitest cases. */
export function resetAutoOpenLastGroupForTests(): void {
  autoOpenedThisSession = false;
}
