# Slice 0053 — activity join/leave/group-rename events

**Tier** — foundation-risk (completes the activity spine; server-emitted events are new)

## Goal

The activity feed shows when someone joined via invite, when someone left, and when the group was renamed — not just expense and member-kick events.

## Before → After

| | Now | After |
| --- | --- | --- |
| Activity kinds | `expense_added/edited/deleted`, `member_kicked/renamed` | + `member_joined`, `member_left`, `group_renamed` |
| Join endpoint | Mints token + bind; no activity | Also inserts a `member_joined` activity via merge |
| Leave endpoint | Revokes token + tombstones bind; no activity | Also inserts a `member_left` activity via merge |
| Client `updateGroup` | Queues group entity | Also queues a `group_renamed` activity |
| Feed / push | Only five kinds | All eight kinds formatted and pushed |

## Plan

1. Add `'member_joined' | 'member_left' | 'group_renamed'` to `ActivityKind` (types + domain).
2. Server: `handleJoin` inserts a `member_joined` activity after successful join; `handleLeave` inserts a `member_left` activity after successful leave. Both go through the DO's merge path so version/wake work.
3. Server merge validation: add kinds to the allowed sets (`MEMBER_ACTIVITY_KINDS` for join/left, new `GROUP_ACTIVITY_KINDS` for `group_renamed`).
4. Client: `updateGroup` queues a `group_renamed` activity (like `updateMember` queues `member_renamed`).
5. Format: `ActivityLineText` + `formatActivityLinePlain` + `pushTitleForKind` handle the three new kinds.
6. Tests at domain + merge + contract levels.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-formatActivityLine` | New kinds produce correct `who` + `description` lines |
| `mergeOne` (server) | Accepts `member_joined`, `member_left`, `group_renamed`; rejects invalid |
| HTTP contract | Join creates a `member_joined` activity visible in roster; Leave creates `member_left` |

## Acceptance

- `npm run check` passes.
- Join an invite → roster includes a `member_joined` activity for that member.
- Leave a group → roster includes a `member_left` activity.
- Rename a group → activity feed shows "You renamed Trip".

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| | | *(filled during build)* |

## Out of scope

- Undo of join/leave/rename (not meaningful)
- Hub recent section redesign
- Activity toast for these kinds (already works via `activitiesFromOthers`)

## Parked this session

- Undo of edit/rename — breadth
