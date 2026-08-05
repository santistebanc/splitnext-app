import { shouldAcceptVersion } from '../domain/version';
import type {
  BindEntity,
  ExpenseEntity,
  GroupEntity,
  MemberEntity,
  SyncEntity,
} from '../types/group';

export type InboundState = {
  group: GroupEntity;
  members: Record<string, MemberEntity>;
  binds: Record<string, BindEntity>;
  expenses: Record<string, ExpenseEntity>;
};

/** Pure apply: returns next state if remote wins by version, else null. */
export function applyRemoteEntity(
  state: InboundState,
  entityType: string,
  entity: SyncEntity,
): InboundState | null {
  if (entityType === 'groups') {
    const remote = entity as GroupEntity;
    if (!shouldAcceptVersion(remote.version, state.group.version)) return null;
    return { ...state, group: remote };
  }

  if (entityType === 'members') {
    const remote = entity as MemberEntity;
    const localVersion = state.members[remote.id]?.version ?? -1;
    if (!shouldAcceptVersion(remote.version, localVersion)) return null;
    return {
      ...state,
      members: { ...state.members, [remote.id]: remote },
    };
  }

  if (entityType === 'expenses') {
    const remote = entity as ExpenseEntity;
    const localVersion = state.expenses[remote.id]?.version ?? -1;
    if (!shouldAcceptVersion(remote.version, localVersion)) return null;
    return {
      ...state,
      expenses: { ...state.expenses, [remote.id]: remote },
    };
  }

  if (entityType === 'binds') {
    const remote = entity as BindEntity;
    const localVersion = state.binds[remote.id]?.version ?? -1;
    if (!shouldAcceptVersion(remote.version, localVersion)) return null;
    return {
      ...state,
      binds: { ...state.binds, [remote.id]: remote },
    };
  }

  return null;
}
