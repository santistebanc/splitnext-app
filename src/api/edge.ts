import { env } from '@/src/config/env';
import type {
  ActivityEntity,
  BindEntity,
  ExpenseEntity,
  GroupEntity,
  MemberEntity,
  SyncEntity,
} from '@/src/types/group';

type Json = Record<string, unknown>;

const FETCH_MS = 15_000;

async function callFunction<T>(
  name: string,
  body: Json,
  options?: { accessToken?: string; deviceUserId?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  if (options?.deviceUserId) {
    headers['x-device-user-id'] = options.deviceUserId;
  }

  const url = `${env.apiUrl}/${name}`;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (err) {
    if (abort.signal.aborted) {
      throw new Error(`edge_${name}_timeout`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: (T & { error?: string; detail?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as T & { error?: string; detail?: string }) : null;
  } catch {
    throw new Error(
      `edge_${name}_non_json status=${res.status} body=${text.slice(0, 120)}`,
    );
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `edge_${name}_failed_${res.status}`);
  }
  if (!data) {
    throw new Error(`edge_${name}_empty`);
  }
  return data;
}

export async function createGroupRemote(input: {
  group_id: string;
  device_user_id: string;
  name: string;
  currency_label: string;
  updated_at: string;
}): Promise<{ access_token: string; group: GroupEntity }> {
  return callFunction('create-group', input);
}

export async function mergeEntities(input: {
  group_id: string;
  device_user_id: string;
  access_token: string;
  items: Array<{
    entity_type: string;
    id: string;
    version: number;
    payload: SyncEntity;
  }>;
}): Promise<{
  results: Array<{
    id: string;
    entity_type: string;
    version: number;
    status: string;
    reason?: string;
  }>;
}> {
  return callFunction(
    'merge',
    { group_id: input.group_id, items: input.items },
    {
      accessToken: input.access_token,
      deviceUserId: input.device_user_id,
    },
  );
}

export async function fetchEntity(input: {
  group_id: string;
  device_user_id: string;
  access_token: string;
  entity_type: string;
  id: string;
}): Promise<{ entity: SyncEntity }> {
  return callFunction(
    'fetch-entity',
    {
      group_id: input.group_id,
      entity_type: input.entity_type,
      id: input.id,
    },
    {
      accessToken: input.access_token,
      deviceUserId: input.device_user_id,
    },
  );
}

export async function listRoster(input: {
  group_id: string;
  device_user_id: string;
  access_token: string;
}): Promise<{
  members: MemberEntity[];
  binds: BindEntity[];
  expenses?: ExpenseEntity[];
  activities?: ActivityEntity[];
}> {
  return callFunction(
    'list-roster',
    { group_id: input.group_id },
    {
      accessToken: input.access_token,
      deviceUserId: input.device_user_id,
    },
  );
}

export async function mintInviteRemote(input: {
  group_id: string;
  device_user_id: string;
  access_token: string;
  member_id: string;
}): Promise<{ token: string; expires_at: string; member_id: string }> {
  return callFunction(
    'mint-invite',
    { group_id: input.group_id, member_id: input.member_id },
    {
      accessToken: input.access_token,
      deviceUserId: input.device_user_id,
    },
  );
}

export async function joinGroupRemote(input: {
  token: string;
  device_user_id: string;
}): Promise<{
  access_token: string;
  group: GroupEntity;
  bind: BindEntity;
}> {
  return callFunction('join-group', {
    token: input.token,
    device_user_id: input.device_user_id,
  });
}

export async function leaveGroupRemote(input: {
  group_id: string;
  device_user_id: string;
  access_token: string;
}): Promise<{ ok: true }> {
  return callFunction(
    'leave-group',
    { group_id: input.group_id },
    {
      accessToken: input.access_token,
      deviceUserId: input.device_user_id,
    },
  );
}
