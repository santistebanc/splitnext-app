/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { randomToken, sha256Hex } from '../_shared/crypto.ts';
import { healthPayload, isHealthRequest } from '../_shared/health.ts';
import { bearerToken, serviceClient } from '../_shared/supabase.ts';

/** 7-day one-use is the product shape; rate-limit counts stay parked. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (isHealthRequest(req.method, req.url)) {
    return jsonResponse(healthPayload('mint-invite', Deno.env.get('DEPLOY_SHA')));
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
    const memberId = body.member_id as string | undefined;
    if (!groupId || !memberId) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const access = await resolveAccessToken(accessToken, groupId, deviceUserId);
    if (!access) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = serviceClient();
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, deleted_at')
      .eq('id', memberId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (memberError) {
      console.error('mint-invite member', memberError);
      return jsonResponse({ error: 'member_lookup_failed' }, 500);
    }
    if (!member || member.deleted_at != null) {
      return jsonResponse({ error: 'member_missing' }, 404);
    }

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { error: insertError } = await supabase.from('invites').insert({
      token_hash: tokenHash,
      group_id: groupId,
      member_id: memberId,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('mint-invite insert', insertError);
      return jsonResponse({ error: 'invite_insert_failed' }, 500);
    }

    return jsonResponse({ token, expires_at: expiresAt, member_id: memberId });
  } catch (err) {
    console.error('mint-invite', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
