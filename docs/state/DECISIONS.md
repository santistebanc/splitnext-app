# Decisions

| Id | Decision | Made in | Why |
| --- | --- | --- | --- |
| D-001 | Use remote Supabase project `splitnext-v3` (`ycpkguwfxlhpovnsuujr`, eu-central-1); do not reuse legacy `splitnext` | bootstrap | Fresh empty project matching locked architecture; old project has incompatible schema/functions |
| D-002 | Store access tokens (and device_user_id) in `expo-secure-store` | bootstrap | Long-lived capability secrets; OS keychain/keystore over plain KV |
| D-003 | Dev/demo on physical phone via Expo Go | bootstrap | Real mobile path from WSL; web SQLite is alpha; Expo Go cannot do HTTPS app links (invites later need a dev build) |
| D-004 | Separate `create-group` Edge Function mints first access token; `merge`/`fetch`/`rt-jwt` require it | slice 0001 | Create cannot call merge before a token exists |
| D-005 | Expo app at repo root; `supabase/` alongside | slice 0001 | No monorepo until a second package appears |
| D-006 | `rt-jwt` falls back to `auth_mode: anon_channel` when no mintable JWT secret is configured | slice 0001 | New Supabase projects use ES256 signing keys; legacy JWT secret is not injected into Edge Functions. Capability check still gates subscription; private minted JWT when `JWT_SECRET`/`SUPABASE_JWT_SECRET` is set |
| D-007 | Fetch Edge Function slug is `fetch-entity` (not `fetch`) | slice 0001 | Slug `fetch` produced intermittent HTML/502 responses that broke client JSON parsing |
| D-008 | Create path inserts group via `create-group`; merge→wake→fetch proven via hub bump | slice 0001 | Post-create merge at v1 would be rejected (`version_not_greater`); bump exercises the sync loop |
