/// <reference path="../types.d.ts" />
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { randomToken, sha256Hex } from '../_shared/crypto.ts';
import { GROUP_SELECT } from '../_shared/entities.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { publishWake } from '../_shared/wake.ts';

/**
 * Trade an invite code for access to its group.
 *
 * A bootstrap endpoint, like `create-group`: the whole point is that the
 * caller has no access token yet, so the code itself is the capability. It is
 * therefore the one place that mints access without an existing one, and every
 * gate below is load-bearing.
 */

/** Must match `INVITE_CODE_ALPHABET` in `src/domain/inviteCode.ts`. */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;

/**
 * The client normalizes before sending; this repeats it rather than trusting
 * it, so a code that works when typed cannot fail when replayed by anything
 * that skipped the client.
 */
function normalizeCode(raw: string): string {
  let out = '';
  for (const ch of raw.toUpperCase()) {
    if (INVITE_ALPHABET.includes(ch)) out += ch;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await req.json();
    const deviceUserId = (req.headers.get('x-device-user-id') ??
      body.device_user_id) as string | undefined;
    const rawCode = body.code as string | undefined;

    if (!deviceUserId || typeof rawCode !== 'string') {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    // A code of the wrong length can never hash to a minted one, so answer
    // before touching the database rather than after a pointless round trip.
    const code = normalizeCode(rawCode);
    if (code.length !== INVITE_LENGTH) {
      return jsonResponse({ error: 'invalid_code' }, 404);
    }

    const supabase = serviceClient();
    const codeHash = await sha256Hex(code);

    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, group_id, member_id, expires_at, redeemed_at')
      .eq('code_hash', codeHash)
      .maybeSingle();

    if (inviteError) {
      console.error('redeem-invite lookup', inviteError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    // A wrong code and a deleted one are the same answer on purpose: telling
    // them apart would turn this into an oracle for which codes exist.
    if (!invite) {
      return jsonResponse({ error: 'invalid_code' }, 404);
    }
    if (invite.redeemed_at) {
      return jsonResponse({ error: 'already_redeemed' }, 409);
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ error: 'expired' }, 410);
    }

    const groupId = invite.group_id as string;
    const memberId = invite.member_id as string;

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, deleted_at')
      .eq('id', memberId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (memberError) {
      console.error('redeem-invite member lookup', memberError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    if (!member || member.deleted_at) {
      return jsonResponse({ error: 'member_gone' }, 410);
    }

    // The slot may have been claimed between minting and redeeming — someone
    // tapped This-is-me on it, or an earlier invite for the same member was
    // redeemed first. Either way this code is now for a person who is already
    // here, and quietly adding a second claimant would be worse than refusing.
    // `limit(1)`, not `maybeSingle()`: D-014 allows one member to be held by
    // several devices, so more than one live bind here is a legal state, and
    // maybeSingle would turn exactly the case we are testing for into a 500.
    const { data: memberBinds, error: memberBindError } = await supabase
      .from('binds')
      .select('id')
      .eq('member_id', memberId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .limit(1);

    if (memberBindError) {
      console.error('redeem-invite member bind lookup', memberBindError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    if (memberBinds && memberBinds.length > 0) {
      return jsonResponse({ error: 'member_already_bound' }, 409);
    }

    // This device is already someone in this group. Redeeming would either
    // strand its old bind or violate one-bind-per-device (D-021), and the
    // person almost certainly opened a code meant for somebody else's phone.
    const { data: deviceBind, error: deviceBindError } = await supabase
      .from('binds')
      .select('id')
      .eq('group_id', groupId)
      .eq('device_user_id', deviceUserId)
      .is('deleted_at', null)
      .maybeSingle();

    if (deviceBindError) {
      console.error('redeem-invite device bind lookup', deviceBindError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    if (deviceBind) {
      return jsonResponse({ error: 'already_joined' }, 409);
    }

    // Claim the invite before granting anything. The `is('redeemed_at', null)`
    // predicate is what makes this one-time under concurrency: two taps racing
    // both read null above, but only one update matches, and the loser sees no
    // rows and is turned away without a token ever being minted.
    const { data: claimed, error: claimError } = await supabase
      .from('invites')
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by_device_user_id: deviceUserId,
      })
      .eq('id', invite.id)
      .is('redeemed_at', null)
      .select('id');

    if (claimError) {
      console.error('redeem-invite claim', claimError);
      return jsonResponse({ error: 'internal' }, 500);
    }
    if (!claimed || claimed.length === 0) {
      return jsonResponse({ error: 'already_redeemed' }, 409);
    }

    /** Hand the invite back if we cannot finish, so a failure costs no code. */
    const releaseInvite = async () => {
      const { error } = await supabase
        .from('invites')
        .update({ redeemed_at: null, redeemed_by_device_user_id: null })
        .eq('id', invite.id);
      if (error) {
        console.error('redeem-invite release failed', error, invite.id);
      }
    };

    const bindId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: bindInsertError } = await supabase.from('binds').insert({
      id: bindId,
      group_id: groupId,
      device_user_id: deviceUserId,
      member_id: memberId,
      version: 1,
      updated_at: now,
      deleted_at: null,
    });

    if (bindInsertError) {
      console.error('redeem-invite bind insert', bindInsertError);
      await releaseInvite();
      return jsonResponse({ error: 'bind_insert_failed' }, 500);
    }

    const accessToken = randomToken();
    const tokenHash = await sha256Hex(accessToken);
    const { error: tokenError } = await supabase.from('access_tokens').insert({
      token_hash: tokenHash,
      group_id: groupId,
      device_user_id: deviceUserId,
    });

    if (tokenError) {
      console.error('redeem-invite token insert', tokenError);
      // Undo the bind too: a bind with no token is a device that appears in
      // the roster but can never sync, which is worse than not joining.
      await supabase.from('binds').delete().eq('id', bindId);
      await releaseInvite();
      return jsonResponse({ error: 'token_insert_failed' }, 500);
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('id', groupId)
      .maybeSingle();

    if (groupError || !group) {
      console.error('redeem-invite group lookup', groupError);
      return jsonResponse({ error: 'internal' }, 500);
    }

    // Tell the devices already in the group that someone joined, so the new
    // member shows up without anyone reopening the screen.
    await publishWake({
      group_id: groupId,
      entity_type: 'binds',
      id: bindId,
      version: 1,
    });

    return jsonResponse({
      access_token: accessToken,
      group,
      member_id: memberId,
    });
  } catch (err) {
    console.error('redeem-invite', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
