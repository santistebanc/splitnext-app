/// <reference path="../types.d.ts" />
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { randomToken, sha256Hex } from '../_shared/crypto.ts';
import { GROUP_SELECT } from '../_shared/entities.ts';
import { healthPayload, isHealthRequest } from '../_shared/health.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { publishWake } from '../_shared/wake.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (isHealthRequest(req.method, req.url)) {
    return jsonResponse(healthPayload('join-group', Deno.env.get('DEPLOY_SHA')));
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const deviceUserId =
      typeof body.device_user_id === 'string' ? body.device_user_id : '';
    if (!token || !deviceUserId) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const supabase = serviceClient();
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, group_id, member_id, expires_at, redeemed_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError) {
      console.error('join-group invite', inviteError);
      return jsonResponse({ error: 'invite_lookup_failed' }, 500);
    }
    if (!invite) {
      return jsonResponse({ error: 'invite_unknown' }, 404);
    }
    if (invite.redeemed_at != null) {
      return jsonResponse({ error: 'invite_redeemed' }, 409);
    }
    if (Date.now() >= Date.parse(invite.expires_at)) {
      return jsonResponse({ error: 'invite_expired' }, 410);
    }

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, deleted_at')
      .eq('id', invite.member_id)
      .eq('group_id', invite.group_id)
      .maybeSingle();

    if (memberError) {
      console.error('join-group member', memberError);
      return jsonResponse({ error: 'member_lookup_failed' }, 500);
    }
    if (!member || member.deleted_at != null) {
      return jsonResponse({ error: 'member_missing' }, 404);
    }

    const { data: existingToken, error: existingError } = await supabase
      .from('access_tokens')
      .select('id')
      .eq('group_id', invite.group_id)
      .eq('device_user_id', deviceUserId)
      .is('revoked_at', null)
      .maybeSingle();

    if (existingError) {
      console.error('join-group existing token', existingError);
      return jsonResponse({ error: 'token_lookup_failed' }, 500);
    }
    if (existingToken) {
      return jsonResponse({ error: 'already_in_group' }, 409);
    }

    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from('invites')
      .update({ redeemed_at: now })
      .eq('id', invite.id)
      .is('redeemed_at', null)
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('join-group claim', claimError);
      return jsonResponse({ error: 'invite_claim_failed' }, 500);
    }
    if (!claimed) {
      return jsonResponse({ error: 'invite_redeemed' }, 409);
    }

    const accessToken = randomToken();
    const accessHash = await sha256Hex(accessToken);
    const { error: tokenError } = await supabase.from('access_tokens').insert({
      token_hash: accessHash,
      group_id: invite.group_id,
      device_user_id: deviceUserId,
    });

    if (tokenError) {
      console.error('join-group token', tokenError);
      return jsonResponse({ error: 'token_insert_failed' }, 500);
    }

    const bind = {
      id: crypto.randomUUID(),
      group_id: invite.group_id,
      device_user_id: deviceUserId,
      member_id: invite.member_id,
      version: 1,
      updated_at: now,
      deleted_at: null,
    };
    const { error: bindError } = await supabase.from('binds').insert(bind);
    if (bindError) {
      console.error('join-group bind', bindError);
      return jsonResponse({ error: 'bind_insert_failed' }, 500);
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('id', invite.group_id)
      .maybeSingle();

    if (groupError || !group) {
      console.error('join-group group', groupError);
      return jsonResponse({ error: 'group_lookup_failed' }, 500);
    }

    await publishWake({
      group_id: invite.group_id,
      entity_type: 'binds',
      id: bind.id,
      version: bind.version,
    });

    return jsonResponse({
      access_token: accessToken,
      group,
      bind: {
        id: bind.id,
        group_id: bind.group_id,
        device_user_id: bind.device_user_id,
        member_id: bind.member_id,
        version: bind.version,
        updated_at: bind.updated_at,
        deleted_at: bind.deleted_at,
      },
    });
  } catch (err) {
    console.error('join-group', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
