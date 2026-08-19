# Slice 0052 — invite status / resend

**Tier** — core-value

## Goal

On an unclaimed member, the person sees whether the last invite is **Active**, **Expired**, or **Used**, and can **Resend** to mint a fresh link instead of silently minting on every open.

## Before → After

| | Now | After |
| --- | --- | --- |
| Member invite row | Auto-mints on open; link or empty, no status | Lists server metadata; shows status; link when this device has a cached token or after Resend |
| Server | `mint-invite` only | `list-member-invites` returns per-member invite metadata (no secrets) |
| Device | Plaintext secret not stored | Cached in secure storage while the invite is still live |

## Plan

1. **`L-efListMemberInvites`** — D1 query by `group_id` + `member_id`; capability check; return `expires_at` / `redeemed_at` ordered newest-first plus `member_deleted_at`.
2. **`L-edgeListMemberInvites` / `L-listMemberInvites`** — client fetch job; clear cached token when nothing live.
3. **`L-inviteStatus`** — pure helper on `InviteView` rows (active / expired / used / none).
4. **`L-memberDetail`** — load status on open; show label; **Resend invite** calls `L-mintInvite` and caches token; copy/share when link present.
5. Tests at `L-inviteStatus` and HTTP contract; update `LOGIC.md` / `FLOWS.md`.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-inviteStatus` | Latest row: live → active; redeemed → used; past `expires_at` → expired; empty → none |
| `L-efListMemberInvites` | Auth required; returns minted rows after `mint-invite`; empty for member with none |
| `L-mintInvite` | Resend stores token in secure storage; list refresh clears cache when invite spent |

## Acceptance

- Run `npm run check`.
- Open an unclaimed member on the hub: status shows **Active** after Resend; copy works; after join on another profile, status is **Used** and Resend mints a new link.
- Contract test covers `list-member-invites` beside existing mint/join test.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| | | *(filled during build)* |

## Out of scope

- Invite copy/share sheet polish — parked
- Hub names-row Invite shortcut — parked
- Auto-mint on first open without Resend tap — deliberate; person chooses Resend

## Parked this session

- Activity join/leave events — breadth
- Per-group push mute — polish
