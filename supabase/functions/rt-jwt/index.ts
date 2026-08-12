/// <reference path="../types.d.ts" />
import { resolveAccessToken } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { healthPayload, isHealthRequest } from '../_shared/health.ts';
import { bearerToken } from '../_shared/supabase.ts';

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64UrlEncode(new Uint8Array(sig))}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // The deploy probe, before any auth work: CI asserts every function reports
  // the merge sha, so a deploy that silently did nothing cannot pass green.
  if (isHealthRequest(req.method, req.url)) {
    return jsonResponse(healthPayload('rt-jwt', Deno.env.get('DEPLOY_SHA')));
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

    // Prefer legacy JWT secret when present (JWT_SECRET is injected on some runtimes;
    // SUPABASE_JWT_SECRET can be set via `supabase secrets set` after importing a key).
    const secret =
      Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET');

    const channel = `group:${groupId}`;
    if (!secret) {
      // Capability gate still enforced above. Client may subscribe with the anon key
      // on this channel until a mintable signing secret is configured.
      return jsonResponse({
        jwt: null,
        auth_mode: 'anon_channel',
        expires_in: 3600,
        channel,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const jwt = await signJwt(
      {
        role: 'authenticated',
        iss: 'supabase',
        iat: now,
        exp: now + 60 * 60,
        sub: deviceUserId,
        group_id: groupId,
      },
      secret,
    );

    return jsonResponse({
      jwt,
      auth_mode: 'minted_jwt',
      expires_in: 3600,
      channel,
    });
  } catch (err) {
    console.error('rt-jwt', err);
    return jsonResponse({ error: 'internal' }, 500);
  }
});
