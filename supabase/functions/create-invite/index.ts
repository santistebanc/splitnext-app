/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { randomInviteCode, sha256Hex } from '../_shared/crypto.ts';
import { bearerToken, serviceClient } from '../_shared/supabase.ts';

/** Long enough to hand over in person or by message; short enough to expire. */
const INVITE_TTL_DAYS = 7;

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
    const memberId = body.member_id as string | undefined;
    if (!groupId || !memberId) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    // Only someone already inside the group may invite into it.
    const access = await resolveAccessToken(accessToken, groupId, deviceUserId);
    if (!access) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = serviceClient();

    // The member must be live and in *this* group — the access check above
    // proves the caller's group, so this is what stops a crafted member_id
    // from minting an invite into somebody else's.
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, deleted_at')
      .eq('id', memberId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (memberError) {
      console.error('create-invite member lookup', memberError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    if (!member || member.deleted_at) {
      return jsonResponse({ error: 'member_not_in_group' }, 404);
    }

    // A member only ever needs one device to answer for them. Inviting a slot
    // someone already holds would either be a no-op or a way to hand their
    // identity to somebody else, so it is refused rather than defined.
    // `limit(1)`, not `maybeSingle()`: D-014 allows one member to be held by
    // several devices, so more than one live bind here is a legal state, and
    // maybeSingle would turn exactly the case we are testing for into a 500.
    const { data: existingBinds, error: bindError } = await supabase
      .from('binds')
      .select('id')
      .eq('member_id', memberId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .limit(1);

    if (bindError) {
      console.error('create-invite bind lookup', bindError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    if (existingBinds && existingBinds.length > 0) {
      return jsonResponse({ error: 'member_already_bound' }, 409);
    }

    const code = randomInviteCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabase.from('invites').insert({
      group_id: groupId,
      member_id: memberId,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('create-invite insert', insertError);
      return jsonResponse({ error: 'invite_insert_failed' }, 500);
    }

    // The only time the plaintext code exists outside the caller's screen.
    return jsonResponse({ code, expires_at: expiresAt });
  } catch (err) {
    console.error('create-invite', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
