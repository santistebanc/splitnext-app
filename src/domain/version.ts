/** Remote/incoming wins only when its version is strictly greater. Symmetric client/server rule. */
export function shouldAcceptVersion(
  incomingVersion: number,
  storedVersion: number,
): boolean {
  return incomingVersion > storedVersion;
}

export type EntityType =
  | 'groups'
  | 'members'
  | 'binds'
  | 'expenses'
  | 'activities';

const FLUSH_ORDER: EntityType[] = [
  'groups',
  'members',
  'binds',
  'expenses',
  'activities',
];

export function compareFlushOrder(a: EntityType, b: EntityType): number {
  return FLUSH_ORDER.indexOf(a) - FLUSH_ORDER.indexOf(b);
}

export function sortByFlushOrder<T extends { entity_type: EntityType }>(
  items: T[],
): T[] {
  return [...items].sort((x, y) =>
    compareFlushOrder(x.entity_type, y.entity_type),
  );
}
