# Slice 0054 — flow assertions for new activity kinds

**Tier** — foundation-risk

## Goal

Capture-driven flow checks assert the new activity behavior introduced in 0053, so regressions are caught in CI without needing a second device.

## Before → After

| | Now | After |
| --- | --- | --- |
| `F-bump` capture flow | Asserts hub title rename only | Also asserts Activity feed includes group-rename event text |
| Coverage of 0053 in capture | Join/leave/rename activity kinds covered by unit/contract tests | Group-rename event also covered by browser flow assertion |

## Plan

1. Extend `F-bump` in `docs/scripts/capture-flows.mjs` to open Activity and assert `renamed the group`.
2. Keep the assertion text-based and robust across actor label (`You` or member name).
3. Run targeted capture assert-only for `F-bump`.
4. Keep scope narrow: no multi-profile orchestration in this slice.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `F-bump` capture flow | Renaming a group is visible in Activity as a group-rename line |

## Acceptance

- Run `npm run capture -- F-bump --assert-only`; it passes clean.
- Run `npm run check`; it stays green.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `F-bump` | Activity overlay fails to open after rename | Flow records a failing problem line and exits non-zero |

## Out of scope

- Multi-device capture for join/leave
- Undo on hub recent list
- Capture taxonomy refactor

## Parked this session

- Multi-profile flow capture harness for invite join/leave — foundation-risk
