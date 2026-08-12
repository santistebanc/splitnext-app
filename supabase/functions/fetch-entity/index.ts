/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { healthPayload, isHealthRequest } from '../_shared/health.ts';
import {
  BIND_SELECT,
  EXPENSE_SELECT,
  GROUP_SELECT,
  MEMBER_SELECT,
} from '../_shared/entities.ts';
import { bearerToken, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // The deploy probe, before any auth work: CI asserts every function reports
  // the merge sha, so a deploy that silently did nothing cannot pass green.
  if (isHealthRequest(req.method, req.url)) {
    return jsonResponse(healthPayload('fetch-entity', Deno.env.get('DEPLOY_SHA')));
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
    const entityType = body.entity_type as string | undefined;
    const id = body.id as string | undefined;
    if (!groupId || !entityType || !id) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const access = await resolveAccessToken(accessToken, groupId, deviceUserId);
    if (!access) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = serviceClient();

    if (entityType === 'groups') {
      if (id !== groupId) {
        return jsonResponse({ error: 'group_mismatch' }, 400);
      }
      const { data, error } = await supabase
        .from('groups')
        .select(GROUP_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ entity: data });
    }

    if (entityType === 'members') {
      const { data, error } = await supabase
        .from('members')
        .select(MEMBER_SELECT)
        .eq('id', id)
        .eq('group_id', groupId)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ entity: data });
    }

    if (entityType === 'binds') {
      const { data, error } = await supabase
        .from('binds')
        .select(BIND_SELECT)
        .eq('id', id)
        .eq('group_id', groupId)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ entity: data });
    }

    if (entityType === 'expenses') {
      const { data, error } = await supabase
        .from('expenses')
        .select(EXPENSE_SELECT)
        .eq('id', id)
        .eq('group_id', groupId)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse({ entity: data });
    }

    return jsonResponse({ error: 'unsupported' }, 400);
  } catch (err) {
    console.error('fetch-entity', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
