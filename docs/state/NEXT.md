# Slice 0009 — member invites

**Tier** — core value (closes the multi-device gap: today no second device can ever join an existing group)

## Goal

Every member row on the hub gets its own one-time invite: mint a code scoped to that member, hand it to the person out-of-band, they type it into "Join with code" on a fresh device, and they land on the hub already bound as that member — no This-is-me tap, no deep link (Expo Go can't do HTTPS app links — D-003; deep-link hosting stays parked).

## Before → After

| | Now | After |
| --- | --- | --- |
| Second device | Can never join an existing group — no invite path exists at all | Any device holding the group can mint a per-member invite code; a second device redeems it via "Join with code" and gets its own access token + bind |
| Bind creation | `bindMe` is the only way to create a bind; gated by `bindingIsOpen`, which closes for good after the group's first expense (D-020) | `bindMe` / This-is-me is **unchanged**. Invite redemption creates a bind through a separate, server-side path gated only by "this member has no live bind yet" — expense history no longer blocks a brand-new member's first join, because nothing is being moved |
| Hub member row | Name + This-is-me | Name + This-is-me (unchanged) + **Invite** (only on members with no live bind), which reveals a one-time code + "expires in 7 days" |
| Lobby | Create group only | Create group + **Join with code** |
| Server | `access_tokens` minted only by `create-group` | New `invites` table + `create-invite` / `redeem-invite` Edge Functions; `redeem-invite` mints a fresh access token and inserts the bind row directly, the same shape `create-group` uses for the token |

## New decision (refines D-020, reverses nothing)

D-020's expense gate was written to stop a device *moving* an already-established claim after money is attributed — "every member stays offerable... afterwards moving a bind would silently re-attribute." An invite never browses a list of options and never moves an existing claim: the target member is fixed the moment the code is minted. So invite redemption gets its own gate — "is this member currently unbound" — independent of whether the group has expenses. `bindMe`/This-is-me keeps D-020 exactly as tested in slice 0005. Recorded as `D-034` at close.

## Plan

1. Migration — `invites` table: `id`, `group_id`, `member_id`, `code_hash`, `created_at`, `expires_at`, `redeemed_at`, `redeemed_by_device_user_id`; deny-all RLS, same shape as `access_tokens`/`members`/`binds`.
2. `randomInviteCode` in `supabase/functions/_shared/crypto.ts` — 8 chars from an unambiguous alphabet (no `0/O/1/I/L`), shown hyphenated (`XXXX-XXXX`).
3. `create-invite` Edge Function — capability-checked via existing `resolveAccessToken`; validates the member is live and in this group; mints + hashes the code; `expires_at = now + 7d`; returns the plaintext code once (never stored plaintext, same discipline as access tokens).
4. `redeem-invite` Edge Function — no existing access token required (bootstrap endpoint, like `create-group`). Order: look up by hash → `invalid_code` if missing; `expired` / `already_redeemed` from its own fields; confirm member still live → `member_gone`; confirm member currently has no live bind → `member_already_bound`; confirm this device doesn't already hold a live bind in this group → `already_joined`; **atomically** consume (`UPDATE invites SET redeemed_at = now() WHERE id = $id AND redeemed_at IS NULL`, checking rows affected) so a double-submit can't redeem twice; mint a fresh access token; insert the bind row directly at version 1; wake the group so any already-open device sees the join live.
5. `L-createInvite` / `L-redeemInvite` jobs in `src/sync/groupSync.ts`; `createInviteRemote` / `redeemInviteRemote` in `src/api/edge.ts`.
6. `memberHasLiveBind` — pure predicate in `src/domain/assumedMember.ts` — gates the Invite button.
7. `normalizeInviteCode` — pure function in new `src/domain/inviteCode.ts` — trims/uppercases/strips separators so "abcd-1234", "ABCD1234", " abcd1234 " all reach the server identically.
8. Hub — "Invite" button per unbound member row; tapping reveals the one-time code + expiry inline (no share sheet, no clipboard chrome — just selectable text to relay however).
9. Lobby — "Join with code" field + button; on success adds the group to this device's lobby and opens the hub, already bound.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `memberHasLiveBind` — `src/domain/assumedMember.ts` | True only when a non-deleted bind currently references the member; ignores soft-deleted binds |
| `normalizeInviteCode` — `src/domain/inviteCode.ts` | Same normalized code for mixed case, surrounding whitespace, and with/without separators |

Server-side invite logic (expiry, one-time-use, the gating order in `redeem-invite`) has no vitest seam, consistent with every other Edge Function in this repo (`shouldAccept`, `create-group` aren't vitested either) — verified by the capture flow and the demo gate against the real deployed functions.

## Acceptance

- On a group that already has an expense, tapping Invite on an unbound member yields a code. Entering that code as "Join with code" on a second, fresh browser context grants access, adds the group to that device's lobby, and opens the hub already showing "You (Name)" for that member — no This-is-me tap.
- Redeeming the same code twice: second attempt fails `already_redeemed`.
- A code minted for a member who gets bound (by anyone) before redemption fails `member_already_bound`.
- `bindMe`/This-is-me behavior is unchanged — still closes after the group's first expense.
- Full suite + typecheck green; `npm run web` drives create → member → expense → invite → (fresh context) join → hub bound.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `create-invite` / `redeem-invite` | member legitimately held by two devices (D-014) | **Was a 500.** Both bind lookups used `.maybeSingle()`, which errors on more than one row — so the very state the check exists to detect turned "member already bound" into `internal`. Now `.limit(1)` on both. |
| `redeem-invite` | code of the wrong length | Rejected as `invalid_code` before any query. Only an empty code was caught before, so a 3- or 40-character string cost a hash and a round trip to reach the same answer. |
| `redeem-invite` | two devices redeem the same code at once | Both read `redeemed_at` as null, but the claim is a conditional `update … is('redeemed_at', null)` whose row count decides: one wins, the loser gets `already_redeemed` and no token is ever minted for it. |
| `redeem-invite` | two *different* codes for the same member redeemed at once | Both can pass, leaving one member held by two devices. Allowed rather than raced-against, because D-014 already permits exactly that; the unique index only ever protected one bind per *device*. |
| `redeem-invite` | bind inserts, access token insert fails | Bind is deleted and the invite released, so the code still works. A bind with no token would put a device in the roster that can never sync — worse than not joining. |
| `redeem-invite` | invite claimed, bind insert fails | Invite released back to unredeemed, so a server-side failure never silently burns somebody's one-time code. |
| `redeem-invite` | device already bound in this group | `already_joined` before anything is written — redeeming would strand the old bind or break one-bind-per-device (D-021), and the code was almost certainly meant for a different phone. |
| `redeem-invite` | member soft-deleted between mint and redeem | `member_gone`. The code named a slot that no longer exists; binding to it would put a deleted person back on the roster. |
| `redeem-invite` | wrong code vs. deleted invite | Both answer `invalid_code`, deliberately — distinguishing them would make the endpoint an oracle for which codes exist. |
| `randomInviteCode` | — | Rejection sampling, not `% 31`: 256 is not a multiple of the alphabet, so plain modulo would bias the first few characters and quietly shrink the keyspace. |
| Invite button | member already claimed by anyone | Button is absent — `memberHasLiveBind` is device-agnostic, so a slot someone else holds is not offerable here either. |
| Invite button | group has expenses | Still shown. This is the whole point of the slice: `bindingIsOpen` gates *changing your mind*, not *filling an empty slot* (D-034). |
| Hub | code minted, app reloaded | Code is gone — it lives in component state only. The server holds a hash, so re-showing it is impossible by construction; **New code** mints a fresh one and the old invite stays valid until it expires. |
| Lobby | code half-typed | Join button disabled by `isWellFormedInviteCode`, so an incomplete code never becomes a failed round trip. |
| Lobby | join fails | Each server reason maps to a sentence about the code, not a raw error string; the message clears as soon as the field is edited. |
| `redeemInvite` | roster pull fails after joining | Swallowed — the token is saved and the group is in the lobby, so the hub opens and the next sync catches up. Joining succeeded; the pull is a head start. |
| `redeemInvite` | Realtime unavailable | Swallowed, same as opening any group: live updates are a bonus, not a gate on joining. |
| `redeem-invite` | group soft-deleted | Not checked — no delete-group surface exists yet, so there is no way to reach it. Named here so it is a known gap rather than an assumption. |
| Invite codes | brute force | 31⁸ ≈ 8.5×10¹¹, one-time and 7-day, but **nothing rate-limits redemption attempts** (parked: **Invite rate limits**). Acceptable at this keyspace; it is the parked item that closes it properly. |

## Out of scope

- HTTPS deep link / `.well-known` hosting for invites (parked: **Deep link hosting**, **Invite URL path** — needs a dev build, not Expo Go, per D-003)
- Native share sheet / SMS / clipboard chrome — code is shown as plain selectable text
- Rate limiting invite creation or redemption attempts (parked: **Invite rate limits**)
- Revoking, listing, or early-expiring an outstanding invite
- Group-wide (non-per-member) invite link (parked: **Group-wide invite UI**)
- Letting a member that's already bound gain a *second* shared device via invite (D-014 already allows sharing in general; this slice's invite path specifically requires the target member be unbound — reinviting an already-claimed member is a future, deliberate "share my slot" feature, not this one)

## Parked this session

- (none new — this session's parking was resolved into the plan itself, not deferred)
