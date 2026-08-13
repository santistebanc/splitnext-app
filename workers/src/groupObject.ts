import { DurableObject } from 'cloudflare:workers';
import { mergeOne, type GroupStore, type MergeResult } from './merge';
import type { MergeItem } from './entities';

type Sql = {
  exec<T extends Record<string, unknown>>(
    query: string,
    ...params: unknown[]
  ): { toArray(): T[]; one(): T };
};

export type GroupRecord = {
  id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  currency_label: string;
  is_closed: number | boolean;
};

export type MemberRecord = {
  id: string;
  group_id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  display_name: string;
};

export type BindRecord = {
  id: string;
  group_id: string;
  device_user_id: string;
  member_id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
};

export type ExpenseRecord = {
  id: string;
  group_id: string;
  payer_member_id: string;
  amount_cents: number;
  description: string;
  allocations: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
};

export class GroupObject extends DurableObject {
  private get sql(): Sql {
    return this.ctx.storage.sql as unknown as Sql;
  }

  private ensureSchema(): void {
    // Durable Object sql.exec runs one statement per call.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        name TEXT NOT NULL DEFAULT '',
        currency_label TEXT NOT NULL DEFAULT 'EUR',
        is_closed INTEGER NOT NULL DEFAULT 0
      )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        display_name TEXT NOT NULL DEFAULT ''
      )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS binds (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        device_user_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        payer_member_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        allocations TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`);
    this.sql.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS binds_one_active_per_device
        ON binds (device_user_id) WHERE deleted_at IS NULL`,
    );
  }

  private store(groupId: string): GroupStore {
    const sql = this.sql;
    return {
      getVersion(entityType, id) {
        const table = tableFor(entityType);
        if (!table) return -1;
        const rows = sql.exec<{ version: number }>(
          `SELECT version FROM ${table} WHERE id = ?`,
          id,
        ).toArray();
        return rows[0]?.version ?? -1;
      },
      getMember(id) {
        const rows = sql.exec<{ id: string }>(
          'SELECT id FROM members WHERE id = ?',
          id,
        ).toArray();
        return rows[0] ?? null;
      },
      upsert(entityType, row) {
        upsertRow(sql, groupId, entityType, row);
      },
    };
  }

  async createGroup(input: {
    group_id: string;
    name: string;
    currency_label: string;
    updated_at: string;
  }): Promise<{ ok: true } | { error: string }> {
    this.ensureSchema();
    const existing = this.sql
      .exec<{ id: string }>('SELECT id FROM groups WHERE id = ?', input.group_id)
      .toArray();
    if (existing[0]) return { error: 'group_insert_failed' };
    this.sql.exec(
      `INSERT INTO groups (id, version, updated_at, deleted_at, name, currency_label, is_closed)
       VALUES (?, 1, ?, NULL, ?, ?, 0)`,
      input.group_id,
      input.updated_at,
      input.name,
      input.currency_label,
    );
    return { ok: true };
  }

  async merge(
    groupId: string,
    items: MergeItem[],
  ): Promise<{ results: MergeResult[] }> {
    this.ensureSchema();
    const store = this.store(groupId);
    const results: MergeResult[] = [];
    for (const item of items) {
      const result = mergeOne(store, groupId, item);
      results.push(result);
      if (result.status === 'accepted') {
        await this.broadcastWake({
          group_id: groupId,
          entity_type: item.entity_type,
          id: item.id,
          version: item.version,
        });
      }
    }
    return { results };
  }

  async fetchEntity(
    groupId: string,
    entityType: string,
    id: string,
  ): Promise<{ entity: Record<string, unknown> } | { error: string; status: number }> {
    this.ensureSchema();
    if (entityType === 'groups') {
      if (id !== groupId) return { error: 'group_mismatch', status: 400 };
      const row = this.sql.exec<GroupRecord>('SELECT * FROM groups WHERE id = ?', id).toArray()[0];
      if (!row) return { error: 'not_found', status: 404 };
      return { entity: groupEntity(row) };
    }
    if (entityType === 'members') {
      const row = this.sql
        .exec<MemberRecord>('SELECT * FROM members WHERE id = ? AND group_id = ?', id, groupId)
        .toArray()[0];
      if (!row) return { error: 'not_found', status: 404 };
      return { entity: memberEntity(row) };
    }
    if (entityType === 'binds') {
      const row = this.sql
        .exec<BindRecord>('SELECT * FROM binds WHERE id = ? AND group_id = ?', id, groupId)
        .toArray()[0];
      if (!row) return { error: 'not_found', status: 404 };
      return { entity: bindEntity(row) };
    }
    if (entityType === 'expenses') {
      const row = this.sql
        .exec<ExpenseRecord>('SELECT * FROM expenses WHERE id = ? AND group_id = ?', id, groupId)
        .toArray()[0];
      if (!row) return { error: 'not_found', status: 404 };
      return { entity: expenseEntity(row) };
    }
    return { error: 'unsupported', status: 400 };
  }

  async listRoster(groupId: string): Promise<{
    members: Record<string, unknown>[];
    binds: Record<string, unknown>[];
    expenses: Record<string, unknown>[];
  }> {
    this.ensureSchema();
    const members = this.sql
      .exec<MemberRecord>('SELECT * FROM members WHERE group_id = ?', groupId)
      .toArray()
      .map(memberEntity);
    const binds = this.sql
      .exec<BindRecord>('SELECT * FROM binds WHERE group_id = ?', groupId)
      .toArray()
      .map(bindEntity);
    const expenses = this.sql
      .exec<ExpenseRecord>('SELECT * FROM expenses WHERE group_id = ?', groupId)
      .toArray()
      .map(expenseEntity);
    return { members, binds, expenses };
  }

  async getMember(
    groupId: string,
    memberId: string,
  ): Promise<{ id: string; deleted_at: string | null } | null> {
    this.ensureSchema();
    const row = this.sql
      .exec<MemberRecord>(
        'SELECT * FROM members WHERE id = ? AND group_id = ?',
        memberId,
        groupId,
      )
      .toArray()[0];
    if (!row) return null;
    return { id: row.id, deleted_at: row.deleted_at };
  }

  async getGroup(groupId: string): Promise<Record<string, unknown> | null> {
    this.ensureSchema();
    const row = this.sql.exec<GroupRecord>('SELECT * FROM groups WHERE id = ?', groupId).toArray()[0];
    return row ? groupEntity(row) : null;
  }

  async insertBind(bind: {
    id: string;
    group_id: string;
    device_user_id: string;
    member_id: string;
    version: number;
    updated_at: string;
    deleted_at: string | null;
  }): Promise<{ ok: true } | { error: string }> {
    this.ensureSchema();
    try {
      this.sql.exec(
        `INSERT INTO binds (id, group_id, device_user_id, member_id, version, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        bind.id,
        bind.group_id,
        bind.device_user_id,
        bind.member_id,
        bind.version,
        bind.updated_at,
        bind.deleted_at,
      );
      return { ok: true };
    } catch {
      return { error: 'bind_insert_failed' };
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {
    // Clients listen; they do not send. Hibernation still requires the handler.
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    // A dropped socket is the client's problem; the next open runs catch-up.
  }

  async broadcastWake(payload: {
    group_id: string;
    entity_type: string;
    id: string;
    version: number;
  }): Promise<void> {
    const data = JSON.stringify({ event: 'wake', payload });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // A failed wake never undoes the write.
      }
    }
  }
}

function tableFor(entityType: string): string | null {
  if (entityType === 'groups') return 'groups';
  if (entityType === 'members') return 'members';
  if (entityType === 'binds') return 'binds';
  if (entityType === 'expenses') return 'expenses';
  return null;
}

function upsertRow(
  sql: Sql,
  groupId: string,
  entityType: string,
  row: Record<string, unknown>,
): void {
  if (entityType === 'groups') {
    sql.exec(
      `INSERT INTO groups (id, version, updated_at, deleted_at, name, currency_label, is_closed)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         version = excluded.version,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         name = excluded.name,
         currency_label = excluded.currency_label,
         is_closed = excluded.is_closed`,
      row.id,
      row.version,
      row.updated_at,
      row.deleted_at,
      row.name,
      row.currency_label,
      row.is_closed ? 1 : 0,
    );
    return;
  }
  if (entityType === 'members') {
    sql.exec(
      `INSERT INTO members (id, group_id, version, updated_at, deleted_at, display_name)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         version = excluded.version,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         display_name = excluded.display_name`,
      row.id,
      groupId,
      row.version,
      row.updated_at,
      row.deleted_at,
      row.display_name,
    );
    return;
  }
  if (entityType === 'binds') {
    sql.exec(
      `INSERT INTO binds (id, group_id, device_user_id, member_id, version, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         device_user_id = excluded.device_user_id,
         member_id = excluded.member_id,
         version = excluded.version,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at`,
      row.id,
      groupId,
      row.device_user_id,
      row.member_id,
      row.version,
      row.updated_at,
      row.deleted_at,
    );
    return;
  }
  sql.exec(
    `INSERT INTO expenses (id, group_id, payer_member_id, amount_cents, description, allocations, version, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payer_member_id = excluded.payer_member_id,
       amount_cents = excluded.amount_cents,
       description = excluded.description,
       allocations = excluded.allocations,
       version = excluded.version,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`,
    row.id,
    groupId,
    row.payer_member_id,
    row.amount_cents,
    row.description,
    JSON.stringify(row.allocations ?? []),
    row.version,
    row.updated_at,
    row.deleted_at,
  );
}

function groupEntity(row: GroupRecord) {
  return {
    id: row.id,
    version: row.version,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    name: row.name,
    currency_label: row.currency_label,
    is_closed: Boolean(row.is_closed),
  };
}

function memberEntity(row: MemberRecord) {
  return {
    id: row.id,
    group_id: row.group_id,
    version: row.version,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    display_name: row.display_name,
  };
}

function bindEntity(row: BindRecord) {
  return {
    id: row.id,
    group_id: row.group_id,
    device_user_id: row.device_user_id,
    member_id: row.member_id,
    version: row.version,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function expenseEntity(row: ExpenseRecord) {
  let allocations: unknown = [];
  try {
    allocations = JSON.parse(row.allocations);
  } catch {
    allocations = [];
  }
  return {
    id: row.id,
    group_id: row.group_id,
    payer_member_id: row.payer_member_id,
    amount_cents: row.amount_cents,
    description: row.description,
    allocations: Array.isArray(allocations) ? allocations : [],
    version: row.version,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}
