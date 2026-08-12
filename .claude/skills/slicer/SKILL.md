---
name: slicer
description: Build a feature or a whole app slice by slice — thin scope, high quality inside each slice. Ask only enough to unblock the next slice, build it well (seams + TDD + review), demo it, commit it, then re-steer. Park everything else. Use when starting an app or feature from scratch, or when the user invokes /slicer.
disable-model-invocation: true
---

# Slicer

An app is built one **slice** at a time. A slice is a narrow but complete path through every layer — schema, logic, UI, tests — that runs and can be demoed on its own. Slicer's job is to land the **next slice well**, then re-steer, until the app exists.

The discipline is not "plan less". It is **plan exactly one slice deep**. Everything the user says that belongs further out is *recorded* and *deferred* — never resolved, never questioned further, until the slice that needs it arrives.

## Quality bar (non-negotiable)

**Minimize scope, not quality.** Slices stay thin so the app can be steered. Inside a slice, quality and thought matter more than speed.

- **Scope** — smallest vertical path that proves the claim. Park everything else.
- **Quality** — correct edge cases, clear module boundaries, durable seams, no "demo-only" hacks that will rot.
- **Thought** — prefer a deeper module with a small interface over a fat orchestrator that "just works."
- **Speed** — only as "don't expand scope." Never as "skip review, skip TDD, ship the shortest path."

Anti-patterns this forbids: growing a god-file to avoid design; sticky errors / race bugs left for the user to find; tests bolted on after without a seam; skipping review to close faster.

## The filter

Before asking any question, apply it:

> Would a different answer change **what I build now**, or **what I build it on**?

- Changes what I build now → **detail question**, ask it.
- Changes the foundation under it, or the *order* of the slices → **direction question**, ask it.
- Neither → **park it.** Write it to `PARKING.md` and move on. No follow-up, no "and how would that work?", no clarifying its edges.

Never ask what the filesystem can answer. Read the repo first.

## Question budget

Spend deliberately. State when you stop and what you parked.

| | Direction | Detail |
|---|---|---|
| Slice 1 (nothing is constrained yet) | ~8 | ~4 |
| Slice 2+ (direction is settled) | 0–2 | ≤5 |

Slice 1 is question-heavy on purpose: every answer is load-bearing on every future slice. Slices 2+ re-open direction **only** when a parked item or a user remark contradicts the recorded direction in `OVERVIEW.md`.

Ask **one question at a time, in plain text, each with your recommended answer.** Never batch. Answers will wander — a question about routing draws out a thought about billing. Catch the tangent, park it verbatim, and return to the question. Do not chase it.

If an interview question stalls — nobody can answer in words whether a state model feels right — reach for `/prototype` instead of asking a fifth variant of it.

## The loop

`/slicer` detects its phase from `docs/state/`. Arguments are hints, not modes: `park <thing>` (record and stop), `status` (report and stop), `next <idea>` (bias the next slice pick).

### Phase 0 — Bootstrap (no `docs/state/`)

**Empty or near-empty repo (greenfield).** Run the direction pass: destination, users, platform, persistence, auth/multi-user, deployment target, hard constraints, non-goals. Budget above. Write `OVERVIEW.md` with a **Direction** section — later slices check against it instead of re-asking.

**Existing codebase (brownfield).** Explore *first* — parallel `Explore` subagents if the repo is large — and read `CONTEXT.md`, `docs/adr/`, and any domain glossary if present. Write `OVERVIEW.md` describing what exists **today**. Then run a direction pass scoped to the *feature only*: destination, non-goals, constraints. Skip every question the code already answers.

Then go to Phase 1.

### Phase 1 — Pick the slice

**Slice 1 is always a walking skeleton**: the thinnest end-to-end path through every layer the direction pass chose — one real route, one real read and write against the real persistence, running locally. It delivers no feature value. It executes every architectural assumption on day one, which is the point.

**Slices 2+ are picked risk-first**, in this order:

> foundation-risk > core value loop > breadth > polish

Whatever is most likely to invalidate the direction goes next. Score parking against those tiers, prune what the last slice made obsolete or already delivered, and open the interview by proposing the **top 3 candidates with a recommended pick**. The user confirms or overrides — that is the steering wheel.

### Phase 2 — Interview

Ask only what the chosen slice needs, under the budget, through the filter. Park the rest as you go.

### Phase 3 — Pre-build gate

Write `NEXT.md` and show it inline, compact: **Now → After**, the plan, the acceptance check, *seams under test*, and *what got parked this session*. Confirm the seams with the user (or accept their override). Then ask once: **build it?**

The parked list matters here — it is the user's chance to promote something that looks mis-ranked before any code exists.

### Phase 4 — Build

Implement the slice to the quality bar above.

1. **Seams first.** List the public interfaces under test in `NEXT.md`. Prefer existing seams to new ones; the fewer seams, the better — but do not skip a seam to go faster.
2. **`/tdd` on those seams** — red → green, one slice of behavior at a time. Pure domain rules always get tests. Wiring (screens, deploy glue) may stay lightly tested if the seam above them is solid.
3. **Shape the modules.** Put new behaviour behind a small interface; do not pile orchestration into an existing fat file when a deeper module would clarify the design.
4. Typecheck and run the relevant tests as you go; full suite before demo.
5. **Self-review before demo, and write down what you found.** Races, sticky errors, empty-queue / offline paths, failed deploys, hydration gaps. Fix what you find; do not leave "the user will notice" as the QA plan. Keep the running list in `NEXT.md` under **`## Edge paths`** — surface, non-happy state, what happens in it — so the board shows the review while the slice is still open; it moves into the archive's `### Edge paths` at close. An unwritten review is indistinguishable from no review, and this is the one part of the process nothing else records.
6. **Keep the map current while building.** Whenever behaviour lands (new/changed modules, routes, or Edge paths), update `LOGIC.md` / `FLOWS.md` to match **today’s code**, then run **`npm run delta`** — it reports which mapped pieces the working tree actually moved, which flows run through them, and what `NEXT.md` says each change is for. A piece it cannot explain is either a gap in the plan or a row `LOGIC.md` owes. Regenerate the published board (`npm run board`) and **open it** for the user when the *map* changed. The current slice is a separate page (`npm run board -- --slice-page`, served at `/slice.html`); the published board does not carry it (D-055).

Do not build anything in `NEXT.md`'s out-of-scope list, however tempting or however small.

### Phase 4b — Re-scope or abandon

A slice that turns out bigger than its `NEXT.md`, or one the user rejects at the demo gate, is a normal event — not a reason to keep building past the plan. Cutting scope mid-slice is the loop working.

- **Too big** — cut `NEXT.md` down to the part that still proves the claim on its own, move the rest into `PARKING.md` **verbatim** with the tier it now deserves, and say what moved. Do not carry a half-built path forward as a "known gap"; either it is in this slice's plan or it is parked.
- **Rejected at the demo gate** — ask what is wrong before touching code, then either fix inside the current scope (still slice N) or park the whole approach and pick again from Phase 1. Do not close a slice the user said no to.
- **Abandoned** — leave `main` alone; delete the branch or leave it unmerged, and record what was learned in `PARKING.md` so the next pick is not the same mistake. Nothing is archived: an archive describes shipped behaviour.

**Resuming a half-built slice** (new session, lost context): `NEXT.md` names the slice, `git status` and the branch say how far it got, and `/slice.html` (or the PR's slice board) renders both. Read those three before writing code — re-deriving the plan from the diff is how scope grows silently.

### Phase 5 — Demo gate

Run it. Tell the user the **exact command or URL** to see it working. Wait for their yes.

**Capture the run.** Before the board refresh, record what this slice made visible into `docs/state/shots/`. Two kinds, and the slice decides which:

- **A clip per flow — `shots/flows/<F-id>.webm`.** Every flow in `FLOWS.md` a browser can drive gets its own short clip, rendered beside that flow's entry on the board. These document the **current system**, not a slice: they are named by flow id and overwritten in place when the flow's behaviour changes, exactly like the `F-` entry above them. Re-record the flows this slice touched at the demo gate. A flow that cannot be driven — needs a second device, a backgrounded app, no surface of its own — is named and explained in the capture script rather than silently absent.

  Keep each one short: it starts at the state its own trigger assumes, not at app launch. Seed that state in a context that is **not** being recorded and hand the recording context a storage snapshot, or every clip opens on a minute of setup. Give each flow its own fixture too — sharing one leaves the clips coupled to the order they were recorded in.

- **A clip — `NNNN-<slug>.webm` — for a slice-level walkthrough** that no single flow covers (a path crossing several flows, or one whose point is what survives a restart). Optional, and skip it when the flow clips already carry the slice. Under ~40s.

  **Show the pointer.** Screen recorders capture the page, not the OS cursor, so a raw clip shows things changing with nothing visibly touching them and the viewer has to infer every interaction. Draw the pointer into the page: a dot that tracks it, a visible press state, and a ripple where each tap lands — in a colour that survives landing on a filled button, and `pointer-events: none` so it never eats the click it is drawing. Move the pointer *to* a target in steps rather than teleporting, hold each press for a beat, and type key by key: an instant `click()` and an instant `fill()` read as things happening by themselves.
- **A still — `NNNN-<slug>.png` — for a surface.** A layout, an empty state, a before/after pair worth freezing. Cheap, so take the two or three that carry the slice; ~900px wide.

**This repo's two capture commands.** `npm run capture` drives the web target through the flows (`npm run web` serving first; pass flow ids to re-record only those, and `--url` if the dev server is not on 8081). `npm run capture:board` still-shoots the board itself for a slice that changed it (`npm run board:serve` first); it names the stills after the slice `NEXT.md` is on. Both are committed and repeatable — that is the bar, and an ad-hoc run you cannot repeat next slice does not clear it.

Drive it with whatever the project's own run path gives you: a committed capture script if the repo has one (write one the first time — an ad-hoc run you cannot repeat next slice is not evidence, it is a memory), `/run`, the web target under a headless browser, or a simulator recording. **Have the capture script assert, not just record** — that the console stayed clean, that state survives a reload — so a broken run fails loudly instead of producing a nice video of a bug.

This is the only record of what the app *does* — the map is all prose, and a table has never caught a broken layout or a flow that dead-ends. Both kinds live in git forever, so a clip is worth its ~1MB only when it shows a flow; do not record video of a static screen. If the slice is genuinely uncapturable (no UI, headless-only, capture tooling missing), say so in one line in the archive's `### Shots` block rather than skipping in silence.

Then ensure `docs/slicer.html` reflects the build — regenerate + open, which now picks up both.

This pause is where parked items get re-prioritized against what the user just saw. Do not commit and do not start the next interview before it.

### Phase 6 — Close

1. **Gates green** — `npm run check` (tests, typecheck, board tooling tests, state audit). The audit reads `docs/state/` against the code and against git: dangling ids, paths that moved, captures the board would silently drop, flow clips older than the flow they document. It prints *notes* (history, orphans) without failing; a **finding** fails and has to be fixed, not explained. The gates are the demo gate and this close, never each commit.
2. `/code-review` on every slice — **this repo's copy**, `.claude/skills/code-review/`, which reviews on three axes: the `AGENTS.md` invariants, `NEXT.md` as the spec (its *Out of scope* list included), and the quality bar as the standard. **Write the result into the archive's `### Review` block** — one bullet per finding, what you did about it, including the ones you accepted and why. Foundation-risk and sync/auth slices get a stricter pass; still run a real review on core-value slices — do not skip for speed. A review nothing records is a review nobody can tell from a skipped one, which is the same argument the Edge paths block already makes.
3. Rewrite `OVERVIEW.md` to describe the app **as it now stands**. Keep it bounded — roughly a page per area. It is a current-state document, not a history.
4. Update **`LOGIC.md`** and **`FLOWS.md`** so they describe the app **as it stands** after this slice (add/change `L-` / `F-` entries; remove obsolete ones).
5. Archive the slice to `docs/state/slices/NNNN-<name>.md`, including a filled **`## Report`** block: headline, highlights, Now→After, **logic delta**, **flow delta**, **edge paths**, **shots**, surfaces, decisions, diff pulse from `git show --stat`. See [templates.md](references/templates.md).
6. Append any decisions made to `DECISIONS.md` as `D-NNN`, one line each, naming the slice that made them.
7. Groom `PARKING.md`: prune delivered or obsolete items, re-score tiers.
8. Re-run `npm run check` — the doc edits above are exactly what the audit reads.
9. Regenerate the board (`npm run board`) — see [references/board.md](references/board.md). It must show **Overview**, **Symbols**, **Flows**, and **Steering**. The current slice is `/slice.html`, not a tab. **Open the board** for the user.
10. **Squash the slice to one commit and tag it** (see Git) — the tag is part of closing, not an afterthought: `npm run audit` fails on an archive whose claimed tag does not exist. Then reset `NEXT.md` to the no-slice-picked stub, so the board stops presenting a closed slice as the one in flight. Commit freely while building — work in progress is the point of a slice — then collapse it at close so history reads one line per slice.

Then back to Phase 1.

## Board open (mandatory)

After every regenerate of `docs/slicer.html` during a `/slicer` session:

1. Open the board for the user in the IDE browser, served by `npm run board:serve` → `http://127.0.0.1:8777/slicer.html` (side panel when they want it visible). That command regenerates before it serves. Serve it, never `file://`: the helper is what makes a path chip open the file in the **running** editor window (`cursor -r -g`), including inside the IDE's own browser.
2. Tell them briefly what refreshed (e.g. “Board updated — logic map + flows; newest closed slice still 0003”).
3. Do this at: end of a build chunk that changed the map, demo gate, and slice close. Skipping the open is a process bug.

The current slice is **not** on the published board. Locally it is `/slice.html` (`npm run board -- --slice-page`); CI generates the same page per PR and comments the URL (D-055). `npm run delta` is the same attribution as text.

The **published** board is https://santistebanc.github.io/splitnext-app/ — regenerated from `docs/state/` by CI on every merge to `main`, so it always shows the system as it stands, never the slice in flight. During a session use the local server: it is the only copy whose path chips open files in the editor.

## State

`docs/state/` is the truth. Templates: [references/templates.md](references/templates.md).

```
docs/state/
  OVERVIEW.md    # where we stand — direction, capabilities, stack, model, routes, seams
  LOGIC.md       # catalogue of behaviour pieces (L- ids) — board current-system map
  FLOWS.md       # end-to-end flows citing L- ids — board current-system flows
  NEXT.md        # the next slice as a delta — Now → After, plan, acceptance, out of scope
  PARKING.md     # deferred items — verbatim phrasing, area, tier, slice raised
  DECISIONS.md   # append-only D-001…
  shots/0007-hub.png            # demo-gate stills; the board embeds them
  shots/flows/F-add-expense.webm  # one clip per drivable flow, keyed by F- id
  slices/0007-auth-session.md   # archive; never loaded unless asked for
docs/slicer.html # generated living page — gitignored; regenerate, never edit
docs/slice.html  # per-PR slice page — also gitignored; `npm run board -- --slice-page`
```

**At session start, read `OVERVIEW.md`, `NEXT.md`, `PARKING.md`, and skim `LOGIC.md` / `FLOWS.md` if the work touches sync or routes.** The archive stays closed unless you are closing a slice or answering a history question.

If the repo has its own issue tracker convention, mirror slices into it, but `docs/state/` remains the source of truth for the loop.

## Git — PR per slice (this repo)

This repo has a remote and CI, so a slice is a branch, a PR, and one squashed commit on `main` carrying a tag. Build commits stay on the branch; `main` reads one line per slice.

**Open the slice** — at the start of Phase 4, off current `main`:

```
git checkout main && git pull
git checkout -b slice/0008-invites
```

Commit freely on that branch while building.

**`main` is one commit per slice — a rule you keep, not one the repo keeps for you.** Squash is the only merge method (merge commits and rebase merges are off), linear history is required, a PR is required before merging, and the squashed commit takes the **PR title and PR body** — not the concatenated build commits. But squash-only enforces one commit per *pull request*: a slice split across three PRs is three commits on `main`, every gate green, and `git revert <slice>` stops meaning anything. **So a slice opens exactly one PR.** If the work outgrows it, re-scope the slice (Phase 4b) rather than opening a second PR under the same number. `npm run audit` reports a slice that landed as more than one commit — after the fact, which is the only moment left.

The PR body is the commit message: write it as one, carrying the headline and the `D-NNN` decisions, exactly as the archive describes them.

**Close the slice** — at Phase 6, after the board is regenerated and everything is green:

```
git push -u origin slice/0008-invites
gh pr create --title "slice(0008): invites" --body-file <(…headline + decisions…)
# CI must be green: npm test + npm run typecheck
gh pr merge --squash --delete-branch      # squash → one commit on main
git checkout main && git pull
git tag -a slice-0008 -m "Slice 0008 — invites"
git push origin slice-0008
```

The archive carries the detail; the squashed commit carries the headline and the decisions, from the PR body. Each slice stays independently revertable, bisectable and addressable as `slice-NNNN` — and the tag lands on `main` **after** the merge, on the squashed commit, never on the branch.

Never `--merge` or `--rebase` a slice PR, and never push to `main` directly: one slice must stay one commit, or `git log main` stops being the list of slices and `git revert <slice>` stops being a whole slice.

Merging `main` deploys `docs/slicer.html` to GitHub Pages. The slice page for a PR is generated by CI on that PR (D-055), not by the merge.

**Never put a commit sha in the archive** — the archive is inside the commit, so writing its own hash is impossible to keep true across an amend or a squash. Reference the **tag** instead.

**`docs/slicer.html` and `docs/slice.html` are not committed.** They are renders of `docs/state/`, so a tracked copy only ever produced rebase conflicts and stale boards. They are gitignored, rebuilt locally by `npm run board` / `npm run board:serve`, and rebuilt by CI — the map for Pages, the slice page for each PR.

Commit freely inside a slice; the squash happens at the merge.

**Slices 0001–0007 predate this** — they were committed straight to `master` and tagged there. The tags are still the addressable unit; only the route to `main` changed.
