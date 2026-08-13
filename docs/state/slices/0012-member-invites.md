# Slice 0012 — member invites

**Tier** — core-value · **Closed** — 2026-08-13 · **Tag** — `slice-0012`

## What shipped

A device that already has a group can mint a one-use 7-day invite for a named member. A second device redeems it (`/join?token=` or lobby paste), lands already bound to that member, and never sees **This is me**.

## Report

### Headline
A second device can join a group as a named member — mint a one-use link on that row, redeem it, already You (Name).

### Highlights
- **`L-efMintInvite` / `L-efJoin`** — hashed invite row names the member; redeem mints an access token and a v1 bind. `member_id` is not a redeem argument.
- **`L-inviteIsLive` / `L-parseInviteToken`** — 7-day, one-use, live member; paste accepts a raw token or a `/join?token=` URL.
- **Hub / lobby / `/join`** — **Invite** on every member except You; lobby paste; join route auto-redeems.
- **`FUNCTIONS`** — `mint-invite` and `join-group` added so CI deploys and health-checks them (D-052).
- Live redeem waits on merge: the functions 404 until this PR lands. `F-invite` / `F-join` named unrecorded.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Second device | Cannot get in | Redeems a one-use invite into a new access token and a bind |
| Invite | None | Hashed row: `group_id`, `member_id`, `expires_at`, `redeemed_at` |
| Hub | Add member / This is me | **Invite** on members who are not You; creator **This is me** unchanged |
| Lobby | Create only | Paste + **Join group**; `/join?token=` |

### Logic delta

- **Added** — `L-join` · `L-inviteIsLive` · `L-parseInviteToken` · `L-mintInvite` · `L-inviteShare` · `L-joinGroup` · `L-edgeMintInvite` · `L-edgeJoin` · `L-efMintInvite` · `L-efJoin`
- **Changed** — `L-lobby` · `L-hub` · `L-initLocalGroup`

### Flow delta

- **Added** — `F-invite` (unrecorded — needs `mint-invite` on the server) · `F-join` (unrecorded — needs `join-group` plus a second device)
- **Changed** — `F-create` · `F-add-member` · `F-bind` (hub/lobby chrome; clips re-recorded)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-inviteIsLive` | Unredeemed, future `expires_at`, live member | Live. Covered by test. |
| `L-inviteIsLive` | `redeemed_at` set | Dead, even if expiry is still in the future. Covered by test. |
| `L-inviteIsLive` | `expires_at` equal to `now` | Dead. Covered by test. |
| `L-inviteIsLive` | Named member tombstoned | Dead. Covered by test. |
| `L-parseInviteToken` | Empty / `/join` with no token | `null`. Covered by test. |
| `L-efMintInvite` | Missing or tombstoned member | `member_missing` 404. No row written. |
| `L-efJoin` | Unknown / redeemed / expired | 404 / 409 / 410. Expired and unknown do not consume. |
| `L-efJoin` | This device already has a live token | `already_in_group` 409. Invite not consumed. |
| `L-efJoin` | Bind insert fails after the invite is claimed | Invite is spent and no bind exists. Rare; not retried. |
| `L-join` | `/join` with no `token` | Screen shows `invite_invalid`. |
| `L-hub` | This device already has an assumed member | **Invite** is hidden on that You row. Other members still offer it. |
| `F-invite` / `F-join` | Functions not on the remote yet | D-052: they deploy on merge. Named unrecorded. |

### Review

- **Invariants** — clean. D-020 not reversed: join writes a first bind for a new device; **This is me** still closes after the first expense. D-052 kept: no hand-deploy; the two functions are on `FUNCTIONS`.
- **Spec** — fixed before close: native copy is the raw token (`L-inviteShare` `.web.ts` split, D-023); a failed mint clears the previous join link. Accepted: `F-invite` / `F-join` clips wait on merge; empty lobby paste is a no-op rather than `invite_invalid`.
- **Standards** — fixed the hub `window` / `navigator` origin branch by moving share text behind `inviteShareText` / `inviteShareText.web.ts`. Accepted: `join-group` inlines the three live-checks (Deno cannot import `src/`; distinct HTTP statuses). Removed unused `join_failed`.

### Shots

- Re-recorded `flows/F-create.webm`, `flows/F-add-member.webm`, `flows/F-bind.webm` (lobby paste + Invite on the member row).
- `F-invite` / `F-join` named in `capture-flows.mjs` as unrecorded rather than silently absent.

### Surfaces touched

- **Client** — `app/join.tsx`, `app/index.tsx`, `app/group/[id].tsx`, `src/sync/invite.ts`, `src/sync/inviteShareText.ts`, `src/domain/invite.ts`, `src/api/edge.ts`
- **Server** — `supabase/migrations/20260813000100_invites.sql`, `mint-invite`, `join-group`; `FUNCTIONS` list
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, this archive, `DECISIONS.md` (D-056, D-057), `PARKING.md`

### Decisions this slice

- D-056 — Invite is per-member; redeem writes the bind on the server
- D-057 — Join is `/join?token=` plus lobby paste, not HTTPS app links

### Diff pulse

`+912 / −30 · 30 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Invite as a one-use 7-day hashed code, redeemed into a new access token?** → Yes.
- **Join via `/join` plus lobby paste — not app links?** → Yes.
- **First bind stays open for a device that has none?** → No. The join link already names the member; redeem binds them; **This is me** does not appear for joiners.
- **Dev remote so an unmerged slice can be demoed?** → Parked as the next slice. Prod stays merge-only (D-052).

## What was parked during this slice

- Dev remote, prod still merge-only → PARKING (foundation-risk; next slice)
- HTTPS app links / `.well-known` / `splitnext.online` → PARKING
- Invite rate-limit counts → PARKING
- Group-wide invite, joiner picker / add-new, claimed exclusive slot → PARKING

## Notes

- Tag `slice-0012` lands on `main` after the squash merge, not on the branch tip.
- This branch is off `main` at slice 0010. Slice 0011's PR was still open when 0012 started; rebase if 0011 merges first.
- After merge, re-record `F-invite` and `F-join` (two Playwright contexts) — the capture driver already names them.
