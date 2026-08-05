/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  BIND_SELECT,
  EXPENSE_SELECT,
  MEMBER_SELECT,
} from '../_shared/entities.ts';
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
    if (!groupId) {
      return jsonResponse({ error: 'invalid_body' }, 400);
    }

    const access = await resolveAccessToken(accessToken, groupId, deviceUserId);
    if (!access) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabase = serviceClient();
    const [membersRes, bindsRes, expensesRes] = await Promise.all([
      supabase.from('members').select(MEMBER_SELECT).eq('group_id', groupId),
      supabase.from('binds').select(BIND_SELECT).eq('group_id', groupId),
      supabase.from('expenses').select(EXPENSE_SELECT).eq('group_id', groupId),
    ]);

    if (membersRes.error) {
      return jsonResponse({ error: membersRes.error.message }, 500);
    }
    if (bindsRes.error) {
      return jsonResponse({ error: bindsRes.error.message }, 500);
    }
    if (expensesRes.error) {
      return jsonResponse({ error: expensesRes.error.message }, 500);
    }

    return jsonResponse({
      members: membersRes.data ?? [],
      binds: bindsRes.data ?? [],
      expenses: expensesRes.data ?? [],
    });
  } catch (err) {
    console.error('list-roster', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
