import { corsHeaders, jsonResponse } from './cors';
import { randomInviteToken, randomToken } from './crypto';
import { healthPayload, isHealthRequest } from './health';
import { GroupObject } from './groupObject';
import {
  claimInvite,
  deletePushToken,
  hasLiveTokenForDevice,
  insertAccessToken,
  insertInvite,
  lookupAccess,
  lookupInvite,
  resolveAccessToken,
  revokeAccessToken,
  upsertPushToken,
} from './indexDb';
import { accessIdentifies, inviteRedeemBlock } from './access';
import type { MergeItem } from './entities';
import { notifyActivityPush, revokePushForDevice } from './pushNotify';

export { GroupObject };

export interface Env {
  GROUP: DurableObjectNamespace<GroupObject>;
  INDEX: D1Database;
  DEPLOY_SHA: string;
  EXPO_ACCESS_TOKEN?: string;
}

const ROUTES = [
  'create-group',
  'merge',
  'fetch-entity',
  'list-roster',
  'mint-invite',
  'join-group',
  'leave-group',
  'register-push-token',
  'revoke-push-token',
] as const;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const route = routeName(url.pathname);

    if (route && isHealthRequest(request.method, request.url)) {
      return jsonResponse(healthPayload(route, env.DEPLOY_SHA));
    }

    if (request.method === 'GET' && url.pathname.startsWith('/wake/')) {
      return handleWake(request, env, url);
    }

    if (request.method !== 'POST' || !route) {
      return jsonResponse({ error: 'method_not_allowed' }, 405);
    }

    try {
      if (route === 'create-group') return await handleCreateGroup(request, env);
      if (route === 'merge') return await handleMerge(request, env, ctx);
      if (route === 'fetch-entity') return await handleFetch(request, env);
      if (route === 'list-roster') return await handleRoster(request, env);
      if (route === 'mint-invite') return await handleMintInvite(request, env);
      if (route === 'leave-group') return await handleLeave(request, env);
      if (route === 'register-push-token') {
        return await handleRegisterPushToken(request, env);
      }
      if (route === 'revoke-push-token') {
        return await handleRevokePushToken(request, env);
      }
      if (route === 'join-group') return await handleJoin(request, env);
      return jsonResponse({ error: 'method_not_allowed' }, 405);
    } catch (err) {
      console.error(route, err);
      return jsonResponse({ error: 'internal' }, 500);
    }
  },
};

function routeName(pathname: string): (typeof ROUTES)[number] | null {
  const name = pathname.replace(/^\//, '').replace(/\/$/, '');
  return (ROUTES as readonly string[]).includes(name)
    ? (name as (typeof ROUTES)[number])
    : null;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function groupStub(env: Env, groupId: string) {
  return env.GROUP.get(env.GROUP.idFromName(groupId));
}

async function handleCreateGroup(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;
  const groupId = body.group_id as string | undefined;
  const deviceUserId = body.device_user_id as string | undefined;
  const name = typeof body.name === 'string' ? body.name : '';
  const currencyLabel =
    typeof body.currency_label === 'string' ? body.currency_label : 'EUR';
  const updatedAt =
    typeof body.updated_at === 'string' ? body.updated_at : new Date().toISOString();

  if (!groupId || !deviceUserId) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const created = await groupStub(env, groupId).createGroup({
    group_id: groupId,
    name,
    currency_label: currencyLabel,
    updated_at: updatedAt,
  });
  if ('error' in created) {
    return jsonResponse({ error: created.error }, 409);
  }

  const accessToken = randomToken();
  await insertAccessToken(env.INDEX, accessToken, groupId, deviceUserId);

  return jsonResponse({
    access_token: accessToken,
    group: {
      id: groupId,
      version: 1,
      updated_at: updatedAt,
      deleted_at: null,
      name,
      currency_label: currencyLabel,
      is_closed: false,
    },
  });
}

async function requireAccess(
  request: Request,
  env: Env,
  groupId: string,
): Promise<Response | null> {
  const accessToken = bearerToken(request);
  const deviceUserId = request.headers.get('x-device-user-id');
  if (!accessToken || !deviceUserId) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const access = await resolveAccessToken(env.INDEX, accessToken, groupId, deviceUserId);
  if (!access) return jsonResponse({ error: 'unauthorized' }, 401);
  return null;
}

async function handleMerge(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const body = (await request.json()) as {
    group_id?: string;
    items?: MergeItem[];
  };
  const groupId = body.group_id;
  const items = body.items;
  if (!groupId || !Array.isArray(items)) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }
  const denied = await requireAccess(request, env, groupId);
  if (denied) return denied;
  const deviceUserId = request.headers.get('x-device-user-id') ?? '';
  const { results } = await groupStub(env, groupId).merge(groupId, items);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const result = results[i];
    if (
      result?.status === 'accepted' &&
      item.entity_type === 'activities' &&
      deviceUserId
    ) {
      ctx.waitUntil(notifyActivityPush(env, groupId, item, deviceUserId));
    }
  }
  return jsonResponse({ results });
}

async function handleRegisterPushToken(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json()) as {
    group_id?: string;
    expo_push_token?: string;
  };
  const groupId = body.group_id;
  const expoPushToken = body.expo_push_token;
  if (!groupId || !expoPushToken) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }
  const denied = await requireAccess(request, env, groupId);
  if (denied) return denied;
  const deviceUserId = request.headers.get('x-device-user-id');
  if (!deviceUserId) return jsonResponse({ error: 'unauthorized' }, 401);
  await upsertPushToken(
    env.INDEX,
    groupId,
    deviceUserId,
    expoPushToken,
    new Date().toISOString(),
  );
  return jsonResponse({ ok: true });
}

async function handleRevokePushToken(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json()) as { group_id?: string };
  const groupId = body.group_id;
  if (!groupId) return jsonResponse({ error: 'invalid_body' }, 400);
  const denied = await requireAccess(request, env, groupId);
  if (denied) return denied;
  const deviceUserId = request.headers.get('x-device-user-id');
  if (!deviceUserId) return jsonResponse({ error: 'unauthorized' }, 401);
  await deletePushToken(env.INDEX, groupId, deviceUserId);
  return jsonResponse({ ok: true });
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    group_id?: string;
    entity_type?: string;
    id?: string;
  };
  const groupId = body.group_id;
  const entityType = body.entity_type;
  const id = body.id;
  if (!groupId || !entityType || !id) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }
  const denied = await requireAccess(request, env, groupId);
  if (denied) return denied;
  const result = await groupStub(env, groupId).fetchEntity(groupId, entityType, id);
  if ('error' in result) {
    return jsonResponse({ error: result.error }, result.status);
  }
  return jsonResponse(result);
}

async function handleRoster(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { group_id?: string };
  const groupId = body.group_id;
  if (!groupId) return jsonResponse({ error: 'invalid_body' }, 400);
  const denied = await requireAccess(request, env, groupId);
  if (denied) return denied;
  return jsonResponse(await groupStub(env, groupId).listRoster(groupId));
}

async function handleMintInvite(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { group_id?: string; member_id?: string };
  const groupId = body.group_id;
  const memberId = body.member_id;
  if (!groupId || !memberId) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }
  const denied = await requireAccess(request, env, groupId);
  if (denied) return denied;

  const member = await groupStub(env, groupId).getMember(groupId, memberId);
  if (!member || member.deleted_at != null) {
    return jsonResponse({ error: 'member_missing' }, 404);
  }

  const token = randomInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await insertInvite(env.INDEX, token, groupId, memberId, expiresAt);
  return jsonResponse({ token, expires_at: expiresAt, member_id: memberId });
}

async function handleJoin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { token?: string; device_user_id?: string };
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const deviceUserId =
    typeof body.device_user_id === 'string' ? body.device_user_id : '';
  if (!token || !deviceUserId) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const invite = await lookupInvite(env.INDEX, token);
  const block = inviteRedeemBlock(
    invite
      ? {
          group_id: invite.group_id,
          member_id: invite.member_id,
          expires_at: invite.expires_at,
          redeemed_at: invite.redeemed_at,
          member_deleted_at: null,
        }
      : null,
    new Date(),
  );
  if (block === 'invite_unknown') return jsonResponse({ error: block }, 404);
  if (block === 'invite_redeemed') return jsonResponse({ error: block }, 409);
  if (block === 'invite_expired') return jsonResponse({ error: block }, 410);
  if (block) return jsonResponse({ error: block }, 400);
  if (!invite) return jsonResponse({ error: 'invite_unknown' }, 404);

  const stub = groupStub(env, invite.group_id);
  const member = await stub.getMember(invite.group_id, invite.member_id);
  if (!member || member.deleted_at != null) {
    return jsonResponse({ error: 'member_missing' }, 404);
  }

  if (await hasLiveTokenForDevice(env.INDEX, invite.group_id, deviceUserId)) {
    return jsonResponse({ error: 'already_in_group' }, 409);
  }

  const now = new Date().toISOString();
  const claimed = await claimInvite(env.INDEX, invite.token_hash, now);
  if (!claimed) return jsonResponse({ error: 'invite_redeemed' }, 409);

  const accessToken = randomToken();
  await insertAccessToken(env.INDEX, accessToken, invite.group_id, deviceUserId);

  const bind = {
    id: crypto.randomUUID(),
    group_id: invite.group_id,
    device_user_id: deviceUserId,
    member_id: invite.member_id,
    version: 1,
    updated_at: now,
    deleted_at: null,
  };
  const inserted = await stub.insertBind(bind);
  if ('error' in inserted) {
    return jsonResponse({ error: inserted.error }, 500);
  }

  const group = await stub.getGroup(invite.group_id);
  if (!group) return jsonResponse({ error: 'group_lookup_failed' }, 500);

  await stub.broadcastWake({
    group_id: invite.group_id,
    entity_type: 'binds',
    id: bind.id,
    version: bind.version,
  });

  return jsonResponse({ access_token: accessToken, group, bind });
}

async function handleLeave(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { group_id?: string };
  const groupId = body.group_id;
  if (!groupId) return jsonResponse({ error: 'invalid_body' }, 400);

  const accessToken = bearerToken(request);
  const deviceUserId = request.headers.get('x-device-user-id');
  if (!accessToken || !deviceUserId) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const row = await lookupAccess(env.INDEX, accessToken);
  if (!accessIdentifies(row, groupId, deviceUserId)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  if (row.revoked_at == null) {
    await revokeAccessToken(env.INDEX, accessToken, new Date().toISOString());
  }
  await revokePushForDevice(env.INDEX, groupId, deviceUserId);
  return jsonResponse({ ok: true });
}

async function handleWake(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return jsonResponse({ error: 'upgrade_required' }, 426);
  }
  const groupId = url.pathname.slice('/wake/'.length).replace(/\/$/, '');
  const accessToken = url.searchParams.get('access_token') ?? '';
  const deviceUserId = url.searchParams.get('device_user_id') ?? '';
  if (!groupId || !accessToken || !deviceUserId) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const access = await resolveAccessToken(env.INDEX, accessToken, groupId, deviceUserId);
  if (!access) return jsonResponse({ error: 'unauthorized' }, 401);
  return groupStub(env, groupId).fetch(request);
}
