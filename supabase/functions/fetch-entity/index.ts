/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { bearerToken, serviceClient } from '../_shared/supabase.ts';

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
    const entityType = body.entity_type as string | undefined;
    const id = body.id as string | undefined;
    if (!groupId || !entityType || !id) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const access = await resolveAccessToken(accessToken, groupId, deviceUserId);
    if (!access) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    if (entityType !== 'groups' || id !== groupId) {
      return jsonResponse({ error: 'unsupported' }, 400);
    }

    const supabase = serviceClient();
    const { data, error } = await supabase
      .from('groups')
      .select(
        'id, version, updated_at, deleted_at, name, currency_label, is_closed',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    if (!data) {
      return jsonResponse({ error: 'not_found' }, 404);
    }

    return jsonResponse({ entity: data });
  } catch (err) {
    console.error('fetch-entity', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
