/// <reference path="../types.d.ts" />
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { healthPayload, isHealthRequest } from '../_shared/health.ts';
import { randomToken, sha256Hex } from '../_shared/crypto.ts';
import { serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // The deploy probe, before any auth work: CI asserts every function reports
  // the merge sha, so a deploy that silently did nothing cannot pass green.
  if (isHealthRequest(req.method, req.url)) {
    return jsonResponse(healthPayload('create-group', Deno.env.get('DEPLOY_SHA')));
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const groupId = body.group_id as string | undefined;
    const deviceUserId = body.device_user_id as string | undefined;
    const name = typeof body.name === 'string' ? body.name : '';
    const currencyLabel =
      typeof body.currency_label === 'string' ? body.currency_label : 'EUR';
    const updatedAt =
      typeof body.updated_at === 'string'
        ? body.updated_at
        : new Date().toISOString();

    if (!groupId || !deviceUserId) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const supabase = serviceClient();
    const { error: groupError } = await supabase.from('groups').insert({
      id: groupId,
      version: 1,
      updated_at: updatedAt,
      deleted_at: null,
      name,
      currency_label: currencyLabel,
      is_closed: false,
    });

    if (groupError) {
      console.error('create-group insert group', groupError);
      return jsonResponse(
        { error: 'group_insert_failed', detail: groupError.message },
        409,
      );
    }

    const accessToken = randomToken();
    const tokenHash = await sha256Hex(accessToken);
    const { error: tokenError } = await supabase.from('access_tokens').insert({
      token_hash: tokenHash,
      group_id: groupId,
      device_user_id: deviceUserId,
    });

    if (tokenError) {
      console.error('create-group insert token', tokenError);
      return jsonResponse(
        { error: 'token_insert_failed', detail: tokenError.message },
        500,
      );
    }

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
  } catch (err) {
    console.error('create-group', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
