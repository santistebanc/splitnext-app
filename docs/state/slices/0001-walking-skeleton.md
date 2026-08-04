# Slice 0001 — walking skeleton

**Tier** — foundation-risk · **Closed** — 2026-08-05 · **Commit** — `slice(0001): walking skeleton`

## What shipped

End-to-end path: Lobby create empty group → Legend/SQLite persist → `create-group` mints access token → Group hub sync status → bump name flushes `merge` → Realtime wake → `fetch-entity` apply by version. Phone demo via Expo Go confirmed.

## Questions asked and answered

- Remote vs local Supabase → remote `splitnext-v3` (D-001)
- Fresh project vs reuse → fresh (D-001)
- Token storage → Secure Store (D-002)
- Demo runtime → Expo Go on phone (D-003)
- Skeleton UI shape → Lobby create + hub sync proof
- First token mint → separate `create-group` (D-004)
- Repo layout → app root + `supabase/` (D-005)

## What was parked during this slice

- Missed-wake / reconnect flush → PARKING foundation-risk
- Members, binds, expenses, invites, activity, balances → PARKING
- Lobby ids out of Secure Store → PARKING polish
- Mintable Realtime JWT secret (leave anon_channel) → PARKING foundation-risk

## Notes

- Create inserts group at v1 via `create-group`; merge→wake→fetch is exercised by hub **Bump name** (avoids v1 merge reject).
- Edge function named `fetch-entity` (not `fetch`) after gateway HTML/502 issues with slug `fetch`.
- `rt-jwt` returns `anon_channel` until a signing secret is configured (D-006).
- Code review: duplicate `fetch` removed at close; flush-order helpers unused in prod until more entity types; `groupSync.ts` is a fat orchestration module (acceptable for skeleton).
