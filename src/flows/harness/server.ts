import {
  bindRow,
  groupRow,
  type MergeItem,
  memberRow,
  shouldAccept,
} from '../../../supabase/functions/_shared/entities';

/**
 * In-process stand-in for the Edge Functions. It answers the same five calls
 * `src/api/edge.ts` makes and applies the *real* version rule from
 * `_shared/entities.ts`, so the fake cannot quietly disagree with the server
 * about who wins a merge.
 */

type Row = Record<string, unknown> & { id: string; version: number };
type WakePayload = {
  group_id: string;
  entity_type: string;
  id: string;
  version: number;
};
export type MergeResult = {
  id: string;
  entity_type: string;
  version: number;
  status: 'accepted' | 'rejected';
};

export class FakeServer {
  groups = new Map<string, Row>();
  members = new Map<string, Row>();
  binds = new Map<string, Row>();
  tokens = new Map<string, { group_id: string; device_user_id: string }>();
  /** Every call the client made, in order — assert on the wire, not the mock. */
  calls: string[] = [];
  /** Realtime subscribers, keyed by channel name. */
  private listeners = new Map<string, ((p: WakePayload) => void)[]>();
  /** Set to a code to make the next call fail, as the network would. */
  failNext: string | null = null;

  private table(entityType: string): Map<string, Row> {
    if (entityType === 'groups') return this.groups;
    if (entityType === 'members') return this.members;
    if (entityType === 'binds') return this.binds;
    throw new Error(`unknown entity_type ${entityType}`);
  }

  private authorize(groupId: string, token: string, deviceUserId: string) {
    const row = this.tokens.get(token);
    if (!row || row.group_id !== groupId || row.device_user_id !== deviceUserId) {
      throw new Error('unauthorized');
    }
  }

  private guard(call: string) {
    this.calls.push(call);
    if (this.failNext) {
      const code = this.failNext;
      this.failNext = null;
      throw new Error(code);
    }
  }

  createGroup(input: {
    group_id: string;
    device_user_id: string;
    name: string;
    currency_label: string;
    updated_at: string;
  }) {
    this.guard('create-group');
    const group = groupRow({
      entity_type: 'groups',
      id: input.group_id,
      version: 1,
      payload: { ...input },
    } as MergeItem);
    this.groups.set(group.id, group as Row);
    const token = `tok_${input.group_id}`;
    this.tokens.set(token, {
      group_id: input.group_id,
      device_user_id: input.device_user_id,
    });
    return { access_token: token, group };
  }

  merge(input: {
    group_id: string;
    device_user_id: string;
    access_token: string;
    items: MergeItem[];
  }) {
    this.guard('merge');
    this.authorize(input.group_id, input.access_token, input.device_user_id);

    const results: MergeResult[] = [];
    for (const item of input.items) {
      const table = this.table(item.entity_type);
      const stored = table.get(item.id);
      if (stored && !shouldAccept(item.version, stored.version)) {
        results.push({ ...keyOf(item), status: 'rejected' });
        continue;
      }
      // binds only bind members of the same group — the server's own integrity rule
      if (item.entity_type === 'binds') {
        const member = this.members.get(String(item.payload.member_id ?? ''));
        if (!member || member.group_id !== input.group_id) {
          results.push({ ...keyOf(item), status: 'rejected' });
          continue;
        }
      }
      const row =
        item.entity_type === 'groups'
          ? groupRow(item)
          : item.entity_type === 'members'
            ? memberRow(item, input.group_id)
            : bindRow(item, input.group_id);
      table.set(item.id, row as Row);
      results.push({ ...keyOf(item), status: 'accepted' });
      this.publishWake({
        group_id: input.group_id,
        entity_type: item.entity_type,
        id: item.id,
        version: item.version,
      });
    }
    return { results };
  }

  fetchEntity(input: {
    group_id: string;
    device_user_id: string;
    access_token: string;
    entity_type: string;
    id: string;
  }) {
    this.guard('fetch-entity');
    this.authorize(input.group_id, input.access_token, input.device_user_id);
    const entity = this.table(input.entity_type).get(input.id);
    if (!entity) throw new Error('not_found');
    return { entity };
  }

  listRoster(input: {
    group_id: string;
    device_user_id: string;
    access_token: string;
  }) {
    this.guard('list-roster');
    this.authorize(input.group_id, input.access_token, input.device_user_id);
    return {
      members: [...this.members.values()].filter(
        (m) => m.group_id === input.group_id,
      ),
      binds: [...this.binds.values()].filter(
        (b) => b.group_id === input.group_id,
      ),
    };
  }

  mintRealtimeAuth(input: {
    group_id: string;
    device_user_id: string;
    access_token: string;
  }) {
    this.guard('rt-jwt');
    this.authorize(input.group_id, input.access_token, input.device_user_id);
    return { jwt: `jwt_${input.group_id}`, channel: `group:${input.group_id}` };
  }

  // ---- realtime ----
  subscribe(channel: string, onWake: (p: WakePayload) => void) {
    const list = this.listeners.get(channel) ?? [];
    list.push(onWake);
    this.listeners.set(channel, list);
  }

  publishWake(payload: WakePayload) {
    for (const fn of this.listeners.get(`group:${payload.group_id}`) ?? []) {
      fn(payload);
    }
  }

  /** Another device changed something — the only way a wake arrives unprompted. */
  peerWrite(groupId: string, entityType: string, row: Row) {
    this.table(entityType).set(row.id, row);
    this.publishWake({
      group_id: groupId,
      entity_type: entityType,
      id: row.id,
      version: row.version,
    });
  }
}

function keyOf(item: MergeItem) {
  return {
    id: item.id,
    entity_type: item.entity_type,
    version: item.version,
  };
}
