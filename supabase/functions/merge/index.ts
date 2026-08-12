/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { healthPayload, isHealthRequest } from '../_shared/health.ts';
import {
  bindRow,
  expenseRow,
  groupRow,
  type MergeItem,
  memberRow,
  shouldAccept,
} from '../_shared/entities.ts';
import { bearerToken, serviceClient } from '../_shared/supabase.ts';
import { publishWake } from '../_shared/wake.ts';

type Result = {
  id: string;
  entity_type: string;
  version: number;
  status: 'accepted' | 'rejected' | 'error';
  reason?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // The deploy probe, before any auth work: CI asserts every function reports
  // the merge sha, so a deploy that silently did nothing cannot pass green.
  if (isHealthRequest(req.method, req.url)) {
    return jsonResponse(healthPayload('merge', Deno.env.get('DEPLOY_SHA')));
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const accessToken = bearerToken(req);
    const deviceUserId = req.headers.get('x-device-user-id');
    if (!accessToken || !deviceUserId) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const body = await req.json();
    const groupId = body.group_id as string | undefined;
    const items = body.items as MergeItem[] | undefined;
    if (!groupId || !Array.isArray(items)) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const access = await resolveAccessToken(accessToken, groupId, deviceUserId);
    if (!access) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = serviceClient();
    const results: Result[] = [];

    for (const item of items) {
      const result = await mergeOne(supabase, groupId, item);
      results.push(result);
      if (result.status === 'accepted') {
        await publishWake({
          group_id: groupId,
          entity_type: item.entity_type,
          id: item.id,
          version: item.version,
        });
      }
    }

    return jsonResponse({ results });
  } catch (err) {
    console.error('merge', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});

async function mergeOne(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  groupId: string,
  item: MergeItem,
): Promise<Result> {
  const base = {
    id: item.id,
    entity_type: item.entity_type,
    version: item.version,
  };

  if (
    item.entity_type !== 'groups' &&
    item.entity_type !== 'members' &&
    item.entity_type !== 'binds' &&
    item.entity_type !== 'expenses'
  ) {
    return { ...base, status: 'error', reason: 'unsupported_entity' };
  }

  if (item.entity_type === 'groups' && item.id !== groupId) {
    return { ...base, status: 'error', reason: 'group_mismatch' };
  }

  if (item.entity_type !== 'groups') {
    const payloadGroup = item.payload.group_id as string | undefined;
    if (payloadGroup && payloadGroup !== groupId) {
      return { ...base, status: 'error', reason: 'group_mismatch' };
    }
  }

  const table = item.entity_type;

  const { data: existing, error: readError } = await supabase
    .from(table)
    .select('version')
    .eq('id', item.id)
    .maybeSingle();

  if (readError) {
    return { ...base, status: 'error', reason: readError.message };
  }

  const storedVersion = existing?.version ?? -1;
  if (!shouldAccept(item.version, storedVersion)) {
    return { ...base, status: 'rejected', reason: 'version_not_greater' };
  }

  let row: Record<string, unknown>;
  if (item.entity_type === 'groups') {
    row = groupRow(item);
  } else if (item.entity_type === 'members') {
    row = memberRow(item, groupId);
  } else if (item.entity_type === 'expenses') {
    row = expenseRow(item, groupId);
    if (!row.payer_member_id) {
      return { ...base, status: 'error', reason: 'invalid_expense' };
    }
    if (!Number.isInteger(row.amount_cents) || (row.amount_cents as number) <= 0) {
      return { ...base, status: 'error', reason: 'invalid_amount' };
    }
    const { data: payer, error: payerError } = await supabase
      .from('members')
      .select('id')
      .eq('id', row.payer_member_id)
      .eq('group_id', groupId)
      .maybeSingle();
    if (payerError) {
      return { ...base, status: 'error', reason: payerError.message };
    }
    if (!payer) {
      return { ...base, status: 'rejected', reason: 'payer_not_in_group' };
    }
  } else {
    row = bindRow(item, groupId);
    if (!row.device_user_id || !row.member_id) {
      return { ...base, status: 'error', reason: 'invalid_bind' };
    }
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id')
      .eq('id', row.member_id)
      .eq('group_id', groupId)
      .maybeSingle();
    if (memberError) {
      return { ...base, status: 'error', reason: memberError.message };
    }
    if (!member) {
      return { ...base, status: 'rejected', reason: 'member_not_in_group' };
    }
  }

  const { error: upsertError } = await supabase.from(table).upsert(row);
  if (upsertError) {
    return { ...base, status: 'error', reason: upsertError.message };
  }

  return { ...base, status: 'accepted' };
}
