/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { bearerToken, serviceClient } from '../_shared/supabase.ts';
import { publishWake } from '../_shared/wake.ts';

type MergeItem = {
  entity_type: string;
  id: string;
  version: number;
  payload: Record<string, unknown>;
};

function shouldAccept(incoming: number, stored: number): boolean {
  return incoming > stored;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const results: Array<{
      id: string;
      entity_type: string;
      status: 'accepted' | 'rejected' | 'error';
      reason?: string;
    }> = [];

    for (const item of items) {
      if (item.entity_type !== 'groups') {
        results.push({
          id: item.id,
          entity_type: item.entity_type,
          status: 'error',
          reason: 'unsupported_entity',
        });
        continue;
      }
      if (item.id !== groupId) {
        results.push({
          id: item.id,
          entity_type: item.entity_type,
          status: 'error',
          reason: 'group_mismatch',
        });
        continue;
      }

      const { data: existing, error: readError } = await supabase
        .from('groups')
        .select('version')
        .eq('id', item.id)
        .maybeSingle();

      if (readError) {
        results.push({
          id: item.id,
          entity_type: item.entity_type,
          status: 'error',
          reason: readError.message,
        });
        continue;
      }

      const storedVersion = existing?.version ?? -1;
      if (!shouldAccept(item.version, storedVersion)) {
        results.push({
          id: item.id,
          entity_type: item.entity_type,
          status: 'rejected',
          reason: 'version_not_greater',
        });
        continue;
      }

      const row = {
        id: item.id,
        version: item.version,
        updated_at:
          (item.payload.updated_at as string) ?? new Date().toISOString(),
        deleted_at: (item.payload.deleted_at as string | null) ?? null,
        name: (item.payload.name as string) ?? '',
        currency_label: (item.payload.currency_label as string) ?? 'EUR',
        is_closed: Boolean(item.payload.is_closed),
      };

      const { error: upsertError } = await supabase.from('groups').upsert(row);
      if (upsertError) {
        results.push({
          id: item.id,
          entity_type: item.entity_type,
          status: 'error',
          reason: upsertError.message,
        });
        continue;
      }

      await publishWake({
        group_id: groupId,
        entity_type: 'groups',
        id: item.id,
        version: item.version,
      });

      results.push({
        id: item.id,
        entity_type: item.entity_type,
        status: 'accepted',
      });
    }

    return jsonResponse({ results });
  } catch (err) {
    console.error('merge', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
