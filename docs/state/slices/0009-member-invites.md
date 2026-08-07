# Slice 0009 — member invites

**Tier** — core value · **Closed** — 2026-08-07 · **Tag** — `slice-0009`

## What shipped

A second device can join a group for the first time. Any device already in a group mints a one-time code against one named member; the person types it into **Join with code** on the lobby and arrives on the hub already being that member. No deep link — Expo Go cannot do HTTPS app links (D-003) — and no "which one am I?", because the code carries the answer.

## Report

### Headline

A group stopped being single-device: per-member invite codes let someone join an existing group — expenses and all — already bound to their own slot.

### Highlights

- **Invites are per member, not per group.** The code names the slot, so redeeming it binds with no picker and no chance of claiming the wrong person.
- **Joining works after the group has expenses.** `bindingIsOpen` (D-020) gates This-is-me only; filling an empty slot moves no claim and re-attributes nothing (D-034).
- **`redeem-invite` is the second endpoint that grants access without an access token**, after `create-group` — the code *is* the capability (D-036).
- **One-time under concurrency.** The invite is claimed by a conditional update whose row count decides the winner, before any token is minted; a failure afterwards releases it rather than burning it.
- **The self-review paid for itself**: both bind lookups used `.maybeSingle()`, which errors on more than one row — and D-014 makes several live binds per member legal, so the exact state the check exists to detect returned a 500 instead of `member_already_bound`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Second device | Could never join an existing group — no path existed | Mints a code per unclaimed member; a fresh device redeems it and gets its own access token + bind |
| Bind creation | `bindMe` only, closed for good by the first expense | `bindMe` unchanged; redemption is a separate server-side path gated on "is this slot free" |
| Hub member row | Name + This is me | + **Invite** on unclaimed members, revealing the code and its expiry inline |
| Lobby | Create group | + **Join with code** |
| Server | Access tokens minted only by `create-group` | `invites` table + `create-invite` / `redeem-invite` |

### Surfaces touched

- **Client** — `app/index.tsx` (join), `app/group/[id].tsx` (invite), `src/domain/inviteCode.ts` (new), `src/domain/assumedMember.ts`, `src/sync/groupSync.ts`, `src/api/edge.ts`, `src/types/syncError.ts`
- **Server** — `supabase/migrations/20260807071500_invites.sql`, `supabase/functions/create-invite`, `supabase/functions/redeem-invite`, `_shared/crypto.ts`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-034…036), `PARKING.md`, `docs/scripts/capture-flows.mjs`

### Decisions this slice

- D-034 — Invites are per member; redeeming binds regardless of expenses, `bindingIsOpen` gates This-is-me only
- D-035 — 8 characters from a 31-character alphabet with no O/0/I/1/L; hash only, one-time, 7-day expiry
- D-036 — `redeem-invite` grants access with no existing access token, the second endpoint to do so

### Logic delta

- **Added** — `L-memberClaimed` · `L-inviteCode` · `L-createInvite` · `L-redeemInvite` · `L-edgeCreateInvite` · `L-edgeRedeemInvite` · `L-efCreateInvite` · `L-efRedeemInvite` · `L-inviteAlphabet`
- **Changed** — `L-hub` (Invite button, code panel) · `L-lobby` (Join with code)

### Flow delta

- **Added** — `F-invite` · `F-join`

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `create-invite` / `redeem-invite` | member legitimately held by two devices (D-014) | **Was a 500.** Both bind lookups used `.maybeSingle()`, which errors on more than one row — so the very state the check exists to detect returned `internal`. Now `.limit(1)` on both. |
| `redeem-invite` | code of the wrong length | Rejected as `invalid_code` before any query. Only an empty code was caught before. |
| `redeem-invite` | two devices redeem the same code at once | The claim is a conditional `update … is('redeemed_at', null)` whose row count decides: one wins, the loser gets `already_redeemed` and no token is minted. |
| `redeem-invite` | two *different* codes for the same member redeemed at once | Both can pass, leaving one member on two devices. Allowed rather than raced-against — D-014 already permits it, and the unique index only protected one bind per *device*. |
| `redeem-invite` | bind inserts, token insert fails | Bind deleted, invite released. A bind with no token is a device in the roster that can never sync — worse than not joining. |
| `redeem-invite` | invite claimed, bind insert fails | Invite released to unredeemed, so a server failure never silently burns a one-time code. |
| `redeem-invite` | device already bound in this group | `already_joined` before anything is written — redeeming would strand the old bind or break D-021. |
| `redeem-invite` | member soft-deleted between mint and redeem | `member_gone`; binding would put a deleted person back on the roster. |
| `redeem-invite` | wrong code vs. deleted invite | Both answer `invalid_code`, so the endpoint is not an oracle for which codes exist. |
| `randomInviteCode` | — | Rejection sampling, not `% 31`: 256 is not a multiple of the alphabet, so plain modulo would bias early characters and shrink the keyspace. |
| Invite button | member already claimed by anyone | Absent — `memberHasLiveBind` is device-agnostic, so a slot someone else holds is not offerable here. |
| Invite button | group has expenses | Still shown. The point of the slice (D-034). |
| Hub | code minted, app reloaded | Gone — it lives in component state only; the server kept a hash, so re-showing it is impossible by construction. **New code** mints another; the old stays valid until it expires. |
| Lobby | code half-typed | Join disabled by `isWellFormedInviteCode`, so an incomplete code never becomes a failed round trip. |
| Lobby | join fails | Each server reason maps to a sentence about the code; the message clears on edit. |
| `redeemInvite` | roster pull or Realtime fails after joining | Swallowed — the token is saved and the group is in the lobby, so the hub opens and the next sync catches up. |
| `redeem-invite` | group soft-deleted | Not checked — no delete-group surface exists to reach it. Named as a known gap, not an assumption. |
| Invite codes | brute force | 31⁸ ≈ 8.5×10¹¹, one-time, 7-day — but nothing rate-limits redemption attempts (parked: **Invite rate limits**). |

### Shots

**Nothing could be captured: this environment has no Supabase credentials** (`.env.example` only, no `SUPABASE_*` vars), so the migration and both Edge Functions are undeployed and `npm run capture` has no backend to drive. `F-invite` and `F-join` are written into `docs/scripts/capture-flows.mjs` — `F-join` seeds its own second device and asserts the joiner arrives bound with no This-is-me — and record on the first run against a deployed stack. The slice therefore closes **without a demo gate**; its server path is verified by reading and by the pure-seam tests only.

### Diff pulse

`+1138 / −59 · 21 files` — from `git show --stat` at close
