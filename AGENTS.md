# Working on this repo (agent entry point)

This file is the contract for any AI agent working here — Claude Code, Codex, Cursor, anything that reads `AGENTS.md`. Read it before touching code. `CLAUDE.md` is a one-line import of this file.

## What this is

A local-first mobile app for splitting shared costs among friends: groups, name-slot members, expenses with allocations, derived balances. It records and suggests; it never moves money. There are no user accounts — a per-device capability token proves access to a group.

**`docs/state/OVERVIEW.md` is the current-state description of the app.** Read it first; it beats anything you infer from the tree. `docs/state/LOGIC.md` catalogues every behaviour piece (`L-` ids) and `docs/state/FLOWS.md` describes the end-to-end flows (`F-` ids) that cite them.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code. Older Expo answers from memory are wrong here.

## How work happens: the slicer loop

The app is built one **slice** at a time — a narrow but complete path through every layer (schema, logic, UI, tests) that runs and can be demoed on its own. The full process lives in [`.claude/skills/slicer/SKILL.md`](.claude/skills/slicer/SKILL.md), with templates in `references/templates.md` and board rules in `references/board.md`. Follow it rather than inventing a workflow.

The short version:

1. Pick the next slice risk-first (foundation-risk > core value > breadth > polish) from `docs/state/PARKING.md`, proposing candidates rather than choosing silently.
2. Interview only about that slice. Everything further out goes to `PARKING.md` verbatim — recorded, not resolved.
3. Write `docs/state/NEXT.md` (Now → After, plan, acceptance, seams under test, out of scope) and get a yes before building.
4. Build to the quality bar (reviewed at close by this repo's own `/code-review`, in `.claude/skills/code-review/`): seams first, tests on the seams (`.claude/skills/tdd/SKILL.md`), small interfaces over fat orchestrators, self-review written into `NEXT.md` under `## Edge paths`.
5. Demo it, capture it (`npm run capture`), then close: review, update `OVERVIEW.md` / `LOGIC.md` / `FLOWS.md`, archive to `docs/state/slices/NNNN-name.md`, append `D-NNN` decisions, groom parking, regenerate the board.

**Minimize scope, not quality.** Slices stay thin so the app can be steered; inside a slice, correctness and design matter more than speed.

## Git: PR per slice

A slice is a branch → PR → **squash** merge → annotated tag `slice-NNNN` on `main`. Commit freely on the branch; `main` reads one line per slice. The full rules — what goes in the PR body, why the tag lands after the merge — are in the [slicer skill](.claude/skills/slicer/SKILL.md#git--pr-per-slice-this-repo); three things are non-negotiable here:

- **Never push to `main` directly**, and never merge a slice PR with `--merge` or `--rebase`. Squash is the only enabled merge method and the repo enforces it.
- **CI is the gate**: `npm run check` — run it before you push, not after CI tells you.
- **One slice opens one PR.** Squash-only enforces one commit per PR, not per slice; two PRs under one slice number is two commits on `main` and a slice you can no longer revert.
- **`docs/slicer.html` is generated and gitignored** — regenerate it, never hand-edit or hand-merge it.

Merging `main` republishes the board and the web app to GitHub Pages.

## Commands

| Command | What it does |
| --- | --- |
| `npm run check` | **The merge gate**: `test` + `typecheck` + `test:board` + `audit`, in that order. CI runs exactly this. |
| `npm test` | Vitest, the seam tests. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test:board` | Python tests for the board generator — parsers, call graph, hunk attribution. |
| `npm run audit` | Audits `docs/state/` against the code and git: dangling ids, moved paths, missing captures, stale flow clips, missing tags, thin archives. Findings fail; notes do not. |
| `npm start` | Expo dev server (phone via Expo Go). |
| `npm run web` | Runs the whole app in a browser — the target headless runs and captures use. |
| `npm run capture` | Drives the web target through every flow in `FLOWS.md`, writing clips to `docs/state/shots/flows/`. Needs `npm run web` already serving. Add flow ids to record only those. |
| `npm run capture:board` | Still-shoots the board itself for a slice that changed it. Needs `npm run board:serve` already serving. |
| `npm run board` | Regenerates `docs/slicer.html` from `docs/state/`. |
| `npm run board:serve` | Regenerates, then serves the board at http://127.0.0.1:8777/slicer.html, where a path chip opens the file in the editor instead of on GitHub. Localhost-only and token-gated; `-- --lan` binds wider. |
| `npx expo export -p web` | The static build CI publishes to `/app` on Pages. |

## Setup

`cp .env.example .env` and fill in the Supabase URL and anon key. Never commit `.env`; never put a service-role key anywhere in the client — Edge Functions hold it server-side.

## Invariants that are not negotiable

- **Money is integer cents.** No floats, anywhere, ever.
- **Conflicts resolve by `version`, not timestamps.** Incoming wins only when strictly newer.
- **Soft-delete only** (`deleted_at`); nothing referenced is ever hard-deleted.
- **Clients never talk to Postgres.** Deny-all RLS; Edge Functions use the service role after a capability hash-check.
- **An expense's allocations live inside the expense**, so one version covers the whole split (D-024).
- **Splits are deterministic across devices** — dedupe, sort by member id, remainder cents in that order (D-025).
- Decisions are append-only in `docs/state/DECISIONS.md`. If you contradict a `D-NNN`, say so and add a new one; do not quietly reverse it.
